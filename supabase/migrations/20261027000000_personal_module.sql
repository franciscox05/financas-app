-- Módulo pessoal (Perfil): objetivos e notas em texto livre, só do próprio
-- utilizador. Sem ligação a dinheiro — ao contrário dos savings_goals
-- removidos antes (eram por valor/conta), isto é para qualquer tipo de
-- objetivo ("ler 12 livros", "treinar 3x por semana") ou nota pessoal.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  due_on date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;
alter table public.notes enable row level security;

create policy "goals_self" on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notes_self" on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index goals_user_idx on public.goals (user_id, done, due_on);
create index notes_user_idx on public.notes (user_id, created_at desc);
