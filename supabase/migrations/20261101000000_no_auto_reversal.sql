-- Ajuste ao pedido anterior: mesmo quando o amigo contesta ("Contestar"), o
-- lado de quem criou o movimento não deve reverter sozinho — isso ainda era
-- uma dependência da ação dele. Um "declined" passa a ser só um aviso visual
-- (o decline_note já mostrado em entryStatusLabel): continua a contar e a
-- transação ligada não é apagada.
--
-- Isto só funciona se "Corrigir e reenviar" aposentar o movimento antigo —
-- senão reenviar duplicava a dívida (o antigo mantém-se a contar, o novo
-- também passaria a contar). retire_declined_entry faz essa limpeza, chamada
-- pelo cliente só depois do novo movimento ser criado com sucesso.

create or replace function public.respond_entry(
  p_id uuid, p_accept boolean, p_note text, p_settlement text, p_account_id uuid, p_category_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.ledger_entries%rowtype;
  m public.ledger_entries%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  perform public._lock_pair(p_id, uid);
  select * into e from public.ledger_entries where id = p_id;
  select * into m from public.ledger_entries where id = e.mirror_id;

  if e.status <> 'pending' then raise exception 'Este movimento já foi respondido.'; end if;
  if e.created_by is null or e.created_by = uid then raise exception 'Só a outra pessoa pode responder.'; end if;

  if p_accept then
    if e.kind in ('repaid_to_me', 'repaid_to_them') then
      if p_settlement is null or p_settlement not in ('bank', 'cash', 'offset') then raise exception 'Escolhe como foi pago.'; end if;
      if p_settlement = 'bank' then perform public._check_bank_choice(uid, p_account_id, p_category_id); end if;
      update public.ledger_entries
         set settlement = p_settlement,
             bank_account_id = case when p_settlement = 'bank' then p_account_id end,
             bank_category_id = case when p_settlement = 'bank' then p_category_id end
       where id = e.id;
    end if;
    update public.ledger_entries set status = 'confirmed' where id in (e.id, m.id);
    perform public._create_bank_transaction(e.id);
    perform public._create_bank_transaction(m.id);
  else
    -- Só um aviso: o lado de quem criou (m) continua a contar e mantém a
    -- transação, se tiver uma — nada se reverte sozinho por causa do outro.
    update public.ledger_entries set status = 'cancelled' where id = e.id;
    update public.ledger_entries set status = 'declined', decline_note = nullif(btrim(p_note), '') where id = m.id;
    if m.is_opening then
      update public.ledger_entries set status = 'confirmed'
       where user_id = m.user_id and friend_id = m.friend_id and status = 'archived';
    end if;
  end if;
end $$;

revoke all on function public.respond_entry(uuid, boolean, text, text, uuid, uuid) from public, anon;
grant execute on function public.respond_entry(uuid, boolean, text, text, uuid, uuid) to authenticated;

-- Aposenta um movimento contestado depois de "Corrigir e reenviar" ter criado o
-- substituto — evita contar os dois. Só o próprio dono do movimento contestado.
create function public.retire_declined_entry(p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.ledger_entries%rowtype;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into e from public.ledger_entries where id = p_id and user_id = uid;
  if not found then raise exception 'Movimento não encontrado.'; end if;
  if e.status <> 'declined' or e.created_by is distinct from uid then
    raise exception 'Só podes substituir um movimento teu contestado.';
  end if;
  update public.ledger_entries set status = 'cancelled' where id = e.id;
  if e.transaction_id is not null then
    delete from public.transactions where id = e.transaction_id;
    update public.ledger_entries set transaction_id = null where id = e.id;
  end if;
end $$;

revoke all on function public.retire_declined_entry(uuid) from public, anon;
grant execute on function public.retire_declined_entry(uuid) to authenticated;
