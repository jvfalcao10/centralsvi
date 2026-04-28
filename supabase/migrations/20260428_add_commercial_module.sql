-- Commercial dashboard module
-- 3 personas: pedro (SDR/outbound), arthur (inside sales), ruan (diagnósticos)
-- Pedro/Arthur: role 'seller', see only own data
-- Ruan: role 'admin', has own persona to fill diagnostic reports
-- João: role 'admin', sees all dashboards

-- =============================================
-- COMMERCIAL_PERSONAS — assigns persona to a user
-- =============================================
CREATE TABLE IF NOT EXISTS public.commercial_personas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  persona TEXT NOT NULL CHECK (persona IN ('pedro', 'arthur', 'ruan')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personas_select_own_or_staff" ON public.commercial_personas
  FOR SELECT USING (user_id = auth.uid() OR public.has_min_role('manager'));

CREATE POLICY "personas_admin_manage" ON public.commercial_personas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================
-- COMMERCIAL_DAILY_REPORTS — 1 report per user per day
-- =============================================
CREATE TABLE IF NOT EXISTS public.commercial_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  -- Pedro (SDR / Outbound)
  abridores INT NOT NULL DEFAULT 0,
  visualizacoes INT NOT NULL DEFAULT 0,
  conexoes INT NOT NULL DEFAULT 0,
  mapeamentos INT NOT NULL DEFAULT 0,
  pre_agendamentos INT NOT NULL DEFAULT 0,
  agendamentos INT NOT NULL DEFAULT 0,
  calls_realizadas INT NOT NULL DEFAULT 0,
  vendas INT NOT NULL DEFAULT 0,
  -- Arthur (Inside Sales)
  ligacoes INT NOT NULL DEFAULT 0,
  decisores INT NOT NULL DEFAULT 0,
  reunioes_marcadas INT NOT NULL DEFAULT 0,
  -- Ruan (Diagnósticos)
  diag_mkt INT NOT NULL DEFAULT 0,
  diag_comercial INT NOT NULL DEFAULT 0,
  -- Notes
  observacoes TEXT,
  melhorias TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, data)
);

CREATE INDEX IF NOT EXISTS idx_commercial_reports_user_data
  ON public.commercial_daily_reports(user_id, data DESC);

ALTER TABLE public.commercial_daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_own_or_admin" ON public.commercial_daily_reports
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "reports_insert_own_or_admin" ON public.commercial_daily_reports
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "reports_update_own_or_admin" ON public.commercial_daily_reports
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "reports_delete_admin" ON public.commercial_daily_reports
  FOR DELETE USING (public.is_admin());

CREATE TRIGGER update_commercial_reports_updated_at
  BEFORE UPDATE ON public.commercial_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- COMMERCIAL_GOALS — monthly targets per persona
-- =============================================
CREATE TABLE IF NOT EXISTS public.commercial_goals (
  persona TEXT PRIMARY KEY CHECK (persona IN ('pedro', 'arthur', 'ruan')),
  -- Pedro
  abridores INT NOT NULL DEFAULT 0,
  visualizacoes INT NOT NULL DEFAULT 0,
  conexoes INT NOT NULL DEFAULT 0,
  mapeamentos INT NOT NULL DEFAULT 0,
  pre_agendamentos INT NOT NULL DEFAULT 0,
  agendamentos INT NOT NULL DEFAULT 0,
  calls_realizadas INT NOT NULL DEFAULT 0,
  vendas INT NOT NULL DEFAULT 0,
  -- Arthur
  ligacoes INT NOT NULL DEFAULT 0,
  decisores INT NOT NULL DEFAULT 0,
  reunioes_marcadas INT NOT NULL DEFAULT 0,
  -- Ruan (semanal — multiplicar x4 pra mensal)
  diag_mkt_semanal INT NOT NULL DEFAULT 0,
  diag_comercial_semanal INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_authed" ON public.commercial_goals
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Edit: admin OR user with persona='ruan'
CREATE POLICY "goals_admin_or_ruan_update" ON public.commercial_goals
  FOR UPDATE USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.commercial_personas
            WHERE user_id = auth.uid() AND persona = 'ruan')
  ) WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.commercial_personas
            WHERE user_id = auth.uid() AND persona = 'ruan')
  );

CREATE POLICY "goals_admin_insert" ON public.commercial_goals
  FOR INSERT WITH CHECK (public.is_admin());

CREATE TRIGGER update_commercial_goals_updated_at
  BEFORE UPDATE ON public.commercial_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Default goals (from project requirements)
INSERT INTO public.commercial_goals (persona, abridores, agendamentos, calls_realizadas, vendas)
VALUES ('pedro', 1000, 20, 20, 4)
ON CONFLICT (persona) DO NOTHING;

INSERT INTO public.commercial_goals (persona, ligacoes, reunioes_marcadas)
VALUES ('arthur', 1200, 40)
ON CONFLICT (persona) DO NOTHING;

INSERT INTO public.commercial_goals (persona, diag_mkt_semanal, diag_comercial_semanal)
VALUES ('ruan', 3, 3)
ON CONFLICT (persona) DO NOTHING;
