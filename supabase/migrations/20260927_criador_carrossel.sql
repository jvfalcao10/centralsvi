-- Criador de Carrossel dentro da Central (27/09/2026).
--
-- Pedido do Joao: templates, conhecimento e "varios agentes" num lugar so. Decisao dele: sem IA
-- dentro da Central (custo zero de API) e so ele usa. Os agentes sao prompts prontos, a resposta
-- volta em JSON e a pagina /conteudo/criador-carrossel monta as laminas e exporta os PNG.
-- Esta tabela guarda os rascunhos. As fotos ficam no bucket privado criador-carrossel.
--
-- Regras da casa aplicadas: tabela nova nasce aberta no Supabase (default privileges dao GRANT
-- ALL para anon e authenticated), entao a RLS liga na mesma hora e o anon perde tudo. Funcao
-- nova tambem nasce chamavel: o revoke nomeia public, anon e authenticated.

CREATE TABLE IF NOT EXISTS public.criador_carrosseis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT,
  template TEXT NOT NULL DEFAULT 't10',
  -- lista de laminas: [{ id, tipo, campos: {chave: texto}, foto: "pedido", fotos: {chave: {path, x, y}} }]
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  legenda TEXT,
  -- opcoes do carrossel: { assinatura, fundo, dataRodape }
  opcoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por UUID DEFAULT auth.uid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.criador_carrosseis DROP CONSTRAINT IF EXISTS criador_carrosseis_template_check;
ALTER TABLE public.criador_carrosseis ADD CONSTRAINT criador_carrosseis_template_check
  CHECK (template = ANY (ARRAY['t5','t6','t7','t8','t9','t10']));

ALTER TABLE public.criador_carrosseis DROP CONSTRAINT IF EXISTS criador_carrosseis_slides_array;
ALTER TABLE public.criador_carrosseis ADD CONSTRAINT criador_carrosseis_slides_array
  CHECK (jsonb_typeof(slides) = 'array');

CREATE INDEX IF NOT EXISTS criador_carrosseis_atualizado_idx ON public.criador_carrosseis (atualizado_em DESC);

CREATE OR REPLACE FUNCTION public.criador_carrosseis_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.criador_carrosseis_touch() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS criador_carrosseis_touch_trg ON public.criador_carrosseis;
CREATE TRIGGER criador_carrosseis_touch_trg
  BEFORE UPDATE ON public.criador_carrosseis
  FOR EACH ROW EXECUTE FUNCTION public.criador_carrosseis_touch();

-- RLS: so admin (o Joao). Cliente, executor e anon nao veem nada.
ALTER TABLE public.criador_carrosseis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.criador_carrosseis FROM anon;

DROP POLICY IF EXISTS "Criador de carrossel so admin" ON public.criador_carrosseis;
CREATE POLICY "Criador de carrossel so admin" ON public.criador_carrosseis
  FOR ALL TO authenticated
  USING (public.has_min_role('admin'))
  WITH CHECK (public.has_min_role('admin'));

COMMENT ON TABLE public.criador_carrosseis IS 'Rascunhos do Criador de Carrossel da Central (/conteudo/criador-carrossel). So admin.';

-- Bucket privado das fotos das laminas (leitura por URL assinada).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('criador-carrossel', 'criador-carrossel', false, 15728640, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "criador-carrossel admin le" ON storage.objects;
CREATE POLICY "criador-carrossel admin le" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'criador-carrossel' AND public.has_min_role('admin'));

DROP POLICY IF EXISTS "criador-carrossel admin sobe" ON storage.objects;
CREATE POLICY "criador-carrossel admin sobe" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'criador-carrossel' AND public.has_min_role('admin'));

DROP POLICY IF EXISTS "criador-carrossel admin altera" ON storage.objects;
CREATE POLICY "criador-carrossel admin altera" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'criador-carrossel' AND public.has_min_role('admin'))
  WITH CHECK (bucket_id = 'criador-carrossel' AND public.has_min_role('admin'));

DROP POLICY IF EXISTS "criador-carrossel admin apaga" ON storage.objects;
CREATE POLICY "criador-carrossel admin apaga" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'criador-carrossel' AND public.has_min_role('admin'));
