-- Metas de poupança: um alvo (valor + data opcional) sobre uma conta já
-- existente (cash ou investimento). O progresso é calculado no frontend a
-- partir do saldo/último snapshot dessa conta — não duplica contabilidade.

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  target_date date,
  created_at timestamptz not null default now()
);

create index savings_goals_user_idx on public.savings_goals (user_id);

alter table public.savings_goals enable row level security;

create policy "savings_goals_self" on public.savings_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
