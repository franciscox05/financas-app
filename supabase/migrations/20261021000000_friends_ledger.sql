-- Amigos e conta-corrente: livro de movimentos por amigo. O saldo é calculado, nunca guardado.
-- balance > 0: o amigo deve-me; balance < 0: eu devo ao amigo.

create table public.friends (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  linked_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'local' check (status in ('local', 'invited', 'connected')),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create index friends_owner_id_idx on public.friends (owner_id);
create unique index friends_owner_linked_user_key
  on public.friends (owner_id, linked_user_id) where linked_user_id is not null;
create unique index friends_owner_name_key
  on public.friends (owner_id, lower(btrim(name)));

alter table public.friends enable row level security;
create policy friends_self on public.friends
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null,
  kind text not null check (kind in ('paid_for_them', 'paid_for_me', 'repaid_to_me', 'repaid_to_them')),
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  occurred_on date not null default current_date,
  due_on date,
  settlement text check (settlement in ('bank', 'cash', 'offset')),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ledger_entries_friend_owner_fkey
    foreign key (friend_id, user_id) references public.friends (id, owner_id) on delete cascade,
  constraint ledger_entries_settlement_only_on_repaid
    check (settlement is null or kind in ('repaid_to_me', 'repaid_to_them'))
);

create index ledger_entries_user_friend_idx on public.ledger_entries (user_id, friend_id);

alter table public.ledger_entries enable row level security;
create policy ledger_entries_self on public.ledger_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create view public.friend_balances with (security_invoker = true) as
select
  friend_id,
  user_id,
  sum(case kind
    when 'paid_for_them' then amount
    when 'repaid_to_them' then amount
    else -amount
  end) as balance
from public.ledger_entries
group by friend_id, user_id;

grant select on public.friend_balances to authenticated;

alter table public.profiles add column mbway_phone text;
