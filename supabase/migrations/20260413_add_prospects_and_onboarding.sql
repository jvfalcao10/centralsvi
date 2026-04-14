-- ============================================================================
-- CENTRAL SVI 2.0 — Migração: Prospects + Onboarding + Activity Log
-- ============================================================================

-- 1. Tabela de Prospects (substitui localStorage)
CREATE TABLE IF NOT EXISTS prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  city TEXT NOT NULL,
  instagram TEXT DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'verde' CHECK (tier IN ('verde', 'amarelo', 'vermelho')),
  touch INTEGER NOT NULL DEFAULT 0 CHECK (touch >= 0 AND touch <= 5),
  channel TEXT NOT NULL DEFAULT 'dm' CHECK (channel IN ('dm', 'whatsapp', 'call')),
  status TEXT NOT NULL DEFAULT 'novo',
  signal TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  next_follow_up DATE,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Onboarding Tasks (substitui localStorage)
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  task_index INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, phase, task_index)
);

-- 3. Tabela de Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Adicionar coluna prospect_id em leads para linkar prospect → lead
ALTER TABLE leads ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id);

-- 6. Adicionar coluna lead_id em clients para linkar lead → client
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- 7. RLS Policies
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage prospects" ON prospects
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage onboarding" ON onboarding_tasks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view activity log" ON activity_log
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- 8. Index para performance
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_tier ON prospects(tier);
CREATE INDEX IF NOT EXISTS idx_prospects_next_follow_up ON prospects(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_onboarding_client ON onboarding_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
