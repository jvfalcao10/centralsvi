begin;
-- A generated preview is metadata, not a content edit: preserve approvals, versions and ordering.
create or replace function public.central_social_asset_preview(p_card_id text,p_asset_id text,p_asset_path text,p_preview jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; merged jsonb; patch jsonb;
begin
 if jsonb_typeof(p_preview)<>'object' or exists(select 1 from jsonb_object_keys(p_preview) k where k not in ('thumbnail','duration_ms','width','height','preview_retry_at')) then raise exception 'invalid_preview'; end if;
 if p_preview ? 'thumbnail' and (p_preview->>'thumbnail' !~ '^previews/[a-f0-9]{64}[.]jpg$' or nullif(p_preview->>'thumbnail','') is null) then raise exception 'invalid_preview_path'; end if;
 select * into c from public.central_social_cards where id=p_card_id for update;
 if not found or not exists(select 1 from jsonb_array_elements(c.assets) a where a->>'id'=p_asset_id and a->>'path'=p_asset_path and a->>'type' like 'video/%') then return false; end if;
 patch:=jsonb_strip_nulls(p_preview);
 select jsonb_agg(case when a->>'id'=p_asset_id and a->>'path'=p_asset_path then (case when patch ? 'thumbnail' then a-'preview_retry_at' else a end)||patch else a end order by n) into merged from jsonb_array_elements(c.assets) with ordinality v(a,n);
 update public.central_social_cards set assets=merged where id=p_card_id;
 return true;
end; $$;
revoke all on function public.central_social_asset_preview(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.central_social_asset_preview(text,text,text,jsonb) to service_role;
commit;
