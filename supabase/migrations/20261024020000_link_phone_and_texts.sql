-- Ao ligar duas contas, o contacto local de cada um fica com o número do perfil do outro (se estiver
-- vazio), e os textos dos push de aceite/confirmada ficam mais claros.

create or replace function public._profile_phone_for_contact(p_user uuid) returns text
language sql
stable
set search_path = public
as $$
  -- Contactos guardam-se com indicativo: 9 dígitos locais passam a 351 + número.
  select case when length(phone) = 9 then '351' || phone else phone end
    from public.profiles where id = p_user
$$;
revoke all on function public._profile_phone_for_contact(uuid) from public, anon, authenticated;

create or replace function public._link_friends(p_req uuid, p_recipient uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  v_req public.friend_requests%rowtype;
  v_name text;
  v_base text;
  v_n int := 0;
begin
  select * into v_req from public.friend_requests where id = p_req;
  if exists (select 1 from public.friends where id = v_req.friend_id and (status = 'connected' or linked_user_id is not null))
     or exists (select 1 from public.friends where owner_id = p_recipient and linked_user_id = v_req.from_user_id) then
    raise exception 'Já estão ligados.';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), su.email, 'Amigo') into v_name
    from auth.users su left join public.profiles p on p.id = su.id where su.id = v_req.from_user_id;
  v_base := v_name;
  while exists (select 1 from public.friends where owner_id = p_recipient and lower(btrim(name)) = lower(btrim(v_name))) loop
    v_n := v_n + 1;
    v_name := v_base || case when v_n = 1 then ' (app)' else ' (app ' || v_n || ')' end;
  end loop;

  begin
    insert into public.friends (owner_id, name, status, linked_user_id, phone)
    values (p_recipient, v_name, 'connected', v_req.from_user_id, public._profile_phone_for_contact(v_req.from_user_id));
    update public.friends
       set status = 'connected', linked_user_id = p_recipient,
           phone = coalesce(phone, public._profile_phone_for_contact(p_recipient))
     where id = v_req.friend_id;
  exception when unique_violation then
    raise exception 'Já estão ligados.';
  end;

  update public.friend_requests
     set status = 'accepted', accepted_by = p_recipient, responded_at = now()
   where id = p_req;
end $$;
revoke all on function public._link_friends(uuid, uuid) from public, anon, authenticated;

-- Contactos já ligados sem número.
update public.friends f
   set phone = public._profile_phone_for_contact(f.linked_user_id)
 where f.linked_user_id is not null and f.phone is null;

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
      perform public._push(new.from_user_id, v_accepter,
        'Aceitou o teu pedido. Confirma que é a pessoa certa.', '/dividas/' || new.friend_id);
    elsif new.status = 'accepted' then
      if old.status = 'awaiting_confirmation' then
        perform public._push(new.accepted_by, 'Contas ligadas',
          v_sender || ' confirmou a ligação. Já podem partilhar despesas.', '/dividas');
      else
        perform public._push(new.from_user_id, 'Contas ligadas',
          v_accepter || ' aceitou o teu pedido. Já podem partilhar despesas.', '/dividas/' || new.friend_id);
      end if;
    end if;
  end if;
  return null;
exception when others then
  raise warning 'push (trigger): %', sqlerrm;
  return null;
end $$;
