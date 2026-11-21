-- Orçamentos e recorrentes (voltam depois de terem sido apagadas a 17/10 por
-- não terem interface). Desta vez com ecrã.
--
-- budgets: um limite MENSAL por categoria de despesa, que vale para todos os
-- meses (muda-se a qualquer altura). Mais simples do que uma linha por mês.
-- recurring_transactions: modelos que o utilizador lança com um toque quando
-- chega o dia; não precisa de cron nem de Edge Functions.

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create index if not exists budgets_user_idx on public.budgets (user_id);

alter table public.budgets enable row level security;

drop policy if exists "budgets_self" on public.budgets;
create policy "budgets_self" on public.budgets
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  note text,
  day_of_month smallint not null check (day_of_month between 1 and 28),
  active boolean not null default true,
  last_generated_month date, -- dia 1 do último mês em que foi lançada
  created_at timestamptz not null default now()
);

create index if not exists recurring_transactions_user_idx
  on public.recurring_transactions (user_id);

alter table public.recurring_transactions enable row level security;

drop policy if exists "recurring_transactions_self" on public.recurring_transactions;
create policy "recurring_transactions_self" on public.recurring_transactions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
