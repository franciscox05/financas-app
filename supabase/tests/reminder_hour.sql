-- Testa a migração 20261123000000_reminder_hour.sql. Correr contra uma BD
-- descartável com TODAS as migrações aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/reminder_hour.sql
-- Tudo dentro de uma transação que termina em rollback.
-- Se existirem perfis anteriores à migração, devem ter ficado com 23h (verificado abaixo).
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1');

do $$
begin
  -- 23h por omissão, para novos e antigos; ainda sem nenhum envio registado.
  if exists (select 1 from public.profiles where reminder_hour <> 23) then
    raise exception 'todos os perfis devem começar com reminder_hour = 23';
  end if;
  if exists (select 1 from public.profiles where reminder_last_sent_on is not null) then
    raise exception 'reminder_last_sent_on deve começar a null';
  end if;
  if (select count(*) from public.profiles where id in
        ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1')) <> 2 then
    raise exception 'o gatilho devia criar os 2 perfis de teste';
  end if;
end $$;

-- Limites: só 0..23.
do $$
begin
  begin
    update public.profiles set reminder_hour = 24 where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'devia rejeitar reminder_hour = 24';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set reminder_hour = -1 where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'devia rejeitar reminder_hour = -1';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set reminder_hour = null where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'devia rejeitar reminder_hour = null';
  exception when not_null_violation then null;
  end;
  update public.profiles set reminder_hour = 0 where id = '00000000-0000-0000-0000-0000000000a1';
  update public.profiles set reminder_hour = 23 where id = '00000000-0000-0000-0000-0000000000a1';
end $$;

-- RLS: o utilizador muda a sua hora (como a app faz, por upsert) e não a de outro.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
-- Imagens mais antigas do Supabase só leem a variável antiga em auth.uid().
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

insert into public.profiles (id, reminder_hour) values ('00000000-0000-0000-0000-0000000000a1', 20)
  on conflict (id) do update set reminder_hour = excluded.reminder_hour;

do $$
declare n int;
begin
  update public.profiles set reminder_hour = 5 where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS: não devia conseguir mudar o perfil de outro (% linhas)', n; end if;
end $$;

reset role;

do $$
begin
  if (select reminder_hour from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') <> 20 then
    raise exception 'o upsert devia ter guardado 20h';
  end if;
  if (select reminder_hour from public.profiles where id = '00000000-0000-0000-0000-0000000000b1') <> 23 then
    raise exception 'o perfil de outro utilizador não devia ter mudado';
  end if;
end $$;

-- O upsert do locale (LanguageSection) não pode repor a hora.
insert into public.profiles (id, locale) values ('00000000-0000-0000-0000-0000000000a1', 'en')
  on conflict (id) do update set locale = excluded.locale;
do $$
begin
  if (select reminder_hour from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') <> 20 then
    raise exception 'guardar o idioma não pode mexer na hora do lembrete';
  end if;
end $$;

-- Cron: agora de hora a hora, um só job, mesmo destino e mesmos segredos; os outros jobs ficam como estavam.
do $$
declare j record;
begin
  select * into j from cron.job where jobname = 'send-daily-reminder';
  if j.schedule <> '0 * * * *' then raise exception 'schedule esperado "0 * * * *", veio "%"', j.schedule; end if;
  if (select count(*) from cron.job where jobname = 'send-daily-reminder') <> 1 then
    raise exception 'deve existir exatamente 1 job send-daily-reminder';
  end if;
  if j.command not like '%/functions/v1/send-daily-reminder%' or j.command not like '%x-cron-secret%'
     or j.command not like '%anon_key%' then
    raise exception 'o comando do cron perdeu URL ou segredos';
  end if;
  if (select schedule from cron.job where jobname = 'send-monthly-summary') <> '0 9 1 * *'
     or (select schedule from cron.job where jobname = 'send-overdue-debts') <> '0 9 * * *' then
    raise exception 'os outros jobs não podiam mudar';
  end if;
end $$;

rollback;
select 'reminder_hour: OK' as resultado;
