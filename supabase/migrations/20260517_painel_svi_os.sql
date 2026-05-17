-- ============================================================================
-- SVI OS Integration — Painel Cliente Multi-tenant
-- Todas as tabelas em public com prefixo `painel_*` (compatível com PostgREST).
-- Idempotente. Não afeta Sofia/IPER/MJC/MedCaixa/Central SVI existentes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ADD columns em public.clients (cada client vira potencialmente uma org tenant)
-- ----------------------------------------------------------------------------

alter table public.clients
  add column if not exists slug text;

alter table public.clients
  add column if not exists brand_color text default '#0A0A0A';

alter table public.clients
  add column if not exists painel_active boolean not null default false;

-- Auto-slug pra clientes que não têm
update public.clients
set slug = lower(regexp_replace(regexp_replace(coalesce(name, id::text), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
where slug is null;

-- Garante unicidade do slug (após backfill)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_slug_unique') then
    alter table public.clients add constraint clients_slug_unique unique (slug);
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- painel_members — quem pode acessar o painel de cada client
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'painel_member_role') then
    create type public.painel_member_role as enum ('client_admin', 'client_user');
  end if;
end$$;

create table if not exists public.painel_members (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.painel_member_role not null default 'client_user',
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index if not exists idx_painel_members_user on public.painel_members(user_id);

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------

create or replace function public.painel_is_svi_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'manager', 'seller', 'executor')
  )
$$;

create or replace function public.painel_user_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.painel_members where user_id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- Tabelas painel_*
-- ----------------------------------------------------------------------------

create table if not exists public.painel_integrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null check (provider in ('meta_ads','google_ads','kommo','whatsapp','google_analytics','stripe','custom')),
  account_id text,
  account_name text,
  credentials jsonb not null default '{}'::jsonb,
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, provider, account_id)
);
create index if not exists idx_painel_integrations_client on public.painel_integrations(client_id);

create table if not exists public.painel_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null check (provider in ('meta_ads','google_ads','other')),
  external_id text not null,
  name text not null,
  objective text,
  status text,
  budget_daily_brl numeric(10,2),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, provider, external_id)
);
create index if not exists idx_painel_campaigns_client on public.painel_campaigns(client_id);

create table if not exists public.painel_campaign_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  campaign_id uuid not null references public.painel_campaigns(id) on delete cascade,
  date date not null,
  impressions int default 0,
  clicks int default 0,
  spend_brl numeric(10,2) default 0,
  leads int default 0,
  cpc_brl numeric(10,2),
  cpm_brl numeric(10,2),
  ctr numeric(6,4),
  cpl_brl numeric(10,2),
  frequency numeric(6,2),
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (campaign_id, date)
);
create index if not exists idx_painel_metrics_client_date on public.painel_campaign_metrics_daily(client_id, date desc);

