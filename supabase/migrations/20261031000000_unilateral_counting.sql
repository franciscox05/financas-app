-- A pedido do Francisco: quem cria um movimento partilhado (gasto ou devolução)
-- já o vê contar no seu próprio saldo de imediato — só o saldo da OUTRA pessoa
-- continua a depender da confirmação dela. Antes, os dois lados ficavam a zero
-- até ao aceite mútuo, obrigando a esperar pelo amigo para a própria conta
-- ficar certa.
--
-- Desenho: o status continua exatamente igual (fica 'pending' até ao aceite —
-- nada muda em canRespond/canRequestCancel/decline/cancel), só o CÁLCULO DO
-- SALDO passa a contar também 'pending' quando created_by = o dono da linha.
-- Isto é seguro porque cada pessoa só vê e soma as suas próprias linhas (RLS);
-- nunca força o saldo de ninguém, só liberta o próprio de depender do outro.
--
-- Como a devolução passa a contar logo do lado de quem a envia, a transação
-- bancária dela (quando settlement='bank') também passa a ser criada na
-- hora, em vez de esperar pelo aceite — por isso cancelar/recusar agora tem
-- de desfazer essa transação se ela já tiver sido criada.

create or replace view public.friend_balances with (security_invoker = true) as
select
  friend_id,
  user_id,
  sum(case kind
    when 'paid_for_them' then amount
    when 'repaid_to_them' then amount
    else -amount
  end) as balance
from public.ledger_entries
where status in ('confirmed', 'cancel_requested')
   or (status = 'pending' and created_by = user_id)
group by friend_id, user_id;

