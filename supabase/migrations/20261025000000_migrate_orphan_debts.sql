-- Migra para friends + ledger_entries as dívidas gravadas na tabela legada `debts`
-- DEPOIS da migração 20261021010000 (o registo rápido continuou a escrever lá até à PR #21).
-- Idempotente: só copia linhas que ainda não têm movimento equivalente (mesmo utilizador,
-- tipo, valor e created_at, que a migração anterior preservou). Não apaga nada.

-- 1. Amigos (locais) que ainda não existem, por nome normalizado
insert into public.friends (owner_id, name)
select user_id, (array_agg(btrim(counterparty_name) order by created_at))[1]
from public.debts
group by user_id, lower(btrim(counterparty_name))
on conflict do nothing;

-- 2. Dívidas sem movimento equivalente
insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, due_on, transaction_id, created_at)
select d.user_id, f.id,
       case d.direction when 'owed_to_me' then 'paid_for_them' else 'paid_for_me' end,
       d.amount, d.note, d.created_at::date, d.due_on, d.transaction_id, d.created_at
from public.debts d
join public.friends f
  on f.owner_id = d.user_id and lower(btrim(f.name)) = lower(btrim(d.counterparty_name))
where not exists (
  select 1 from public.ledger_entries e
  where e.user_id = d.user_id and e.friend_id = f.id
    and e.kind = case d.direction when 'owed_to_me' then 'paid_for_them' else 'paid_for_me' end
    and e.amount = d.amount and e.created_at = d.created_at
);

-- 3. Pagamentos sem movimento equivalente
insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, settlement, transaction_id, created_at)
select p.user_id, f.id,
       case d.direction when 'owed_to_me' then 'repaid_to_me' else 'repaid_to_them' end,
       p.amount, p.note, p.paid_on, 'bank', p.transaction_id, p.created_at
from public.debt_payments p
join public.debts d on d.id = p.debt_id
join public.friends f
  on f.owner_id = d.user_id and lower(btrim(f.name)) = lower(btrim(d.counterparty_name))
where not exists (
  select 1 from public.ledger_entries e
  where e.user_id = p.user_id and e.friend_id = f.id
    and e.kind = case d.direction when 'owed_to_me' then 'repaid_to_me' else 'repaid_to_them' end
    and e.amount = p.amount and e.created_at = p.created_at
);

-- 4. Dívidas fechadas: devolução pelo valor em falta
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
  and d.amount - coalesce(p.paid, 0) > 0
  and not exists (
    select 1 from public.ledger_entries e
    where e.user_id = d.user_id and e.friend_id = f.id
      and e.kind = case d.direction when 'owed_to_me' then 'repaid_to_me' else 'repaid_to_them' end
      and e.amount = d.amount - coalesce(p.paid, 0)
      and e.created_at = coalesce(d.settled_at, d.created_at)
  );
