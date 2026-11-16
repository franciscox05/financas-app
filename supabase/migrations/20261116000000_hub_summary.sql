-- hub_summary: função só de leitura para o tiago-hub (dashboard pessoal do Tiago) ler os agregados
-- de um mês (ganhos, gastos, gastos por categoria). O Francisco aprovou a ideia a 16/11/2026.
-- APLICADA a 16/11/2026 na Supabase (projeto de produção), depois de o Francisco aprovar este SQL no PR.
--
-- O quê: uma função só de leitura para o tiago-hub (dashboard pessoal do Tiago) ler os
-- AGREGADOS de um mês (ganhos, gastos, gastos por categoria) com um token próprio.
-- Não devolve movimentos, contas, amigos nem nada de outro utilizador.
-- Porquê assim: a FinancasApp não tem backend; a alternativa seria a service role key
-- (salta o RLS de todos) ou uma sessão completa do Tiago noutro domínio (leitura E escrita).
-- Revogar: delete from public.hub_tokens where user_id = '<uuid>';

create table public.hub_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- sha256 (hex) do token; o token em claro nunca fica na base de dados
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- RLS ligado e SEM policies: pela API ninguém lê nem escreve esta tabela.
-- Só o SQL editor (dono do projeto) e a função abaixo lhe chegam.
alter table public.hub_tokens enable row level security;
revoke all on public.hub_tokens from anon, authenticated;

-- Mesma conta do ecrã Balanço (listTransactionsInRange em src/lib/db.js):
-- transactions do mês + transfers com counts_as_expense (contam como gasto).
create function public.hub_summary(p_token text, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 32 or p_month is null then
    return null;
  end if;

  select user_id into v_user
  from public.hub_tokens
  where token_sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  if v_user is null then
    return null; -- token desconhecido ou revogado: o hub mostra erro
  end if;

  with m as (
    select t.type, t.amount, c.name as category
    from public.transactions t
    left join public.categories c on c.id = t.category_id
    where t.user_id = v_user and t.occurred_on >= v_from and t.occurred_on < v_to
    union all
    select 'expense'::text, tr.amount, c.name
    from public.transfers tr
    left join public.categories c on c.id = tr.category_id
    where tr.user_id = v_user and tr.counts_as_expense
      and tr.occurred_on >= v_from and tr.occurred_on < v_to
  ),
  by_category as (
    select coalesce(category, 'Sem categoria') as name, sum(amount) as amount
    from m where type = 'expense' group by 1
  )
  select jsonb_build_object(
    'month', v_from,
    'income', coalesce((select sum(amount) from m where type = 'income'), 0),
    'expense', coalesce((select sum(amount) from m where type = 'expense'), 0),
    'categories', coalesce(
      (select jsonb_agg(jsonb_build_object('name', name, 'amount', amount) order by amount desc) from by_category),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- O hub chama com a anon key (sem sessão): o token é a única chave.
revoke execute on function public.hub_summary(text, date) from public, authenticated;
grant execute on function public.hub_summary(text, date) to anon;

-- Depois de aplicada, o Tiago regista o SEU token no SQL editor (uma vez):
--   1) gerar:  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
--   2) insert into public.hub_tokens (user_id, token_sha256)
--      values ('<uuid do Tiago>', encode(sha256(convert_to('<token>', 'UTF8')), 'hex'));
--   3) pôr o token em FINANCAS_HUB_TOKEN na Vercel do hub.
-- Limite conhecido: o PostgREST não tem rate limit por função; a defesa é o token de 256 bits.
