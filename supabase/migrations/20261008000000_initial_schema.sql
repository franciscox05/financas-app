-- Esquema inicial: profiles, accounts, categories, transactions, net_worth_snapshots
-- Isolamento por utilizador via RLS (user_id = auth.uid()) em todas as tabelas.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'investment')),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  value numeric(12, 2) not null check (value >= 0),
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index net_worth_snapshots_user_date_idx on public.net_worth_snapshots (user_id, snapshot_date desc);

-- RLS: cada utilizador só acede aos seus próprios dados.

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.net_worth_snapshots enable row level security;

create policy "profiles_self" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "accounts_self" on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories_self" on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "transactions_self" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "net_worth_snapshots_self" on public.net_worth_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No signup: cria profile + semeia contas/categorias default para o novo utilizador.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.accounts (user_id, name, type) values
    (new.id, 'Conta à Ordem', 'cash'),
    (new.id, 'XTB', 'investment'),
    (new.id, 'Trade Republic', 'investment');

  insert into public.categories (user_id, name, type) values
    (new.id, 'Salário', 'income'),
    (new.id, 'Outros Ganhos', 'income'),
    (new.id, 'Alimentação', 'expense'),
    (new.id, 'Transporte', 'expense'),
    (new.id, 'Casa', 'expense'),
    (new.id, 'Lazer', 'expense'),
    (new.id, 'Saúde', 'expense'),
    (new.id, 'Outros Gastos', 'expense');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
