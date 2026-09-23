-- Dedicacao real do candidato (23/09/2026).
-- Joao: "e bom saber se tem tempo ser fixo nosso".
-- Gestor de trafego costuma ter carteira propria. Quem mantem 6 clientes
-- nao vira fixo, por melhor que seja. Isso e FATO, nao qualidade, entao
-- nao entra na nota: entra como alerta na ficha.
ALTER TABLE public.vaga_candidatos ADD COLUMN IF NOT EXISTS situacao_atual TEXT;
ALTER TABLE public.vaga_candidatos ADD COLUMN IF NOT EXISTS se_entrar TEXT;
ALTER TABLE public.vaga_candidatos ADD COLUMN IF NOT EXISTS horas_dia TEXT;
COMMENT ON COLUMN public.vaga_candidatos.se_entrar IS 'O que ele faz com o que atende hoje se for contratado. O campo que mais diz se vira fixo.';
