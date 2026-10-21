-- Atualização ao vivo: cada push de pedidos/movimentos também envia um broadcast privado ao canal
-- 'user:<id>' do destinatário, para a app aberta recarregar logo (sem fechar e abrir). As tabelas
-- não vão para a publicação do Realtime porque friend_requests só é legível por quem a enviou.

create policy "live_broadcast_receive_own" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'user:' || (select auth.uid())::text and realtime.messages.extension = 'broadcast');

create or replace function public._push(p_user uuid, p_title text, p_body text, p_url text) returns void
language plpgsql
set search_path = public
as $$
begin
  begin
    perform realtime.send(jsonb_build_object('url', p_url), 'changed', 'user:' || p_user::text, true);
  exception when others then
    raise warning 'live: %', sqlerrm;
  end;
  perform net.http_post(
    url := 'https://dhhrywxhtqrhfxcpxdyb.supabase.co/functions/v1/notify-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('user_id', p_user, 'title', p_title, 'body', p_body, 'url', p_url)
  );
exception when others then
  raise warning 'push: %', sqlerrm; -- o push nunca bloqueia a operação, mas deixa rasto nos logs
end $$;
