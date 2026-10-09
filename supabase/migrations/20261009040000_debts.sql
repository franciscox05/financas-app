-- Dívidas (IOU) unilaterais: "alguém deve-me" ou "devo a alguém", opcionalmente
-- associadas à transação que as originou. Ao acertar, gera a transação de
-- reembolso correspondente para o saldo ficar sempre a bater certo.

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  direction text not null check (direction in ('owed_to_me', 'i_owe')),
  counterparty_name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  transaction_id uuid references public.transactions (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'settled')),
  settled_transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index debts_user_status_idx on public.debts (user_id, status);

alter table public.debts enable row level security;

create policy "debts_self" on public.debts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
