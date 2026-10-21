-- Testes dos pedidos de amizade por número de telemóvel. Correr contra uma BD descartável com todas as migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/phone_requests.sql
-- Tudo dentro de uma transação que termina em rollback.
begin;

-- normalize_phone
do $$
begin
  if public.normalize_phone('912 345 678') <> '912345678' then raise exception 'espaços'; end if;
  if public.normalize_phone('+351 912345678') <> '912345678' then raise exception '+351'; end if;
  if public.normalize_phone('00351912345678') <> '912345678' then raise exception '00351'; end if;
  if public.normalize_phone('+44 7700 900123') <> '447700900123' then raise exception 'internacional'; end if;
  if public.normalize_phone('') is not null or public.normalize_phone(null) is not null
     or public.normalize_phone('abc') is not null or public.normalize_phone('12345') is not null then
    raise exception 'lixo devia dar nulo';
  end if;
end $$;

-- A pede; B é a pessoa certa; D tem o mesmo número que B (pessoa errada); C não tem número.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@x.com', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x.com', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'c@x.com', now()),
  ('00000000-0000-0000-0000-0000000000d1', 'd@x.com', now());
update public.profiles set full_name = 'Tiago', phone = '911111111' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set full_name = 'Francisco Gomes', phone = '912345678' where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set full_name = 'Impostor', phone = '912345678' where id = '00000000-0000-0000-0000-0000000000d1';

