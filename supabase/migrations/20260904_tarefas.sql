-- Tarefas da equipe dentro da Central (04/09/2026).
--
-- Pedido do Joao: "nao tem tarefas igual ClickUp". A meta registrada e sair do
-- ClickUp ate nov/2026, e o motivo do funil de conteudo nunca ter sido usado
-- (content_posts zerada) e que a demanda nasce la, nao aqui. Esta tabela e o
-- lugar onde a demanda passa a nascer.
--
-- Desenho colado nas listas por cliente do ClickUp:
--   tarefa tem cliente (opcional: tarefa interna nao tem), dono, prazo e status.
--   `clickup_id` guarda o id original na importacao, pra rodar de novo sem duplicar.
--   `notificada` e o gancho do robo de WhatsApp no n8n: tarefa nova com dono
--   vira mensagem no PV, e o robo marca aqui pra nao mandar duas vezes.

CREATE TABLE IF NOT EXISTS public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',

  cliente_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  -- nome denormalizado: a tarefa continua legivel se o cliente for removido
  cliente_nome TEXT,

  -- dono: user_id de profiles quando a pessoa tem login; nome sempre preenchido
  dono_id UUID,
  dono_nome TEXT,

  prazo DATE,
  status TEXT NOT NULL DEFAULT 'aberta',
  prioridade TEXT NOT NULL DEFAULT 'normal',

  origem TEXT NOT NULL DEFAULT 'central',
  clickup_id TEXT,

  notificada BOOLEAN NOT NULL DEFAULT false,
  criado_por UUID,
  concluida_em TIMESTAMPTZ
);

ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_status_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_status_check
  CHECK (status = ANY (ARRAY['aberta','fazendo','feita']));

ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_prioridade_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_prioridade_check
  CHECK (prioridade = ANY (ARRAY['baixa','normal','alta']));

ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_origem_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_origem_check
  CHECK (origem = ANY (ARRAY['central','clickup','sofia']));

CREATE UNIQUE INDEX IF NOT EXISTS tarefas_clickup_uidx ON public.tarefas (clickup_id) WHERE clickup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tarefas_status_idx ON public.tarefas (status, prazo);
CREATE INDEX IF NOT EXISTS tarefas_dono_idx ON public.tarefas (dono_id, status);
CREATE INDEX IF NOT EXISTS tarefas_cliente_idx ON public.tarefas (cliente_id);

CREATE OR REPLACE FUNCTION public.tarefas_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.atualizado_em := now();
  IF NEW.status = 'feita' AND OLD.status IS DISTINCT FROM 'feita' THEN
    NEW.concluida_em := now();
  END IF;
  IF NEW.status <> 'feita' THEN
    NEW.concluida_em := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS tarefas_touch_trg ON public.tarefas;
CREATE TRIGGER tarefas_touch_trg
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tarefas_touch();

-- RLS: tarefa e do time (executor+). Cliente externo nao ve nada.
-- Robo do n8n entra por service_role, que bypassa RLS.
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tarefas sao do time" ON public.tarefas
    FOR ALL USING (public.has_min_role('executor'))
    WITH CHECK (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.tarefas IS 'Tarefas da equipe na Central: substituto das listas por cliente do ClickUp.';
COMMENT ON COLUMN public.tarefas.notificada IS 'false = o robo de WhatsApp do n8n ainda nao avisou o dono.';
COMMENT ON COLUMN public.tarefas.clickup_id IS 'Id original na importacao do ClickUp; unico, importar de novo nao duplica.';
