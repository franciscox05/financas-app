-- Complemento da 20261108000000: o trigger ali criado só dispara a partir de
-- agora, em pagamentos/confirmações futuras — não reage retroativamente a
-- contas que já estavam a zero antes de existir. Este backfill aplica a
-- mesma regra uma vez aos dados existentes: para cada par (user_id,
-- friend_id) já saldado (soma das entradas confirmed/cancel_requested = 0),
-- esconde tudo desse par menos a entrada mais recente (a que, na prática,
-- foi a que fechou a conta) — mesmo critério do trigger, só que aplicado ao
-- histórico de uma vez em vez de ao vivo.

with pairs as (
  select user_id, friend_id
    from public.ledger_entries
   where status in ('confirmed', 'cancel_requested')
   group by user_id, friend_id
  having sum(case kind
               when 'paid_for_them' then amount
               when 'repaid_to_them' then amount
               else -amount
             end) = 0
),
latest as (
  select distinct on (le.user_id, le.friend_id) le.id
    from public.ledger_entries le
    join pairs p on p.user_id = le.user_id and p.friend_id = le.friend_id
   where le.status in ('confirmed', 'cancel_requested')
   order by le.user_id, le.friend_id, le.created_at desc
)
update public.ledger_entries le
   set hidden_from_feed = true
  from pairs p
 where le.user_id = p.user_id
   and le.friend_id = p.friend_id
   and le.status in ('confirmed', 'cancel_requested')
   and le.hidden_from_feed = false
   and le.id not in (select id from latest);
