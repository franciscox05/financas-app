-- Agendamento mensal do resumo push (autorizado explicitamente pelo
-- utilizador em 2026-10-09, mesma base que o lembrete diario). Chama o Edge
-- Function send-monthly-summary no dia 1 de cada mes, com o mesmo padrao de
-- autenticacao (Authorization da gateway + x-cron-secret dentro do codigo)
-- que ja foi corrigido para o lembrete diario em
-- 20261009020000_fix_push_cron_auth_header.sql.

select cron.schedule(
  'send-monthly-summary',
  '0 9 1 * *', -- dia 1 de cada mes, as 09:00 UTC
  $$
  select net.http_post(
    url := 'https://dhhrywxhtqrhfxcpxdyb.supabase.co/functions/v1/send-monthly-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
