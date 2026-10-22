-- Dois bugs encontrados em revisão de código sobre o modelo de conta-corrente:
--
-- 1) ledger_entries_guard deixava o cliente editar/apagar linhas 'archived'
--    (criadas por share_opening_balance ao resumir o histórico privado). Só
--    'confirmed' sem mirror_id devia ser editável/apagável diretamente — o
--    resto ('archived' incluído) só muda de estado através das funções
--    security definer (respond_entry/cancel_pending_entry/respond_cancel).
--
-- 2) share_opening_balance somava o histórico privado numa SELECT e só depois
--    arquivava com uma UPDATE separada, sem bloquear as linhas entre as duas
--    — uma entrada confirmada no meio da janela entrava no UPDATE (que
--    recalcula o WHERE na altura em que corre) sem ter entrado na soma,
--    desaparecendo do saldo. Agora bloqueia e soma as linhas numa única
--    instrução (CTE com FOR UPDATE), e só essas linhas (por id) são
--    arquivadas — uma confirmação concorrente simplesmente não entra na
--    foto e fica de fora, em vez de ser arquivada sem ter sido contada.

create or replace function public.ledger_entries_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if exists (select 1 from public.friends where id = new.friend_id and status = 'connected') then
      raise exception 'Com um amigo ligado, os movimentos são partilhados e têm de ser confirmados.';
    end if;
    if new.status <> 'confirmed' or new.mirror_id is not null or new.created_by is not null
       or new.decline_note is not null or new.cancel_requested_by is not null
       or new.bank_account_id is not null or new.bank_category_id is not null or new.is_opening then
      raise exception 'Operação não permitida.';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.mirror_id is not null or old.status <> 'confirmed' then
      raise exception 'Este movimento é partilhado: usa os botões do movimento.';
    end if;
    if new.status is distinct from old.status or new.mirror_id is distinct from old.mirror_id
       or new.created_by is distinct from old.created_by or new.decline_note is distinct from old.decline_note
       or new.cancel_requested_by is distinct from old.cancel_requested_by
       or new.bank_account_id is distinct from old.bank_account_id
       or new.bank_category_id is distinct from old.bank_category_id
       or new.is_opening is distinct from old.is_opening
       or new.user_id is distinct from old.user_id or new.friend_id is distinct from old.friend_id then
      raise exception 'Operação não permitida.';
    end if;
    return new;
  else
    if old.mirror_id is not null or old.status = 'archived' then
      raise exception 'Este movimento é partilhado: usa os botões do movimento.';
    end if;
    return old;
  end if;
end $$;

create or replace function public.share_opening_balance(p_friend_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  f public.friends%rowtype;
  v_other_friend uuid;
  v_cents bigint;
  v_ids uuid[];
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

  -- Bloqueia (FOR UPDATE) e fixa o conjunto de linhas numa só instrução: uma entrada
  -- confirmada depois deste ponto fica simplesmente de fora, em vez de ser arquivada
  -- sem ter entrado na soma (ver nota no topo do ficheiro).
  with picked as (
    select id, amount, kind
      from public.ledger_entries
     where user_id = uid and friend_id = p_friend_id and status = 'confirmed' and mirror_id is null
     for update
  )
  select coalesce(sum(round(amount * 100) * case kind
           when 'paid_for_them' then 1 when 'repaid_to_them' then 1 else -1 end), 0)::bigint,
         coalesce(array_agg(id), array[]::uuid[])
    into v_cents, v_ids
    from picked;
  if v_cents = 0 then raise exception 'Não há saldo anterior para partilhar.'; end if;

  update public.ledger_entries set status = 'archived' where id = any(v_ids);

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
