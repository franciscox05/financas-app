-- Testes dos movimentos partilhados. Correr contra uma BD descartável com todas as migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/shared_entries.sql
-- Tudo dentro de uma transação que termina em rollback.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@x.com', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x.com', now());

insert into public.accounts (id, user_id, name, type) values
  ('cccccccc-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Conta A', 'cash'),
  ('cccccccc-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'Conta B', 'cash');
insert into public.categories (id, user_id, name, type) values
  ('cccccccc-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'Divida in', 'income'),
  ('cccccccc-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1', 'Divida out', 'expense'),
  ('cccccccc-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1', 'Divida in', 'income'),
  ('cccccccc-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1', 'Divida out', 'expense');

-- Contactos já ligados entre si (A -> "Beto", B -> "Tiago")
insert into public.friends (id, owner_id, name, status, linked_user_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Beto', 'connected', '00000000-0000-0000-0000-0000000000b1'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b1', 'Tiago', 'connected', '00000000-0000-0000-0000-0000000000a1');

create function pg_temp.balance(p_user uuid, p_friend uuid) returns numeric
language sql as $$
  select coalesce((select balance from public.friend_balances where user_id = p_user and friend_id = p_friend), 0)
$$;
grant execute on function pg_temp.balance(uuid, uuid) to public;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

-- (a) create_shared_entry: duas linhas pending, kind invertido, mirror cruzado, sem transações, saldos intactos
select public.create_shared_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'paid_for_them', 10, 'creatina', date '2026-10-20', null, null, null, null);
do $$
declare ea public.ledger_entries; eb public.ledger_entries; n int;
begin
  select * into ea from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1';
  select * into eb from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000b1';
  if ea.id is null then raise exception 'A devia ver a sua linha'; end if;
  reset role;
  select * into ea from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1';
  select * into eb from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000b1';
  if ea.status <> 'pending' or eb.status <> 'pending' then raise exception 'ambas devem ficar pending'; end if;
  if ea.kind <> 'paid_for_them' or eb.kind <> 'paid_for_me' then raise exception 'kind invertido errado'; end if;
  if ea.mirror_id <> eb.id or eb.mirror_id <> ea.id then raise exception 'mirror_id não cruzado'; end if;
  if ea.created_by <> '00000000-0000-0000-0000-0000000000a1' or eb.created_by <> '00000000-0000-0000-0000-0000000000a1' then
    raise exception 'created_by devia ser o criador nas duas linhas';
  end if;
  select count(*) into n from public.transactions;
  if n <> 0 then raise exception 'pendente não devia criar transações'; end if;
  if pg_temp.balance('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1') <> 0
     or pg_temp.balance('00000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000f2') <> 0 then
    raise exception 'pendente não devia contar no saldo';
  end if;
end $$;

-- (b) o cliente não consegue contornar as funções
set local role authenticated;
do $$
declare ida uuid; n int;
begin
  select id into ida from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    update public.ledger_entries set amount = 999 where id = ida;
    raise exception 'update direto de movimento partilhado devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Este movimento é partilhado%' then raise; end if;
  end;
  begin
    delete from public.ledger_entries where id = ida;
    raise exception 'delete direto de movimento partilhado devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Este movimento é partilhado%' then raise; end if;
  end;
  begin
    insert into public.ledger_entries (user_id, friend_id, kind, amount)
    values ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'paid_for_them', 5);
    raise exception 'insert direto num contacto ligado devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Com um amigo ligado%' then raise; end if;
  end;
  begin
    update public.friends set linked_user_id = null where id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
    raise exception 'desligar à mão devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Operação não permitida%' then raise; end if;
  end;
  begin
    delete from public.friends where id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
    raise exception 'apagar contacto ligado devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Este amigo tem uma ligação%' then raise; end if;
  end;
end $$;

-- B não responde a algo que ele próprio não criou? B é o destinatário: B responde. A (criador) não.
do $$
declare ida uuid;
begin
  select id into ida from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    perform public.respond_entry(ida, true, null, null, null, null);
    raise exception 'o criador não devia poder aceitar o seu próprio movimento';
  exception when raise_exception then
    if sqlerrm not like 'Só a outra pessoa%' then raise; end if;
  end;
end $$;

-- (c) B aceita: as duas confirmed, saldo muda (A +10, B -10); segunda resposta falha
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
do $$
declare idb uuid;
begin
  select id into idb from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000b1';
  if idb is null then raise exception 'B devia ver a sua linha pendente'; end if;
  perform public.respond_entry(idb, true, null, null, null, null);
  begin
    perform public.respond_entry(idb, true, null, null, null, null);
    raise exception 'segunda resposta devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Este movimento já foi respondido%' then raise; end if;
  end;
  if pg_temp.balance('00000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000f2') <> -10 then
    raise exception 'B devia ficar a dever 10';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
begin
  if pg_temp.balance('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1') <> 10 then
    raise exception 'A devia ter 10 a receber';
  end if;
end $$;

-- (d) devolução por banco: A regista "ele devolveu-me 4" (bank); B aceita como bank com a sua conta;
--     transações só ao confirmar, com os tipos certos
select public.create_shared_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'repaid_to_me', 4, null, date '2026-10-21', null, 'bank',
  'cccccccc-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000a2');
