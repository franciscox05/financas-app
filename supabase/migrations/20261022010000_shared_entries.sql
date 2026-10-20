-- Movimentos partilhados entre amigos ligados: cada lado tem a sua linha, ligadas por mirror_id.
-- Estados: confirmed | pending | declined | cancelled | archived | cancel_requested.
-- Contam no saldo só confirmed e cancel_requested. Toda a escrita entre utilizadores passa
-- pelas funções abaixo (security definer); os triggers impedem o cliente de contornar.

alter table public.ledger_entries
  add column status text not null default 'confirmed'
    check (status in ('confirmed', 'pending', 'declined', 'cancelled', 'archived', 'cancel_requested')),
  add column mirror_id uuid references public.ledger_entries (id) on delete set null,
  add column created_by uuid references auth.users (id) on delete set null,
  add column decline_note text,
  add column cancel_requested_by uuid references auth.users (id) on delete set null,
  add column bank_account_id uuid references public.accounts (id) on delete set null,
  add column bank_category_id uuid references public.categories (id) on delete set null,
  add column is_opening boolean not null default false;

create index ledger_entries_mirror_idx on public.ledger_entries (mirror_id);

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
group by friend_id, user_id;

-- Guarda: o cliente (authenticated/anon) não escreve campos de partilha nem toca em movimentos
-- partilhados. As funções security definer correm como dono da função e passam.
create function public.ledger_entries_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if exists (select 1 from public.friends where id = new.friend_id and status = 'connected') then
      raise exception 'Com um amigo ligado, os movimentos são partilhados e têm de ser confirmados.';
    end if;
    if new.status <> 'confirmed' or new.mirror_id is not null or new.created_by is not null
       or new.decline_note is not null or new.cancel_requested_by is not null
       or new.bank_account_id is not null or new.bank_category_id is not null or new.is_opening then
      raise exception 'Operação não permitida.';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.mirror_id is not null or old.status <> 'confirmed' and old.status <> 'archived' then
      raise exception 'Este movimento é partilhado: usa os botões do movimento.';
    end if;
    if new.status is distinct from old.status or new.mirror_id is distinct from old.mirror_id
       or new.created_by is distinct from old.created_by or new.decline_note is distinct from old.decline_note
       or new.cancel_requested_by is distinct from old.cancel_requested_by
       or new.bank_account_id is distinct from old.bank_account_id
       or new.bank_category_id is distinct from old.bank_category_id
       or new.is_opening is distinct from old.is_opening
       or new.user_id is distinct from old.user_id or new.friend_id is distinct from old.friend_id then
      raise exception 'Operação não permitida.';
    end if;
    return new;
  else
    if old.mirror_id is not null then
      raise exception 'Este movimento é partilhado: usa os botões do movimento.';
    end if;
    return old;
  end if;
end $$;

create trigger ledger_entries_guard
  before insert or update or delete on public.ledger_entries
  for each row execute function public.ledger_entries_guard();

-- Guarda dos contactos: o cliente não se liga a ninguém nem apaga um contacto ligado.
create function public.friends_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'local' or new.linked_user_id is not null then
      raise exception 'Operação não permitida.';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status or new.linked_user_id is distinct from old.linked_user_id
       or new.owner_id is distinct from old.owner_id then
      raise exception 'Operação não permitida.';
    end if;
    return new;
  else
    if old.status <> 'local' then
      raise exception 'Este amigo tem uma ligação ativa e não pode ser apagado nesta versão.';
    end if;
    return old;
  end if;
end $$;

create trigger friends_guard
  before insert or update or delete on public.friends
  for each row execute function public.friends_guard();

-- ---------------------------------------------------------------------------
-- Funções privadas

create function public._invert_kind(p_kind text) returns text
language sql immutable as $$
  select case p_kind
    when 'paid_for_them' then 'paid_for_me'
    when 'paid_for_me' then 'paid_for_them'
    when 'repaid_to_me' then 'repaid_to_them'
    else 'repaid_to_me'
  end
