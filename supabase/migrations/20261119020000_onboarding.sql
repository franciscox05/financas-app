-- Onboarding em questionário (auditoria 2026-11-19, secção 3).
-- Só acrescenta colunas e uma função; não altera dados existentes além do
-- backfill: quem já usa a app fica marcado como "onboarding feito".
--
-- O gatilho handle_new_user NÃO é alterado: continua a semear as contas e
-- categorias de sempre. Quando o novo utilizador conclui o onboarding,
-- complete_onboarding() apaga esses defeitos (só se ainda não houver nenhuma
-- atividade) e cria o que ele escolheu. Assim esta migração pode ser aplicada
-- antes do código novo sem estragar o registo de utilizadores.

alter table public.profiles
  add column onboarded_at timestamptz,
  add column locale text check (locale is null or locale ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  add column currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  add column preferences jsonb not null default '{}'::jsonb;

update public.profiles set onboarded_at = now() where onboarded_at is null;

create or replace function public.complete_onboarding(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_locale text := p_payload ->> 'locale';
  v_currency text := p_payload ->> 'currency';
  a jsonb;
  c jsonb;
  v_acc uuid;
  v_name text;
  v_type text;
  v_balance numeric;
  v_order int := 0;
  v_has_activity boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = uid and onboarded_at is not null) then
    raise exception 'onboarding already completed' using errcode = 'P0001';
  end if;
  if v_locale !~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$' or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid locale or currency' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'accounts') <> 'array' or jsonb_array_length(p_payload -> 'accounts') not between 1 and 30
     or jsonb_typeof(p_payload -> 'categories') <> 'array' or jsonb_array_length(p_payload -> 'categories') not between 2 and 80 then
    raise exception 'invalid accounts or categories' using errcode = '22023';
  end if;

  select exists (select 1 from public.transactions where user_id = uid)
      or exists (select 1 from public.transfers where user_id = uid)
      or exists (select 1 from public.net_worth_snapshots where user_id = uid)
    into v_has_activity;
  if not v_has_activity then
    delete from public.accounts where user_id = uid;
    delete from public.categories where user_id = uid;
  end if;

  for a in select * from jsonb_array_elements(p_payload -> 'accounts') loop
    v_name := btrim(a ->> 'name');
    v_type := a ->> 'type';
    v_balance := coalesce(nullif(a ->> 'opening_balance', '')::numeric, 0);
    if v_name = '' or length(v_name) > 60 or v_type not in ('cash', 'investment') or v_balance < 0 or v_balance > 999999999 then
      raise exception 'invalid account' using errcode = '22023';
    end if;
    v_order := v_order + 1;
    insert into public.accounts (user_id, name, type, sort_order)
    values (uid, v_name, v_type, v_order)
    returning id into v_acc;
    if v_balance > 0 then
      insert into public.net_worth_snapshots (user_id, account_id, value, snapshot_date)
      values (uid, v_acc, round(v_balance, 2), current_date);
    end if;
  end loop;

  for c in select * from jsonb_array_elements(p_payload -> 'categories') loop
    v_name := btrim(c ->> 'name');
    v_type := c ->> 'type';
    if v_name = '' or length(v_name) > 60 or v_type not in ('income', 'expense') then
      raise exception 'invalid category' using errcode = '22023';
    end if;
    insert into public.categories (user_id, name, type, is_savings, is_lending)
    values (uid, v_name, v_type,
            coalesce((c ->> 'is_savings')::boolean, false) and v_type = 'expense',
            coalesce((c ->> 'is_lending')::boolean, false));
  end loop;

  if not exists (select 1 from public.categories where user_id = uid and type = 'expense')
     or not exists (select 1 from public.categories where user_id = uid and type = 'income') then
    raise exception 'need at least one income and one expense category' using errcode = '22023';
  end if;

  insert into public.profiles (id, onboarded_at, locale, currency, preferences)
  values (uid, now(), v_locale, v_currency, coalesce(p_payload -> 'preferences', '{}'::jsonb))
  on conflict (id) do update
    set onboarded_at = excluded.onboarded_at,
        locale = excluded.locale,
        currency = excluded.currency,
        preferences = excluded.preferences;
end;
$$;

revoke all on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
