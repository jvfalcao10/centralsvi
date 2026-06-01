-- Weekly traffic reports com fluxo de aprovação humana
-- Workflow A (n8n sex 15h) gera o relatório com status='pending' e cria task no ClickUp
-- João ou Aleilson aprova/rejeita via página /aprovar/trafego/:slug?token=...
-- Workflow B (n8n webhook) recebe a decisão e, se aprovado, envia WhatsApp pro grupo

CREATE TABLE IF NOT EXISTS public.weekly_traffic_reports (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  approval_token TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  cliente_label TEXT NOT NULL,
  group_chatid TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  spend_cents BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  reach BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  ctr NUMERIC(10,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'sent', 'failed')),
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT,
  sent_at TIMESTAMPTZ,
  whatsapp_message_id TEXT,
  clickup_task_id TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_report_account_time
  ON public.weekly_traffic_reports(account_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_report_slug
  ON public.weekly_traffic_reports(slug);
CREATE INDEX IF NOT EXISTS idx_weekly_report_status
  ON public.weekly_traffic_reports(status, generated_at DESC);

ALTER TABLE public.weekly_traffic_reports ENABLE ROW LEVEL SECURITY;

-- Leitura pública: qualquer um com o slug acessa.
-- Filtros sensíveis (approval_token) jamais devem ser expostos no frontend cliente.
CREATE POLICY "weekly_report_public_read"
  ON public.weekly_traffic_reports FOR SELECT
  USING (true);

-- Gestão completa só admin/staff (n8n usa service_role e bypassa)
CREATE POLICY "weekly_report_admin_manage"
  ON public.weekly_traffic_reports FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.weekly_traffic_reports TO anon;
GRANT SELECT ON public.weekly_traffic_reports TO authenticated;
