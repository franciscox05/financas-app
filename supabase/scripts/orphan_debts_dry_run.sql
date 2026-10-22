-- Simulação (só leitura) da migração 20261025000000_migrate_orphan_debts.sql.
-- Conta, por utilizador, quantas linhas da tabela legada `debts` ainda não têm movimento
-- equivalente no conta-corrente. Não escreve nada; o ROLLBACK é só garantia extra.
-- Correr no SQL Editor do Supabase. NÃO está em migrations/ para nunca ser aplicado.
begin;

with kinds as (
  select d.id, d.user_id, d.amount, d.created_at, d.counterparty_name,
         case d.direction when 'owed_to_me' then 'paid_for_them' else 'paid_for_me' end as kind
  from public.debts d
)
select k.user_id,
       count(*) as dividas_por_migrar,
       count(distinct lower(btrim(k.counterparty_name))) as amigos_envolvidos,
       sum(k.amount) as valor_total
from kinds k
where not exists (
  select 1
  from public.friends f
  join public.ledger_entries e on e.friend_id = f.id and e.user_id = f.owner_id
  where f.owner_id = k.user_id
    and lower(btrim(f.name)) = lower(btrim(k.counterparty_name))
    and e.kind = k.kind and e.amount = k.amount and e.created_at = k.created_at
)
group by k.user_id
order by dividas_por_migrar desc;

-- Pagamentos ainda sem movimento equivalente (por utilizador).
select p.user_id, count(*) as pagamentos_por_migrar, sum(p.amount) as valor_total
from public.debt_payments p
join public.debts d on d.id = p.debt_id
where not exists (
  select 1
  from public.friends f
  join public.ledger_entries e on e.friend_id = f.id and e.user_id = f.owner_id
  where f.owner_id = p.user_id
    and lower(btrim(f.name)) = lower(btrim(d.counterparty_name))
    and e.kind = case d.direction when 'owed_to_me' then 'repaid_to_me' else 'repaid_to_them' end
    and e.amount = p.amount and e.created_at = p.created_at
)
group by p.user_id;

rollback;
