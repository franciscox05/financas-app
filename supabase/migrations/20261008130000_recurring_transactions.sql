-- Transacoes recorrentes (Fase 5): templates que o utilizador lanca manualmente
-- com um toque quando chega o mes, sem precisar de Edge Functions/pg_cron.

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  note text,
  day_of_month smallint not null check (day_of_month between 1 and 28),
  active boolean not null default true,
  last_generated_month date, -- dia 1 do ultimo mes em que foi lancada
  created_at timestamptz not null default now()
);

create index recurring_transactions_user_idx on public.recurring_transactions (user_id);

alter table public.recurring_transactions enable row level security;

create policy "recurring_transactions_self" on public.recurring_transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
