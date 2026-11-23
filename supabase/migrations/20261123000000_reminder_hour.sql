-- Hora do lembrete diario escolhida pelo utilizador (hora de Lisboa), 23h por
-- omissao. O cron passa de "20:00 UTC" para "de hora a hora"; a Edge Function
-- send-daily-reminder so envia a quem escolheu a hora atual de Lisboa, o que
-- resolve o horario de verao sem mexer no cron duas vezes por ano.
--
-- NAO APLICADA em producao: precisa de autorizacao expressa do Francisco.
-- Aplicar com: supabase db query --linked -f supabase/migrations/20261123000000_reminder_hour.sql
-- (e publicar a nova versao da function send-daily-reminder).

alter table public.profiles
  add column reminder_hour smallint not null default 23
    check (reminder_hour between 0 and 23),
  -- Ultimo dia (data de Lisboa) em que o lembrete foi enviado: evita o duplo
  -- envio na hora repetida quando os relogios recuam (outubro) e em reexecucoes.
  add column reminder_last_sent_on date;

select cron.unschedule('send-daily-reminder');

select cron.schedule(
  'send-daily-reminder',
  '0 * * * *', -- de hora a hora, ao minuto 0 (UTC)
  $$
  select net.http_post(
    url := 'https://dhhrywxhtqrhfxcpxdyb.supabase.co/functions/v1/send-daily-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
