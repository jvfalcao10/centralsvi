-- Listas de tarefas (04/09/2026, segunda rodada no mesmo dia).
--
-- Feedback do Joao na v1: "nao ta igual ClickUp que colocamos lista, pasta,
-- pessoas, convite. Ta solto como se fosse so meu to do list."
--
-- A estrutura do ClickUp na Central fica assim:
--   pasta Clientes  -> automatica, uma "lista" por cliente com tarefa (cliente_id)
--   pasta Equipe    -> automatica, uma fila por pessoa (dono_id)
--   pasta Listas    -> ESTA tabela: listas nomeadas a mao (Tarefas Gerais,
--                      Operacional SVI...), criadas/renomeadas na propria tela
-- Cliente e pessoa nao viram linha aqui de proposito: ja sao entidades da
-- Central e duplicar viraria dessincronizacao na certa.

CREATE TABLE IF NOT EXISTS public.tarefa_listas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📋',
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS lista_id UUID REFERENCES public.tarefa_listas(id) ON DELETE SET NULL;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS lista_nome TEXT;

CREATE INDEX IF NOT EXISTS tarefas_lista_idx ON public.tarefas (lista_id);

ALTER TABLE public.tarefa_listas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Listas sao do time" ON public.tarefa_listas
    FOR ALL USING (public.has_min_role('executor'))
    WITH CHECK (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.tarefa_listas IS 'Listas nomeadas da aba Tarefas (pasta "Listas"); clientes e pessoas agrupam sozinhos.';

-- Seed espelhando as listas gerais que existiam no ClickUp
INSERT INTO public.tarefa_listas (nome, emoji, ordem)
SELECT v.nome, v.emoji, v.ordem
FROM (VALUES ('Tarefas Gerais', '🗂️', 0), ('Operacional SVI', '⚙️', 1)) AS v(nome, emoji, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.tarefa_listas t WHERE t.nome = v.nome);
