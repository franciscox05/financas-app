-- Pagamentos parciais de dívidas: cada pagamento é um evento próprio (com a
-- transação bancária correspondente). O saldo em dívida é sempre
-- debts.amount - soma(debt_payments.amount), calculado na app.
-- Dívidas já acertadas antes desta migração continuam válidas (status 'settled').

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index debt_payments_debt_idx on public.debt_payments (debt_id);
create index debt_payments_user_idx on public.debt_payments (user_id);

alter table public.debt_payments enable row level security;

create policy "debt_payments_self" on public.debt_payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nota ao fechar uma dívida "por acerto" (sem transação bancária).
alter table public.debts add column settled_note text;
