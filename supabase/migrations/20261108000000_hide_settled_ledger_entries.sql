-- Bug reportado em produção: uma dívida de amigos já liquidada (saldo do
-- amigo a voltar a zero) continuava a aparecer no Registo como uma despesa
-- solta ao lado da própria transação de liquidação — duplicação visual.
-- O saldo das contas e o Balanço não são afetados por este bug nem por esta
-- correção: accountBalance.balanceAt() e listTransactionsInRange() só leem
-- transactions/transfers, nunca ledger_entries.
--
-- O modelo é de saldo corrente (friend_balances soma todas as entradas
-- confirmed/cancel_requested desde sempre, sem ligação entre uma liquidação
-- e as dívidas que ela paga) — não se introduz aqui reconciliação por
-- fatura. Só se esconde do Registo o que já não interessa ver: quando o
-- saldo de um amigo volta a zero, as entradas anteriores desse amigo deixam
-- de aparecer na view `movements`, mas continuam a contar em
-- friend_balances exatamente como sempre contaram (nenhuma linha é alterada
-- a nível de kind/amount/status, só a flag de visibilidade no feed).

alter table public.ledger_entries
  add column hidden_from_feed boolean not null default false;

-- Dispara depois de uma entrada de pagamento/devolução ficar confirmed —
-- tanto no INSERT direto (amigo local, criado já confirmed) como no UPDATE
-- de status feito por respond_entry (amigo ligado) — e verifica o saldo
-- desse amigo do lado de quem confirmou. Um trigger evita duplicar esta
-- regra em dois sítios (createRepayment em JS e create_shared_entry/
-- respond_entry em SQL): cobre os dois caminhos com a mesma lógica.
create function public._hide_settled_ledger_entries() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cents bigint;
begin
  select coalesce(sum(round(amount * 100) * case kind
           when 'paid_for_them' then 1 when 'repaid_to_them' then 1 else -1 end), 0)::bigint
    into v_cents
    from public.ledger_entries
   where user_id = new.user_id and friend_id = new.friend_id
     and status in ('confirmed', 'cancel_requested');

  -- Só quando o saldo fica exatamente a zero (quites) — uma devolução que
  -- passe para o lado contrário (overshoot sem "perdão da diferença") não
  -- fecha nada, fica tudo visível como dívida em aberto na direção inversa.
  if v_cents = 0 then
    update public.ledger_entries
       set hidden_from_feed = true
     where user_id = new.user_id and friend_id = new.friend_id
       and status in ('confirmed', 'cancel_requested')
       and hidden_from_feed = false
       and id <> new.id;
  end if;
  return null;
end $$;

create trigger ledger_entries_hide_settled
  after insert or update of status on public.ledger_entries
  for each row
  when (new.status = 'confirmed' and new.kind in ('repaid_to_me', 'repaid_to_them'))
  execute function public._hide_settled_ledger_entries();

revoke all on function public._hide_settled_ledger_entries() from public, anon, authenticated;

-- Só o WHERE da origem `ledger` muda (mais "and not e.hidden_from_feed");
-- o select list é igual ao de 20261104010000, por isso create or replace
-- chega (o drop+create de outras migrations desta view era só por causa de
-- um tipo de coluna inferido de outra forma, não é o caso aqui).
create or replace view public.movements
with (security_invoker = true) as
select
  t.id,
  t.user_id,
  'transaction'::text as source,
  t.type,
  t.amount,
  t.account_id,
  a.name as account_name,
  null::uuid as counter_account_id,
  null::text as counter_account_name,
  t.category_id,
  c.name as category_name,
  false as counts_as_expense,
  t.note,
  t.occurred_on,
  t.created_at,
  null::uuid as friend_id,
  null::text as friend_name,
  null::text as ledger_status,
  null::text as ledger_kind
from public.transactions t
left join public.accounts a on a.id = t.account_id
left join public.categories c on c.id = t.category_id
where not exists (
  select 1 from public.ledger_entries le
  where le.transaction_id = t.id
    and le.status = 'cancel_requested'
    and le.cancel_requested_by = t.user_id
)
union all
select
  tr.id,
  tr.user_id,
  'transfer'::text as source,
  case when tr.counts_as_expense then 'expense' else 'transfer' end as type,
  tr.amount,
  tr.from_account_id as account_id,
  fa.name as account_name,
  tr.to_account_id as counter_account_id,
  ta.name as counter_account_name,
  tr.category_id,
  tc.name as category_name,
  tr.counts_as_expense,
  tr.note,
  tr.occurred_on,
  tr.created_at,
  null::uuid as friend_id,
  null::text as friend_name,
  null::text as ledger_status,
  null::text as ledger_kind
from public.transfers tr
left join public.accounts fa on fa.id = tr.from_account_id
left join public.accounts ta on ta.id = tr.to_account_id
left join public.categories tc on tc.id = tr.category_id
union all
select
  e.id,
  e.user_id,
  'ledger'::text as source,
  case when (case e.kind
               when 'paid_for_them' then e.amount
               when 'repaid_to_them' then e.amount
               else -e.amount
             end) > 0 then 'income' else 'expense' end as type,
  abs(case e.kind
        when 'paid_for_them' then e.amount
        when 'repaid_to_them' then e.amount
        else -e.amount
      end) as amount,
  null::uuid as account_id,
  null::text as account_name,
  null::uuid as counter_account_id,
  null::text as counter_account_name,
  null::uuid as category_id,
  null::text as category_name,
  false as counts_as_expense,
  e.note,
  e.occurred_on,
  e.created_at,
  e.friend_id,
  f.name as friend_name,
  e.status as ledger_status,
  e.kind as ledger_kind
from public.ledger_entries e
join public.friends f on f.id = e.friend_id
where not e.hidden_from_feed
  and e.transaction_id is null
  and (
    e.status = 'confirmed'
    or (e.status = 'cancel_requested' and e.cancel_requested_by <> e.user_id)
    or (e.status in ('pending', 'declined') and e.created_by = e.user_id)
  );
