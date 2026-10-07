begin;

-- Publicar o mesmo vídeo no Reels E no Story.
--
-- As duas travas da fila olhavam só a peça, não o formato, então depois de
-- enfileirar o reel a peça inteira ficava bloqueada e o story não entrava.
-- Reels e story são publicações diferentes do mesmo arquivo, e é assim que a
-- equipe usa: o reel fica no perfil e o story leva até ele no mesmo dia.
--
-- O que elas protegem continua de pé, agora por formato: não existe o mesmo
-- formato duas vezes na fila, nem republicar um formato já publicado naquela
-- revisão. Publicação é irreversível e post duplicado é o erro que custa caro.
--
-- A peça que já foi postada aceita o story depois, e não volta para "agendado"
-- por causa disso: a etapa continua Postado.

create or replace function public.central_social_publication_enqueue(p_id text,p_expected integer,p_request uuid,p_data jsonb,p_actor text,p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; j public.central_social_publications;
begin
 if p_actor_id is null or nullif(trim(p_actor),'') is null then raise exception 'staff_required';end if;
 select * into j from public.central_social_publications where request_id=p_request;
 if found then
  if j.card_id<>p_id or j.actor_id<>p_actor_id then raise exception 'request_conflict';end if;
  return to_jsonb(j);
 end if;
 select * into c from public.central_social_cards where id=p_id for update;
 if not found then raise exception 'card_missing';end if;
 select * into j from public.central_social_publications where request_id=p_request;
 if found then
  if j.card_id<>p_id or j.actor_id<>p_actor_id then raise exception 'request_conflict';end if;
  return to_jsonb(j);
 end if;
 if c.version<>p_expected then raise exception 'version_conflict';end if;
 if c.ingest_pending or c.client='Identificar cliente' or jsonb_array_length(c.selected_assets)=0 then raise exception 'card_not_ready';end if;
 if c.stage not in ('aprovado','agendado','para_anuncio','postado') then raise exception 'card_not_approved';end if;
 if exists(select 1 from public.central_social_publications where card_id=p_id and revision=c.revision and status='published' and format=p_data->>'format') then raise exception 'already_published';end if;
 if (c.stage='postado' or c.posted_at is not null) and not exists(select 1 from public.central_social_publications where card_id=p_id and revision=c.revision and status='published') then raise exception 'already_published';end if;
 if exists(select 1 from public.central_social_publications where card_id=p_id and format=p_data->>'format' and status in ('queued','preparing','processing','publishing','uncertain')) then raise exception 'publication_active';end if;
 if (p_data->>'scheduled_at')::timestamptz < now()-interval '2 minutes' or (p_data->>'scheduled_at')::timestamptz>now()+interval '1 year' then raise exception 'invalid_schedule';end if;
 if p_data->'assets' is distinct from (select jsonb_agg(a.value order by s.ordinality) from jsonb_array_elements_text(c.selected_assets) with ordinality s(id,ordinality) join jsonb_array_elements(c.assets) a on a.value->>'id'=s.id) then raise exception 'assets_changed';end if;
 if p_data->>'format'<>'story' and c.caption is distinct from coalesce(p_data->>'caption','') then
  c.revision=c.revision+1;
  update public.central_social_cards set caption=coalesce(p_data->>'caption',''),revision=c.revision,approved_revision=c.revision,approved_by=p_actor,approved_at=now(),approval_evidence='Legenda conferida pela equipe ao confirmar publicação na Central.',token_hash=null,token_expires_at=null where id=p_id;
 end if;
 update public.central_social_cards set stage=case when c.stage='postado' then 'postado' else 'agendado' end,scheduled_at=(p_data->>'scheduled_at')::timestamptz,channel='Instagram · @'||(p_data->>'account_username'),version=version+1,updated_at=now() where id=p_id;
 insert into public.central_social_publications(request_id,card_id,revision,actor,actor_id,account_id,account_username,format,caption,assets,cover_path,cover_offset_ms,scheduled_at)
 values(p_request,p_id,c.revision,p_actor,p_actor_id,p_data->>'account_id',p_data->>'account_username',p_data->>'format',coalesce(p_data->>'caption',''),p_data->'assets',p_data->>'cover_path',(p_data->>'cover_offset_ms')::integer,(p_data->>'scheduled_at')::timestamptz) returning * into j;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details) values(p_id,'programar_publicacao',p_actor,p_actor_id,c.revision,jsonb_build_object('job_id',j.id,'account',j.account_username,'format',j.format,'scheduled_at',j.scheduled_at));
 return to_jsonb(j);
end;$$;


commit;