create table if not exists public.painel_creatives (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  campaign_id uuid references public.painel_campaigns(id) on delete set null,
  external_id text,
  name text,
  type text check (type in ('image','video','carousel','text')),
  preview_url text,
  score numeric(5,2),
  status text default 'active' check (status in ('active','paused','fatigued','winner','loser')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_painel_creatives_client on public.painel_creatives(client_id);
create index if not exists idx_painel_creatives_campaign on public.painel_creatives(campaign_id);

create table if not exists public.painel_pipelines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null default 'Vendas',
  is_default boolean default true,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_painel_pipeline_default on public.painel_pipelines(client_id) where is_default;

create table if not exists public.painel_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.painel_pipelines(id) on delete cascade,
  name text not null,
  position int not null,
  color text default '#8E8E93',
  is_won boolean default false,
  is_lost boolean default false,
  created_at timestamptz not null default now(),
  unique (pipeline_id, position)
);

create table if not exists public.painel_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  pipeline_id uuid references public.painel_pipelines(id) on delete set null,
  stage_id uuid references public.painel_pipeline_stages(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  source text,
  source_campaign_id uuid references public.painel_campaigns(id) on delete set null,
  utm jsonb,
  status text not null default 'new' check (status in ('new','contacted','qualified','meeting','proposal','won','lost','nurturing')),
  score int default 0,
  estimated_value_brl numeric(12,2),
  assigned_to uuid references auth.users(id) on delete set null,
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_painel_leads_client_status on public.painel_leads(client_id, status);
create index if not exists idx_painel_leads_pipeline on public.painel_leads(pipeline_id);

create table if not exists public.painel_lead_activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  lead_id uuid not null references public.painel_leads(id) on delete cascade,
  type text not null check (type in ('note','email','whatsapp','call','meeting','stage_change','status_change','ai_sdr_message','ai_sdr_action')),
  content text,
  metadata jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text default 'user' check (actor_kind in ('user','ai_sdr','system','integration')),
  created_at timestamptz not null default now()
);
create index if not exists idx_painel_activities_lead on public.painel_lead_activities(lead_id, created_at desc);
create index if not exists idx_painel_activities_client on public.painel_lead_activities(client_id, created_at desc);

create table if not exists public.painel_insights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('campaign_analysis','creative_fatigue','recommendation','win_pattern','risk','copy_suggestion')),
  title text not null,
  body text not null,
  severity text default 'info' check (severity in ('info','low','medium','high','critical')),
  context jsonb,
  status text default 'unread' check (status in ('unread','read','acted_on','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_painel_insights_client on public.painel_insights(client_id, created_at desc);

create table if not exists public.painel_alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  severity text default 'medium' check (severity in ('info','low','medium','high','critical')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_painel_alerts_client_unres on public.painel_alerts(client_id) where resolved_at is null;

create table if not exists public.painel_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  scope text not null default 'growth_agent' check (scope in ('growth_agent','sdr_agent','support_agent','copy_agent')),
  lead_id uuid references public.painel_leads(id) on delete set null,
  title text,
  created_at timestamptz not null default now()
);
create index if not exists idx_painel_ai_conv_client on public.painel_ai_conversations(client_id, created_at desc);

create table if not exists public.painel_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.painel_ai_conversations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_painel_ai_msg_conv on public.painel_ai_messages(conversation_id, created_at);

-- ----------------------------------------------------------------------------
-- TRIGGERS de updated_at (reusa função já existente da Central SVI)
-- ----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['painel_integrations','painel_campaigns','painel_creatives','painel_leads'] loop
    execute format(
      'drop trigger if exists trg_painel_updated on public.%I; ' ||
      'create trigger trg_painel_updated before update on public.%I ' ||
      'for each row execute function public.update_updated_at_column();',
      t, t
    );
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- RLS — tight: só membro do client OU svi_team
-- ----------------------------------------------------------------------------

alter table public.painel_members enable row level security;
alter table public.painel_integrations enable row level security;
alter table public.painel_campaigns enable row level security;
alter table public.painel_campaign_metrics_daily enable row level security;
alter table public.painel_creatives enable row level security;
alter table public.painel_pipelines enable row level security;
alter table public.painel_pipeline_stages enable row level security;
alter table public.painel_leads enable row level security;
alter table public.painel_lead_activities enable row level security;
alter table public.painel_insights enable row level security;
alter table public.painel_alerts enable row level security;
alter table public.painel_ai_conversations enable row level security;
alter table public.painel_ai_messages enable row level security;

drop policy if exists painel_members_read on public.painel_members;
create policy painel_members_read on public.painel_members for select
  using (user_id = auth.uid() or public.painel_is_svi_team());
drop policy if exists painel_members_svi_write on public.painel_members;
create policy painel_members_svi_write on public.painel_members for all
  using (public.painel_is_svi_team())
  with check (public.painel_is_svi_team());

do $$
declare
  t text;
  tables text[] := array[
    'painel_integrations','painel_campaigns','painel_campaign_metrics_daily','painel_creatives',
    'painel_pipelines','painel_leads','painel_lead_activities',
    'painel_insights','painel_alerts','painel_ai_conversations','painel_ai_messages'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %1$I on public.%2$I', t || '_member_read', t);
    execute format(
      'create policy %1$I on public.%2$I for select ' ||
      'using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team())',
      t || '_member_read', t
    );
    execute format('drop policy if exists %1$I on public.%2$I', t || '_member_write', t);
    execute format(
      'create policy %1$I on public.%2$I for all ' ||
      'using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team()) ' ||
      'with check (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team())',
      t || '_member_write', t
    );
  end loop;
end$$;

-- pipeline_stages: derivado de pipelines (sem client_id direto)
drop policy if exists painel_pipeline_stages_read on public.painel_pipeline_stages;
create policy painel_pipeline_stages_read on public.painel_pipeline_stages for select
  using (
    pipeline_id in (
      select id from public.painel_pipelines
      where client_id in (select public.painel_user_client_ids())
    )
    or public.painel_is_svi_team()
  );
drop policy if exists painel_pipeline_stages_write on public.painel_pipeline_stages;
create policy painel_pipeline_stages_write on public.painel_pipeline_stages for all
  using (
    pipeline_id in (
      select id from public.painel_pipelines
      where client_id in (select public.painel_user_client_ids())
    )
    or public.painel_is_svi_team()
  ) with check (
    pipeline_id in (
      select id from public.painel_pipelines
      where client_id in (select public.painel_user_client_ids())
    )
    or public.painel_is_svi_team()
  );

-- ----------------------------------------------------------------------------
-- RPC: ativar painel de um client
-- ----------------------------------------------------------------------------

create or replace function public.painel_activate_client(p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pipe_id uuid;
begin
  if not public.painel_is_svi_team() then
    raise exception 'forbidden';
  end if;

  update public.clients set painel_active = true where id = p_client_id;

  select id into v_pipe_id from public.painel_pipelines
    where client_id = p_client_id and is_default = true limit 1;

  if v_pipe_id is null then
    insert into public.painel_pipelines (client_id, name, is_default)
      values (p_client_id, 'Vendas', true)
      returning id into v_pipe_id;

    insert into public.painel_pipeline_stages (pipeline_id, name, position, color, is_won, is_lost) values
      (v_pipe_id, 'Novo lead', 0, '#8E8E93', false, false),
      (v_pipe_id, 'Contato feito', 1, '#0A84FF', false, false),
      (v_pipe_id, 'Qualificado', 2, '#5856D6', false, false),
      (v_pipe_id, 'Reunião agendada', 3, '#AF52DE', false, false),
      (v_pipe_id, 'Proposta enviada', 4, '#FF9F0A', false, false),
      (v_pipe_id, 'Ganhou', 5, '#34C759', true, false),
      (v_pipe_id, 'Perdeu', 6, '#FF3B30', false, true);
  end if;

  return v_pipe_id;
end $$;

grant execute on function public.painel_activate_client(uuid) to authenticated;
grant execute on function public.painel_is_svi_team() to authenticated;
grant execute on function public.painel_user_client_ids() to authenticated;
