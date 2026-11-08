-- Ordem manual das contas (pedido do Francisco): a lista era sempre alfabética,
-- por isso "Conta à Ordem" vinha antes de "Dinheiro" e do "Cofre" sem que ele
-- pudesse pôr à frente a que usa mais. A ordem é por utilizador e independente
-- do tipo — a separação Liquidez/Investimento no Património continua a vir de
-- `accounts.type`, isto só decide a ordem DENTRO de cada bloco.
alter table public.accounts
  add column if not exists sort_order integer not null default 0;

-- Backfill: mantém a ordem que cada pessoa já via (alfabética), para a lista
-- não saltar sozinha na primeira vez. A partir daqui é ela que manda.
with ordered as (
  select id, row_number() over (partition by user_id order by name) as pos
  from public.accounts
)
update public.accounts a
   set sort_order = ordered.pos
  from ordered
 where ordered.id = a.id
   and a.sort_order = 0;

create index if not exists accounts_user_sort_idx on public.accounts (user_id, sort_order);