insert into public.friends (id, owner_id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Francisco', '912345678'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Sem app', '933333333'),
  ('aaaaaaaa-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', 'Sem número', null),
  ('aaaaaaaa-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 'Eu', '911111111');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

-- (a) pedido por número: sem número no contacto e para o próprio número falham; um número com conta e outro
--     sem conta devolvem o mesmo (void) e deixam o contacto invited
do $$
begin
  begin
    perform public.send_friend_request_phone('aaaaaaaa-0000-0000-0000-0000000000f3');
    raise exception 'contacto sem número devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Guarda o número%' then raise; end if;
  end;
  begin
    perform public.send_friend_request_phone('aaaaaaaa-0000-0000-0000-0000000000f4');
    raise exception 'o próprio número devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Não podes enviar um pedido a ti próprio%' then raise; end if;
  end;
end $$;
select public.send_friend_request_phone('aaaaaaaa-0000-0000-0000-0000000000f1');
select public.send_friend_request_phone('aaaaaaaa-0000-0000-0000-0000000000f2');
do $$
declare n int;
begin
  select count(*) into n from public.friends where status = 'invited';
  if n <> 2 then raise exception 'esperados 2 contactos invited, obtidos %', n; end if;
  begin
    perform public.send_friend_request_phone('aaaaaaaa-0000-0000-0000-0000000000f1');
    raise exception 'segundo pedido ativo devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Já enviaste%' then raise; end if;
  end;
end $$;

-- (b) quem tem o número vê o pedido (B e D), C (sem número) e A não
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.list_incoming_requests();
  if n <> 1 then raise exception 'B devia ver 1 pedido, viu %', n; end if;
  if (select via from public.list_incoming_requests()) <> 'phone' then raise exception 'via devia ser phone'; end if;
  if (select awaiting from public.list_incoming_requests()) then raise exception 'ainda não aceitou'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
do $$
begin
  if (select count(*) from public.list_incoming_requests()) <> 0 then raise exception 'C não devia ver pedidos'; end if;
end $$;

-- (c) D (pessoa errada) aceita primeiro: fica à espera de confirmação, sem ligação
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1"}', true);
do $$
declare rid uuid;
begin
  select id into rid from public.list_incoming_requests();
  perform public.respond_friend_request(rid, true);
  if (select count(*) from public.list_incoming_requests() where awaiting) <> 1 then
    raise exception 'D devia ver o pedido como à espera de confirmação';
  end if;
  reset role;
  if exists (select 1 from public.friends where linked_user_id is not null) then
    raise exception 'ninguém devia ficar ligado antes da confirmação';
  end if;
  if (select status from public.friend_requests where id = rid) <> 'awaiting_confirmation' then
    raise exception 'estado devia ser awaiting_confirmation';
  end if;
  set local role authenticated;
end $$;

-- (d) A vê quem aceitou (nome e email parcial), só ele; recusa: volta a pending, D deixa de o ver
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare rid uuid; r record;
begin
  reset role;
  select id into rid from public.friend_requests where to_phone = '912345678';
  set local role authenticated;
  select * into r from public.get_request_accepter(rid);
  if r.name <> 'Impostor' or r.email_hint <> 'd***@x.com' then
    raise exception 'accepter errado: % %', r.name, r.email_hint;
  end if;
  perform public.confirm_friend_request(rid, false);
  reset role;
  if (select status from public.friend_requests where id = rid) <> 'pending' then
    raise exception 'recusar a confirmação devolve o pedido a pending';
  end if;
  set local role authenticated;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1"}', true);
do $$
begin
  if (select count(*) from public.list_incoming_requests()) <> 0 then
    raise exception 'D deixa de ver o pedido depois de recusado';
  end if;
end $$;

-- (e) só o remetente confirma; B (a pessoa certa) aceita; A confirma; ficam ligados
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
do $$
declare rid uuid;
begin
  select id into rid from public.list_incoming_requests();
  perform public.respond_friend_request(rid, true);
  begin
    perform public.confirm_friend_request(rid, true);
    raise exception 'só o remetente confirma';
  exception when raise_exception then
    if sqlerrm not like 'Pedido não encontrado%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare rid uuid;
begin
  reset role;
  select id into rid from public.friend_requests where to_phone = '912345678';
  set local role authenticated;
  perform public.confirm_friend_request(rid, true);
  reset role;
  if (select status from public.friend_requests where id = rid) <> 'accepted' then raise exception 'pedido devia ficar accepted'; end if;
  if not exists (select 1 from public.friends where id = 'aaaaaaaa-0000-0000-0000-0000000000f1'
                    and status = 'connected' and linked_user_id = '00000000-0000-0000-0000-0000000000b1') then
    raise exception 'contacto de A devia ficar ligado a B';
  end if;
  if not exists (select 1 from public.friends where owner_id = '00000000-0000-0000-0000-0000000000b1'
                    and status = 'connected' and linked_user_id = '00000000-0000-0000-0000-0000000000a1' and name = 'Tiago') then
    raise exception 'B devia ter um contacto Tiago ligado';
  end if;
  set local role authenticated;
end $$;

-- (f) cancelar em awaiting_confirmation: pedido ao número sem conta (f2), simulado com C a aceitar
reset role;
update public.profiles set phone = '933333333' where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
do $$
declare rid uuid;
begin
  select id into rid from public.list_incoming_requests();
  perform public.respond_friend_request(rid, false);
  if (select count(*) from public.list_incoming_requests()) <> 0 then raise exception 'recusar por número esconde o pedido'; end if;
  reset role;
  if (select status from public.friend_requests where id = rid) <> 'pending' then
    raise exception 'recusar por número só esconde: o pedido continua pending';
  end if;
  update public.friend_requests set status = 'awaiting_confirmation', accepted_by = '00000000-0000-0000-0000-0000000000c1',
         rejected_by = '{}' where id = rid;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  set local role authenticated;
  perform public.cancel_friend_request(rid);
  reset role;
  if (select status from public.friend_requests where id = rid) <> 'cancelled' then raise exception 'devia cancelar'; end if;
  if (select status from public.friends where id = 'aaaaaaaa-0000-0000-0000-0000000000f2') <> 'local' then
    raise exception 'o contacto volta a local';
  end if;
end $$;

-- (g) o fluxo por email da Fase 3a continua a ligar logo ao aceitar
reset role;
insert into public.friends (id, owner_id, name) values ('aaaaaaaa-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000a1', 'Por email');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
select public.send_friend_request('aaaaaaaa-0000-0000-0000-0000000000f5', 'c@x.com');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
do $$
declare rid uuid;
begin
  select id into rid from public.list_incoming_requests() where via = 'email';
  perform public.respond_friend_request(rid, true);
  reset role;
  if (select status from public.friends where id = 'aaaaaaaa-0000-0000-0000-0000000000f5') <> 'connected' then
    raise exception 'por email liga logo';
  end if;
end $$;

rollback;
