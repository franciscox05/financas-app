-- Transferências entre contas próprias (ex.: Conta Corrente -> XTB ao investir).
-- Vivem fora de `transactions` de propósito: não são Gasto/Ganho, só dinheiro
-- a mudar de sítio, por isso nunca devem entrar nos totais de Balanço/Dashboard.
-- `accountBalance.balanceAt()` soma-as diretamente no saldo de cada conta.

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete restrict,
  to_account_id uuid not null references public.accounts (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create index transfers_user_idx on public.transfers (user_id);

alter table public.transfers enable row level security;

create policy "transfers_self" on public.transfers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
