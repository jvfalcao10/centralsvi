-- ============================================================================
-- claim_my_invitation() — função RPC que aplica role baseada em invitation
-- ============================================================================
-- O trigger apply_invitation_trigger (definido em SETUP_INVITATIONS.sql) deveria
-- aplicar a role automaticamente no signup. Mas em alguns casos isso falha:
--   - Trigger não foi aplicado em produção
--   - RLS bloqueou o INSERT em user_roles dentro do trigger
--   - Race condition: AuthContext leu role antes do trigger terminar
--   - Email com case/espaços diferentes entre invitation e auth.users
--
-- Esta função RPC pode ser chamada pelo próprio usuário logado e aplica
-- a invitation com SECURITY DEFINER (ignora RLS). Faz lookup case-insensitive
-- no email pra evitar mismatch.
--
-- USO no frontend:
--   const { data, error } = await supabase.rpc('claim_my_invitation')
--   if (data) { // role aplicada, fazer refresh do AuthContext
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_my_invitation()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  current_email TEXT;
  invitation_record RECORD;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN NULL; -- não autenticado
  END IF;

  -- Email do auth.users
  SELECT email INTO current_email FROM auth.users WHERE id = current_user_id;
  IF current_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Já tem alguma role? Não faz nada
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = current_user_id) THEN
    RETURN NULL;
  END IF;

  -- Busca invitation pendente (case-insensitive, trim de espaços)
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(current_email))
    AND accepted = false
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL; -- não tem invitation
  END IF;

  -- Aplica role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, invitation_record.role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Marca invitation como aceita
  UPDATE public.invitations
  SET accepted = true, accepted_at = now()
  WHERE id = invitation_record.id;

  RETURN invitation_record.role;
END;
$$;

-- Permite que qualquer usuário autenticado chame (a função internamente
-- só age sobre o próprio user via auth.uid())
GRANT EXECUTE ON FUNCTION public.claim_my_invitation() TO authenticated;

-- Verificação:
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'claim_my_invitation';
