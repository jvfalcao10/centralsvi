-- Geracao automatica das faturas do mes.
--
-- Problema que isso resolve: ate aqui a fatura so nascia quando alguem clicava
-- "Registrar pag.", e ja nascia `pago`. Logo, quem nao pagou nao virava linha,
-- virava AUSENCIA de linha, e inadimplencia so dava pra deduzir. Na pratica
-- (03/08/2026) isso deu 8 falsos inadimplentes contra 1 real, porque o registro
-- do pagamento atrasa dias ou semanas.
--
-- Com isso aqui, todo dia 1 nasce uma fatura `pendente` por cliente ativo.
-- "Pendente" passa a ser estado real e registrar pagamento vira BAIXA em vez de
-- criacao. A lista de inadimplente para de depender de deducao.
--
-- Roda sozinha via pg_cron, e e idempotente: pode ser chamada a mao quantas
-- vezes quiser que nao duplica (ver o NOT EXISTS por mes).

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.gerar_faturas_do_mes(
  p_mes date DEFAULT (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')))::date
)
RETURNS TABLE (mes text, criadas integer, puladas_moeda integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes     date := date_trunc('month', p_mes)::date;
  v_criadas integer;
  v_puladas integer;
BEGIN
  WITH elegiveis AS (
    SELECT
      c.id,
      c.mrr,
      -- dia 31 em mes de 30 cai no ultimo dia do mes
      make_date(
        EXTRACT(YEAR  FROM v_mes)::int,
        EXTRACT(MONTH FROM v_mes)::int,
        LEAST(c.dia_vencimento, EXTRACT(DAY FROM (v_mes + INTERVAL '1 month - 1 day'))::int)
      ) AS vencimento
    FROM public.clients c
    WHERE c.status = 'ativo'
      AND c.dia_vencimento IS NOT NULL
      AND c.mrr > 0
      -- USD fica de fora: a conversao depende da cotacao do dia, que o app faz
      -- na hora de registrar. Gerar aqui gravaria o numero em dolar como se
      -- fosse real. Hoje isso e so o MJC Pavers, registrado a mao.
      AND c.currency = 'BRL'
      -- so entra quem ja tinha primeira mensalidade vencida neste mes.
      -- primeira mensalidade = primeiro vencimento DEPOIS da assinatura, nunca
      -- no mesmo dia (contrato 30/07 vencendo dia 30 comeca a dever em agosto).
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
      -- idempotencia: se ja existe qualquer fatura desse cliente no mes, nao cria
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

  SELECT count(*)::int INTO v_puladas
  FROM public.clients c
  WHERE c.status = 'ativo'
    AND c.dia_vencimento IS NOT NULL
    AND c.currency <> 'BRL';

  RETURN QUERY SELECT to_char(v_mes, 'YYYY-MM'), v_criadas, v_puladas;
END;
$$;

COMMENT ON FUNCTION public.gerar_faturas_do_mes(date) IS
  'Cria as faturas pendentes do mes para clientes ativos em BRL. Idempotente. Roda via pg_cron todo dia 1 as 06h de Brasilia.';

-- Agendamento: dia 1 de cada mes, 09:00 UTC = 06:00 de Brasilia.
-- unschedule antes para a migracao poder rodar de novo sem duplicar o job.
DO $$
BEGIN
  PERFORM cron.unschedule('gerar-faturas-mensais');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job ainda nao existia
END $$;

SELECT cron.schedule(
  'gerar-faturas-mensais',
  '0 9 1 * *',
  $$SELECT public.gerar_faturas_do_mes();$$
);
