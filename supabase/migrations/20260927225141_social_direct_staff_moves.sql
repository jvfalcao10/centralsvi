-- Staff stage changes are explicit decisions. Dates and publication details are optional.
-- Public client responses retain their existing validation; grants/RLS remain unchanged.
begin;
CREATE OR REPLACE FUNCTION public.central_social_apply(p_id text, p_expected integer, p_patch jsonb, p_action text, p_actor text, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare c public.central_social_cards; n public.central_social_cards;
begin
 select * into c from public.central_social_cards where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if c.version <> p_expected then raise exception 'version_conflict'; end if;
 n := jsonb_populate_record(c, p_patch - 'id' - 'created_at' - 'version');
 if n.ingest_pending and n.stage in ('aguardando','aprovado','agendado','postado') then raise exception 'import_pending'; end if;
 if p_action='mover' and (p_actor_id is null or nullif(trim(p_actor),'') is null) then raise exception 'staff_required'; end if;
 if n.stage in ('aguardando','aprovado','agendado','postado') and jsonb_array_length(n.selected_assets)=0 then raise exception 'assets_required'; end if;
 if (n.stage='aprovado' or p_action in ('agendar','postar')) and (n.approved_revision is distinct from n.revision or n.approved_by is null or n.approved_at is null or jsonb_array_length(n.selected_assets)=0) then
  raise exception 'approval_required';
 end if;
 if p_action='agendar' and n.scheduled_at is null then raise exception 'schedule_required'; end if;
 if n.stage='postado' and (n.posted_at is null or (p_action='postar' and nullif(n.channel,'') is null)) then raise exception 'publication_required'; end if;
 update public.central_social_cards set
  client=n.client, title=n.title, assets=n.assets, selected_assets=n.selected_assets, caption=n.caption, note=n.note, stage=n.stage,
  revision=n.revision, version=c.version+1, approved_revision=n.approved_revision,
  approved_by=n.approved_by, approved_at=n.approved_at, approval_evidence=n.approval_evidence,
  scheduled_at=n.scheduled_at, posted_at=n.posted_at, posted_url=n.posted_url, channel=n.channel,
  token_hash=n.token_hash, token_expires_at=n.token_expires_at, updated_at=now()
 where id=p_id returning * into n;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details)
 values(p_id,p_action,p_actor,p_actor_id,n.revision,jsonb_build_object('client',n.client,'title',n.title,'from',c.stage,'to',n.stage,'evidence',n.approval_evidence,'note',n.note,'scheduled_at',n.scheduled_at,'posted_at',n.posted_at,'posted_url',n.posted_url,'channel',n.channel,'caption',n.caption,'selected_assets',n.selected_assets,'assets',n.assets,'previous',jsonb_build_object('stage',c.stage,'approved_by',c.approved_by,'approved_at',c.approved_at,'approval_evidence',c.approval_evidence,'scheduled_at',c.scheduled_at,'posted_at',c.posted_at,'posted_url',c.posted_url,'channel',c.channel)));
 if n.stage='postado' or c.stage='postado' then
  update public.postagens_organizador set postado_em=n.posted_at where id=p_id;
 end if;
 return to_jsonb(n);
end; $function$;

revoke all on function public.central_social_apply(text,integer,jsonb,text,text,uuid) from public,anon,authenticated;
grant execute on function public.central_social_apply(text,integer,jsonb,text,text,uuid) to service_role;
commit;
