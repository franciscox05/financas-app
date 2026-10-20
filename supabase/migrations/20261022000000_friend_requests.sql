-- Pedidos de amizade entre utilizadores. O cliente nunca escreve aqui: tudo passa pelas funções abaixo.

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null,
  to_email text not null check (to_email <> '' and to_email = lower(btrim(to_email))),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_friend_fkey
    foreign key (friend_id, from_user_id) references public.friends (id, owner_id) on delete cascade
);

create unique index friend_requests_one_pending_key
  on public.friend_requests (friend_id) where status = 'pending';
create index friend_requests_to_email_idx on public.friend_requests (to_email) where status = 'pending';

alter table public.friend_requests enable row level security;
-- O remetente lê os seus pedidos; sem políticas de escrita, o cliente não escreve diretamente.
create policy friend_requests_sender_read on public.friend_requests
  for select using (from_user_id = auth.uid());
revoke insert, update, delete on public.friend_requests from authenticated, anon;

create function public.send_friend_request(p_friend_id uuid, p_email text)
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
  if exists (select 1 from public.friend_requests where friend_id = p_friend_id and status = 'pending') then
    raise exception 'Já enviaste um pedido a este amigo.';
  end if;

  insert into public.friend_requests (from_user_id, friend_id, to_email) values (uid, p_friend_id, v_email);
  update public.friends set status = 'invited' where id = p_friend_id;
end $$;

create function public.cancel_friend_request(p_id uuid)
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
   where id = p_id and from_user_id = uid and status = 'pending' for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  update public.friend_requests set status = 'cancelled', responded_at = now() where id = p_id;
  update public.friends set status = 'local' where id = v_req.friend_id and status = 'invited';
end $$;

create function public.list_incoming_requests()
returns table (id uuid, from_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         coalesce(nullif(btrim(p.full_name), ''), su.email, 'Alguém') as from_name,
         r.created_at
    from public.friend_requests r
    join auth.users me on me.id = auth.uid()
    left join public.profiles p on p.id = r.from_user_id
    left join auth.users su on su.id = r.from_user_id
   where r.status = 'pending'
     and me.email_confirmed_at is not null
     and r.to_email = lower(me.email)
   order by r.created_at desc
$$;

create function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_me auth.users%rowtype;
  v_req public.friend_requests%rowtype;
  v_name text;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into v_me from auth.users where id = uid;
  if v_me.email_confirmed_at is null then raise exception 'Pedido não encontrado.'; end if;

  select * into v_req from public.friend_requests
   where id = p_id and to_email = lower(v_me.email) for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if v_req.status <> 'pending' then return; end if;

  if not p_accept then
    update public.friend_requests set status = 'declined', responded_at = now() where id = p_id;
    update public.friends set status = 'local' where id = v_req.friend_id and status = 'invited';
    return;
  end if;

  if v_req.from_user_id = uid then raise exception 'Não podes aceitar o teu próprio pedido.'; end if;
  if exists (select 1 from public.friends where id = v_req.friend_id and (status = 'connected' or linked_user_id is not null))
     or exists (select 1 from public.friends where owner_id = uid and linked_user_id = v_req.from_user_id) then
    raise exception 'Já estão ligados.';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), su.email, 'Amigo') into v_name
    from auth.users su left join public.profiles p on p.id = su.id where su.id = v_req.from_user_id;
  if exists (select 1 from public.friends where owner_id = uid and lower(btrim(name)) = lower(btrim(v_name))) then
    v_name := v_name || ' (app)';
  end if;

  begin
    insert into public.friends (owner_id, name, status, linked_user_id)
    values (uid, v_name, 'connected', v_req.from_user_id);
    update public.friends set status = 'connected', linked_user_id = uid where id = v_req.friend_id;
  exception when unique_violation then
    raise exception 'Já estão ligados.';
  end;

  update public.friend_requests set status = 'accepted', responded_at = now() where id = p_id;
end $$;

revoke all on function public.send_friend_request(uuid, text) from public, anon;
revoke all on function public.cancel_friend_request(uuid) from public, anon;
revoke all on function public.list_incoming_requests() from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.send_friend_request(uuid, text) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.list_incoming_requests() to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
