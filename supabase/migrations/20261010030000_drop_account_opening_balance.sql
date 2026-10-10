-- Reverte o "saldo inicial" estático (sem data) introduzido na migration
-- anterior: distorcia retroativamente todo o histórico, porque era somado
-- em todos os meses igualmente. Substituído por snapshots datados
-- (net_worth_snapshots), já generalizados a qualquer tipo de conta, que só
-- afetam o património a partir da data do snapshot em diante.

alter table public.accounts
  drop column opening_balance;
