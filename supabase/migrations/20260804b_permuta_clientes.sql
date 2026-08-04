-- Permuta: cliente ativo que troca o servico em vez de pagar em dinheiro.
--
-- Nao e inadimplente (nao deve nada) e nao e MRR zero (o contrato tem valor,
-- so nao vira caixa). Sem esse estado, a Central so tinha duas gavetas erradas
-- pra colocar esse cliente: ou ele aparecia devendo todo mes, ou o MRR dele
-- ficava zerado no cadastro e ele sumia da cobranca pra sempre.
--
-- Dois formatos, os dois reais na carteira em 04/08/2026:
--   permuta = true, permuta_ate = NULL         -> permuta sem prazo (Numeros Contabilidade)
--   permuta = true, permuta_ate = '2026-08-31' -> permuta ate agosto, cobra a partir de
--                                                 setembro (Carlotinha Veiculos, 2 meses permutados)
--
-- A parte do ALTER TABLE ja foi aplicada em 04/08/2026. A funcao abaixo precisa
-- ser colada no SQL Editor: a trava do Claude Code bloqueia CREATE FUNCTION pela
-- Management API.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS permuta BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permuta_ate DATE;

COMMENT ON COLUMN public.clients.permuta IS 'Cliente ativo que nao paga em dinheiro (troca por servico/produto).';
COMMENT ON COLUMN public.clients.permuta_ate IS 'Ultimo dia da permuta. Nulo = permuta sem prazo. Volta a gerar fatura no mes seguinte a esta data.';

-- Regera a funcao de faturamento ensinando a pular quem esta em permuta no mes.
--
-- DROP antes do CREATE porque o retorno mudou: ganhou a coluna `puladas_permuta`.
-- CREATE OR REPLACE nao muda tipo de retorno (Postgres 42P13). Dropar e seguro
-- aqui: o job do pg_cron guarda o comando como TEXTO ("SELECT
-- public.gerar_faturas_do_mes();") e so resolve a funcao na hora de rodar, entao
-- o agendamento continua valendo sem precisar reagendar.
DROP FUNCTION IF EXISTS public.gerar_faturas_do_mes(date);

CREATE OR REPLACE FUNCTION public.gerar_faturas_do_mes(
  p_mes date DEFAULT (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')))::date
)
RETURNS TABLE (mes text, criadas integer, puladas_moeda integer, puladas_permuta integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_mes      date := date_trunc('month', p_mes)::date;
  v_criadas  integer;
  v_moeda    integer;
  v_permuta  integer;
BEGIN
  WITH elegiveis AS (
    SELECT
      c.id,
      c.mrr,
      make_date(
        EXTRACT(YEAR  FROM v_mes)::int,
        EXTRACT(MONTH FROM v_mes)::int,
        LEAST(c.dia_vencimento, EXTRACT(DAY FROM (v_mes + INTERVAL '1 month - 1 day'))::int)
      ) AS vencimento
    FROM public.clients c
    WHERE c.status = 'ativo'
      AND c.dia_vencimento IS NOT NULL
      AND c.mrr > 0
      AND c.currency = 'BRL'
      -- permuta no mes nao gera fatura. permuta_ate no proprio mes ainda conta
      -- como permuta; a cobranca volta no mes seguinte.
      AND NOT (c.permuta AND (c.permuta_ate IS NULL OR c.permuta_ate >= v_mes))
      AND (
        CASE
          WHEN LEAST(
                 c.dia_vencimento,
                 EXTRACT(DAY FROM (date_trunc('month', c.inicio_contrato) + INTERVAL '1 month - 1 day'))::int
               ) > EXTRACT(DAY FROM c.inicio_contrato)::int
          THEN date_trunc('month', c.inicio_contrato)::date
          ELSE (date_trunc('month', c.inicio_contrato) + INTERVAL '1 month')::date
        END
      ) <= v_mes
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.client_id = c.id
          AND date_trunc('month', i.vencimento) = v_mes
      )
  ), inseridas AS (
    INSERT INTO public.invoices (client_id, valor, vencimento, status)
    SELECT id, mrr, vencimento, 'pendente' FROM elegiveis
    RETURNING 1
  )
  SELECT count(*)::int INTO v_criadas FROM inseridas;

  SELECT count(*)::int INTO v_moeda
  FROM public.clients c
  WHERE c.status = 'ativo' AND c.dia_vencimento IS NOT NULL AND c.currency <> 'BRL';

  SELECT count(*)::int INTO v_permuta
  FROM public.clients c
  WHERE c.status = 'ativo' AND c.dia_vencimento IS NOT NULL
    AND c.permuta AND (c.permuta_ate IS NULL OR c.permuta_ate >= v_mes);

  RETURN QUERY SELECT to_char(v_mes, 'YYYY-MM'), v_criadas, v_moeda, v_permuta;
END;
$func$;

COMMENT ON FUNCTION public.gerar_faturas_do_mes(date) IS
  'Cria as faturas pendentes do mes para clientes ativos em BRL, fora de permuta. Idempotente. Roda via pg_cron todo dia 1 as 06h de Brasilia.';
