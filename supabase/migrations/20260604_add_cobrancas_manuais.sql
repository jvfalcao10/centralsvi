-- Cobranças Manuais SVI
-- Pix/boletos manuais que NÃO são MRR de cliente recorrente (cobranças com contato específico, recorrência semanal/avulsa, conferência de pagamento, etc).
-- Espelha a lista ClickUp 901523751994 (💰 Cobranças Recorrentes SVI).

CREATE TABLE IF NOT EXISTS public.cobrancas_manuais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  metodo TEXT NOT NULL DEFAULT 'pix',
  recorrencia TEXT NOT NULL DEFAULT 'mensal',
  dia_mes INTEGER,
  valor NUMERIC(12,2),
  contato TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  proximo_vencimento DATE,
  clickup_task_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cobrancas_manuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage cobrancas_manuais"
  ON public.cobrancas_manuais
  FOR ALL
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.cobrancas_manuais IS 'Cobranças manuais (pix/boleto não-MRR) com espelho ClickUp via clickup_task_id';
COMMENT ON COLUMN public.cobrancas_manuais.metodo IS 'pix | boleto | dinheiro | transferencia';
COMMENT ON COLUMN public.cobrancas_manuais.recorrencia IS 'mensal | semanal | avulso';
COMMENT ON COLUMN public.cobrancas_manuais.dia_mes IS 'Dia do mês de vencimento (1-31). NULL para avulso/semanal';

-- Seed inicial (jun/2026)
INSERT INTO public.cobrancas_manuais (cliente_nome, descricao, metodo, recorrencia, dia_mes, contato, observacoes, proximo_vencimento, clickup_task_id) VALUES
('Supermercado América', 'Emitir boleto mensal', 'boleto', 'mensal', 30, 'Patrícia (financeiro)', NULL, '2026-06-30', '86ca4kyqj'),
('Espaço Soraia',        'Emitir boleto mensal', 'boleto', 'mensal', 10, 'André (filho da Soraia)', NULL, '2026-06-10', '86ca4kyfn'),
('Dr. Felipe Branco',    'Cobrar pix da Kelen', 'pix', 'mensal', 10, 'Kelen', NULL, '2026-06-10', '86ca4kygg'),
('Spa Nature',           'Cobrar pix da Dra. Luana', 'pix', 'mensal', 20, 'Dra. Luana', 'Verificar separadamente pagamento maio/2026', '2026-06-20', '86ca4kyra'),
('Pro Life',             'Conferir pix do Wildson (raramente atrasa)', 'pix', 'mensal', 25, 'Wildson', 'Monitoramento, geralmente entra dia 20', '2026-06-25', '86ca4kyrw'),
('Alpha Fitness',        'Conferir pix do Sydney', 'pix', 'mensal', 30, 'Sydney', 'Pix até dia 30', '2026-06-30', '86ca4kyx1'),
('A Fórmula',            'Conferir pagamento dos 6 boletos abril/2026 em diante', 'boleto', 'mensal', 10, 'Financeiro deles', 'Boletos já estão com eles', '2026-06-10', '86ca4kym4'),
('Baruc Pizzas',         'Cobrar pix semanal R$ 250', 'pix', 'semanal', NULL, NULL, 'Recorrência semanal R$ 250', '2026-06-02', '86ca4kyn1'),
('⚠️ Spa Nature (maio)', 'Verificar se Dra. Luana pagou maio/2026', 'pix', 'avulso', NULL, 'Dra. Luana', 'PENDÊNCIA ÚNICA — não recorrente', '2026-06-04', '86ca4kyvf');

-- Trigger pra atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_cobrancas_manuais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cobrancas_manuais_updated_at ON public.cobrancas_manuais;
CREATE TRIGGER trg_cobrancas_manuais_updated_at
BEFORE UPDATE ON public.cobrancas_manuais
FOR EACH ROW
EXECUTE FUNCTION public.update_cobrancas_manuais_updated_at();
