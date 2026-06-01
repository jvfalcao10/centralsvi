-- Meta Ads accounts snapshot module
-- Powered by n8n workflow "SVI Traffic - Saldo Watcher" (y04YYuRe812uD6Vo)
-- Append-only snapshots; latest view exposes current state.

-- =============================================
-- META_AD_ACCOUNTS_SNAPSHOT
-- =============================================
CREATE TABLE IF NOT EXISTS public.meta_ad_accounts_snapshot (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL,
  account_name TEXT,
  account_status INT NOT NULL,
  disable_reason INT NOT NULL DEFAULT 0,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  amount_spent_cents BIGINT NOT NULL DEFAULT 0,
  spend_cap_cents BIGINT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  severity TEXT NOT NULL CHECK (severity IN ('CRITICO', 'MEDIO', 'ZERADA_ATIVA', 'OK')),
  bm_label TEXT,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_snap_account_time
  ON public.meta_ad_accounts_snapshot(account_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_snap_time
  ON public.meta_ad_accounts_snapshot(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_snap_severity
  ON public.meta_ad_accounts_snapshot(severity);

ALTER TABLE public.meta_ad_accounts_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trafego_select_staff"
  ON public.meta_ad_accounts_snapshot FOR SELECT
  USING (public.has_min_role('manager'));

CREATE POLICY "trafego_admin_manage"
  ON public.meta_ad_accounts_snapshot FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================
-- VIEW: latest snapshot per account
-- =============================================
CREATE OR REPLACE VIEW public.meta_ad_accounts_latest AS
SELECT DISTINCT ON (account_id)
  account_id,
  account_name,
  account_status,
  disable_reason,
  balance_cents,
  amount_spent_cents,
  spend_cap_cents,
  currency,
  severity,
  bm_label,
  snapshot_at
FROM public.meta_ad_accounts_snapshot
ORDER BY account_id, snapshot_at DESC;

GRANT SELECT ON public.meta_ad_accounts_latest TO authenticated;
