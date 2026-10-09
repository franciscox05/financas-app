-- Notificacoes push (Fase 5 final): tabela de subscricoes por utilizador.
-- O agendamento diario (extensoes pg_cron/pg_net) fica numa migration
-- separada, pendente de confirmacao explicita do utilizador.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_self" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
