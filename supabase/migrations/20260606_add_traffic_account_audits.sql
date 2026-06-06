-- Tabela de auditorias forenses por conta Meta Ads
-- Cada row = 1 auditoria de 1 conta (versionável por audit_date)

CREATE TABLE IF NOT EXISTS traffic_account_audits (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL,
  cliente_label TEXT NOT NULL,
  account_name TEXT,
  vertical TEXT,
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  analyst_name TEXT DEFAULT 'SVI Sistema',

  -- Snapshot numérico (cache pra listagem rápida)
  spend_lifetime_cents BIGINT,
  spend_90d_cents BIGINT,
  spend_30d_cents BIGINT,
  spend_7d_cents BIGINT,
  conv_90d INT,
  conv_30d INT,
  conv_7d INT,
  cpmsg_30d_cents INT,
  freq_30d NUMERIC,
  reach_30d INT,
  active_ads_count INT,
  active_campaigns_count INT,

  -- Saúde da conta
  account_balance_cents INT,
  spend_cap_cents INT,
  cap_runway_days INT,
  account_status_label TEXT,

  -- Auditoria estruturada
  markdown_report TEXT NOT NULL,
  short_summary TEXT, -- resumo de 3 frases do agent
  severity TEXT, -- critical, alto, medio, ok

  -- Plano de ação
  top_strength TEXT,
  top_vazamento TEXT,
  acoes_imediatas JSONB, -- [{ "titulo": "...", "tempo": "5min", "impacto": "..." }]
  meta_30d JSONB, -- { "conv": { "atual": 45, "meta": 120 }, "cpmsg": ... }

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_audits_account ON traffic_account_audits (account_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_audits_severity ON traffic_account_audits (severity, audit_date DESC);

ALTER TABLE traffic_account_audits ENABLE ROW LEVEL SECURITY;

-- Política: qualquer usuário autenticado com role manager/admin/traffic pode ler
CREATE POLICY traffic_audits_select_authenticated ON traffic_account_audits
  FOR SELECT
  TO authenticated
  USING (
    public.has_min_role(auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'traffic'
    )
  );

-- Insert via service_role (n8n / endpoint admin)
CREATE POLICY traffic_audits_insert_service ON traffic_account_audits
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE traffic_account_audits IS 'Auditoria forense por conta Meta Ads. 1 row por auditoria, versionável por audit_date.';
