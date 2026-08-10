-- Despesa recorrente que nasce sozinha, igual a fatura.
--
-- Diagnostico (10/08/2026): o trigger de 20260427 so cria a proxima despesa
-- QUANDO alguem marca a atual como paga. Ninguem marca. Resultado real: o banco
-- inteiro tinha 3 despesas, o aluguel de 05/05 dizia `recorrencia_gerada = true`
-- sem nenhum descendente, e a internet de 05/05 seguia pendente desde maio, ou
-- seja, nunca gerou junho, julho nem agosto.
--
-- Mesma doenca das faturas: o sistema so anda se alguem lembrar. Mesma cura:
-- a linha nasce no dia 1 e pagar vira BAIXA, nao criacao.
--
-- O modelo de cada recorrente e a linha mais recente com `recorrente = true`
-- daquela categoria+descricao. Nao inventa valor: repete o que ja foi cadastrado.
-- Idempotente: se ja existe despesa com a mesma descricao no mes, nao cria.
--
-- ⚠️ CREATE FUNCTION e bloqueado pela Management API (ver
-- feedback_vercel_hobby_limite_funcoes / trava do Claude Code): colar no SQL Editor.
-- Agosto/2026 ja foi gerado a mao por INSERT em 10/08 (Aluguel e Internet).

CREATE OR REPLACE FUNCTION public.gerar_despesas_do_mes(
  p_mes date DEFAULT (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')))::date
)
RETURNS TABLE (mes text, criadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_mes     date := date_trunc('month', p_mes)::date;
  v_criadas integer;
BEGIN
  WITH modelo AS (
    SELECT DISTINCT ON (categoria, descricao)
      categoria, descricao, valor, EXTRACT(DAY FROM vencimento)::int AS dia
    FROM public.expenses
    WHERE recorrente = true
      AND parcelas_total IS NULL          -- parcelada ja nasce inteira, nao repete
      AND vencimento <= (v_mes + INTERVAL '1 month - 1 day')::date
    ORDER BY categoria, descricao, vencimento DESC
  ), novas AS (
    INSERT INTO public.expenses (categoria, descricao, valor, vencimento, status, recorrente)
    SELECT m.categoria, m.descricao, m.valor,
           make_date(
             EXTRACT(YEAR FROM v_mes)::int, EXTRACT(MONTH FROM v_mes)::int,
             LEAST(m.dia, EXTRACT(DAY FROM (v_mes + INTERVAL '1 month - 1 day'))::int)
           ),
           'pendente', true
    FROM modelo m
    WHERE NOT EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.descricao = m.descricao AND e.categoria = m.categoria
        AND date_trunc('month', e.vencimento) = v_mes)
    RETURNING 1
  )
  SELECT count(*)::int INTO v_criadas FROM novas;

  RETURN QUERY SELECT to_char(v_mes, 'YYYY-MM'), v_criadas;
END;
$func$;

COMMENT ON FUNCTION public.gerar_despesas_do_mes(date) IS
  'Cria as despesas recorrentes pendentes do mes a partir do ultimo lancamento de cada uma. Idempotente. pg_cron, dia 1 as 06h de Brasilia.';

-- Desliga o trigger antigo: com a geracao mensal ele so duplicaria.
DROP TRIGGER IF EXISTS trigger_criar_proxima_recorrencia ON public.expenses;

DO $$
BEGIN
  PERFORM cron.unschedule('gerar-despesas-mensais');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('gerar-despesas-mensais', '5 9 1 * *',
  $$SELECT public.gerar_despesas_do_mes();$$);
