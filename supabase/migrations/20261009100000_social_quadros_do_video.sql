-- Quadros do vídeo para a legenda.
--
-- Entender o vídeo era trabalho do Gemini, que lia o arquivo inteiro. No plano
-- grátis ele devolve 429 e 503, e três peças desistiram depois de queimar as
-- três tentativas: Dr. Felipe, Christo Rei e Dr. Daniel.
--
-- Agora que a cópia leve existe, dá para tirar alguns quadros dela e deixar a
-- leitura com um modelo que não vive em fila de cota. O número de quadros fica
-- guardado no próprio arquivo, para quem for escrever a legenda saber que eles
-- existem sem precisar varrer o armazenamento.

create or replace function public.central_social_asset_approval(
 p_card_id text, p_asset_id text, p_asset_path text, p_patch jsonb)
returns boolean
language plpgsql
set search_path to ''
as $$
declare c public.central_social_cards; merged jsonb;
begin
 if jsonb_typeof(p_patch)<>'object' or exists(
  select 1 from jsonb_object_keys(p_patch) k where k not in ('approval_path','approval_retry_at','frames'))
 then raise exception 'invalid_approval_patch'; end if;
 if p_patch ? 'approval_path' and (p_patch->>'approval_path' !~ '^approval/[a-f0-9]{64}[.]mp4$'
  or nullif(p_patch->>'approval_path','') is null)
 then raise exception 'invalid_approval_path'; end if;
 if p_patch ? 'frames' and ((p_patch->>'frames')::int is null or (p_patch->>'frames')::int not between 0 and 24)
 then raise exception 'invalid_frames'; end if;

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

-- O claim passa a pegar também o vídeo que já tem cópia leve mas ainda não tem
-- quadros. Nesse caso quem trabalha baixa a cópia de 7 MB, não o original.
-- O retorno ganhou uma coluna, e o Postgres não troca tipo de retorno em
-- replace: derruba e recria.
drop function if exists public.central_social_approval_claim();
create function public.central_social_approval_claim()
returns table(card_id text, asset_id text, asset_path text, drive_id text, bytes bigint, approval_path text)
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
     and (nullif(x->>'approval_path','') is null or nullif(x->>'frames','') is null)
     and coalesce((x->>'approval_retry_at')::timestamptz, 'epoch') <= now()
     and (x->>'bytes')::bigint between 1 and 314572800)
  order by updated_at desc
  limit 20
  for update skip locked
 loop
  select x into a from jsonb_array_elements(c.assets) x
  where x->>'storage'='drive' and x->>'type' like 'video/%'
    and (nullif(x->>'approval_path','') is null or nullif(x->>'frames','') is null)
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
  drive_id:=a->>'drive_id'; bytes:=(a->>'bytes')::bigint; approval_path:=a->>'approval_path';
  return next;
  return;
 end loop;
 return;
end; $$;

revoke all on function public.central_social_approval_claim() from public, anon, authenticated;
revoke all on function public.central_social_asset_approval(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.central_social_approval_claim() to service_role;
grant execute on function public.central_social_asset_approval(text,text,text,jsonb) to service_role;
