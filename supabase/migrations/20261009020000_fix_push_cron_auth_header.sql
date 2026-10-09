-- Corrige o job agendado: a gateway de Edge Functions da Supabase exige um
-- header Authorization valido (nao basta o segredo customizado x-cron-secret),
-- caso contrario rejeita com 401 UNAUTHORIZED_NO_AUTH_HEADER antes mesmo de
-- chegar ao codigo da function. A anon/publishable key chega para passar a
-- gateway; a autorizacao real continua a ser feita pelo x-cron-secret dentro
-- do codigo da function.

select cron.unschedule('send-daily-reminder');

select cron.schedule(
  'send-daily-reminder',
  '0 20 * * *', -- todos os dias as 20:00 UTC
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
