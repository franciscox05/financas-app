-- Saldo anterior: ao ligar contas, o histórico privado de um contacto pode ser resumido numa só entrada
-- para o outro aceitar. As entradas antigas passam a archived (visíveis, mas fora do saldo); se a
-- proposta for contestada ou cancelada, voltam a contar (ver respond_entry e cancel_pending_entry).

create function public.share_opening_balance(p_friend_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  f public.friends%rowtype;
  v_other_friend uuid;
  v_cents bigint;
  v_kind text;
  v_own uuid;
  v_mirror uuid;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into f from public.friends where id = p_friend_id and owner_id = uid for update;
  if not found then raise exception 'Amigo não encontrado.'; end if;
  if f.status <> 'connected' or f.linked_user_id is null then
    raise exception 'Este amigo ainda não está ligado.';
  end if;
  select id into v_other_friend from public.friends
   where owner_id = f.linked_user_id and linked_user_id = uid and status = 'connected';
  if v_other_friend is null then raise exception 'Este amigo ainda não está ligado.'; end if;

  if exists (select 1 from public.ledger_entries
              where user_id = uid and friend_id = p_friend_id and is_opening and status = 'pending') then
    raise exception 'Já enviaste o saldo anterior. Falta a outra pessoa confirmar.';
  end if;

  -- Só entradas privadas (nunca partilhadas) e confirmadas entram no saldo anterior.
  select coalesce(sum(round(amount * 100) * case kind
           when 'paid_for_them' then 1 when 'repaid_to_them' then 1 else -1 end), 0)::bigint
    into v_cents
    from public.ledger_entries
   where user_id = uid and friend_id = p_friend_id and status = 'confirmed' and mirror_id is null;
  if v_cents = 0 then raise exception 'Não há saldo anterior para partilhar.'; end if;

  update public.ledger_entries set status = 'archived'
   where user_id = uid and friend_id = p_friend_id and status = 'confirmed' and mirror_id is null;

  v_kind := case when v_cents > 0 then 'paid_for_them' else 'paid_for_me' end;

  insert into public.ledger_entries
    (user_id, friend_id, kind, amount, note, occurred_on, status, created_by, is_opening)
  values
    (uid, p_friend_id, v_kind, abs(v_cents) / 100.0, 'Saldo anterior', current_date, 'pending', uid, true)
  returning id into v_own;

  insert into public.ledger_entries
    (user_id, friend_id, kind, amount, note, occurred_on, status, created_by, is_opening)
  values
    (f.linked_user_id, v_other_friend, public._invert_kind(v_kind), abs(v_cents) / 100.0, 'Saldo anterior',
     current_date, 'pending', uid, true)
  returning id into v_mirror;

  update public.ledger_entries set mirror_id = v_mirror where id = v_own;
  update public.ledger_entries set mirror_id = v_own where id = v_mirror;
  return v_own;
end $$;

revoke all on function public.share_opening_balance(uuid) from public, anon;
grant execute on function public.share_opening_balance(uuid) to authenticated;
