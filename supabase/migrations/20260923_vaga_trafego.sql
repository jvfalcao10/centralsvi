-- Vaga de gestor de trafego (23/09/2026).
-- Candidato responde o formulario publico, a IA corrige as abertas e o admin
-- da Central abre o ranking pronto.
--
-- SEGURANCA: o anon NAO escreve aqui. O formulario posta num endpoint que
-- entra com service role. Assim a tabela fica fechada pros dois lados e
-- ninguem consegue ler resposta nem gabarito de fora.

CREATE TABLE IF NOT EXISTS public.vaga_candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  vaga TEXT NOT NULL DEFAULT 'gestor-trafego',

  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  cidade TEXT,
  link_prova TEXT,

  anos_experiencia INT,
  verba_gerida TEXT,
  contas_simultaneas TEXT,
  verticais TEXT[],
  disponibilidade TEXT,
  aceita_pj BOOLEAN,
  pretensao TEXT,

  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,

  score_tecnico NUMERIC(5,2),
  score_aberto NUMERIC(5,2),
  score_total NUMERIC(5,2),
  notas_dimensao JSONB,
  parecer TEXT,
  pontos_fortes TEXT[],
  alertas TEXT[],
  erro_correcao TEXT,

  status TEXT NOT NULL DEFAULT 'novo',
  observacao_interna TEXT
);

ALTER TABLE public.vaga_candidatos DROP CONSTRAINT IF EXISTS vaga_candidatos_status_check;
ALTER TABLE public.vaga_candidatos ADD CONSTRAINT vaga_candidatos_status_check
  CHECK (status = ANY (ARRAY['novo','triagem','entrevista','teste','reprovado','contratado']));

CREATE INDEX IF NOT EXISTS vaga_candidatos_score_idx ON public.vaga_candidatos (vaga, score_total DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS vaga_candidatos_status_idx ON public.vaga_candidatos (status);
CREATE UNIQUE INDEX IF NOT EXISTS vaga_candidatos_wpp_uidx ON public.vaga_candidatos (vaga, whatsapp);

ALTER TABLE public.vaga_candidatos ENABLE ROW LEVEL SECURITY;

-- Regra da casa: tabela nova nasce aberta, entao fecha nominalmente.
REVOKE ALL ON public.vaga_candidatos FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.vaga_candidatos TO authenticated;

DO $$ BEGIN
  CREATE POLICY "Candidatos so pra gestao" ON public.vaga_candidatos
    FOR ALL USING (public.has_min_role('manager'))
    WITH CHECK (public.has_min_role('manager'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.vaga_candidatos IS 'Candidatos da vaga de trafego, com correcao automatica. Escrita so por service role (endpoint publico); leitura so manager+.';
COMMENT ON COLUMN public.vaga_candidatos.alertas IS 'O que preocupa na candidatura: vicio tecnico, resposta vaga, contradicao.';
