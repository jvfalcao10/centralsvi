-- svi.ai · IA SDR autônoma
-- Configuração por cliente: persona, instruções, gatilhos de handoff humano.

create table if not exists public.painel_ai_sdr_configs (
  client_id uuid primary key references public.clients(id) on delete cascade,
  enabled boolean not null default false,
  persona text not null default '',
  instructions text not null default '',
  handoff_triggers jsonb not null default '["preço","valor","quanto custa","cancelar","reclamar","falar com humano","atendente"]'::jsonb,
  model text not null default 'claude-haiku-4-5-20251001',
  updated_at timestamptz not null default now()
);

alter table public.painel_ai_sdr_configs enable row level security;

-- Membros do painel podem ver/editar config
drop policy if exists painel_ai_sdr_configs_member_read on public.painel_ai_sdr_configs;
create policy painel_ai_sdr_configs_member_read on public.painel_ai_sdr_configs
  for select using (
    public.painel_is_svi_team()
    or client_id = any(public.painel_user_client_ids())
  );

drop policy if exists painel_ai_sdr_configs_member_write on public.painel_ai_sdr_configs;
create policy painel_ai_sdr_configs_member_write on public.painel_ai_sdr_configs
  for all using (
    public.painel_is_svi_team()
    or client_id = any(public.painel_user_client_ids())
  )
  with check (
    public.painel_is_svi_team()
    or client_id = any(public.painel_user_client_ids())
  );

-- Trigger updated_at
create or replace function public.painel_ai_sdr_configs_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists painel_ai_sdr_configs_touch_trigger on public.painel_ai_sdr_configs;
create trigger painel_ai_sdr_configs_touch_trigger
  before update on public.painel_ai_sdr_configs
  for each row execute function public.painel_ai_sdr_configs_touch();
