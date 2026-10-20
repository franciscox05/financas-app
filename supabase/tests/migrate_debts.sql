-- Teste da migração debts -> ledger_entries. Correr a partir da raiz do repo, numa BD descartável
-- que já tem todas as migrations anteriores:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/migrate_debts.sql
-- Semeia dívidas antigas, corre o corpo da migration e verifica os saldos. Termina em rollback.
begin;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1');

insert into public.accounts (id, user_id, name, type)
values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Conta', 'cash');
insert into public.categories (id, user_id, name, type)
values ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'Dividas', 'expense');
insert into public.transactions (id, user_id, account_id, category_id, amount, type)
values
  ('cccccccc-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 5, 'income'),
  ('cccccccc-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 12, 'expense');

-- (i) Rui: owed_to_me 20 com pagamentos 5 + 5 => saldo 10
insert into public.debts (id, user_id, direction, counterparty_name, amount, due_on)
values ('dddddddd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'owed_to_me', 'Rui', 20, date '2026-12-31');
insert into public.debt_payments (user_id, debt_id, amount, transaction_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'dddddddd-0000-0000-0000-000000000001', 5, 'cccccccc-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000c1', 'dddddddd-0000-0000-0000-000000000001', 5, null);

-- (ii) Ana: i_owe 12 fechada por transação, sem pagamentos => saldo 0
insert into public.debts (user_id, direction, counterparty_name, amount, status, settled_transaction_id, settled_at)
values ('00000000-0000-0000-0000-0000000000c1', 'i_owe', 'Ana', 12, 'settled', 'cccccccc-0000-0000-0000-0000000000a2', now());

-- (iii) Rita: fechada por acerto, com nota e sem transação => saldo 0
insert into public.debts (user_id, direction, counterparty_name, amount, status, settled_note, settled_at)
values ('00000000-0000-0000-0000-0000000000c1', 'owed_to_me', 'Rita', 7, 'settled', 'ficamos quites', now());

-- (iv) Pedro e " pedro ": mesmo amigo; 3 + 4 => saldo 7
insert into public.debts (user_id, direction, counterparty_name, amount) values
  ('00000000-0000-0000-0000-0000000000c1', 'owed_to_me', 'Pedro', 3),
  ('00000000-0000-0000-0000-0000000000c1', 'owed_to_me', ' pedro ', 4);

-- Limpa o que uma execução anterior da migration (sobre tabelas vazias) possa ter criado
delete from public.ledger_entries;
delete from public.friends;

\i supabase/migrations/20261021010000_migrate_debts_to_ledger.sql

do $$
declare
  uid constant uuid := '00000000-0000-0000-0000-0000000000c1';
  n int;
  b numeric;
begin
  select count(*) into n from public.friends where owner_id = uid and lower(btrim(name)) = 'pedro';
  if n <> 1 then raise exception 'esperado 1 amigo Pedro, obtido %', n; end if;
  select count(*) into n from public.friends where owner_id = uid;
  if n <> 4 then raise exception 'esperados 4 amigos, obtido %', n; end if;

  select fb.balance into b from public.friend_balances fb join public.friends f on f.id = fb.friend_id
   where f.owner_id = uid and f.name = 'Rui';
  if b is distinct from 10 then raise exception 'saldo Rui esperado 10, obtido %', b; end if;

  select fb.balance into b from public.friend_balances fb join public.friends f on f.id = fb.friend_id
   where f.owner_id = uid and f.name = 'Ana';
  if b is distinct from 0 then raise exception 'saldo Ana esperado 0, obtido %', b; end if;

  select fb.balance into b from public.friend_balances fb join public.friends f on f.id = fb.friend_id
   where f.owner_id = uid and f.name = 'Rita';
  if b is distinct from 0 then raise exception 'saldo Rita esperado 0, obtido %', b; end if;

  select fb.balance into b from public.friend_balances fb join public.friends f on f.id = fb.friend_id
   where f.owner_id = uid and lower(btrim(f.name)) = 'pedro';
  if b is distinct from 7 then raise exception 'saldo Pedro esperado 7, obtido %', b; end if;

  -- transaction_id dos pagamentos e da dívida fechada preservado
  select count(*) into n from public.ledger_entries
   where user_id = uid and transaction_id = 'cccccccc-0000-0000-0000-0000000000a1' and kind = 'repaid_to_me' and settlement = 'bank';
  if n <> 1 then raise exception 'transaction_id do pagamento não preservado'; end if;
  select count(*) into n from public.ledger_entries
   where user_id = uid and transaction_id = 'cccccccc-0000-0000-0000-0000000000a2' and kind = 'repaid_to_them' and settlement = 'bank';
  if n <> 1 then raise exception 'transaction_id do fecho não preservado'; end if;

  -- due_on copiado
  select count(*) into n from public.ledger_entries
   where user_id = uid and kind = 'paid_for_them' and due_on = date '2026-12-31';
  if n <> 1 then raise exception 'due_on não copiado'; end if;

  -- a nota do acerto passa para a devolução offset
  select count(*) into n from public.ledger_entries
   where user_id = uid and settlement = 'offset' and note = 'ficamos quites';
  if n <> 1 then raise exception 'devolução offset da Rita em falta'; end if;

  -- nada em dinheiro vivo
  select count(*) into n from public.ledger_entries where user_id = uid and settlement = 'cash';
  if n <> 0 then raise exception 'não devia haver entradas cash'; end if;

  -- debts fica intacta
  select count(*) into n from public.debts where user_id = uid;
  if n <> 5 then raise exception 'debts não devia ser alterada (tem %)', n; end if;
end $$;

rollback;
