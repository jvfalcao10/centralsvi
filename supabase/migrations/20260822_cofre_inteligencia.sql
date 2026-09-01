-- Cofre de Inteligencia (Central + Sofia no WhatsApp).
--
-- Fluxo desenhado com o Joao em 22/08/2026:
--   1. Joao manda um LINK (Instagram/TikTok/YouTube) ou um video pra Sofia no PV/grupo.
--   2. Sofia baixa, transcreve e LE TUDO. Grava aqui com estado 'analisado' e devolve
--      resumo + angulo (anatomia-viral) + formato sugerido (formatos-criativos) +
--      3 clientes pra quem aquilo serve.
--   3. Joao responde pra quem modelar. Sofia modela (roteiro/flyer/carrossel) e grava
--      o entregavel aqui, estado 'modelado'.
--   4. Joao diz pra quem subir. Sofia cria a task no ClickUp com o entregavel VERBATIM
--      + o link desta pagina na Central, e grava estado 'entregue'.
--
-- O video NAO sobe pro banco: fica a URL da fonte e a transcricao.
-- Regra da casa: nada de credencial aqui dentro.

CREATE TABLE IF NOT EXISTS public.intel_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- de onde veio
  origem TEXT NOT NULL DEFAULT 'whatsapp',
  tipo TEXT NOT NULL DEFAULT 'link',
  plataforma TEXT,
  fonte_url TEXT,
  midia_url TEXT,
  autor TEXT,
  titulo TEXT,

  -- o que a Sofia leu/assistiu
  legenda TEXT,
  transcricao TEXT,

  -- o que a Sofia entendeu (anatomia-viral + formatos-criativos)
  resumo TEXT,
  angulo TEXT,
  mecanismo TEXT,
  formato_sugerido TEXT,
  sugestao_clientes TEXT[],

  -- o que virou
  estado TEXT NOT NULL DEFAULT 'recebido',
  cliente TEXT,
  cliente_list_id TEXT,
  formato TEXT,
  entregavel TEXT,

  -- pra onde foi
  responsavel TEXT,
  clickup_task_id TEXT,
  clickup_url TEXT,

  -- rastro
  enviado_por TEXT,
  chat_id TEXT,
  erro TEXT
);

ALTER TABLE public.intel_items DROP CONSTRAINT IF EXISTS intel_items_estado_check;
ALTER TABLE public.intel_items ADD CONSTRAINT intel_items_estado_check
  CHECK (estado = ANY (ARRAY['recebido','analisado','modelado','entregue','arquivado','erro']));

ALTER TABLE public.intel_items DROP CONSTRAINT IF EXISTS intel_items_tipo_check;
ALTER TABLE public.intel_items ADD CONSTRAINT intel_items_tipo_check
  CHECK (tipo = ANY (ARRAY['link','video','texto','imagem','audio']));

ALTER TABLE public.intel_items DROP CONSTRAINT IF EXISTS intel_items_formato_check;
ALTER TABLE public.intel_items ADD CONSTRAINT intel_items_formato_check
  CHECK (formato IS NULL OR formato = ANY (ARRAY['roteiro','flyer','carrossel','legenda']));

CREATE INDEX IF NOT EXISTS intel_items_criado_idx ON public.intel_items (criado_em DESC);
CREATE INDEX IF NOT EXISTS intel_items_estado_idx ON public.intel_items (estado);
CREATE INDEX IF NOT EXISTS intel_items_cliente_idx ON public.intel_items (cliente);

-- atualizado_em sozinho, senao ninguem lembra de setar
CREATE OR REPLACE FUNCTION public.intel_items_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS intel_items_touch_trg ON public.intel_items;
CREATE TRIGGER intel_items_touch_trg
  BEFORE UPDATE ON public.intel_items
  FOR EACH ROW EXECUTE FUNCTION public.intel_items_touch();

-- RLS: cofre interno. Time (executor+) le e escreve. Cliente externo NAO ve nada.
-- A Sofia (n8n) entra por service_role, que bypassa RLS.
ALTER TABLE public.intel_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Cofre de inteligencia e do time" ON public.intel_items
    FOR ALL USING (public.has_min_role('executor'))
    WITH CHECK (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.intel_items IS 'Cofre de inteligencia do Joao: referencia crua -> angulo -> peca modelada -> task no ClickUp.';
COMMENT ON COLUMN public.intel_items.entregavel IS 'Peca final em markdown. Vai VERBATIM pra descricao da task no ClickUp.';
COMMENT ON COLUMN public.intel_items.transcricao IS 'Fala do video transcrita (Whisper) ou texto integral do que foi mandado.';

-- 22/08 (mesmo dia): o "motor" da referencia, o que faz ela prender. Saia so na
-- resposta da Sofia e nao ficava gravado, entao a Central nao mostrava.
ALTER TABLE public.intel_items ADD COLUMN IF NOT EXISTS motor TEXT;
COMMENT ON COLUMN public.intel_items.motor IS 'O mecanismo de atencao da referencia: por que aquilo prende.';

-- 22/08 (fim do dia): o Joao pediu que a modelagem espelho siga a MESMA quantidade de slides
-- da referencia e carregue o estilo visual dela pro briefing do designer.
ALTER TABLE public.intel_items ADD COLUMN IF NOT EXISTS estilo_visual TEXT;
ALTER TABLE public.intel_items ADD COLUMN IF NOT EXISTS qtd_slides INT;
COMMENT ON COLUMN public.intel_items.estilo_visual IS 'Como a referencia e desenhada: layout, tipografia, cor, uso de imagem. Vai pro briefing do designer.';
COMMENT ON COLUMN public.intel_items.qtd_slides IS 'Quantos slides a referencia tem. A modelagem espelho segue esse numero.';

-- 23/08: a mesma referencia serve varios clientes. Modelar duas vezes estava sobrescrevendo a
-- peca do primeiro cliente. Agora a segunda modelagem nasce como linha propria, apontando pra
-- referencia de origem.
ALTER TABLE public.intel_items ADD COLUMN IF NOT EXISTS derivado_de UUID REFERENCES public.intel_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS intel_items_derivado_idx ON public.intel_items (derivado_de);
COMMENT ON COLUMN public.intel_items.derivado_de IS 'Quando a peca nasce de uma referencia ja modelada pra outro cliente, ela vira linha propria apontando pra referencia.';
