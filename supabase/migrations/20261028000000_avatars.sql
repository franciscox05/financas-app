-- Foto de perfil: bucket público (ficheiro em si não é sensível, só o URL é
-- previsível) mas só o dono escreve o seu. Visível a amigos ligados através
-- de list_friend_avatars() (security definer) — profiles continua só legível
-- pelo próprio dono (profiles_self), isto é a única fresta propositada.

alter table public.profiles add column avatar_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Convenção de pasta: "{user_id}/avatar.ext" — (storage.foldername(name))[1] dá o 1º
-- segmento do caminho, que tem de ser o próprio uid para poder escrever/apagar.
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_owner_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Caminho (não URL completo) da foto de cada amigo ligado, para o cliente construir
-- o URL público. Só devolve quem está mesmo "connected" com quem chama.
create function public.list_friend_avatars() returns table(friend_id uuid, avatar_path text)
language sql
security definer
set search_path = public
as $$
  select f.id, p.avatar_path
  from public.friends f
  join public.profiles p on p.id = f.linked_user_id
  where f.owner_id = auth.uid() and f.status = 'connected' and p.avatar_path is not null
$$;

revoke all on function public.list_friend_avatars() from public, anon;
grant execute on function public.list_friend_avatars() to authenticated;