do $$
declare n int;
begin
  reset role;
  select count(*) into n from public.transactions;
  if n <> 0 then raise exception 'sem confirmação não há transações (houve %)', n; end if;
  set local role authenticated;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
do $$
declare idb uuid; n int;
begin
  select id into idb from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000b1' and status = 'pending';
  begin
    perform public.respond_entry(idb, true, null, null, null, null);
    raise exception 'aceitar devolução sem dizer como foi pago devia falhar';
  exception when raise_exception then
    if sqlerrm not like 'Escolhe como foi pago%' then raise; end if;
  end;
  begin
    perform public.respond_entry(idb, true, null, 'bank', 'cccccccc-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000b3');
    raise exception 'conta de outro utilizador devia ser recusada';
  exception when raise_exception then
    if sqlerrm not like 'Escolhe a conta e a categoria%' then raise; end if;
  end;
  perform public.respond_entry(idb, true, null, 'bank', 'cccccccc-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-0000000000b3');
  reset role;
  if (select type from public.transactions where user_id = '00000000-0000-0000-0000-0000000000a1') <> 'income' then
    raise exception 'A recebeu: devia ser income';
  end if;
  if (select type from public.transactions where user_id = '00000000-0000-0000-0000-0000000000b1') <> 'expense' then
    raise exception 'B pagou: devia ser expense';
  end if;
  select count(*) into n from public.ledger_entries where transaction_id is not null;
  if n <> 2 then raise exception 'as duas linhas devem apontar para a sua transação (%)', n; end if;
  if pg_temp.balance('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1') <> 6 then
    raise exception 'A devia ficar com 6 a receber';
  end if;
  set local role authenticated;
end $$;

-- (e) contestar: criador fica declined com a nota, a outra cancelled, saldo inalterado
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
select public.create_shared_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'paid_for_them', 3, 'café', null, null, null, null, null);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
do $$
declare idb uuid;
begin
  select id into idb from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000b1' and status = 'pending';
  perform public.respond_entry(idb, false, 'não foi assim', null, null, null);
  reset role;
  if (select status from public.ledger_entries where id = idb) <> 'cancelled' then raise exception 'linha de B devia ficar cancelled'; end if;
  if (select status from public.ledger_entries where mirror_id = idb) <> 'declined' then raise exception 'linha de A devia ficar declined'; end if;
  if (select decline_note from public.ledger_entries where mirror_id = idb) <> 'não foi assim' then raise exception 'nota em falta'; end if;
  if pg_temp.balance('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1') <> 6 then
    raise exception 'contestar não devia alterar o saldo';
  end if;
  set local role authenticated;
end $$;

-- (f) cancel_pending_entry: só o criador, só pending
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
select public.create_shared_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'paid_for_me', 2, null, null, null, null, null, null);
do $$
declare ida uuid; idb uuid;
begin
  select id into ida from public.ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'pending';
  select mirror_id into idb from public.ledger_entries where id = ida;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
  begin
    perform public.cancel_pending_entry(idb);
    raise exception 'o destinatário não devia cancelar';
  exception when raise_exception then
    if sqlerrm not like 'Só podes cancelar%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  perform public.cancel_pending_entry(ida);
  reset role;
  if (select count(*) from public.ledger_entries where id in (ida, idb) and status = 'cancelled') <> 2 then
    raise exception 'as duas linhas devem ficar cancelled';
  end if;
  set local role authenticated;
end $$;

-- (g) anulação mútua da devolução bank confirmada (4 €): pede A, B recusa, depois aceita
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare ida uuid; idb uuid;
begin
  select id into ida from public.ledger_entries
   where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'repaid_to_me' and status = 'confirmed';
  select mirror_id into idb from public.ledger_entries where id = ida;
  perform public.request_cancel(ida);
  begin
    perform public.respond_cancel(ida, true);
    raise exception 'quem pediu não devia responder';
  exception when raise_exception then
    if sqlerrm not like 'Só a outra pessoa%' then raise; end if;
  end;
  if pg_temp.balance('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1') <> 6 then
    raise exception 'cancel_requested continua a contar';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
  perform public.respond_cancel(idb, false);
  reset role;
  if (select count(*) from public.ledger_entries where id in (ida, idb) and status = 'confirmed' and cancel_requested_by is null) <> 2 then
    raise exception 'recusar devia voltar tudo a confirmed';
  end if;
  if (select count(*) from public.transactions) <> 2 then raise exception 'recusar não toca nas transações'; end if;
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
  perform public.request_cancel(idb);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  perform public.respond_cancel(ida, true);
  reset role;
  if (select count(*) from public.ledger_entries where id in (ida, idb) and status = 'cancelled' and transaction_id is null) <> 2 then
    raise exception 'aceitar devia cancelar as duas e limpar transaction_id';
  end if;
  if (select count(*) from public.transactions) <> 0 then raise exception 'as duas transações devem desaparecer'; end if;
  if pg_temp.balance('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000f1') <> 10 then
    raise exception 'anulada a devolução de 4, A volta a 10';
  end if;
  set local role authenticated;
end $$;

-- (h) campos do espelho nunca mudam pela resposta
reset role;
do $$
declare ea public.ledger_entries;
begin
  select * into ea from public.ledger_entries
   where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'paid_for_me' and amount = 10;
  if ea.occurred_on <> date '2026-10-20' or ea.note <> 'creatina' then
    raise exception 'valor/tipo/data/nota do espelho alterados';
  end if;
end $$;

rollback;
