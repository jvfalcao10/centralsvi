-- Comentarios na tarefa (04/09/2026, terceira rodada do dia).
-- Pedido do Joao: "clicar em cima da tarefa e abrir um card com tudo igual
-- ClickUp". O card sem o fio de comentarios nao substitui o ClickUp, porque
-- e nos comentarios que o time troca feedback de entrega.

CREATE TABLE IF NOT EXISTS public.tarefa_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id UUID,
  autor_nome TEXT,
  texto TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tarefa_comentarios_tarefa_idx ON public.tarefa_comentarios (tarefa_id, criado_em);

ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Comentarios sao do time" ON public.tarefa_comentarios
    FOR ALL USING (public.has_min_role('executor'))
    WITH CHECK (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.tarefa_comentarios IS 'Fio de comentarios do card de tarefa na Central.';
