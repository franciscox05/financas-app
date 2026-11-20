-- Testa que friend_balances e o gatilho _hide_settled_ledger_entries seguem a
-- regra de entryCounts() (src/lib/ledgerMath.js). Precisa da migração
-- 20261119000000 aplicada. Correr contra uma BD descartável:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/friend_balances.sql
-- Tudo dentro de uma transação que termina em rollback.
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

insert into public.friends (id, owner_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Rui'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Ana'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'Bia');

-- (1) Vista. Quatro entradas de A para o Rui, valores distintos para se ver
-- quais contam:
--   1 €  declined, criada por A       -> conta
--   2 €  pending, criada por B        -> NÃO conta
--   4 €  cancel_requested por A       -> NÃO conta (A pediu a anulação)
--   8 €  cancel_requested por B       -> conta
-- Esperado: 9. (A regra antiga dava 12: ignorava declined e contava os 4 €.)
insert into public.ledger_entries (user_id, friend_id, kind, amount, status, created_by, cancel_requested_by) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 1, 'declined', '00000000-0000-0000-0000-00000000000a', null),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 2, 'pending', '00000000-0000-0000-0000-00000000000b', null),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 4, 'cancel_requested', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 8, 'cancel_requested', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

do $$
declare v numeric;
begin
  select balance into v from public.friend_balances
   where user_id = '00000000-0000-0000-0000-00000000000a'
     and friend_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v is distinct from 9 then
    raise exception 'friend_balances do Rui deveria dar 9, deu %', v;
  end if;
end $$;

-- (2) Gatilho, caso que NÃO fecha: A tem 10 € a receber da Ana, pediu a
-- anulação desse movimento (deixa de contar do lado dele) e depois recebe 10 €.
-- O saldo que conta é -10 (≠ 0): nada se esconde. (A regra antiga somava o
-- movimento anulado, dava 0 e escondia-o.)
insert into public.ledger_entries (id, user_id, friend_id, kind, amount, status, created_by, cancel_requested_by) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'paid_for_them', 10, 'cancel_requested', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a');
insert into public.ledger_entries (user_id, friend_id, kind, amount, status) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'repaid_to_me', 10, 'confirmed');

do $$
begin
  if (select hidden_from_feed from public.ledger_entries where id = 'bbbbbbbb-0000-0000-0000-000000000001') then
    raise exception 'gatilho escondeu um movimento cuja anulação o próprio pediu';
  end if;
end $$;

-- (3) Gatilho, caso que fecha só com a regra nova: A tem 10 € confirmados e
-- 5 € de uma entrada declined que ele próprio criou (continua a contar do
-- lado dele), e depois recebe 15 €. Saldo que conta: 10 + 5 - 15 = 0 -> quites,
-- esconde os 10 € confirmados. (A regra antiga ignorava o declined, dava -5 e
-- não escondia nada.)
insert into public.ledger_entries (id, user_id, friend_id, kind, amount, status, created_by) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000003', 'paid_for_them', 10, 'confirmed', null),
  ('bbbbbbbb-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000003', 'paid_for_them', 5, 'declined', '00000000-0000-0000-0000-00000000000a');
insert into public.ledger_entries (user_id, friend_id, kind, amount, status) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000003', 'repaid_to_me', 15, 'confirmed');

do $$
begin
  if not (select hidden_from_feed from public.ledger_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002') then
    raise exception 'gatilho deveria esconder os 10 € confirmados (10 + 5 declined - 15 = quites)';
  end if;
end $$;

-- (4) Gatilho, guarda de regressão (passa com as duas regras): 10 € confirmados
-- e 10 € devolvidos -> quites, esconde a dívida.
insert into public.friends (id, owner_id, name)
values ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'Leo');
insert into public.ledger_entries (id, user_id, friend_id, kind, amount, status) values
  ('bbbbbbbb-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000004', 'paid_for_them', 10, 'confirmed');
insert into public.ledger_entries (user_id, friend_id, kind, amount, status) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000004', 'repaid_to_me', 10, 'confirmed');

do $$
begin
  if not (select hidden_from_feed from public.ledger_entries where id = 'bbbbbbbb-0000-0000-0000-000000000004') then
    raise exception 'gatilho deveria esconder a dívida já quite';
  end if;
end $$;

rollback;
