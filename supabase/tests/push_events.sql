-- Testes das notificações push. Correr contra uma BD descartável com todas as migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/push_events.sql
-- Cria stubs de net.http_post e vault dentro da transação (que termina em rollback).
begin;

create schema net;
create table public.__push_log (id serial, url text, headers jsonb, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint
language plpgsql as $$
begin
  if current_setting('app.push_fail', true) = 'on' then raise exception 'pg_net em baixo'; end if;
  insert into public.__push_log (url, headers, body) values (url, headers, body);
  return 1;
end $$;
create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);
insert into vault.decrypted_secrets values ('anon_key', 'anon-test'), ('cron_secret', 'cron-test');

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@x.com', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x.com', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'c@x.com', now());
update public.profiles set full_name = 'Tiago', phone = '911111111' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set full_name = 'Francisco', phone = '922222222' where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set full_name = 'Carla', phone = '933333333' where id = '00000000-0000-0000-0000-0000000000c1';

-- A (contacto "Beto") e B (contacto "Tiago") já ligados; contactos de A para pedidos
insert into public.friends (id, owner_id, name, status, linked_user_id, phone) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Beto', 'connected', '00000000-0000-0000-0000-0000000000b1', null),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b1', 'Tiago', 'connected', '00000000-0000-0000-0000-0000000000a1', null);
insert into public.friends (id, owner_id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', 'Por email', null),
  ('aaaaaaaa-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 'Por número', '933333333');

create function pg_temp.pushes() returns table (n bigint) language sql as $$ select count(*) from public.__push_log $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

-- (a) novo movimento: um push só, para B, sem valores, a abrir o amigo certo
select public.create_shared_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'paid_for_them', 10, 'creatina', null, null, null, null, null);
do $$
declare l public.__push_log;
begin
  reset role;
  if (select count(*) from public.__push_log) <> 1 then
    raise exception 'devia haver 1 push, há %', (select count(*) from public.__push_log);
  end if;
  select * into l from public.__push_log;
  if l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000b1' then raise exception 'destinatário errado'; end if;
  if l.body ->> 'url' <> '/dividas/aaaaaaaa-0000-0000-0000-0000000000f2' then raise exception 'url errada: %', l.body ->> 'url'; end if;
  if (l.body ->> 'body') !~ 'Tiago' or ((l.body ->> 'title') || (l.body ->> 'body')) ~ '[0-9]' then
    raise exception 'corpo errado ou com valores: %', l.body ->> 'body';
  end if;
  if l.url not like '%/functions/v1/notify-user' or l.headers ->> 'x-cron-secret' <> 'cron-test'
     or l.headers ->> 'Authorization' <> 'Bearer anon-test' then
    raise exception 'pedido http mal formado';
  end if;
  delete from public.__push_log;
  set local role authenticated;
end $$;

-- (b) B aceita: push para A ("Beto aceitou")
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
do $$
declare idb uuid; l public.__push_log;
begin
  select id into idb from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000b1';
  perform public.respond_entry(idb, true, null, null, null, null);
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000a1'
     or (l.body ->> 'body') !~ 'Beto' or (l.body ->> 'body') !~ 'aceitou' then
    raise exception 'push de aceitação errado: %', l.body;
  end if;
  delete from public.__push_log;
  set local role authenticated;
end $$;

-- (c) anulação: A pede (push para B), B recusa (push para A), A pede outra vez e B aceita (push para A)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare ida uuid; idb uuid; l public.__push_log;
begin
  select id into ida from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1';
  select mirror_id into idb from public.ledger_entries where id = ida;
  perform public.request_cancel(ida);
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000b1'
     or (l.body ->> 'body') !~ 'Tiago' or (l.body ->> 'body') !~ 'anular' then
    raise exception 'push de pedido de anulação errado: %', l.body;
  end if;
  delete from public.__push_log;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
  set local role authenticated;
  perform public.respond_cancel(idb, false);
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000a1'
     or (l.body ->> 'body') !~ 'recusou' then
    raise exception 'push de anulação recusada errado: %', l.body;
  end if;
  delete from public.__push_log;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  set local role authenticated;
  perform public.request_cancel(ida);
  reset role;
  delete from public.__push_log;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
  set local role authenticated;
  perform public.respond_cancel(idb, true);
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000a1'
     or (l.body ->> 'body') !~ 'anular' then
    raise exception 'push de anulação aceite errado: %', l.body;
  end if;
  delete from public.__push_log;
  set local role authenticated;
end $$;

-- (d) B cria um movimento e A contesta: push para B ("contestou")
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
select public.create_shared_entry('aaaaaaaa-0000-0000-0000-0000000000f2', 'paid_for_me', 3, 'café', null, null, null, null, null);
do $$
declare ida uuid; l public.__push_log;
begin
  reset role;
  delete from public.__push_log;
  select id into ida from public.ledger_entries
   where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'pending';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  set local role authenticated;
  perform public.respond_entry(ida, false, 'não foi assim', null, null, null);
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000b1'
     or (l.body ->> 'body') !~ 'contestou' or (l.body ->> 'body') ~ 'não foi assim' then
    raise exception 'push de contestação errado: %', l.body;
  end if;
  delete from public.__push_log;
  set local role authenticated;
end $$;

-- (e) pedidos de amizade: email -> push só a quem tem esse email; número -> a quem tem o número
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
select public.send_friend_request('aaaaaaaa-0000-0000-0000-0000000000f3', 'c@x.com');
do $$
declare l public.__push_log;
begin
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000c1'
     or (l.body ->> 'body') !~ 'Tiago' then
    raise exception 'push de pedido por email errado: %', l.body;
  end if;
  delete from public.__push_log;
  set local role authenticated;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
select public.send_friend_request_phone('aaaaaaaa-0000-0000-0000-0000000000f4');
-- pedido por número a um número que ninguém tem: nenhuma notificação
do $$
declare l public.__push_log;
begin
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000c1' then
    raise exception 'push de pedido por número errado: %', l.body;
  end if;
  delete from public.__push_log;
  -- C aceita o pedido por número: A recebe "aceitou" (à espera de confirmação)
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
  set local role authenticated;
  perform public.respond_friend_request((select id from public.list_incoming_requests() where via = 'phone'), true);
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000a1'
     or (l.body ->> 'body') !~ 'Carla' or (l.body ->> 'body') !~ 'Confirma' then
    raise exception 'push de aceitação por número errado: %', l.body;
  end if;
  delete from public.__push_log;
  -- A confirma: C recebe "confirmou a ligação"
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  set local role authenticated;
  perform public.confirm_friend_request((select id from public.friend_requests where to_phone = '933333333'), true);
  reset role;
  select * into l from public.__push_log;
  if (select count(*) from public.__push_log) <> 1 or l.body ->> 'user_id' <> '00000000-0000-0000-0000-0000000000c1'
     or (l.body ->> 'body') !~ 'confirmou' then
    raise exception 'push de confirmação errado: %', l.body;
  end if;
  delete from public.__push_log;
end $$;

-- (f) uma falha do pg_net nunca bloqueia a operação
select set_config('app.push_fail', 'on', false);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
begin
  perform public.create_shared_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'paid_for_them', 1, 'x', null, null, null, null, null);
  reset role;
  if (select count(*) from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1' and note = 'x') <> 1 then
    raise exception 'a operação devia ter funcionado mesmo com o push em baixo';
  end if;
end $$;

rollback;
