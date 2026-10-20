-- Testes dos pedidos de amizade. Correr contra uma BD descartável com todas as migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/friend_requests.sql
-- Tudo dentro de uma transação que termina em rollback.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@x.com', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x.com', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'c@x.com', null);
-- o trigger de novos utilizadores já criou os profiles
update public.profiles set full_name = 'Tiago' where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.friends (id, owner_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Francisco'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Fantasma'),
  ('aaaaaaaa-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', 'Carla'),
  ('aaaaaaaa-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 'Eu mesmo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

-- (a) enviar a si próprio falha
do $$
begin
  begin
    perform public.send_friend_request('aaaaaaaa-0000-0000-0000-0000000000f4', 'A@x.com');
    raise exception 'enviar a si próprio devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Não podes%' then raise; end if;
  end;
end $$;

-- (b) email com conta e email sem conta: sem erro, um pending cada, contacto passa a invited
select public.send_friend_request('aaaaaaaa-0000-0000-0000-0000000000f1', ' B@x.com ');
select public.send_friend_request('aaaaaaaa-0000-0000-0000-0000000000f2', 'ninguem@x.com');
select public.send_friend_request('aaaaaaaa-0000-0000-0000-0000000000f3', 'c@x.com');
do $$
declare n int;
begin
  select count(*) into n from public.friend_requests where status = 'pending';
  if n <> 3 then raise exception 'esperados 3 pendentes, obtidos %', n; end if;
  select count(*) into n from public.friends where status = 'invited';
  if n <> 3 then raise exception 'esperados 3 contactos invited, obtidos %', n; end if;
  if exists (select 1 from public.friend_requests where to_email <> lower(btrim(to_email))) then
    raise exception 'to_email devia estar normalizado';
  end if;
end $$;

-- (c) segundo pending para o mesmo contacto falha com mensagem simples
do $$
begin
  begin
    perform public.send_friend_request('aaaaaaaa-0000-0000-0000-0000000000f1', 'b@x.com');
    raise exception 'segundo pedido pendente devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Já enviaste%' then raise; end if;
  end;
end $$;

-- escrita direta do cliente nos pedidos é impossível
do $$
declare n int;
begin
  begin
    insert into public.friend_requests (from_user_id, friend_id, to_email)
    values ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f4', 'x@x.com');
    raise exception 'insert direto devia falhar';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.friend_requests set status = 'accepted';
    raise exception 'update direto devia falhar';
  exception when insufficient_privilege then null;
  end;
end $$;

-- (d) B (email confirmado) vê o seu pedido; outro utilizador não; A não vê pedidos feitos por si como recebidos
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.list_incoming_requests();
  if n <> 1 then raise exception 'B devia ver 1 pedido, viu %', n; end if;
  if (select from_name from public.list_incoming_requests()) <> 'Tiago' then
    raise exception 'from_name devia ser Tiago';
  end if;
  select count(*) into n from public.friend_requests;
  if n <> 0 then raise exception 'B não devia ler friend_requests diretamente (viu %)', n; end if;
end $$;

-- (e) C (email não confirmado) não vê nem aceita
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
do $$
declare n int; rid uuid;
begin
  select count(*) into n from public.list_incoming_requests();
  if n <> 0 then raise exception 'C sem email confirmado não devia ver pedidos'; end if;
end $$;
reset role;
do $$
declare rid uuid;
begin
  select id into rid from public.friend_requests where to_email = 'c@x.com';
  set local role authenticated;
  begin
    perform public.respond_friend_request(rid, true);
    raise exception 'C sem email confirmado não devia aceitar';
  exception when raise_exception then
    if sqlerrm not like 'Pedido não encontrado%' then raise; end if;
  end;
end $$;
reset role;

-- (f) B aceita: ligação cruzada, nome do novo contacto = full_name do remetente; idempotente
do $$
declare rid uuid; n int;
begin
  select id into rid from public.friend_requests where to_email = 'b@x.com';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
  set local role authenticated;
  perform public.respond_friend_request(rid, true);
  perform public.respond_friend_request(rid, true);
  reset role;
  select count(*) into n from public.friends
   where owner_id = '00000000-0000-0000-0000-0000000000b1'
     and linked_user_id = '00000000-0000-0000-0000-0000000000a1'
     and status = 'connected' and name = 'Tiago';
  if n <> 1 then raise exception 'B devia ter exatamente 1 contacto Tiago ligado, tem %', n; end if;
  select count(*) into n from public.friends
   where id = 'aaaaaaaa-0000-0000-0000-0000000000f1'
     and linked_user_id = '00000000-0000-0000-0000-0000000000b1' and status = 'connected';
  if n <> 1 then raise exception 'contacto do A devia ficar ligado ao B'; end if;
  if (select status from public.friend_requests where id = rid) <> 'accepted' then
    raise exception 'pedido devia ficar accepted';
  end if;
end $$;

-- (g) aceitar quando o contacto já foi ligado por outro caminho
do $$
declare rid uuid;
begin
  insert into public.friends (id, owner_id, name, status, linked_user_id)
  values ('aaaaaaaa-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000b1', 'Outro', 'connected', '00000000-0000-0000-0000-0000000000b1');
  delete from public.friends where id = 'aaaaaaaa-0000-0000-0000-0000000000f5';
  -- o contacto Carla do A é ligado a mão ao C, depois C confirma e tenta aceitar
  update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000c1';
  update public.friends set status = 'connected', linked_user_id = '00000000-0000-0000-0000-0000000000c1'
   where id = 'aaaaaaaa-0000-0000-0000-0000000000f3';
  select id into rid from public.friend_requests where to_email = 'c@x.com';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
  set local role authenticated;
  begin
    perform public.respond_friend_request(rid, true);
    raise exception 'aceitar contacto já ligado devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Já estão ligados%' then raise; end if;
  end;
  reset role;
end $$;

-- (h) recusar volta o contacto a local; cancelar só pelo remetente
do $$
declare rid uuid;
begin
  update public.friends set status = 'invited', linked_user_id = null where id = 'aaaaaaaa-0000-0000-0000-0000000000f3';
  update public.friend_requests set status = 'pending' where to_email = 'c@x.com';
  select id into rid from public.friend_requests where to_email = 'c@x.com';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
  set local role authenticated;
  perform public.respond_friend_request(rid, false);
  reset role;
  if (select status from public.friends where id = 'aaaaaaaa-0000-0000-0000-0000000000f3') <> 'local' then
    raise exception 'recusar devia voltar o contacto a local';
  end if;
  if (select status from public.friend_requests where id = rid) <> 'declined' then
    raise exception 'pedido devia ficar declined';
  end if;
end $$;

do $$
declare rid uuid;
begin
  select id into rid from public.friend_requests where to_email = 'ninguem@x.com';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
  set local role authenticated;
  begin
    perform public.cancel_friend_request(rid);
    raise exception 'só o remetente podia cancelar';
  exception when raise_exception then
    if sqlerrm not like 'Pedido não encontrado%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  perform public.cancel_friend_request(rid);
  reset role;
  if (select status from public.friends where id = 'aaaaaaaa-0000-0000-0000-0000000000f2') <> 'local' then
    raise exception 'cancelar devia voltar o contacto a local';
  end if;
end $$;

rollback;
