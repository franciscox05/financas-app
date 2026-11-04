-- UX: o título da transação bancária de uma liquidação ficava
-- "Conta-corrente: <Nome> · <nota>" (ou só "Conta-corrente: <Nome>" sem
-- nota) — redundante, porque a lista do Registo já mostra o amigo como tag
-- separada na linha. Passa a gravar-se só a nota escrita pela pessoa, com
-- um rótulo genérico de fallback quando não há nota.

create or replace function public._create_bank_transaction(p_entry_id uuid) returns void
language plpgsql
set search_path = public
as $$
declare
  r public.ledger_entries%rowtype;
  v_tx uuid;
begin
  select * into r from public.ledger_entries where id = p_entry_id;
  if r.settlement is distinct from 'bank' or r.transaction_id is not null then return; end if;
  -- A conta ou a categoria escolhida pode ter sido apagada entretanto: confirma-se na mesma o
  -- movimento, só não há transação (a conta-corrente não depende dela).
  if not exists (select 1 from public.accounts where id = r.bank_account_id and user_id = r.user_id)
     or not exists (select 1 from public.categories where id = r.bank_category_id and user_id = r.user_id) then
    return;
  end if;
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note)
  values (r.user_id, r.bank_account_id, r.bank_category_id, r.amount,
          case r.kind when 'repaid_to_me' then 'income' else 'expense' end,
          r.occurred_on,
          coalesce(nullif(btrim(r.note), ''), 'Liquidação de dívida'))
  returning id into v_tx;
  update public.ledger_entries set transaction_id = v_tx where id = p_entry_id;
end $$;

-- Backfill: limpa o prefixo "Conta-corrente: <Nome> · " das transações já
-- criadas pela versão antiga da função, ficando só a nota original (ou o
-- rótulo genérico, se não havia nota nenhuma a seguir ao nome).
update public.transactions
   set note = coalesce(nullif(btrim(split_part(note, ' · ', 2)), ''), 'Liquidação de dívida')
 where note like 'Conta-corrente:%';
