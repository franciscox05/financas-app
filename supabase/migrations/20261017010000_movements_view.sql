-- View só de leitura que junta `transactions` e `transfers` num único feed de
-- "movimentos" para a lista principal (Registo). Transferências continuam
-- numa tabela própria (não contam como Gasto/Ganho no Balanço/Dashboard, que
-- continuam a ler só de `transactions`); esta view existe apenas para o
-- utilizador ver tudo o que mexeu nas contas num só sítio, como via antes
-- quando registava os investimentos como gasto+ganho à mão.
--
-- `security_invoker = true` garante que a RLS das tabelas de base (filtrada
-- por user_id) é aplicada com o utilizador que faz a query, não o dono da view.
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
  t.created_at
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
  tr.created_at
from public.transfers tr
left join public.accounts fa on fa.id = tr.from_account_id
left join public.accounts ta on ta.id = tr.to_account_id;
