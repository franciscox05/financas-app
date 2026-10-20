-- Migra as dívidas antigas (debts + debt_payments) para friends + ledger_entries.
-- Não apaga nada: a tabela debts fica intacta durante uma versão.

-- 1. Um amigo (local) por utilizador e nome normalizado
insert into public.friends (owner_id, name)
select user_id, (array_agg(btrim(counterparty_name) order by created_at))[1]
from public.debts
group by user_id, lower(btrim(counterparty_name))
on conflict do nothing;

-- 2. Cada dívida passa a um movimento
insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, due_on, transaction_id, created_at)
select d.user_id, f.id,
       case d.direction when 'owed_to_me' then 'paid_for_them' else 'paid_for_me' end,
       d.amount, d.note, d.created_at::date, d.due_on, d.transaction_id, d.created_at
from public.debts d
join public.friends f
  on f.owner_id = d.user_id and lower(btrim(f.name)) = lower(btrim(d.counterparty_name));

-- 3. Cada pagamento passa a devolução por banco, mantendo a transação
insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, settlement, transaction_id, created_at)
select p.user_id, f.id,
       case d.direction when 'owed_to_me' then 'repaid_to_me' else 'repaid_to_them' end,
       p.amount, p.note, p.paid_on, 'bank', p.transaction_id, p.created_at
from public.debt_payments p
join public.debts d on d.id = p.debt_id
join public.friends f
  on f.owner_id = d.user_id and lower(btrim(f.name)) = lower(btrim(d.counterparty_name));

-- 4. Dívidas fechadas: devolução pelo valor em falta (banco se havia transação de fecho, senão offset)
insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, settlement, transaction_id, created_at)
select d.user_id, f.id,
       case d.direction when 'owed_to_me' then 'repaid_to_me' else 'repaid_to_them' end,
       d.amount - coalesce(p.paid, 0),
       d.settled_note,
       coalesce(d.settled_at, d.created_at)::date,
       case when d.settled_transaction_id is not null then 'bank' else 'offset' end,
       d.settled_transaction_id,
       coalesce(d.settled_at, d.created_at)
from public.debts d
join public.friends f
  on f.owner_id = d.user_id and lower(btrim(f.name)) = lower(btrim(d.counterparty_name))
left join lateral (
  select sum(amount) as paid from public.debt_payments where debt_id = d.id
) p on true
where d.status = 'settled'
  and d.amount - coalesce(p.paid, 0) > 0;
