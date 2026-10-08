-- Orcamentos mensais por categoria (Fase 5).

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month date not null, -- sempre dia 1 do mes (ex: 2026-10-01)
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create index budgets_user_month_idx on public.budgets (user_id, month);

alter table public.budgets enable row level security;

create policy "budgets_self" on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
