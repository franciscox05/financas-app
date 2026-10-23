-- A pedido do Francisco: movimentos de amigos sem transação ligada (ex. "Ficamos
-- quites" via "Descontado noutra coisa") ficavam de fora da lista de Registo —
-- primeiro puseram-se numa secção à parte, mas o pedido era mesmo misturados na
-- lista principal, por ordem cronológica. Como a lista já vem desta view (uma só
-- query, com paginação/filtros/pesquisa a funcionarem em cima dela), a forma
-- certa é juntar aqui uma terceira origem, não montar isto à mão no cliente.
--
-- Só entram os que contam para o saldo (mesma regra do entryCounts no cliente:
-- confirmed/cancel_requested sempre; pending/declined só se foram criados por
-- quem está a ver) e que não têm transaction_id (esses já aparecem via a
-- transação ligada, não fariam sentido em duplicado).

-- create or replace view falha aqui: o amount calculado (abs(...) sobre uma expressão)
-- infere numeric genérico, e o Postgres não deixa mudar o tipo de uma coluna existente
-- com replace — por isso apaga-se e recria-se a view em vez de substituir.
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
    e.status in ('confirmed', 'cancel_requested')
    or (e.status in ('pending', 'declined') and e.created_by = e.user_id)
  );
