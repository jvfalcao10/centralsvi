-- Radar de tendências por cliente (14/10/2026).
-- Antes a coleta rodava pra todo cliente com segmento, inclusive quem já saiu.
-- João: "pra todos os clientes não compensa". Liga só onde notícia vira post.
alter table public.clients
  add column if not exists radar_ativo boolean not null default false,
  add column if not exists radar_nota text;

comment on column public.clients.radar_ativo is
  'Liga a coleta diária do Radar de tendências pra este cliente. Desligado por padrão.';
comment on column public.clients.radar_nota is
  'Foco e formato que o radar deve respeitar pra este cliente (ex.: só estático e carrossel).';
