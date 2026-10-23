-- A pedido do Francisco (conversa com o Tiago, 2026-10-23/24): pedir a anulação de
-- um movimento partilhado ("quero apagar as coisas de teste... sem depender de
-- ninguém") continuava a mostrar a transação/linha no Registo de quem pediu até o
-- amigo responder, porque `movements` incluía cancel_requested sempre, para os
-- dois lados. Mesmo princípio já usado para pending/declined: quem agiu (aqui,
-- quem pediu a anulação) já não vê a linha contar nem aparecer, sem apagar nada a
-- sério — se o amigo recusar, volta a 'confirmed' e reaparece sozinho. O OUTRO
-- lado continua a ver e a contar até responder.

drop view if exists public.movements;

create view public.movements
with (security_invoker = true) as
select
  t.id,
  t.user_id,
  'transaction'::text as source,
  t.type,
  t.amount,
  t.account_id,
  a.name as account_name,
  null::uuid as counter_account_id,
  null::text as counter_account_name,
  t.category_id,
  c.name as category_name,
  t.note,
  t.occurred_on,
  t.created_at,
  null::uuid as friend_id,
  null::text as friend_name,
  null::text as ledger_status,
  null::text as ledger_kind
from public.transactions t
left join public.accounts a on a.id = t.account_id
left join public.categories c on c.id = t.category_id
where not exists (
  select 1 from public.ledger_entries le
  where le.transaction_id = t.id
    and le.status = 'cancel_requested'
    and le.cancel_requested_by = t.user_id
)
union all
select
  tr.id,
  tr.user_id,
  'transfer'::text as source,
  'transfer'::text as type,
  tr.amount,
  tr.from_account_id as account_id,
  fa.name as account_name,
  tr.to_account_id as counter_account_id,
  ta.name as counter_account_name,
  null::uuid as category_id,
  null::text as category_name,
  tr.note,
  tr.occurred_on,
  tr.created_at,
  null::uuid as friend_id,
  null::text as friend_name,
  null::text as ledger_status,
  null::text as ledger_kind
from public.transfers tr
left join public.accounts fa on fa.id = tr.from_account_id
left join public.accounts ta on ta.id = tr.to_account_id
union all
select
  e.id,
  e.user_id,
  'ledger'::text as source,
  case when (case e.kind
               when 'paid_for_them' then e.amount
               when 'repaid_to_them' then e.amount
               else -e.amount
             end) > 0 then 'income' else 'expense' end as type,
  abs(case e.kind
        when 'paid_for_them' then e.amount
        when 'repaid_to_them' then e.amount
        else -e.amount
      end) as amount,
  null::uuid as account_id,
  null::text as account_name,
  null::uuid as counter_account_id,
  null::text as counter_account_name,
  null::uuid as category_id,
  null::text as category_name,
  e.note,
  e.occurred_on,
  e.created_at,
  e.friend_id,
  f.name as friend_name,
  e.status as ledger_status,
  e.kind as ledger_kind
from public.ledger_entries e
join public.friends f on f.id = e.friend_id
where e.transaction_id is null
  and (
    e.status = 'confirmed'
    or (e.status = 'cancel_requested' and e.cancel_requested_by <> e.user_id)
    or (e.status in ('pending', 'declined') and e.created_by = e.user_id)
  );
