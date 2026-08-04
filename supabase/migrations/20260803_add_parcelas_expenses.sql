-- Despesas parceladas no contas a pagar.
-- Uma compra em 12x vira 12 linhas em `expenses`, uma por mês,
-- cada uma sabendo em que parcela está (`parcela_atual`) e quantas são no total (`parcelas_total`).
--
-- Nulo nas duas colunas = despesa NÃO parcelada (avulsa ou recorrente mensal).
-- Parcelada e recorrente são mutuamente exclusivas: a parcelada já nasce com todas as
-- parcelas criadas, então o trigger de recorrência (20260427) não deve tocar nela.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS parcela_atual INTEGER,
  ADD COLUMN IF NOT EXISTS parcelas_total INTEGER;

-- Trava de sanidade: se veio parcela, tem que vir o total, e a parcela não pode passar do total.
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_parcelas_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_parcelas_check CHECK (
    (parcela_atual IS NULL AND parcelas_total IS NULL)
    OR (parcela_atual >= 1 AND parcelas_total >= 1 AND parcela_atual <= parcelas_total)
  );

COMMENT ON COLUMN public.expenses.parcela_atual IS 'Número desta parcela (1-based). Nulo se a despesa não é parcelada.';
COMMENT ON COLUMN public.expenses.parcelas_total IS 'Total de parcelas da compra. Nulo se a despesa não é parcelada.';
