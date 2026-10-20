-- Testes do saldo anterior. Correr contra uma BD descartável com todas as migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/opening_balance.sql
-- Tudo dentro de uma transação que termina em rollback.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@x.com', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x.com', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'c@x.com', now()),
  ('00000000-0000-0000-0000-0000000000d1', 'd@x.com', now());

-- A<->B (aceitam) e C<->D (contestam/cancelam), todos já ligados
insert into public.friends (id, owner_id, name, status, linked_user_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Beto', 'connected', '00000000-0000-0000-0000-0000000000b1'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b1', 'Tiago', 'connected', '00000000-0000-0000-0000-0000000000a1'),
  ('aaaaaaaa-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c1', 'Dani', 'connected', '00000000-0000-0000-0000-0000000000d1'),
  ('aaaaaaaa-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000d1', 'Cris', 'connected', '00000000-0000-0000-0000-0000000000c1');

-- Histórico privado anterior à ligação (inserido como superuser, sem passar pelo guarda)
insert into public.ledger_entries (user_id, friend_id, kind, amount, settlement) values
  ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'paid_for_them', 10, null),
  ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'repaid_to_me', 3, 'cash'),
  ('00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000f3', 'paid_for_me', 12.50, null),
  ('00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000f3', 'paid_for_them', 2.50, null);

create function pg_temp.balance(p_user uuid, p_friend uuid) returns numeric
language sql as $$
  select coalesce((select balance from public.friend_balances where user_id = p_user and friend_id = p_friend), 0)
$$;
grant execute on function pg_temp.balance(uuid, uuid) to public;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

-- (a) partilhar: antigas archived, uma entrada is_opening de 7 (paid_for_them) pendente; saldo de A a 0
select public.share_opening_balance('aaaaaaaa-0000-0000-0000-0000000000f1');
do $$
declare ea public.ledger_entries;
begin
  if pg_temp.balance('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1') <> 0 then
    raise exception 'enquanto pendente, o saldo de A fica a 0 (antigas arquivadas)';
  end if;
  reset role;
  if (select count(*) from public.ledger_entries
       where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'archived') <> 2 then
    raise exception 'as 2 antigas devem ficar archived';
  end if;
  select * into ea from public.ledger_entries
   where user_id = '00000000-0000-0000-0000-0000000000a1' and is_opening;
  if ea.kind <> 'paid_for_them' or ea.amount <> 7 or ea.status <> 'pending' or ea.note <> 'Saldo anterior' then
    raise exception 'entrada de saldo anterior errada: % % %', ea.kind, ea.amount, ea.status;
  end if;
  if (select kind from public.ledger_entries where id = ea.mirror_id) <> 'paid_for_me' then
    raise exception 'o outro lado devia ser paid_for_me';
  end if;
  set local role authenticated;
end $$;

-- (b) partilhar outra vez enquanto pendente falha
do $$
begin
  begin
    perform public.share_opening_balance('aaaaaaaa-0000-0000-0000-0000000000f1');
    raise exception 'segundo envio pendente devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Já enviaste o saldo anterior%' then raise; end if;
  end;
end $$;

-- (c) B aceita: A +7, B -7, sem duplicação; as antigas continuam archived
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
do $$
declare idb uuid;
begin
  select id into idb from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000b1' and is_opening;
  perform public.respond_entry(idb, true, null, null, null, null);
  if pg_temp.balance('00000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000f2') <> -7 then
    raise exception 'B devia ficar a dever 7';
  end if;
  reset role;
  if pg_temp.balance('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1') <> 7 then
    raise exception 'A devia ter 7 a receber, sem duplicar';
  end if;
  if (select count(*) from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'archived') <> 2 then
    raise exception 'as antigas devem continuar archived';
  end if;
  set local role authenticated;
end $$;

-- (d) depois de aceite não há mais saldo privado para partilhar
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
begin
  begin
    perform public.share_opening_balance('aaaaaaaa-0000-0000-0000-0000000000f1');
    raise exception 'sem saldo privado devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Não há saldo anterior%' then raise; end if;
  end;
end $$;

-- (e) C partilha (saldo -10), D contesta: as antigas de C voltam a contar
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
select public.share_opening_balance('aaaaaaaa-0000-0000-0000-0000000000f3');
do $$
begin
  if pg_temp.balance('00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000f3') <> 0 then
    raise exception 'pendente: saldo de C a 0';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1"}', true);
do $$
declare idd uuid;
begin
  select id into idd from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000d1' and is_opening;
  perform public.respond_entry(idd, false, 'não me lembro disto', null, null, null);
  reset role;
  if pg_temp.balance('00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000f3') <> -10 then
    raise exception 'contestado: C volta a -10';
  end if;
  if (select count(*) from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000c1' and status = 'archived') <> 0 then
    raise exception 'nada deve ficar archived depois de contestar';
  end if;
  set local role authenticated;
end $$;

-- (f) C volta a partilhar e cancela: antigas voltam a contar
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
do $$
declare idc uuid;
begin
  idc := public.share_opening_balance('aaaaaaaa-0000-0000-0000-0000000000f3');
  perform public.cancel_pending_entry(idc);
  if pg_temp.balance('00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000f3') <> -10 then
    raise exception 'cancelado: C volta a -10';
  end if;
end $$;

-- (g) o saldo anterior não se anula depois de confirmado
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare ida uuid;
begin
  select id into ida from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1' and is_opening;
  begin
    perform public.request_cancel(ida);
    raise exception 'saldo anterior não devia poder ser anulado';
  exception when raise_exception then
    if sqlerrm not like 'O saldo anterior não se anula%' then raise; end if;
  end;
end $$;

rollback;