create or replace function public.create_shared_entry(
  p_friend_id uuid, p_kind text, p_amount numeric, p_note text, p_occurred_on date,
  p_due_on date, p_settlement text, p_account_id uuid, p_category_id uuid,
  p_transaction_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  f public.friends%rowtype;
  v_other_friend uuid;
  v_own uuid;
  v_mirror uuid;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into f from public.friends where id = p_friend_id and owner_id = uid;
  if not found then raise exception 'Amigo não encontrado.'; end if;
  if f.status <> 'connected' or f.linked_user_id is null then
    raise exception 'Este amigo ainda não está ligado.';
  end if;
  select id into v_other_friend from public.friends
   where owner_id = f.linked_user_id and linked_user_id = uid and status = 'connected';
  if v_other_friend is null then raise exception 'Este amigo ainda não está ligado.'; end if;

  if p_kind not in ('paid_for_them', 'paid_for_me', 'repaid_to_me', 'repaid_to_them') then
    raise exception 'Operação não permitida.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Escreve um valor maior que zero.'; end if;
  if p_transaction_id is not null
     and not exists (select 1 from public.transactions where id = p_transaction_id and user_id = uid) then
    raise exception 'Transação não encontrada.';
  end if;
  if p_kind in ('repaid_to_me', 'repaid_to_them') then
    if p_settlement is null or p_settlement not in ('bank', 'cash', 'offset') then raise exception 'Escolhe como foi pago.'; end if;
    if p_settlement = 'bank' then perform public._check_bank_choice(uid, p_account_id, p_category_id); end if;
  elsif p_settlement is not null then
    raise exception 'Operação não permitida.';
  end if;

  insert into public.ledger_entries
    (user_id, friend_id, kind, amount, note, occurred_on, due_on, settlement, status, created_by,
     bank_account_id, bank_category_id, transaction_id)
  values
    (uid, p_friend_id, p_kind, p_amount, p_note, coalesce(p_occurred_on, current_date), p_due_on,
     p_settlement, 'pending', uid,
     case when p_settlement = 'bank' then p_account_id end,
     case when p_settlement = 'bank' then p_category_id end,
     p_transaction_id)
  returning id into v_own;

  insert into public.ledger_entries
    (user_id, friend_id, kind, amount, note, occurred_on, status, created_by)
  values
    (f.linked_user_id, v_other_friend, public._invert_kind(p_kind), p_amount, p_note,
     coalesce(p_occurred_on, current_date), 'pending', uid)
  returning id into v_mirror;

  update public.ledger_entries set mirror_id = v_mirror where id = v_own;
  update public.ledger_entries set mirror_id = v_own where id = v_mirror;

  -- Conta já do lado de quem cria: numa devolução por banco, a transação é
  -- criada agora (não só quando o outro lado aceitar).
  if p_settlement = 'bank' then
    perform public._create_bank_transaction(v_own);
  end if;

  return v_own;
end $$;

revoke all on function public.create_shared_entry(uuid, text, numeric, text, date, date, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.create_shared_entry(uuid, text, numeric, text, date, date, text, uuid, uuid, uuid) to authenticated;

-- Desfaz a transação da própria linha se já tinha sido criada (devolução por banco).
create or replace function public.cancel_pending_entry(p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.ledger_entries%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  perform public._lock_pair(p_id, uid);
  select * into e from public.ledger_entries where id = p_id;
  if e.status <> 'pending' or e.created_by is distinct from uid then
    raise exception 'Só podes cancelar um movimento teu que ainda esteja por confirmar.';
  end if;
  update public.ledger_entries set status = 'cancelled' where id in (e.id, e.mirror_id);
  if e.transaction_id is not null then
    delete from public.transactions where id = e.transaction_id;
    update public.ledger_entries set transaction_id = null where id = e.id;
  end if;
  if e.is_opening then
    update public.ledger_entries set status = 'confirmed'
     where user_id = e.user_id and friend_id = e.friend_id and status = 'archived';
  end if;
end $$;

-- Recusar também desfaz a transação de quem pediu, se já tinha sido criada.
create or replace function public.respond_entry(
  p_id uuid, p_accept boolean, p_note text, p_settlement text, p_account_id uuid, p_category_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.ledger_entries%rowtype;
  m public.ledger_entries%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  perform public._lock_pair(p_id, uid);
  select * into e from public.ledger_entries where id = p_id;
  select * into m from public.ledger_entries where id = e.mirror_id;

  if e.status <> 'pending' then raise exception 'Este movimento já foi respondido.'; end if;
  if e.created_by is null or e.created_by = uid then raise exception 'Só a outra pessoa pode responder.'; end if;

  if p_accept then
    if e.kind in ('repaid_to_me', 'repaid_to_them') then
      if p_settlement is null or p_settlement not in ('bank', 'cash', 'offset') then raise exception 'Escolhe como foi pago.'; end if;
      if p_settlement = 'bank' then perform public._check_bank_choice(uid, p_account_id, p_category_id); end if;
      update public.ledger_entries
         set settlement = p_settlement,
             bank_account_id = case when p_settlement = 'bank' then p_account_id end,
             bank_category_id = case when p_settlement = 'bank' then p_category_id end
       where id = e.id;
    end if;
    update public.ledger_entries set status = 'confirmed' where id in (e.id, m.id);
    perform public._create_bank_transaction(e.id);
    perform public._create_bank_transaction(m.id);
  else
    if m.transaction_id is not null then
      delete from public.transactions where id = m.transaction_id;
    end if;
    update public.ledger_entries set status = 'cancelled' where id = e.id;
    update public.ledger_entries set status = 'declined', decline_note = nullif(btrim(p_note), ''), transaction_id = null where id = m.id;
    if m.is_opening then
      update public.ledger_entries set status = 'confirmed'
       where user_id = m.user_id and friend_id = m.friend_id and status = 'archived';
    end if;
  end if;
end $$;

revoke all on function public.cancel_pending_entry(uuid) from public, anon;
revoke all on function public.respond_entry(uuid, boolean, text, text, uuid, uuid) from public, anon;
grant execute on function public.cancel_pending_entry(uuid) to authenticated;
grant execute on function public.respond_entry(uuid, boolean, text, text, uuid, uuid) to authenticated;
