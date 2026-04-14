-- ============================================================================
-- CENTRAL SVI — Sistema de Permissões por Role
-- ============================================================================

-- 1. Atualizar enum para incluir 'seller' e 'executor'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'executor';

-- 2. Função helper para verificar role do usuário atual
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY
    CASE role::text
      WHEN 'admin' THEN 1
      WHEN 'manager' THEN 2
      WHEN 'seller' THEN 3
      WHEN 'executor' THEN 4
      ELSE 5
    END
  LIMIT 1
$$;

-- 3. Função helper para checar se é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- 4. Função helper para checar se tem role mínima
CREATE OR REPLACE FUNCTION public.has_min_role(_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _role = 'admin' THEN public.is_admin()
    WHEN _role = 'manager' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager')
    )
    WHEN _role = 'seller' THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager', 'seller')
    )
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  END
$$;

-- ============================================================================
-- POLICIES POR ROLE
-- ============================================================================

-- INVOICES — Apenas admin e manager
DROP POLICY IF EXISTS "Auth users manage invoices" ON public.invoices;
CREATE POLICY "Admin and manager manage invoices" ON public.invoices
  FOR ALL USING (public.has_min_role('manager'));

-- EXPENSES — Apenas admin e manager
DROP POLICY IF EXISTS "Auth users manage expenses" ON public.expenses;
CREATE POLICY "Admin and manager manage expenses" ON public.expenses
  FOR ALL USING (public.has_min_role('manager'));

-- CLIENTS — Admin/manager vêem tudo. Executor vê só os atribuídos a ele.
DROP POLICY IF EXISTS "Auth users manage clients" ON public.clients;
CREATE POLICY "Clients access by role" ON public.clients
  FOR ALL USING (
    public.has_min_role('manager') OR
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.client_id = clients.id AND d.responsavel_id = auth.uid()
    )
  );

-- DELIVERIES — Executores vêem só as próprias
DROP POLICY IF EXISTS "Auth users manage deliveries" ON public.deliveries;
CREATE POLICY "Deliveries by role" ON public.deliveries
  FOR ALL USING (
    public.has_min_role('manager') OR
    responsavel_id = auth.uid()
  );

-- LEADS — Admin, manager e seller vêem tudo
DROP POLICY IF EXISTS "Auth users manage leads" ON public.leads;
CREATE POLICY "Leads by role" ON public.leads
  FOR ALL USING (public.has_min_role('seller'));

-- PROSPECTS — Admin, manager e seller
DROP POLICY IF EXISTS "Auth users manage prospects" ON public.prospects;
CREATE POLICY "Prospects by role" ON public.prospects
  FOR ALL USING (public.has_min_role('seller'));

-- ONBOARDING — Admin e manager
DROP POLICY IF EXISTS "Auth users manage onboarding" ON public.onboarding_tasks;
CREATE POLICY "Onboarding by role" ON public.onboarding_tasks
  FOR ALL USING (public.has_min_role('manager'));

-- INTERACTIONS — Todos autenticados
DROP POLICY IF EXISTS "Auth users manage interactions" ON public.interactions;
CREATE POLICY "Interactions by role" ON public.interactions
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ACTIVITY LOG — Todos autenticados podem ver (mas só admin/manager veem tudo)
DROP POLICY IF EXISTS "Auth users view activity" ON public.activity_log;
CREATE POLICY "Activity log by role" ON public.activity_log
  FOR SELECT USING (
    public.has_min_role('manager') OR user_id = auth.uid()
  );
CREATE POLICY "Activity log insert" ON public.activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- DEFINIR VOCÊ COMO ADMIN (AJUSTE SEU EMAIL)
-- ============================================================================
-- Vai adicionar role 'admin' ao primeiro usuário que se cadastrou
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;
