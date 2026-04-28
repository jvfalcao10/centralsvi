-- Recurring monthly expenses
-- When an expense flagged `recorrente = true` is marked as `pago`,
-- a trigger automatically creates the next month's pending expense.
-- `recorrencia_gerada` prevents duplicate generation if the user toggles status back and forth.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recorrente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia_gerada BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.criar_proxima_recorrencia()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pago'
     AND OLD.status IS DISTINCT FROM 'pago'
     AND NEW.recorrente = true
     AND NEW.recorrencia_gerada = false THEN

    INSERT INTO public.expenses (
      categoria, descricao, valor, vencimento, status, recorrente, recorrencia_gerada
    )
    VALUES (
      NEW.categoria,
      NEW.descricao,
      NEW.valor,
      (NEW.vencimento + INTERVAL '1 month')::date,
      'pendente',
      true,
      false
    );

    NEW.recorrencia_gerada := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_criar_proxima_recorrencia ON public.expenses;
CREATE TRIGGER trigger_criar_proxima_recorrencia
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_proxima_recorrencia();
