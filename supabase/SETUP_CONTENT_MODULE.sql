-- ============================================================================
-- CENTRAL SVI — Módulo de Gestão de Conteúdo para Clientes Externos
-- ============================================================================
-- Esta migration adiciona:
--   1. Role 'client' (cliente externo com login próprio)
--   2. Fluxo de aprovação: client_signup_requests
--   3. Tabelas de conteúdo: posts, pautas, references, trends
--   4. Funções approve_client_signup / reject_client_signup
--   5. RLS policies (cliente vê só o que é dele; staff vê tudo)
--
-- Pré-requisitos: SETUP_COMPLETO.sql e SETUP_ROLES.sql já aplicados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ROLE 'client' NO ENUM
-- ----------------------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- ----------------------------------------------------------------------------
-- 2. LIGA clients <-> auth.users (cliente pode ter login)
-- ----------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_user_id
  ON public.clients(user_id) WHERE user_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. CLIENT SIGNUP REQUESTS (fila de aprovação do master dashboard)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_signup_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT,
  instagram TEXT,
  segment TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csr_status ON public.client_signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_csr_created_at ON public.client_signup_requests(created_at DESC);

ALTER TABLE public.client_signup_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Staff manage signup requests" ON public.client_signup_requests
    FOR ALL USING (public.has_min_role('manager'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "User sees own signup request" ON public.client_signup_requests
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "User creates own signup request" ON public.client_signup_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 4. CONTENT POSTS (Kanban: ideia / producao / agendado / publicado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT NOT NULL
    CHECK (format IN ('carrossel', 'reels', 'stories', 'feed')),
  category TEXT,
  status TEXT NOT NULL DEFAULT 'ideia'
    CHECK (status IN ('ideia', 'producao', 'agendado', 'publicado')),
  scheduled_date DATE,
  published_at TIMESTAMPTZ,
  caption TEXT,
  hashtags TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_client_status
  ON public.content_posts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled
  ON public.content_posts(scheduled_date) WHERE scheduled_date IS NOT NULL;

ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Content posts access" ON public.content_posts
    FOR ALL USING (
      public.has_min_role('executor') OR
      client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 5. CONTENT PAUTAS (repositório de ideias de conteúdo)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_pautas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  format_suggestion TEXT,
  urgency TEXT NOT NULL DEFAULT 'evergreen'
    CHECK (urgency IN ('evergreen', 'tendencia', 'sazonal')),
  status TEXT NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'usada', 'descartada')),
  notes TEXT,
  used_in_post_id UUID REFERENCES public.content_posts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pautas_client_status
  ON public.content_pautas(client_id, status);
CREATE INDEX IF NOT EXISTS idx_pautas_category
  ON public.content_pautas(client_id, category);

ALTER TABLE public.content_pautas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Content pautas access" ON public.content_pautas
    FOR ALL USING (
      public.has_min_role('executor') OR
      client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 6. CONTENT REFERENCES (perfis monitorados — concorrentes/referências)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_references (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL
    CHECK (platform IN ('instagram', 'youtube', 'linkedin', 'tiktok')),
  handle TEXT NOT NULL,
  specialty TEXT,
  notes TEXT,
  last_checked_at TIMESTAMPTZ,
  followers_count INT,
  posts_per_week NUMERIC(5,2),
  top_formats TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refs_client ON public.content_references(client_id);

ALTER TABLE public.content_references ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Content references access" ON public.content_references
    FOR ALL USING (
      public.has_min_role('executor') OR
      client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 7. CONTENT TRENDS (radar de tendências — alimentado por staff via RSS/manual)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_trends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  relevance TEXT NOT NULL DEFAULT 'media'
    CHECK (relevance IN ('alta', 'media', 'baixa')),
  category TEXT,
  summary TEXT,
  converted_to_pauta_id UUID REFERENCES public.content_pautas(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_trends_client ON public.content_trends(client_id);
CREATE INDEX IF NOT EXISTS idx_trends_captured ON public.content_trends(captured_at DESC);

ALTER TABLE public.content_trends ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Content trends access" ON public.content_trends
    FOR ALL USING (
      public.has_min_role('executor') OR
      client_id IS NULL OR
      client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 8. TRIGGERS updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_posts_updated ON public.content_posts;
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.content_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pautas_updated ON public.content_pautas;
CREATE TRIGGER trg_pautas_updated BEFORE UPDATE ON public.content_pautas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. FUNÇÃO: approve_client_signup
--    Admin/manager aprova um signup_request:
--      - Atribui role 'client' ao user
--      - Cria (ou vincula) o registro em clients
--      - Marca request como approved
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_client_signup(
  _request_id UUID,
  _link_to_client_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req RECORD;
  _client_id UUID;
BEGIN
  IF NOT public.has_min_role('manager') THEN
    RAISE EXCEPTION 'Unauthorized: only admin/manager can approve';
  END IF;

  SELECT * INTO _req FROM public.client_signup_requests
    WHERE id = _request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signup request not found';
  END IF;

  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Signup request is not pending (status=%)', _req.status;
  END IF;

  IF _link_to_client_id IS NOT NULL THEN
    UPDATE public.clients
       SET user_id = _req.user_id,
           email = COALESCE(email, _req.email),
           phone = COALESCE(NULLIF(phone, ''), _req.phone),
           instagram = COALESCE(NULLIF(instagram, ''), _req.instagram)
     WHERE id = _link_to_client_id;
    _client_id := _link_to_client_id;
  ELSE
    INSERT INTO public.clients (
      name, company, phone, email, instagram, segment,
      user_id, status, health_score, inicio_contrato, mrr, currency, plano
    ) VALUES (
      _req.name, _req.company, COALESCE(_req.phone, ''), _req.email,
      _req.instagram, COALESCE(_req.segment, 'geral'),
      _req.user_id, 'ativo', 80, CURRENT_DATE, 0, 'BRL', 'conteudo'
    )
    RETURNING id INTO _client_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (_req.user_id, 'client'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.client_signup_requests
     SET status = 'approved',
         client_id = _client_id,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'client_id', _client_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. FUNÇÃO: reject_client_signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_client_signup(
  _request_id UUID,
  _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_min_role('manager') THEN
    RAISE EXCEPTION 'Unauthorized: only admin/manager can reject';
  END IF;

  UPDATE public.client_signup_requests
     SET status = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = _reason
   WHERE id = _request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signup request not found or not pending';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. FUNÇÃO HELPER: current_client_id (usada no frontend)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.clients WHERE user_id = auth.uid() LIMIT 1
$$;

-- ----------------------------------------------------------------------------
-- 12. ATUALIZAR has_min_role para incluir 'client' (abaixo de executor)
--     (nota: role 'client' não dá acesso a NADA de staff; é apenas para
--     permitir que o AuthContext reconheça o role e roteie para dashboard
--     de cliente. Policies de staff continuam exigindo 'executor' ou maior.)
-- ----------------------------------------------------------------------------
-- Nenhum ajuste em has_min_role é necessário: ele já funciona por hierarquia
-- de staff. O role 'client' é checado diretamente no frontend e nas policies
-- de content_* (via user_id na tabela clients).

-- ============================================================================
-- FIM. Para aplicar: cole no SQL Editor do Supabase e execute.
-- ============================================================================
