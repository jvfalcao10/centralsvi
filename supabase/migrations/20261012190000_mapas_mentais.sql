-- Mapas mentais editáveis (12/10/2026).
--
-- Mapa de reunião, de estudo e a carteira da casa desenhados em árvore,
-- no estilo MindMeister, dentro da Central. O markdown é a fonte da verdade:
-- primeira linha "# Título" e o resto em lista aninhada com 2 espaços.
-- O mapa é desenhado no navegador a partir desse texto.
--
-- Toda a equipe interna lê e escreve (admin, manager, seller, executor,
-- traffic, social). Papel de cliente não enxerga a tabela.

create table if not exists public.mapas_mentais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  -- Valores livres: geral, reunioes, estudos, carteira.
  pasta text not null default 'geral',
  markdown text not null default '',
  criado_por uuid references auth.users (id) on delete set null,
  atualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mapas_mentais_pasta_updated_idx
  on public.mapas_mentais (pasta, updated_at desc);

-- updated_at sobe sozinho a cada update. A tela compara esse valor antes de
-- salvar para avisar quando outra pessoa salvou depois.
drop trigger if exists mapas_mentais_updated_at on public.mapas_mentais;
create trigger mapas_mentais_updated_at
  before update on public.mapas_mentais
  for each row execute function public.update_updated_at_column();

-- Tabela nova nasce aberta: fechar e nomear quem pode.
alter table public.mapas_mentais enable row level security;
revoke all on table public.mapas_mentais from public, anon, authenticated;
grant select, insert, update, delete on table public.mapas_mentais to authenticated;
grant all on table public.mapas_mentais to service_role;

-- Só usuário autenticado com papel interno. A leitura de user_roles aqui
-- cobre o próprio usuário pela policy "Users can view their own roles".
drop policy if exists "mapas_mentais_select_equipe" on public.mapas_mentais;
create policy "mapas_mentais_select_equipe" on public.mapas_mentais
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text in ('admin','manager','seller','executor','traffic','social')
    )
  );

drop policy if exists "mapas_mentais_insert_equipe" on public.mapas_mentais;
create policy "mapas_mentais_insert_equipe" on public.mapas_mentais
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text in ('admin','manager','seller','executor','traffic','social')
    )
  );

drop policy if exists "mapas_mentais_update_equipe" on public.mapas_mentais;
create policy "mapas_mentais_update_equipe" on public.mapas_mentais
  for update to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text in ('admin','manager','seller','executor','traffic','social')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text in ('admin','manager','seller','executor','traffic','social')
    )
  );

drop policy if exists "mapas_mentais_delete_equipe" on public.mapas_mentais;
create policy "mapas_mentais_delete_equipe" on public.mapas_mentais
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text in ('admin','manager','seller','executor','traffic','social')
    )
  );

comment on table public.mapas_mentais is
  'Mapas mentais da equipe (área Mapas da Central). Markdown é a fonte da verdade; o mapa é desenhado no navegador.';
