begin;

-- 22/10/2026. O Radar de Reels estava com UM perfil e NENHUM post salvo desde
-- 13/09, e não era só por estar fora do menu: a equipe não conseguia cadastrar
-- perfil nenhum. `radar_add_profile` descobria o cliente por
-- `current_client_id()`, que só devolve linha para usuário com papel `client`.
-- Para o Arthur, que é executor, a função sempre levantava "sem cliente
-- associado", e a tela mostrava "confira se o perfil está escrito certo".
--
-- Agora o cliente vai por parâmetro quando quem chama é da casa. Cliente
-- logado continua sem poder escolher: ele só mexe no próprio radar.
create or replace function public.radar_add_profile(p_handle text, p_reason text default null, p_client_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_handle text;
  v_client uuid;
  v_profile uuid;
  v_total int;
begin
  -- Aceita @perfil, perfil ou o endereço do perfil.
  v_handle := lower(trim(both from coalesce(p_handle, '')));
  v_handle := regexp_replace(v_handle, '^https?://(www\.)?instagram\.com/', '');
  v_handle := regexp_replace(v_handle, '/.*$', '');
  v_handle := ltrim(v_handle, '@');
  if v_handle !~ '^[a-z0-9._]{1,30}$' or v_handle in ('p','reel','reels','explore','stories','tv') then
    raise exception 'perfil invalido';
  end if;

  v_client := public.current_client_id();
  if v_client is null and p_client_id is not null and public.has_min_role('executor') then
    v_client := p_client_id;
  end if;
  if v_client is null then
    raise exception 'sem cliente associado';
  end if;

  -- Teto por cliente: cada perfil vigiado custa coleta todo dia.
  select count(*) into v_total from public.radar_watchlist where client_id = v_client;
  if v_total >= 8 then
    raise exception 'limite de 8 perfis por cliente';
  end if;

  insert into public.radar_profiles (platform, handle)
  values ('instagram', v_handle)
  on conflict (platform, handle) do nothing;

  select id into v_profile from public.radar_profiles
  where platform = 'instagram' and handle = v_handle;

  insert into public.radar_watchlist (client_id, profile_id, reason, added_by)
  values (v_client, v_profile, nullif(trim(both from coalesce(p_reason, '')), ''), auth.uid())
  on conflict (client_id, profile_id) do nothing;

  return v_profile;
end;
$$;

create or replace function public.radar_remove_profile(p_profile_id uuid, p_client_id uuid default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
begin
  v_client := public.current_client_id();
  if v_client is null and p_client_id is not null and public.has_min_role('executor') then
    v_client := p_client_id;
  end if;
  if v_client is null then
    raise exception 'sem cliente associado';
  end if;
  -- Sai só da lista deste cliente: o perfil continua servindo quem mais o vigia.
  delete from public.radar_watchlist where client_id = v_client and profile_id = p_profile_id;
  return true;
end;
$$;

-- Função nova nasce aberta: revogar do public não basta, tem que nomear os
-- papéis que podem executar.
revoke all on function public.radar_add_profile(text, text, uuid) from public;
revoke all on function public.radar_remove_profile(uuid, uuid) from public;
revoke all on function public.radar_add_profile(text, text, uuid) from anon;
revoke all on function public.radar_remove_profile(uuid, uuid) from anon;
grant execute on function public.radar_add_profile(text, text, uuid) to authenticated;
grant execute on function public.radar_remove_profile(uuid, uuid) to authenticated;

-- As antigas, de dois e um argumento, somem para não ficar duas portas para a
-- mesma coisa, uma delas quebrada para a equipe.
drop function if exists public.radar_add_profile(text, text);
drop function if exists public.radar_remove_profile(uuid);

-- Etiqueta no que foi salvo. João, 22/10/2026: "organizar por tags", com o
-- quadro por cliente parecido com a pipeline de postagens.
alter table public.radar_saves add column if not exists tags text[] not null default '{}';
create index if not exists idx_radar_saves_tags on public.radar_saves using gin (tags);

commit;
