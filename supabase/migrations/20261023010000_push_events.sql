-- Notificações push para pedidos de amizade e movimentos partilhados. Os triggers chamam a Edge
-- Function notify-user (mesmo padrão e segredos dos cron existentes). O texto nunca leva valores
-- nem notas (aparece no ecrã de bloqueio) e uma falha de envio nunca bloqueia a operação.
-- Só deve ser aplicado DEPOIS de a função notify-user estar publicada no Supabase.

create function public._push(p_user uuid, p_title text, p_body text, p_url text) returns void
language plpgsql
set search_path = public
as $$
begin
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
revoke all on function public._push(uuid, text, text, text) from public, anon, authenticated;

create function public.friend_requests_push() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sender text;
  v_accepter text;
  r record;
begin
  select coalesce(nullif(btrim(full_name), ''), 'Alguém') into v_sender
    from public.profiles where id = new.from_user_id;
  v_sender := coalesce(v_sender, 'Alguém');

  if tg_op = 'INSERT' then
    for r in
      select u.id
        from auth.users u
        left join public.profiles p on p.id = u.id
       where u.email_confirmed_at is not null
         and u.id <> new.from_user_id
         and ((new.to_email is not null and lower(u.email) = new.to_email)
              or (new.to_phone is not null and p.phone = new.to_phone))
    loop
      perform public._push(r.id, 'Pedido de amizade', v_sender || ' quer ligar contas contigo.', '/dividas');
    end loop;
  elsif new.status is distinct from old.status then
    select coalesce(nullif(btrim(full_name), ''), 'Alguém') into v_accepter
      from public.profiles where id = new.accepted_by;
    v_accepter := coalesce(v_accepter, 'Alguém');

    if new.status = 'awaiting_confirmation' then
      perform public._push(new.from_user_id, 'Pedido aceite',
        v_accepter || ' aceitou o teu pedido. Confirma que é a pessoa certa.', '/dividas/' || new.friend_id);
    elsif new.status = 'accepted' then
      if old.status = 'awaiting_confirmation' then
        perform public._push(new.accepted_by, 'Ligação confirmada',
          v_sender || ' confirmou a ligação.', '/dividas');
      else
        perform public._push(new.from_user_id, 'Pedido aceite',
          v_accepter || ' aceitou o teu pedido.', '/dividas/' || new.friend_id);
      end if;
    end if;
  end if;
  return null;
exception when others then
  raise warning 'push (trigger): %', sqlerrm;
  return null;
end $$;

create trigger friend_requests_push
  after insert or update on public.friend_requests
  for each row execute function public.friend_requests_push();

create function public.ledger_entries_push() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
  v_linked uuid;
begin
  select name, linked_user_id into v_name, v_linked from public.friends where id = new.friend_id;
  if v_linked is null then return null; end if;

  if tg_op = 'INSERT' then
    if new.status = 'pending' and new.created_by is not null and new.created_by <> new.user_id then
      perform public._push(new.user_id,
        case when new.is_opening then 'Saldo anterior' else 'Novo movimento' end,
        case when new.is_opening then v_name || ' enviou o saldo anterior para confirmares.'
             else v_name || ' registou um movimento contigo. Toca para confirmar.' end,
        '/dividas/' || new.friend_id);
    end if;
    return null;
  end if;

  if new.status is not distinct from old.status then return null; end if;

  if old.status = 'pending' and new.status = 'confirmed' and new.user_id = new.created_by then
    perform public._push(new.user_id, 'Movimento aceite', v_name || ' aceitou o teu movimento.', '/dividas/' || new.friend_id);
  elsif old.status = 'pending' and new.status = 'declined' and new.user_id = new.created_by then
    perform public._push(new.user_id, 'Movimento contestado', v_name || ' contestou o teu movimento.', '/dividas/' || new.friend_id);
  elsif old.status = 'confirmed' and new.status = 'cancel_requested' and new.user_id <> new.cancel_requested_by then
    perform public._push(new.user_id, 'Pedido de anulação',
      v_name || ' pediu para anular um movimento. Toca para responder.', '/dividas/' || new.friend_id);
  elsif old.status = 'cancel_requested' and new.status = 'cancelled' and new.user_id = new.cancel_requested_by then
    perform public._push(new.user_id, 'Anulação aceite', v_name || ' aceitou anular o movimento.', '/dividas/' || new.friend_id);
  elsif old.status = 'cancel_requested' and new.status = 'confirmed' and new.user_id = old.cancel_requested_by then
    perform public._push(new.user_id, 'Anulação recusada', v_name || ' recusou anular o movimento.', '/dividas/' || new.friend_id);
  end if;
  return null;
exception when others then
  raise warning 'push (trigger): %', sqlerrm;
  return null;
end $$;

create trigger ledger_entries_push
  after insert or update of status on public.ledger_entries
  for each row execute function public.ledger_entries_push();
