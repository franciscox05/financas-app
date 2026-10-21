-- Pedidos de amizade por número de telemóvel (Fase 3b). O número não está verificado: quem aceita
-- fica "à espera de confirmação" e quem pediu confirma o nome da conta antes de ligar.

create function public.normalize_phone(p text) returns text
language sql immutable
as $$
  select case
    when d is null then null
    when length(d) = 12 and d like '351%' then substr(d, 4)
    when length(d) between 9 and 15 then d
    else null
  end
  from (select nullif(regexp_replace(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '^00', ''), '') as d) s
$$;

alter table public.profiles
  add column phone text check (phone is null or phone ~ '^[0-9]{9,15}$');
create index profiles_phone_idx on public.profiles (phone) where phone is not null;

-- O número do perfil guarda-se sempre normalizado (9 dígitos locais ou internacional só com dígitos).
create function public.profiles_normalize_phone() returns trigger
language plpgsql
as $$
begin
  if new.phone is not null then
    new.phone := public.normalize_phone(new.phone);
    if new.phone is null then raise exception 'Número de telefone inválido.'; end if;
  end if;
  return new;
end $$;

create trigger profiles_normalize_phone
  before insert or update of phone on public.profiles
  for each row execute function public.profiles_normalize_phone();

alter table public.friend_requests alter column to_email drop not null;
alter table public.friend_requests
  add column to_phone text check (to_phone is null or to_phone ~ '^[0-9]{9,15}$'),
  add column accepted_by uuid references auth.users (id) on delete set null,
  add column rejected_by uuid[] not null default '{}';
alter table public.friend_requests
  add constraint friend_requests_target_check check ((to_email is not null) <> (to_phone is not null));
alter table public.friend_requests drop constraint friend_requests_status_check;
alter table public.friend_requests
  add constraint friend_requests_status_check
  check (status in ('pending', 'awaiting_confirmation', 'accepted', 'declined', 'cancelled'));

drop index public.friend_requests_one_pending_key;
create unique index friend_requests_one_active_key
  on public.friend_requests (friend_id) where status in ('pending', 'awaiting_confirmation');
create index friend_requests_to_phone_idx
  on public.friend_requests (to_phone) where status in ('pending', 'awaiting_confirmation');

-- ---------------------------------------------------------------------------
-- Funções

-- Liga os dois contactos (comum aos pedidos por email e por número).
create function public._link_friends(p_req uuid, p_recipient uuid) returns void
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
    insert into public.friends (owner_id, name, status, linked_user_id)
    values (p_recipient, v_name, 'connected', v_req.from_user_id);
    update public.friends set status = 'connected', linked_user_id = p_recipient where id = v_req.friend_id;
  exception when unique_violation then
    raise exception 'Já estão ligados.';
  end;

  update public.friend_requests
     set status = 'accepted', accepted_by = p_recipient, responded_at = now()
   where id = p_req;
end $$;
revoke all on function public._link_friends(uuid, uuid) from public, anon, authenticated;

