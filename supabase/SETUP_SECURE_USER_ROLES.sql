-- ============================================================================
-- CENTRAL SVI — Lockdown do user_roles (previne privilege escalation)
-- ============================================================================
-- Aplicado em qvkfcvcqlfamyzgqgnrq em 2026-04-18
--
-- Problema original detectado pelo Supabase security advisor:
--   "Table public.user_roles has RLS policies but RLS is not enabled"
--
-- Risco concreto: cliente autenticado com anon key poderia executar
--   supabase.from('user_roles').insert({ user_id: meu_uid, role: 'admin' })
--   e virar admin sem qualquer verificação.
--
-- Esta migration:
--   1. Habilita RLS na tabela user_roles
--   2. Mantém a policy existente "user_roles_select_own"
--   3. Adiciona "user_roles_select_staff" (manager+ vê todos — necessário /team)
--   4. Adiciona INSERT/UPDATE/DELETE restritos a admin
--
-- Impacto nas funções existentes:
--   - is_admin(), has_min_role() → SECURITY DEFINER, continuam funcionando
--   - approve_client_signup(), apply_invitation() → SECURITY DEFINER, OK
--   - AuthContext (select .eq('user_id', auth.uid())) → coberto pela policy own
-- ============================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "user_roles_select_staff" ON public.user_roles
    FOR SELECT USING (public.has_min_role('manager'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_insert_admin" ON public.user_roles
    FOR INSERT WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_update_admin" ON public.user_roles
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_delete_admin" ON public.user_roles
    FOR DELETE USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
