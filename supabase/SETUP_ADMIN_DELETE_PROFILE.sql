-- ============================================================================
-- admin_delete_profile() — RPC para admin apagar perfil completamente
-- ============================================================================
-- A tabela profiles tem RLS habilitado mas SEM policy de DELETE.
-- Tentar `supabase.from('profiles').delete()` falha silenciosamente.
--
-- Esta RPC roda com SECURITY DEFINER, valida que quem chama é admin via
-- public.is_admin(), e apaga profile + user_roles do user alvo.
--
-- Uso no frontend:
--   await supabase.rpc('admin_delete_profile', { target_user_id: 'uuid' })
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_profile(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só admin pode chamar
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem apagar perfis';
  END IF;

  -- Não permite admin se auto-apagar
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode apagar seu próprio perfil';
  END IF;

  -- Apaga roles primeiro (FK), depois profile
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE user_id = target_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_profile(UUID) TO authenticated;
