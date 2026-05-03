-- ============================================================================
-- Permitir DELETE em profiles para admins
-- ============================================================================
-- Hoje a tabela profiles tem RLS habilitado mas SEM nenhuma policy de DELETE.
-- Isso fazia o "Remover membro" da página /team falhar silenciosamente em
-- profiles e deixava registros órfãos.
--
-- A página agora apaga só user_roles (revogação de acesso) e isso é suficiente
-- para o usuário não aparecer mais na Equipe nem acessar o sistema.
--
-- Aplique este script SE quiser permitir hard-delete de profiles também
-- (limpeza definitiva). NÃO é necessário para o fluxo atual funcionar.
-- ============================================================================

DO $$ BEGIN
  CREATE POLICY "profiles_delete_admin" ON public.profiles
    FOR DELETE USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verificação:
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.profiles'::regclass;
