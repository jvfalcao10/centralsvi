-- Pipeline de conteudo com aprovacao do cliente.
--
-- Diagnostico (10/08/2026): o funil ja existia no ClickUp com as etapas certas
-- (recebido -> em edicao -> aguardando aprovacao -> ajuste -> aprovado -> postado),
-- mas das 72 tarefas NENHUMA passou por "aguardando aprovacao" ou "ajuste". As
-- tarefas nasciam com nome "[Cliente] POST_FINAL aprovado 12/05 21:58", ou seja,
-- ja aprovadas. A aprovacao acontecia no WhatsApp e alguem registrava depois.
-- Mesma doenca da fatura: o sistema registrava o passado em vez de conduzir.
--
-- Na Central, content_posts tinha as etapas ideia/producao/agendado/publicado e
-- ZERO linhas, porque a pagina nem estava no menu.
--
-- Aqui o funil ganha as tres etapas que faltavam e o entregavel:
--   ideia -> producao -> aprovacao -> (ajuste) -> aprovado -> agendado -> publicado
--
-- O video NAO sobe pro banco: fica no Drive (qualidade + peso) e vem o link,
-- mais um print pro cliente ver sem baixar nada. Foi o que o Joao pediu.
--
-- Aplicado em 10/08/2026 via Management API.

ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS arquivo_url text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS motivo_ajuste text,
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por text,
  ADD COLUMN IF NOT EXISTS token text;

ALTER TABLE public.content_posts DROP CONSTRAINT IF EXISTS content_posts_status_check;
ALTER TABLE public.content_posts ADD CONSTRAINT content_posts_status_check
  CHECK (status = ANY (ARRAY['ideia','producao','aprovacao','ajuste','aprovado','agendado','publicado']));

-- Token do link publico. Parcial porque a maioria das pecas nunca vira link.
CREATE UNIQUE INDEX IF NOT EXISTS content_posts_token_uidx
  ON public.content_posts (token) WHERE token IS NOT NULL;

COMMENT ON COLUMN public.content_posts.arquivo_url IS 'Link do arquivo final no Drive. Video nao sobe pro banco.';
COMMENT ON COLUMN public.content_posts.preview_url IS 'Print/thumb pro cliente aprovar sem baixar nada.';
COMMENT ON COLUMN public.content_posts.token IS 'Token do link publico /aprovar/conteudo/:token. A tabela segue fechada pro anon: quem le e o endpoint com service role.';
