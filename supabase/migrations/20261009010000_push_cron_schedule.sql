-- Agendamento diario do lembrete push (autorizado explicitamente pelo
-- utilizador em 2026-10-09). Instala pg_cron/pg_net e agenda a chamada
-- diaria ao Edge Function send-daily-reminder, autenticada por um segredo
-- partilhado (nao pelo JWT normal, porque quem chama e o proprio Postgres).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-daily-reminder',
  '0 20 * * *', -- todos os dias as 20:00 UTC
  $$
  select net.http_post(
    url := 'https://dhhrywxhtqrhfxcpxdyb.supabase.co/functions/v1/send-daily-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
