-- Testes do schema de amigos/conta-corrente. Correr contra uma BD descartável:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/ledger_schema.sql
-- Tudo dentro de uma transação que termina em rollback.
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

-- Dados do utilizador A (como dono das linhas)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

insert into public.friends (id, owner_id, name)
values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Rui');

do $$
begin
  if (select status from public.friends where name = 'Rui') <> 'local' then
    raise exception 'friends.status deveria ter default local';
  end if;
end $$;

-- (a) amount = 0 falha
do $$
begin
  begin
    insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on)
    values ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 0, current_date);
    raise exception 'amount = 0 deveria falhar';
  exception when check_violation then null;
  end;
end $$;

-- (b) settlement num paid_for_them falha; numa devolução é aceite
do $$
begin
  begin
    insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on, settlement)
    values ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 5, current_date, 'cash');
    raise exception 'settlement em paid_for_them deveria falhar';
  exception when check_violation then null;
  end;
  insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on, settlement)
  values ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'repaid_to_me', 1, current_date, 'cash');
  delete from public.ledger_entries where kind = 'repaid_to_me';
end $$;

-- (d) saldo: paid_for_me 10 + paid_for_them 11.50 = 1.50
insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_me', 10, current_date),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 11.50, current_date);

do $$
declare b numeric;
begin
  select balance into b from public.friend_balances
   where friend_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and user_id = '00000000-0000-0000-0000-00000000000a';
  if b is distinct from 1.50 then
    raise exception 'saldo esperado 1.50, obtido %', b;
  end if;
end $$;

-- Sinais das devolucoes: repaid_to_me -4 e repaid_to_them +0.50 => 1.50 - 4 + 0.50 = -2.00
insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on, settlement) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'repaid_to_me', 4, current_date, 'bank'),
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'repaid_to_them', 0.50, current_date, 'offset');
do $$
declare b numeric;
begin
  select balance into b from public.friend_balances
   where friend_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if b is distinct from -2.00 then
    raise exception 'saldo com devolucoes esperado -2.00, obtido %', b;
  end if;
end $$;

-- (c) utilizador B nao ve nem altera linhas do A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.friends;
  if n <> 0 then raise exception 'B nao devia ver friends do A (viu %)', n; end if;
  select count(*) into n from public.ledger_entries;
  if n <> 0 then raise exception 'B nao devia ver ledger_entries do A (viu %)', n; end if;
  select count(*) into n from public.friend_balances;
  if n <> 0 then raise exception 'B nao devia ver friend_balances do A (viu %)', n; end if;

  update public.ledger_entries set amount = 999;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B nao devia alterar linhas do A'; end if;
  delete from public.ledger_entries;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B nao devia apagar linhas do A'; end if;

  begin
    insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on)
    values ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 1, current_date);
    raise exception 'B nao devia inserir em nome do A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- (e) B nao consegue ligar uma entrada ao amigo do A (chave composta friend_id, user_id)
do $$
begin
  begin
    insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on)
    values ('00000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'paid_for_them', 1, current_date);
    raise exception 'B nao devia ligar entradas a amigos do A';
  exception when foreign_key_violation then null;
  end;
end $$;

-- (f) nomes de amigos unicos por dono, ignorando maiusculas e espacos
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
insert into public.friends (owner_id, name) values ('00000000-0000-0000-0000-00000000000a', 'Pedro');
do $$
begin
  begin
    insert into public.friends (owner_id, name) values ('00000000-0000-0000-0000-00000000000a', ' pedro ');
    raise exception 'Pedro e " pedro " deviam conflitar';
  exception when unique_violation then null;
  end;
end $$;

rollback;