$$;

-- Bloqueia a linha e o seu par por ordem de id (evita deadlocks entre os dois utilizadores).
create function public._lock_pair(p_id uuid, p_uid uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  v_mirror uuid;
begin
  select mirror_id into v_mirror from public.ledger_entries where id = p_id and user_id = p_uid;
  if not found or v_mirror is null then raise exception 'Movimento não encontrado.'; end if;
  perform 1 from public.ledger_entries where id in (p_id, v_mirror) order by id for update;
end $$;

-- Cria a transação bancária de uma linha confirmada e guarda o seu id.
create function public._create_bank_transaction(p_entry_id uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  r public.ledger_entries%rowtype;
  v_name text;
  v_tx uuid;
begin
  select * into r from public.ledger_entries where id = p_entry_id;
  if r.settlement is distinct from 'bank' or r.transaction_id is not null then return; end if;
  -- A conta ou a categoria escolhida pode ter sido apagada entretanto: confirma-se na mesma o
  -- movimento, só não há transação (a conta-corrente não depende dela).
  if not exists (select 1 from public.accounts where id = r.bank_account_id and user_id = r.user_id)
     or not exists (select 1 from public.categories where id = r.bank_category_id and user_id = r.user_id) then
    return;
  end if;
  select name into v_name from public.friends where id = r.friend_id;
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note)
  values (r.user_id, r.bank_account_id, r.bank_category_id, r.amount,
          case r.kind when 'repaid_to_me' then 'income' else 'expense' end,
          r.occurred_on,
          'Conta-corrente: ' || v_name || coalesce(' · ' || nullif(btrim(r.note), ''), ''))
  returning id into v_tx;
  update public.ledger_entries set transaction_id = v_tx where id = p_entry_id;
end $$;

create function public._check_bank_choice(p_uid uuid, p_account uuid, p_category uuid) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_account is null or p_category is null then raise exception 'Escolhe a conta e a categoria.'; end if;
  if not exists (select 1 from public.accounts where id = p_account and user_id = p_uid)
     or not exists (select 1 from public.categories where id = p_category and user_id = p_uid) then
    raise exception 'Escolhe a conta e a categoria.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Funções públicas

create function public.create_shared_entry(
  p_friend_id uuid, p_kind text, p_amount numeric, p_note text, p_occurred_on date,
  p_due_on date, p_settlement text, p_account_id uuid, p_category_id uuid
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
  v_repaid boolean;
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
  v_repaid := p_kind in ('repaid_to_me', 'repaid_to_them');
  if v_repaid then
    if p_settlement is null or p_settlement not in ('bank', 'cash', 'offset') then raise exception 'Escolhe como foi pago.'; end if;
    if p_settlement = 'bank' then perform public._check_bank_choice(uid, p_account_id, p_category_id); end if;
  elsif p_settlement is not null then
    raise exception 'Operação não permitida.';
  end if;

  insert into public.ledger_entries
    (user_id, friend_id, kind, amount, note, occurred_on, due_on, settlement, status, created_by,
     bank_account_id, bank_category_id)
  values
    (uid, p_friend_id, p_kind, p_amount, p_note, coalesce(p_occurred_on, current_date), p_due_on,
     p_settlement, 'pending', uid,
     case when p_settlement = 'bank' then p_account_id end,
     case when p_settlement = 'bank' then p_category_id end)
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

create function public.respond_entry(
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
    update public.ledger_entries set status = 'cancelled' where id = e.id;
    update public.ledger_entries set status = 'declined', decline_note = nullif(btrim(p_note), '') where id = m.id;
    if m.is_opening then
      update public.ledger_entries set status = 'confirmed'
       where user_id = m.user_id and friend_id = m.friend_id and status = 'archived';
    end if;
  end if;
end $$;

create function public.cancel_pending_entry(p_id uuid) returns void
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
  if e.is_opening then
    update public.ledger_entries set status = 'confirmed'
     where user_id = e.user_id and friend_id = e.friend_id and status = 'archived';
  end if;
end $$;

create function public.request_cancel(p_id uuid) returns void
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
  if e.status <> 'confirmed' then raise exception 'Só podes pedir a anulação de um movimento já confirmado.'; end if;
  if e.is_opening then raise exception 'O saldo anterior não se anula: lança um movimento novo.'; end if;
  update public.ledger_entries set status = 'cancel_requested', cancel_requested_by = uid
   where id in (e.id, e.mirror_id);
end $$;

create function public.respond_cancel(p_id uuid, p_accept boolean) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.ledger_entries%rowtype;
  r public.ledger_entries%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  perform public._lock_pair(p_id, uid);
  select * into e from public.ledger_entries where id = p_id;
  if e.status <> 'cancel_requested' then raise exception 'Não há nenhum pedido de anulação para este movimento.'; end if;
  if e.cancel_requested_by = uid then raise exception 'Só a outra pessoa pode responder.'; end if;

  if p_accept then
    for r in select * from public.ledger_entries where id in (e.id, e.mirror_id) loop
      if r.transaction_id is not null then
        delete from public.transactions where id = r.transaction_id;
      end if;
    end loop;
    update public.ledger_entries set status = 'cancelled', transaction_id = null where id in (e.id, e.mirror_id);
  else
    update public.ledger_entries set status = 'confirmed', cancel_requested_by = null
     where id in (e.id, e.mirror_id);
  end if;
end $$;

revoke all on function public._invert_kind(text) from public, anon, authenticated;
revoke all on function public._lock_pair(uuid, uuid) from public, anon, authenticated;
revoke all on function public._create_bank_transaction(uuid) from public, anon, authenticated;
revoke all on function public._check_bank_choice(uuid, uuid, uuid) from public, anon, authenticated;

revoke all on function public.create_shared_entry(uuid, text, numeric, text, date, date, text, uuid, uuid) from public, anon;
revoke all on function public.respond_entry(uuid, boolean, text, text, uuid, uuid) from public, anon;
revoke all on function public.cancel_pending_entry(uuid) from public, anon;
revoke all on function public.request_cancel(uuid) from public, anon;
revoke all on function public.respond_cancel(uuid, boolean) from public, anon;
grant execute on function public.create_shared_entry(uuid, text, numeric, text, date, date, text, uuid, uuid) to authenticated;
grant execute on function public.respond_entry(uuid, boolean, text, text, uuid, uuid) to authenticated;
grant execute on function public.cancel_pending_entry(uuid) to authenticated;
grant execute on function public.request_cancel(uuid) to authenticated;
grant execute on function public.respond_cancel(uuid, boolean) to authenticated;

-- Se a conta ligada desaparece (utilizador apagado: linked_user_id passa a nulo), o contacto volta
-- a local e os movimentos que dependiam da outra pessoa ficam resolvidos:
-- pendentes cancelados (com o saldo anterior a voltar a contar) e anulações pedidas a confirmed.
create function public.friends_unlinked() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.ledger_entries
              where user_id = new.owner_id and friend_id = new.id and status = 'pending' and is_opening) then
    update public.ledger_entries set status = 'confirmed'
     where user_id = new.owner_id and friend_id = new.id and status = 'archived';
  end if;
  -- mirror_id = null: a linha do outro lado pode já estar a ser apagada em cascata.
  update public.ledger_entries set status = 'cancelled', mirror_id = null
   where user_id = new.owner_id and friend_id = new.id and status = 'pending';
  update public.ledger_entries set status = 'confirmed', cancel_requested_by = null, mirror_id = null
   where user_id = new.owner_id and friend_id = new.id and status = 'cancel_requested';
  update public.friends set status = 'local' where id = new.id and status <> 'local';
  return null;
end $$;

create trigger friends_unlinked
  after update of linked_user_id on public.friends
  for each row
  when (old.linked_user_id is not null and new.linked_user_id is null)
  execute function public.friends_unlinked();
