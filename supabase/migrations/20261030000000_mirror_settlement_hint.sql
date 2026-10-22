-- Ao aceitar uma devolução, pré-seleciona a forma de pagamento que o remetente já
-- escolheu (continua editável) — reduz a chance de os dois lados ficarem com
-- registos inconsistentes sobre o mesmo pagamento real. O aceitador não consegue
-- ler a linha do remetente diretamente (RLS: ledger_entries_self só mostra as
-- próprias), por isso esta leitura pontual passa por uma função security definer.

create function public.get_mirror_settlement(p_id uuid) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.ledger_entries%rowtype;
  v_settlement text;
begin
  if uid is null then raise exception 'Inicia sessão para continuar.'; end if;
  select * into e from public.ledger_entries where id = p_id and user_id = uid;
  if not found then raise exception 'Movimento não encontrado.'; end if;
  if e.mirror_id is null then return null; end if;
  select settlement into v_settlement from public.ledger_entries where id = e.mirror_id;
  return v_settlement;
end $$;

revoke all on function public.get_mirror_settlement(uuid) from public, anon;
grant execute on function public.get_mirror_settlement(uuid) to authenticated;
