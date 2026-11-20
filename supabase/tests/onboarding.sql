-- Testa complete_onboarding(). Correr contra uma BD descartável com as
-- migrações aplicadas:  psql -v ON_ERROR_STOP=1 -f supabase/tests/onboarding.sql
-- Tudo dentro de uma transação que termina em rollback.
begin;

-- Novo utilizador: o gatilho semeia 3 contas e 8 categorias de defeito.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if (select count(*) from public.accounts where user_id = '00000000-0000-0000-0000-0000000000a1') <> 3 then
    raise exception 'seed inicial esperado: 3 contas';
  end if;
  if (select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') is not null then
    raise exception 'um utilizador novo não pode vir marcado como onboarded';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

select public.complete_onboarding('{
  "locale": "en", "currency": "USD",
  "preferences": {"goals": ["track", "friends"], "template": "student"},
  "accounts": [
    {"name": "Checking", "type": "cash", "opening_balance": 1250.5},
    {"name": "Brokerage", "type": "investment", "opening_balance": 0}
  ],
  "categories": [
    {"name": "Salary", "type": "income"},
    {"name": "Repayments", "type": "income", "is_lending": true},
    {"name": "Food", "type": "expense"},
    {"name": "Investing", "type": "expense", "is_savings": true},
    {"name": "Loans", "type": "expense", "is_lending": true}
  ]
}'::jsonb);

-- As verificações leem as tabelas diretamente (como dono da BD de teste).
reset role;
do $$
declare u uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  if (select array_agg(name order by sort_order) from public.accounts where user_id = u) <> array['Checking','Brokerage'] then
    raise exception 'contas seed deviam ter sido substituídas';
  end if;
  if (select count(*) from public.categories where user_id = u) <> 5 then raise exception 'esperadas 5 categorias'; end if;
  if (select count(*) from public.categories where user_id = u and is_lending) <> 2 then raise exception 'esperadas 2 categorias de empréstimo'; end if;
  if (select count(*) from public.categories where user_id = u and is_savings) <> 1 then raise exception 'esperada 1 categoria de poupança'; end if;
  if (select value from public.net_worth_snapshots where user_id = u) <> 1250.50 then raise exception 'saldo inicial em falta'; end if;
  if (select count(*) from public.net_worth_snapshots where user_id = u) <> 1 then raise exception 'só a conta com saldo > 0 leva snapshot'; end if;
  if (select currency || locale from public.profiles where id = u) <> 'USDen' then raise exception 'perfil sem idioma/moeda'; end if;
  if (select onboarded_at from public.profiles where id = u) is null then raise exception 'onboarded_at por preencher'; end if;
end $$;

-- Não se pode repetir.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$ begin
  begin
    perform public.complete_onboarding('{"locale":"en","currency":"USD","accounts":[{"name":"X","type":"cash"}],"categories":[{"name":"a","type":"income"},{"name":"b","type":"expense"}]}'::jsonb);
    raise exception 'segundo onboarding deveria falhar';
  exception when sqlstate 'P0001' then null;
  end;
end $$;

-- Validações: moeda inválida, conta inválida.
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
do $$ begin
  begin
    perform public.complete_onboarding('{"locale":"pt","currency":"euro","accounts":[{"name":"X","type":"cash"}],"categories":[{"name":"a","type":"income"},{"name":"b","type":"expense"}]}'::jsonb);
    raise exception 'moeda inválida deveria falhar';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.complete_onboarding('{"locale":"pt","currency":"EUR","accounts":[{"name":"X","type":"bank"}],"categories":[{"name":"a","type":"income"},{"name":"b","type":"expense"}]}'::jsonb);
    raise exception 'tipo de conta inválido deveria falhar';
  exception when sqlstate '22023' then null;
  end;
end $$;

-- Sem sessão não funciona.
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  begin
    perform public.complete_onboarding('{}'::jsonb);
    raise exception 'anon não deveria poder chamar';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
