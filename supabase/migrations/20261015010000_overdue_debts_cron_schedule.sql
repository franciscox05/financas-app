-- Agendamento diário do lembrete de dívidas atrasadas. Chama o Edge Function
-- send-overdue-debts com o mesmo padrão de autenticação das outras funções
-- (Authorization da gateway + x-cron-secret verificado dentro do código).
-- Só deve ser aplicado DEPOIS de a função estar publicada no Supabase.

select cron.schedule(
  'send-overdue-debts',
  '0 9 * * *', -- todos os dias às 09:00 UTC
  $$
  select net.http_post(
    url := 'https://dhhrywxhtqrhfxcpxdyb.supabase.co/functions/v1/send-overdue-debts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
