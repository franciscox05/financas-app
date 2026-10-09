-- Dicionario de regras de categorizacao: o utilizador associa uma palavra-
-- chave (ex. "gas") a uma categoria, e isso aplica-se automaticamente a
-- qualquer nota que contenha essa palavra-chave (ex. "gasolina", "gasóleo",
-- "gasolina bmw") em futuras importacoes -- sem ter de repetir a escolha em
-- cada mes so porque a mesma despesa foi escrita de forma diferente.

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  keyword text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index category_rules_user_idx on public.category_rules (user_id);

alter table public.category_rules enable row level security;

create policy "category_rules_self" on public.category_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
