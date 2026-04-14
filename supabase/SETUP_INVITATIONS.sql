-- ============================================================================
-- Sistema de Convites para Equipe
-- ============================================================================

-- Tabela de convites
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'executor',
  invited_by UUID REFERENCES auth.users(id),
  invited_by_name TEXT,
  accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage invitations" ON public.invitations
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can read invitations by email" ON public.invitations
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger: quando usuário se cadastra, verifica se tem convite e aplica role
CREATE OR REPLACE FUNCTION public.apply_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Busca convite pendente para este email
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE email = NEW.email AND accepted = false
  LIMIT 1;

  IF FOUND THEN
    -- Cria role conforme o convite
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invitation_record.role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Marca convite como aceito
    UPDATE public.invitations
    SET accepted = true, accepted_at = now()
    WHERE id = invitation_record.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Dispara o trigger depois que handle_new_user cria o profile
DROP TRIGGER IF EXISTS apply_invitation_trigger ON auth.users;
CREATE TRIGGER apply_invitation_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.apply_invitation();