create or replace function public.send_friend_request(p_friend_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_friend public.friends%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  if position('@' in v_email) < 2 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Escreve um email válido.';
  end if;

  select * into v_friend from public.friends where id = p_friend_id and owner_id = uid for update;
  if not found then raise exception 'Amigo não encontrado.'; end if;
  if v_friend.status = 'connected' then raise exception 'Já estão ligados.'; end if;

  if v_email = lower((select email from auth.users where id = uid)) then
    raise exception 'Não podes enviar um pedido a ti próprio.';
  end if;
  if exists (select 1 from public.friend_requests
              where friend_id = p_friend_id and status in ('pending', 'awaiting_confirmation')) then
    raise exception 'Já enviaste um pedido a este amigo.';
  end if;

  insert into public.friend_requests (from_user_id, friend_id, to_email) values (uid, p_friend_id, v_email);
  update public.friends set status = 'invited' where id = p_friend_id;
end $$;

create function public.send_friend_request_phone(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_friend public.friends%rowtype;
  v_phone text;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into v_friend from public.friends where id = p_friend_id and owner_id = uid for update;
  if not found then raise exception 'Amigo não encontrado.'; end if;
  if v_friend.status = 'connected' then raise exception 'Já estão ligados.'; end if;

  v_phone := public.normalize_phone(v_friend.phone);
  if v_phone is null then raise exception 'Guarda o número de telemóvel deste amigo.'; end if;
  if v_phone = (select phone from public.profiles where id = uid) then
    raise exception 'Não podes enviar um pedido a ti próprio.';
  end if;
  if exists (select 1 from public.friend_requests
              where friend_id = p_friend_id and status in ('pending', 'awaiting_confirmation')) then
    raise exception 'Já enviaste um pedido a este amigo.';
  end if;

  insert into public.friend_requests (from_user_id, friend_id, to_phone) values (uid, p_friend_id, v_phone);
  update public.friends set status = 'invited' where id = p_friend_id;
end $$;

create or replace function public.cancel_friend_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_req public.friend_requests%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into v_req from public.friend_requests
   where id = p_id and from_user_id = uid and status in ('pending', 'awaiting_confirmation') for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  update public.friend_requests set status = 'cancelled', responded_at = now() where id = p_id;
  update public.friends set status = 'local' where id = v_req.friend_id and status = 'invited';
end $$;

drop function public.list_incoming_requests();
create function public.list_incoming_requests()
returns table (id uuid, from_name text, created_at timestamptz, via text, awaiting boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         coalesce(nullif(btrim(p.full_name), ''), su.email, 'Alguém') as from_name,
         r.created_at,
         case when r.to_email is not null then 'email' else 'phone' end as via,
         (r.status = 'awaiting_confirmation') as awaiting
    from public.friend_requests r
    join auth.users me on me.id = auth.uid()
    left join public.profiles mp on mp.id = me.id
    left join public.profiles p on p.id = r.from_user_id
    left join auth.users su on su.id = r.from_user_id
   where me.email_confirmed_at is not null
     and r.from_user_id <> me.id
     and (
       (r.status = 'pending' and (
          (r.to_email is not null and r.to_email = lower(me.email))
          or (r.to_phone is not null and mp.phone is not null and r.to_phone = mp.phone
              and not (me.id = any (r.rejected_by)))
       ))
       or (r.status = 'awaiting_confirmation' and r.accepted_by = me.id)
     )
   order by r.created_at desc
$$;
revoke all on function public.list_incoming_requests() from public, anon;
grant execute on function public.list_incoming_requests() to authenticated;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_me auth.users%rowtype;
  v_phone text;
  v_req public.friend_requests%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into v_me from auth.users where id = uid;
  if v_me.email_confirmed_at is null then raise exception 'Pedido não encontrado.'; end if;

  select * into v_req from public.friend_requests where id = p_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if v_req.from_user_id = uid then raise exception 'Não podes aceitar o teu próprio pedido.'; end if;

  if v_req.to_email is not null then
    -- Por email (verificado): liga logo ao aceitar.
    if v_req.to_email <> lower(v_me.email) then raise exception 'Pedido não encontrado.'; end if;
    if v_req.status <> 'pending' then return; end if;
    if not p_accept then
      update public.friend_requests set status = 'declined', responded_at = now() where id = p_id;
      update public.friends set status = 'local' where id = v_req.friend_id and status = 'invited';
      return;
    end if;
    perform public._link_friends(p_id, uid);
    return;
  end if;

  -- Por número (não verificado): aceitar fica à espera da confirmação de quem pediu.
  select phone into v_phone from public.profiles where id = uid;
  if v_phone is null or v_req.to_phone <> v_phone then raise exception 'Pedido não encontrado.'; end if;

  if v_req.status = 'awaiting_confirmation' then
    if v_req.accepted_by = uid and not p_accept then
      update public.friend_requests
         set status = 'pending', accepted_by = null, rejected_by = array_append(rejected_by, uid)
       where id = p_id;
    end if;
    return;
  end if;
  if v_req.status <> 'pending' then return; end if;
  if uid = any (v_req.rejected_by) then raise exception 'Pedido não encontrado.'; end if;

  if p_accept then
    if exists (select 1 from public.friends where id = v_req.friend_id and (status = 'connected' or linked_user_id is not null))
       or exists (select 1 from public.friends where owner_id = uid and linked_user_id = v_req.from_user_id) then
      raise exception 'Já estão ligados.';
    end if;
    update public.friend_requests set status = 'awaiting_confirmation', accepted_by = uid where id = p_id;
  else
    update public.friend_requests set rejected_by = array_append(rejected_by, uid) where id = p_id;
  end if;
end $$;

create function public.confirm_friend_request(p_id uuid, p_confirm boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_req public.friend_requests%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into v_req from public.friend_requests
   where id = p_id and from_user_id = uid and status = 'awaiting_confirmation' for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  if p_confirm then
    perform public._link_friends(p_id, v_req.accepted_by);
  else
    update public.friend_requests
       set status = 'pending', accepted_by = null, rejected_by = array_append(rejected_by, v_req.accepted_by)
     where id = p_id;
  end if;
end $$;

create function public.get_request_accepter(p_id uuid)
returns table (name text, email_hint text)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(p.full_name), ''), 'Sem nome') as name,
         left(u.email, 1) || '***@' || split_part(u.email, '@', 2) as email_hint
    from public.friend_requests r
    join auth.users u on u.id = r.accepted_by
    left join public.profiles p on p.id = r.accepted_by
   where r.id = p_id and r.from_user_id = auth.uid() and r.status = 'awaiting_confirmation'
$$;

revoke all on function public.send_friend_request_phone(uuid) from public, anon;
revoke all on function public.confirm_friend_request(uuid, boolean) from public, anon;
revoke all on function public.get_request_accepter(uuid) from public, anon;
grant execute on function public.send_friend_request_phone(uuid) to authenticated;
grant execute on function public.confirm_friend_request(uuid, boolean) to authenticated;
grant execute on function public.get_request_accepter(uuid) to authenticated;
