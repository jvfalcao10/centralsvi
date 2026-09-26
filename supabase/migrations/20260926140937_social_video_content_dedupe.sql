begin;
-- Block decisions while checking an incoming video, but do not invalidate an
-- approved revision until its bytes are known to differ. New cards appear only
-- when a complete original is available. Existing ClickUp intake is unchanged.
create function public.central_social_video_prepare(p_key text,p_card jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare j public.central_social_inbox;
begin
 select * into j from public.central_social_inbox where key=p_key for update;
 if not found or j.status='done' then return; end if;
 if j.provider<>'whatsapp' then raise exception 'invalid_video_source'; end if;
 perform pg_advisory_xact_lock(hashtextextended(j.card_id,0));
 update public.central_social_cards set ingest_pending=true where id=j.card_id and posted_at is null;
 update public.central_social_inbox set payload=payload||'{"noticed":true,"content_check":true}'::jsonb where key=p_key;
end; $$;
revoke all on function public.central_social_video_prepare(text,jsonb) from public,anon,authenticated;
grant execute on function public.central_social_video_prepare(text,jsonb) to service_role;

-- Backfill only verified metadata of the same immutable stored asset. No
-- revision, approval, link, selection or update ordering is changed.
create function public.central_social_asset_fingerprint(p_card_id text,p_asset_id text,p_asset_path text,p_sha256 text,p_bytes bigint,p_period text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; merged jsonb;
begin
 if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes<=0 or p_period is null or p_period !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'invalid_fingerprint'; end if;
 select * into c from public.central_social_cards where id=p_card_id for update;
 if not found or not exists(select 1 from jsonb_array_elements(c.assets) a where a->>'id'=p_asset_id and a->>'path'=p_asset_path and a->>'storage'='drive' and a->>'type' like 'video/%' and (a->>'bytes')::bigint=p_bytes and (not a ? 'sha256' or a->>'sha256'=p_sha256) and (not a ? 'delivery_period' or a->>'delivery_period'=p_period)) then return false; end if;
 select jsonb_agg(case when a->>'id'=p_asset_id and a->>'path'=p_asset_path then a||jsonb_build_object('sha256',p_sha256,'delivery_period',p_period) else a end order by n) into merged from jsonb_array_elements(c.assets) with ordinality v(a,n);
 update public.central_social_cards set assets=merged where id=c.id;
 return true;
end; $$;
revoke all on function public.central_social_asset_fingerprint(text,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.central_social_asset_fingerprint(text,text,text,text,bigint,text) to service_role;

create function public.central_social_video_complete(p_key text,p_card jsonb,p_assets jsonb,p_complete boolean default true)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.central_social_inbox; c public.central_social_cards; target public.central_social_cards; a jsonb; old_asset jsonb; match_id text; client_name text;
begin
 select * into j from public.central_social_inbox where key=p_key for update;
 if not found then raise exception 'job_not_found'; end if;
 if j.provider<>'whatsapp' then raise exception 'invalid_video_source'; end if;
 if j.status='done' then return jsonb_build_object('changed',false,'id',j.card_id,'duplicate',j.payload ? 'duplicate_of'); end if;
 -- Serialize the short final database transaction, not the media transfer. Two
-- simultaneous first deliveries cannot both pass the content lookup.
 perform pg_advisory_xact_lock(hashtextextended('central-social-video-complete',0));
 perform pg_advisory_xact_lock(hashtextextended(j.card_id,0));
 select * into target from public.central_social_cards where id=j.card_id for update;
 client_name:=coalesce(target.client,p_card->>'client');
 if p_complete and jsonb_array_length(p_assets)=1 then
  a:=p_assets->0;
  if a->>'sha256' ~ '^[a-f0-9]{64}$' and a->>'delivery_period' ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' and a->>'storage'='drive' and a->>'type' like 'video/%' and (a->>'bytes')::bigint>0 then
   select card.id,asset into match_id,old_asset
   from public.central_social_cards card cross join lateral jsonb_array_elements(card.assets) asset
   where card.client=client_name and asset->>'sha256'=a->>'sha256'
    and asset->>'delivery_period'=a->>'delivery_period' and (asset->>'bytes')::bigint=(a->>'bytes')::bigint
    and asset->>'type' like 'video/%'
    and (client_name<>'Identificar cliente' or card.author=p_card->>'author')
    -- An explicit different piece is intentional reuse, not a duplicate. Avoid
    -- routing a different existing piece into another card without a decision.
    and (card.id=j.card_id or (target.id is null and coalesce(j.payload->>'delivery_version','')=''))
    and (card.stage<>'arquivado' or card.id=j.card_id)
   order by (card.id=j.card_id) desc,card.created_at,card.id limit 1;
   if match_id is not null then
    select * into c from public.central_social_cards where id=match_id for update;
    -- Metadata may have been edited between lookup and lock. Abort for retry
    -- rather than making a decision with stale client/content information.
    if c.client is distinct from client_name or not exists(select 1 from jsonb_array_elements(c.assets) x where x=old_asset) then raise exception 'content_changed_retry'; end if;
    insert into public.central_social_events(card_id,action,actor,revision,details)
    values(c.id,'reenvio','Sincronização · whatsapp',c.revision,jsonb_build_object('from',c.stage,'to',c.stage,'source_key',j.key,'source_message',j.source_id,'original_asset',old_asset->>'id','received_asset',a,'note','Reenvio do mesmo arquivo reconhecido pelo conteúdo. A peça, a seleção e a aprovação foram preservadas. Arquivo recebido: '||coalesce(a->>'name','vídeo')));
    update public.central_social_inbox set status='done',card_id=c.id,lease_until=null,error=null,updated_at=now(),payload=payload||jsonb_build_object('duplicate_of',jsonb_build_object('card_id',c.id,'asset_id',old_asset->>'id','sha256',a->>'sha256')) where key=p_key;
    update public.central_social_cards set ingest_pending=exists(select 1 from public.central_social_inbox i where i.card_id=c.id and i.status<>'done' and i.payload->>'noticed'='true') where id=c.id and c.posted_at is null;
    return jsonb_build_object('changed',false,'duplicate',true,'id',c.id,'added',0);
   end if;
  end if;
 end if;
 -- A genuinely different file follows the established version/approval rules.
 return public.central_social_complete(p_key,p_card,p_assets,p_complete);
end; $$;
revoke all on function public.central_social_video_complete(text,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.central_social_video_complete(text,jsonb,jsonb,boolean) to service_role;
commit;
