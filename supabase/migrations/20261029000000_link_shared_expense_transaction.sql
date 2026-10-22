-- Bug reportado: um gasto partilhado (QuickEntryForm, amigo ligado) cria uma
-- transação bancária e um movimento pendente, mas sem nenhuma ligação entre
-- os dois — apagar a transação não tocava no pedido, que o amigo continuava
-- a poder aceitar depois (dinheiro "fantasma": a transação já não existe,
-- mas o movimento continua a contar). create_shared_entry passa agora a
-- aceitar o id da transação e a guardá-lo só do lado de quem a criou (o
-- amigo nunca tem essa transação na conta dele).

drop function if exists public.create_shared_entry(uuid, text, numeric, text, date, date, text, uuid, uuid);

create function public.create_shared_entry(
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
  return v_own;
end $$;

revoke all on function public.create_shared_entry(uuid, text, numeric, text, date, date, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.create_shared_entry(uuid, text, numeric, text, date, date, text, uuid, uuid, uuid) to authenticated;
