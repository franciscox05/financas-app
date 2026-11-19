-- S1-1 (auditoria 2026-11-15): a regra "que entradas contam para o saldo" estava
-- em três sítios e dois estavam desatualizados. A regra atual é a de
-- entryCounts() em src/lib/ledgerMath.js e da vista `movements`:
--   confirmed         -> conta
--   cancel_requested  -> conta, exceto para quem pediu a anulação
--   pending/declined  -> conta só para quem criou a entrada
--   outros            -> não conta
-- Antes, `friend_balances` e o gatilho _hide_settled_ledger_entries ignoravam
-- `declined` e contavam `cancel_requested` para os dois lados.
-- Esta migração põe a regra numa função e usa-a na vista e no gatilho.
-- Só redefine objetos (create or replace); não altera linhas nem colunas.
-- A vista `movements` já está certa e não é tocada.

create or replace function public.ledger_entry_counts(
  p_status text,
  p_cancel_requested_by uuid,
  p_created_by uuid,
  p_user_id uuid
) returns boolean
language sql
immutable
as $$
  select case p_status
    when 'confirmed' then true
    when 'cancel_requested' then p_cancel_requested_by is distinct from p_user_id
    when 'pending' then p_created_by = p_user_id
    when 'declined' then p_created_by = p_user_id
    else false
  end
$$;

-- Mesmas colunas e permissões que antes (create or replace mantém os grants).
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
where public.ledger_entry_counts(status, cancel_requested_by, created_by, user_id)
group by friend_id, user_id;

-- Gatilho: o saldo "quites" passa a usar a mesma regra. O que se esconde do
-- Registo continua a ser só confirmed/cancel_requested (como antes).
create or replace function public._hide_settled_ledger_entries() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cents bigint;
begin
  select coalesce(sum(round(amount * 100) * case kind
           when 'paid_for_them' then 1 when 'repaid_to_them' then 1 else -1 end), 0)::bigint
    into v_cents
    from public.ledger_entries
   where user_id = new.user_id and friend_id = new.friend_id
     and public.ledger_entry_counts(status, cancel_requested_by, created_by, user_id);

  -- Só quando o saldo fica exatamente a zero (quites) — uma devolução que
  -- passe para o lado contrário (overshoot sem "perdão da diferença") não
  -- fecha nada, fica tudo visível como dívida em aberto na direção inversa.
  if v_cents = 0 then
    update public.ledger_entries
       set hidden_from_feed = true
     where user_id = new.user_id and friend_id = new.friend_id
       and status in ('confirmed', 'cancel_requested')
       and hidden_from_feed = false
       and id <> new.id;
  end if;
  return null;
end $$;
