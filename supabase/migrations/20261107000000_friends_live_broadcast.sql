-- Ao adicionar/editar/apagar um amigo, a app só recarregava na aba onde a ação aconteceu — outra
-- aba/dispositivo com a mesma conta aberta só via a mudança ao voltar a ficar visível (ou nem isso,
-- numa PWA iOS suspensa há muito tempo, obrigando a reiniciar a app). `friend_requests` e
-- `ledger_entries` já davam broadcast (ver 20261023010000/20261024000000); faltava `friends`.
-- Sem notificação push aqui de propósito — é sempre o próprio dono a mexer na sua lista, só precisa
-- de recarregar as outras abas, não de um alerta.

create or replace function public.friends_broadcast() returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('url', '/amigos'),
    'changed',
    'user:' || coalesce(new.owner_id, old.owner_id)::text,
    true
  );
  return null;
exception when others then
  raise warning 'live (friends): %', sqlerrm;
  return null;
end $$;

create trigger friends_broadcast
  after insert or update or delete on public.friends
  for each row execute function public.friends_broadcast();
