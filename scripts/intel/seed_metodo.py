# -*- coding: utf-8 -*-
"""Cria/atualiza a tabela intel_metodo no Supabase da Central e faz o seed dos cartoes."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.expanduser("~/Dev/svi-supabase-audit"))
import sb
from metodo_cards import CARDS

REF = "qvkfcvcqlfamyzgqgnrq"

DDL = """
CREATE TABLE IF NOT EXISTS public.intel_metodo (
  slug TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  aplica_em TEXT[] NOT NULL DEFAULT ARRAY['sempre'],
  ordem INT NOT NULL DEFAULT 100,
  conteudo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intel_metodo ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Metodo e do time" ON public.intel_metodo
    FOR ALL USING (public.has_min_role('executor'))
    WITH CHECK (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON TABLE public.intel_metodo IS 'Metodo de conteudo da SVI destilado das skills. A Sofia carrega os cartoes por formato e usa como system prompt da modelagem.';
"""


def q(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    sb.sql(REF, DDL)
    for c in CARDS:
        arr = "ARRAY[" + ",".join(q(a) for a in c["aplica_em"]) + "]::text[]"
        sb.sql(REF, f"""
INSERT INTO public.intel_metodo (slug, titulo, aplica_em, ordem, conteudo, ativo, atualizado_em)
VALUES ({q(c['slug'])}, {q(c['titulo'])}, {arr}, {c['ordem']}, {q(c['conteudo'])}, true, now())
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  aplica_em = EXCLUDED.aplica_em,
  ordem = EXCLUDED.ordem,
  conteudo = EXCLUDED.conteudo,
  ativo = true,
  atualizado_em = now();
""")
        print("ok", c["slug"])
    r = sb.sql(REF, "SELECT count(*) AS n, sum(length(conteudo)) AS chars FROM public.intel_metodo WHERE ativo")
    print(r)


if __name__ == "__main__":
    main()
