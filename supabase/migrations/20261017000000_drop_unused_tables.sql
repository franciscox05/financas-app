-- Remove tabelas de funcionalidades já retiradas da app (sem UI/código há
-- vários dias): orçamentos, transações recorrentes e metas de poupança.
-- Ver histórico git para contexto (commits a938ce3, 338bc68, 946775b).

drop table if exists public.budgets;
drop table if exists public.recurring_transactions;
drop table if exists public.savings_goals;
