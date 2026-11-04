-- As funções de trigger de 20261109010000 (e o friends_broadcast que lá foi corrigido) são
-- security definer e, por omissão do Postgres, ficavam com EXECUTE para public/anon/authenticated.
-- Não dá para as chamar por RPC (uma função `returns trigger` só corre como trigger), mas o
-- advisor de segurança assinala-as e não há motivo para terem esse privilégio. Os triggers
-- continuam a disparar: o Postgres não verifica EXECUTE ao disparar um trigger.

revoke all on function public.ledger_entries_live() from public, anon, authenticated;
revoke all on function public.friend_requests_live() from public, anon, authenticated;
revoke all on function public.friends_broadcast() from public, anon, authenticated;
