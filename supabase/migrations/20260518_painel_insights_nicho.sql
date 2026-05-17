-- ============================================================================
-- SVI OS — estender kinds de insights pra inteligência de nicho
-- Aditivo + idempotente.
-- ============================================================================

-- 1. Estender CHECK de kind pra aceitar novos tipos
alter table public.painel_insights drop constraint if exists painel_insights_kind_check;
alter table public.painel_insights add constraint painel_insights_kind_check
  check (kind in (
    'campaign_analysis','creative_fatigue','recommendation','win_pattern',
    'risk','copy_suggestion','news','content_idea','opportunity'
  ));

-- 2. Adicionar coluna URL opcional (pra news ter link da fonte)
alter table public.painel_insights add column if not exists source_url text;

-- 3. Adicionar coluna source_label opcional (pra mostrar "Folha de SP", "Exame", etc)
alter table public.painel_insights add column if not exists source_label text;

-- 4. Adicionar índice pra filtros por kind/status que vamos usar
create index if not exists idx_painel_insights_client_kind on public.painel_insights(client_id, kind, created_at desc);
