-- Atualização ao vivo em TODAS as mudanças de movimentos e pedidos, não só nas que dão push.
--
-- Até aqui o broadcast para o canal `user:<id>` só saía de dentro de `_push`, chamado pelos
-- triggers de push apenas em certas transições (movimento pendente criado pelo amigo, aceite,
-- contestado, pedido de anulação…). Ficavam sem aviso: movimentos já confirmados (contagem
-- unilateral), edições de valor/nota/data, liquidações, movimentos apagados ou escondidos,
-- pedidos de amizade cancelados ou recusados. O outro lado (ou a mesma conta noutro dispositivo)
-- só via a mudança depois de refrescar a página — o problema relatado nas páginas de Amigos.
--
-- Estes triggers só fazem broadcast (sem push): o push continua a cargo dos triggers existentes.
-- Um broadcast repetido é inofensivo — o cliente junta rajadas num só recarregamento
-- (src/lib/liveUpdates.js). Falhas no Realtime nunca bloqueiam a escrita.

create or replace function public._live(p_user uuid, p_url text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then return; end if;
  perform realtime.send(jsonb_build_object('url', p_url), 'changed', 'user:' || p_user::text, true);
exception when others then
  raise warning 'live: %', sqlerrm;
end $$;

revoke all on function public._live(uuid, text) from public, anon, authenticated;

-- Correção ao 20261107000000: `friends_broadcast` corria como o utilizador (`authenticated`), que
-- não tem política de INSERT em `realtime.messages` — o `realtime.send` falhava com "violates
-- row-level security policy" e o erro era engolido, por isso criar/editar um amigo diretamente
-- nunca chegava às outras abas. Passa a usar `_live` (security definer).
create or replace function public.friends_broadcast() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._live(coalesce(new.owner_id, old.owner_id), '/amigos');
  return null;
exception when others then
  raise warning 'live (friends): %', sqlerrm;
  return null;
end $$;

-- Movimentos: cada lado tem a sua própria linha (o espelho pertence ao amigo), por isso avisar o
-- dono da linha chega para cobrir os dois lados de qualquer alteração.
-- security definer: quem escreve é `authenticated`, que (de propósito) não pode chamar `_live`.
create or replace function public.ledger_entries_live() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ledger_entries%rowtype := coalesce(new, old);
begin
  perform public._live(r.user_id, '/dividas/' || r.friend_id);
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    perform public._live(old.user_id, '/dividas/' || old.friend_id);
  end if;
  return null;
exception when others then
  raise warning 'live (ledger_entries): %', sqlerrm;
  return null;
end $$;

drop trigger if exists ledger_entries_live on public.ledger_entries;
create trigger ledger_entries_live
  after insert or update or delete on public.ledger_entries
  for each row execute function public.ledger_entries_live();

-- Pedidos de amizade: avisa quem enviou, quem aceitou (antes e depois) e os destinatários
-- (por email ou telemóvel), para o pedido aparecer/desaparecer ao vivo dos dois lados.
create or replace function public.friend_requests_live() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.friend_requests%rowtype := coalesce(new, old);
  v_to uuid;
begin
  perform public._live(r.from_user_id, '/dividas/' || r.friend_id);
  perform public._live(r.accepted_by, '/dividas');
  if tg_op = 'UPDATE' and old.accepted_by is distinct from new.accepted_by then
    perform public._live(old.accepted_by, '/dividas');
  end if;

  for v_to in
    select u.id
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id <> r.from_user_id
       and u.id is distinct from r.accepted_by
       and ((r.to_email is not null and lower(u.email) = r.to_email)
            or (r.to_phone is not null and p.phone = r.to_phone))
  loop
    perform public._live(v_to, '/dividas');
  end loop;
  return null;
exception when others then
  raise warning 'live (friend_requests): %', sqlerrm;
  return null;
end $$;

drop trigger if exists friend_requests_live on public.friend_requests;
create trigger friend_requests_live
  after insert or update or delete on public.friend_requests
  for each row execute function public.friend_requests_live();
