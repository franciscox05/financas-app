-- Remove o módulo antigo de Dívidas (tabelas `debts` e `debt_payments`).
-- Desde a 20261021010000_migrate_debts_to_ledger as dívidas vivem em
-- `ledger_entries` (página Amigos, rota /dividas) e a página antiga
-- (src/pages/Debts.jsx) já não estava em nenhuma rota. Verificado antes de
-- apagar (2026-10-29): ambas as tabelas vazias em produção, sem vistas,
-- funções, cron jobs nem edge functions a usá-las (send-overdue-debts usa
-- ledger_entries).

drop table if exists public.debt_payments;
drop table if exists public.debts;
