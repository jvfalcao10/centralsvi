-- Cópia leve do vídeo para aprovação.
--
-- O vídeo que o editor entrega vem do celular com bitrate de câmera: o da GM
-- Gás tinha 49,8s e 126,5 MB, ou seja 20,3 Mbps. A Central entrega cerca de
-- 6,6 Mbps para o cliente, então o player nunca alcançava o vídeo e ficava
-- rodando. Comprimido em 1080x1920 com crf 28 o mesmo arquivo fica em 7,4 MB
-- e 1,24 Mbps, que cabe folgado na banda do cliente.
--
-- O original NÃO é tocado: ele continua sendo o que vai para o Instagram.

-- Pega UM vídeo sem cópia leve e já marca a espera, para que duas execuções do
-- cron não comprimam o mesmo arquivo. skip locked porque a fila é disputada.
create or replace function public.central_social_approval_claim()
returns table(card_id text, asset_id text, asset_path text, drive_id text, bytes bigint)
language plpgsql
set search_path to ''
as $$
declare c record; a jsonb;
begin
 for c in
  select id, assets from public.central_social_cards
  where exists(
   select 1 from jsonb_array_elements(assets) x
   where x->>'storage'='drive' and x->>'type' like 'video/%'
     and nullif(x->>'approval_path','') is null
     and coalesce((x->>'approval_retry_at')::timestamptz, 'epoch') <= now()
     and (x->>'bytes')::bigint between 1 and 314572800)
  order by updated_at desc
  limit 20
  for update skip locked
 loop
  select x into a from jsonb_array_elements(c.assets) x
  where x->>'storage'='drive' and x->>'type' like 'video/%'
    and nullif(x->>'approval_path','') is null
    and coalesce((x->>'approval_retry_at')::timestamptz, 'epoch') <= now()
    and (x->>'bytes')::bigint between 1 and 314572800
  limit 1;
  if a is null then continue; end if;

  update public.central_social_cards set assets=(
   select jsonb_agg(case when x->>'id'=a->>'id' and x->>'path'=a->>'path'
    then x || jsonb_build_object('approval_retry_at', to_char(now()+interval '10 minutes','YYYY-MM-DD"T"HH24:MI:SSOF'))
    else x end order by n)
   from jsonb_array_elements(c.assets) with ordinality v(x,n))
  where id=c.id;

  card_id:=c.id; asset_id:=a->>'id'; asset_path:=a->>'path';
  drive_id:=a->>'drive_id'; bytes:=(a->>'bytes')::bigint;
  return next;
  return;
 end loop;
 return;
end; $$;

-- Grava o resultado. Só duas chaves entram, e o caminho tem formato fixo.
create or replace function public.central_social_asset_approval(
 p_card_id text, p_asset_id text, p_asset_path text, p_patch jsonb)
returns boolean
language plpgsql
set search_path to ''
as $$
declare c public.central_social_cards; merged jsonb;
begin
 if jsonb_typeof(p_patch)<>'object' or exists(
  select 1 from jsonb_object_keys(p_patch) k where k not in ('approval_path','approval_retry_at'))
 then raise exception 'invalid_approval_patch'; end if;
 if p_patch ? 'approval_path' and (p_patch->>'approval_path' !~ '^approval/[a-f0-9]{64}[.]mp4$'
  or nullif(p_patch->>'approval_path','') is null)
 then raise exception 'invalid_approval_path'; end if;

 select * into c from public.central_social_cards where id=p_card_id for update;
 if not found or not exists(
  select 1 from jsonb_array_elements(c.assets) a
  where a->>'id'=p_asset_id and a->>'path'=p_asset_path and a->>'type' like 'video/%')
 then return false; end if;

 select jsonb_agg(case when a->>'id'=p_asset_id and a->>'path'=p_asset_path
  then (case when p_patch ? 'approval_path' then a-'approval_retry_at' else a end) || jsonb_strip_nulls(p_patch)
  else a end order by n) into merged
 from jsonb_array_elements(c.assets) with ordinality v(a,n);
 update public.central_social_cards set assets=merged where id=p_card_id;
 return true;
end; $$;

-- Função nova nasce aberta: fechar e nomear quem pode.
revoke all on function public.central_social_approval_claim() from public, anon, authenticated;
revoke all on function public.central_social_asset_approval(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.central_social_approval_claim() to service_role;
grant execute on function public.central_social_asset_approval(text,text,text,jsonb) to service_role;
