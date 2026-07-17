-- ============================================================================
-- SVI.Co — Fila de Aprovação de Conteúdo (Plano Estratégico do Mês + Caça)
-- A IA gera → grava aqui (pendente) → time aprova na Central → Sofia envia.
-- Idempotente: pode re-rodar sem quebrar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_aprovacoes (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo           TEXT NOT NULL DEFAULT 'plano_mensal',        -- plano_mensal | caca
  cliente        TEXT NOT NULL,
  chatid         TEXT,                                        -- grupo WhatsApp destino (null = sem grupo)
  mes            TEXT,
  ano            INT,
  titulo         TEXT NOT NULL,
  texto          TEXT NOT NULL,                               -- mensagem final (editável antes de aprovar)
  status         TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','aprovado','enviado','reprovado')),
  aprovado_por   UUID REFERENCES auth.users(id),
  motivo         TEXT,                                        -- motivo de reprovação (opcional)
  criado_em      TIMESTAMPTZ DEFAULT now(),
  atualizado_em  TIMESTAMPTZ DEFAULT now(),
  enviado_em     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_aprov_status ON public.content_aprovacoes(status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_aprov_mes    ON public.content_aprovacoes(ano, mes, status);

ALTER TABLE public.content_aprovacoes ENABLE ROW LEVEL SECURITY;

-- Staff (executor+) vê e mexe em tudo. Cliente NUNCA acessa esta fila.
DO $$ BEGIN
  CREATE POLICY "Aprovacoes staff full" ON public.content_aprovacoes
    FOR ALL
    USING (public.has_min_role('executor'))
    WITH CHECK (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- touch atualizado_em
CREATE OR REPLACE FUNCTION public.touch_aprovacoes() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aprov_touch ON public.content_aprovacoes;
CREATE TRIGGER trg_aprov_touch BEFORE UPDATE ON public.content_aprovacoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_aprovacoes();
