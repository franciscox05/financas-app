-- Limpeza pontual do estrago do bug de `deleteEntry` (corrigido em friendsDb.js
-- na mesma PR): apagar uma dívida de amigo criada pelo "Paguei eu" deixava a
-- transação bancária na conta, porque o teste era `settlement === 'bank'` e esse
-- fluxo nunca preenche `settlement`. O Francisco apagou e recriou um empréstimo
-- de 4.490€ e ficou com duas transações iguais: -8.980€ no património, com a
-- segunda invisível no conta-corrente (FK a NULL).
--
-- Não é um backfill genérico de propósito: uma transação sem referência em
-- `ledger_entries` é, no caso normal, apenas uma transação comum — não há
-- marcador que distinga "ficou órfã" de "nunca teve amigo". Por isso a limpeza
-- é pela assinatura exata do bug (uma órfã que tem gémea idêntica — mesmo
-- utilizador, conta, valor, tipo, data e nota — essa sim referenciada por um
-- movimento), que em toda a base de dados devolveu uma única linha: a de
-- 4.490€ de 06/11 22:35 do Francisco. Nada é apagado se já não houver gémea.
delete from public.transactions t
where not exists (
    select 1 from public.ledger_entries le where le.transaction_id = t.id
  )
  and exists (
    select 1
    from public.transactions g
    join public.ledger_entries le2 on le2.transaction_id = g.id
    where g.user_id = t.user_id
      and g.id <> t.id
      and g.account_id is not distinct from t.account_id
      and g.amount = t.amount
      and g.type = t.type
      and g.occurred_on = t.occurred_on
      and g.note is not distinct from t.note
      -- A gémea referenciada tem de ser a mais recente: apaga-se a cópia
      -- deixada para trás, nunca a que está ligada ao movimento atual.
      and g.created_at > t.created_at
  );
