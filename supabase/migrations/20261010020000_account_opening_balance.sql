-- Saldo inicial por conta "dinheiro" (cash): dinheiro que já existia antes
-- de começar a registar (ex. em casa, ou o que já tinha na Conta à Ordem),
-- sem ter de criar uma transação falsa que distorceria os Ganhos/Gastos de
-- um mês qualquer. O saldo de uma conta cash passa a ser
-- opening_balance + soma das transações; nunca entra no Balanço/Registo,
-- só no Património (equivalente aos snapshots das contas de investimento,
-- que já podiam ter qualquer data no passado).

alter table public.accounts
  add column opening_balance numeric(12, 2) not null default 0;
