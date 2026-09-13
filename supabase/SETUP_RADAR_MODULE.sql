-- ============================================================================
-- MÓDULO RADAR DE CONTEÚDO
-- ----------------------------------------------------------------------------
-- Alimenta a página Radar com coleta real em vez de cadastro manual.
--
-- Ideia central: o perfil vigiado é compartilhado entre clientes. Se três
-- clientes vigiam o mesmo perfil, a coleta roda uma vez só e serve os três.
-- Quem liga cliente e perfil é a watchlist.
--
-- A régua de destaque é a mediana do próprio perfil, guardada em
-- radar_profiles e recalculada a cada coleta. Número absoluto grande não vira
-- destaque sozinho: o reel precisa passar do que aquele perfil costuma fazer.
--
-- Toda tabela nasce com RLS ligada. Staff enxerga tudo a partir de executor;
-- cliente enxerga apenas o que está na própria watchlist.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PERFIS VIGIADOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform           TEXT NOT NULL DEFAULT 'instagram',
  handle             TEXT NOT NULL,
  display_name       TEXT,
  avatar_url         TEXT,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  -- Baseline do perfil, recalculado pelo coletor a cada rodada.
  median_views       BIGINT,
  sample_size        INTEGER NOT NULL DEFAULT 0,
  median_updated_at  TIMESTAMPTZ,
  last_collected_at  TIMESTAMPTZ,
  last_error         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT radar_profiles_platform_handle_key UNIQUE (platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_radar_profiles_active
  ON public.radar_profiles(active, last_collected_at NULLS FIRST);

ALTER TABLE public.radar_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Radar profiles staff" ON public.radar_profiles
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. WATCHLIST: QUEM VIGIA QUEM
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_watchlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES public.radar_profiles(id) ON DELETE CASCADE,
  -- Por que este perfil entrou: concorrente, referência do nicho, outro mercado.
  reason      TEXT,
  added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT radar_watchlist_client_profile_key UNIQUE (client_id, profile_id)
);

