-- Texto do push de pedido de amizade: o nome de quem pede no título (o iOS acrescenta "from <app>").
create or replace function public.friend_requests_push() returns trigger
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
      perform public._push(r.id, v_sender, 'Quer ligar contas contigo. Toca para responder.', '/dividas');
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
