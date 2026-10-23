-- Continuação da 20261104000000: a view `movements` (lista do Registo) tem
-- de mostrar uma transferência "conta como gasto" com categoria, como um
-- gasto normal, em vez do estilo neutro de transferência — senão o Registo
-- não refletia a mudança.

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
  false as counts_as_expense,
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
  case when tr.counts_as_expense then 'expense' else 'transfer' end as type,
  tr.amount,
  tr.from_account_id as account_id,
  fa.name as account_name,
  tr.to_account_id as counter_account_id,
  ta.name as counter_account_name,
  tr.category_id,
  tc.name as category_name,
  tr.counts_as_expense,
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
left join public.categories tc on tc.id = tr.category_id
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
  false as counts_as_expense,
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
