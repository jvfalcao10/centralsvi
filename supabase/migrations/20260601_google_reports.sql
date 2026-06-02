-- Relatórios Google (GBP) · prints viram link visual pro cliente
-- Equipe sobe os prints do painel GMN, Claude Vision lê os números e gera o relatório.
-- O cliente abre um link público (/r/:slug) e vê os resultados. Sem PDF.

create table if not exists public.google_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_name text not null default '',
  slug text not null unique,
  period_label text not null default '',
  -- métricas de visão geral: [{ key, label, current, previous, delta_pct, unit }]
  metrics jsonb not null default '[]'::jsonb,
  -- análise: { resumo_cliente, destaque, observacoes, modules[], diagnostico:{pontos[],acoes[]} }
  analysis jsonb not null default '{}'::jsonb,
  review_messages text not null default '',
  status text not null default 'draft', -- draft | published
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists google_reports_client_idx on public.google_reports (client_id, created_at desc);

alter table public.google_reports enable row level security;

-- Equipe SVI vê/edita tudo; cliente vê só os relatórios do próprio client_id.
-- (Acesso público sem login NÃO passa por aqui — vem por uma function serverless
--  que usa service role e só devolve relatórios com status = 'published'.)
-- painel_user_client_ids() retorna SETOF, então usamos "in (select ...)" e não "= any()".
drop policy if exists google_reports_member_read on public.google_reports;
create policy google_reports_member_read on public.google_reports
  for select using (
    public.painel_is_svi_team()
    or client_id in (select public.painel_user_client_ids())
  );

drop policy if exists google_reports_member_write on public.google_reports;
create policy google_reports_member_write on public.google_reports
  for all using (
    public.painel_is_svi_team()
    or client_id in (select public.painel_user_client_ids())
  )
  with check (
    public.painel_is_svi_team()
    or client_id in (select public.painel_user_client_ids())
  );

create or replace function public.google_reports_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists google_reports_touch_trigger on public.google_reports;
create trigger google_reports_touch_trigger
  before update on public.google_reports
  for each row execute function public.google_reports_touch();