DO $$ BEGIN
  -- Depende da watchlist, por isso nasce depois dela.
  -- Cliente enxerga apenas os perfis que ele mesmo colocou no radar.
  CREATE POLICY "Radar profiles client read" ON public.radar_profiles
    FOR SELECT USING (
      id IN (
        SELECT profile_id FROM public.radar_watchlist
        WHERE client_id = public.current_client_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_radar_watchlist_client ON public.radar_watchlist(client_id);
CREATE INDEX IF NOT EXISTS idx_radar_watchlist_profile ON public.radar_watchlist(profile_id);

ALTER TABLE public.radar_watchlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Radar watchlist staff" ON public.radar_watchlist
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- O cliente monta e desmonta a própria lista, no onboarding e depois.
  CREATE POLICY "Radar watchlist client" ON public.radar_watchlist
    FOR ALL USING (client_id = public.current_client_id())
    WITH CHECK (client_id = public.current_client_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. POSTS COLETADOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID NOT NULL REFERENCES public.radar_profiles(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL DEFAULT 'instagram',
  external_id    TEXT NOT NULL,
  url            TEXT NOT NULL,
  caption        TEXT,
  views          BIGINT,
  likes          BIGINT,
  comments       BIGINT,
  duration_s     NUMERIC,
  published_at   TIMESTAMPTZ,
  thumb_url      TEXT,
  video_url      TEXT,
  -- Comparação com o próprio perfil, gravada na coleta.
  times_median   NUMERIC,
  is_highlight   BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT radar_posts_platform_external_key UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_radar_posts_profile ON public.radar_posts(profile_id);
CREATE INDEX IF NOT EXISTS idx_radar_posts_published ON public.radar_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_posts_highlight
  ON public.radar_posts(is_highlight, published_at DESC);

ALTER TABLE public.radar_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Radar posts staff" ON public.radar_posts
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Radar posts client read" ON public.radar_posts
    FOR SELECT USING (
      profile_id IN (
        SELECT profile_id FROM public.radar_watchlist
        WHERE client_id = public.current_client_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 4. O QUE O CLIENTE MARCOU
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_saves (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  post_id            UUID NOT NULL REFERENCES public.radar_posts(id) ON DELETE CASCADE,
  note               TEXT,
  -- Caminho do que foi marcado até virar entregável.
  status             TEXT NOT NULL DEFAULT 'salvo',
  converted_pauta_id UUID REFERENCES public.content_pautas(id) ON DELETE SET NULL,
  saved_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT radar_saves_client_post_key UNIQUE (client_id, post_id),
  CONSTRAINT radar_saves_status_check CHECK (status IN ('salvo', 'em_producao', 'usado', 'descartado'))
);

CREATE INDEX IF NOT EXISTS idx_radar_saves_client ON public.radar_saves(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_saves_status ON public.radar_saves(status);

ALTER TABLE public.radar_saves ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Radar saves staff" ON public.radar_saves
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Radar saves client" ON public.radar_saves
    FOR ALL USING (client_id = public.current_client_id())
    WITH CHECK (client_id = public.current_client_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 5. TRANSCRIÇÃO SOB DEMANDA
-- ----------------------------------------------------------------------------
-- Transcrever tudo não escala nem em custo nem em tempo. Só o que alguém
-- marcou, ou o que a equipe abriu para virar roteiro, chega aqui.
CREATE TABLE IF NOT EXISTS public.radar_transcripts (
  post_id     UUID PRIMARY KEY REFERENCES public.radar_posts(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  hook        TEXT,
  words       INTEGER,
  model       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.radar_transcripts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Radar transcripts staff" ON public.radar_transcripts
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Radar transcripts client read" ON public.radar_transcripts
    FOR SELECT USING (
      post_id IN (
        SELECT p.id FROM public.radar_posts p
        JOIN public.radar_watchlist w ON w.profile_id = p.profile_id
        WHERE w.client_id = public.current_client_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 6. REGISTRO DAS COLETAS
-- ----------------------------------------------------------------------------
-- Serve para saber quanto custou, o que entrou e o que falhou, sem depender
-- de log de ferramenta externa.
CREATE TABLE IF NOT EXISTS public.radar_collections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source         TEXT NOT NULL DEFAULT 'instagram',
  profiles_count INTEGER NOT NULL DEFAULT 0,
  items_read     INTEGER NOT NULL DEFAULT 0,
  posts_new      INTEGER NOT NULL DEFAULT 0,
  highlights     INTEGER NOT NULL DEFAULT 0,
  cost_usd       NUMERIC(10, 4),
  ok             BOOLEAN NOT NULL DEFAULT TRUE,
  message        TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_radar_collections_started
  ON public.radar_collections(started_at DESC);

ALTER TABLE public.radar_collections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Custo é assunto da casa: cliente não lê esta tabela.
  CREATE POLICY "Radar collections staff" ON public.radar_collections
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 7. BIBLIOTECA DE ANÚNCIOS
-- ----------------------------------------------------------------------------
-- A Biblioteca não publica desempenho de anúncio comercial. O sinal honesto é
-- há quanto tempo o anúncio está no ar: ninguém paga para manter anúncio ruim.
-- days_running é sinal, não métrica de resultado.
CREATE TABLE IF NOT EXISTS public.radar_ad_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name   TEXT NOT NULL,
  page_id     TEXT,
  page_url    TEXT,
  country     TEXT NOT NULL DEFAULT 'BR',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_collected_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT radar_ad_pages_page_key UNIQUE (page_name, country)
);

CREATE TABLE IF NOT EXISTS public.radar_ad_watchlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_page_id  UUID REFERENCES public.radar_ad_pages(id) ON DELETE CASCADE,
  -- Ou vigia uma página concorrente, ou uma palavra do nicho.
  keyword     TEXT,
  added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT radar_ad_watchlist_alvo_check CHECK (ad_page_id IS NOT NULL OR keyword IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.radar_ads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_page_id     UUID REFERENCES public.radar_ad_pages(id) ON DELETE CASCADE,
  keyword        TEXT,
  archive_id     TEXT NOT NULL,
  page_name      TEXT,
  body           TEXT,
  cta            TEXT,
  link_url       TEXT,
  media_type     TEXT,
  media_url      TEXT,
  thumb_url      TEXT,
  started_at     TIMESTAMPTZ,
  days_running   INTEGER,
  variations     INTEGER,
  still_active   BOOLEAN,
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT radar_ads_archive_key UNIQUE (archive_id)
);

CREATE INDEX IF NOT EXISTS idx_radar_ads_page ON public.radar_ads(ad_page_id);
CREATE INDEX IF NOT EXISTS idx_radar_ads_days ON public.radar_ads(days_running DESC);
CREATE INDEX IF NOT EXISTS idx_radar_ad_watchlist_client ON public.radar_ad_watchlist(client_id);

ALTER TABLE public.radar_ad_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_ad_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_ads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Radar ad pages staff" ON public.radar_ad_pages
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Radar ad pages client read" ON public.radar_ad_pages
    FOR SELECT USING (
      id IN (
        SELECT ad_page_id FROM public.radar_ad_watchlist
        WHERE client_id = public.current_client_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Radar ad watchlist staff" ON public.radar_ad_watchlist
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Radar ad watchlist client" ON public.radar_ad_watchlist
    FOR ALL USING (client_id = public.current_client_id())
    WITH CHECK (client_id = public.current_client_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Radar ads staff" ON public.radar_ads
    FOR ALL USING (public.has_min_role('executor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Radar ads client read" ON public.radar_ads
    FOR SELECT USING (
      ad_page_id IN (
        SELECT ad_page_id FROM public.radar_ad_watchlist
        WHERE client_id = public.current_client_id()
      )
      OR keyword IN (
        SELECT keyword FROM public.radar_ad_watchlist
        WHERE client_id = public.current_client_id() AND keyword IS NOT NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
