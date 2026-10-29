-- Avisos do Security Advisor do Supabase (2026-10-29).
--
-- 1) handle_new_user (trigger em auth.users) e rls_auto_enable (event trigger
--    ensure_rls) são SECURITY DEFINER e estavam expostas em /rest/v1/rpc a anon e
--    authenticated. Só fazem sentido como triggers: o trigger dispara na mesma
--    sem EXECUTE para estes papéis (o privilégio só é verificado ao criar o
--    trigger), por isso basta retirar o EXECUTE.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2) search_path fixo nas funções que não o tinham (evita que um objeto com o
--    mesmo nome noutro schema seja apanhado em vez do de public).
alter function public._invert_kind(text) set search_path = public, pg_temp;
alter function public.normalize_phone(text) set search_path = public, pg_temp;
alter function public.profiles_normalize_phone() set search_path = public, pg_temp;
