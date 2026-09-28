begin;
create table public.central_social_publications (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 card_id text not null references public.central_social_cards(id) on delete restrict,
 revision integer not null, actor text not null, actor_id uuid not null,
 account_id text not null, account_username text not null, format text not null check(format in ('image','reel','carousel','story')),
 caption text not null, assets jsonb not null, cover_path text, cover_offset_ms integer,
 scheduled_at timestamptz not null,
 status text not null default 'queued' check(status in ('queued','preparing','processing','publishing','published','failed','uncertain','canceled')),
 progress jsonb not null default '{}', lease_id uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default now(), attempts integer not null default 0,
 error text, media_id text, permalink text, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index central_social_publications_active on public.central_social_publications(card_id) where status in ('queued','preparing','processing','publishing','uncertain');
create unique index central_social_publications_once on public.central_social_publications(card_id,revision) where status='published';
create index central_social_publications_due on public.central_social_publications(next_attempt_at,scheduled_at) where status in ('queued','preparing','processing','publishing','uncertain');
alter table public.central_social_publications enable row level security;
revoke all on public.central_social_publications from public,anon,authenticated;
grant all on public.central_social_publications to service_role;

create function public.central_social_publication_enqueue(p_id text,p_expected integer,p_request uuid,p_data jsonb,p_actor text,p_actor_id uuid)
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
 if c.stage not in ('aprovado','agendado','para_anuncio') then raise exception 'card_not_approved';end if;
 if c.stage='postado' or c.posted_at is not null or exists(select 1 from public.central_social_publications where card_id=p_id and revision=c.revision and status='published') then raise exception 'already_published';end if;
 if exists(select 1 from public.central_social_publications where card_id=p_id and status in ('queued','preparing','processing','publishing','uncertain')) then raise exception 'publication_active';end if;
 if (p_data->>'scheduled_at')::timestamptz < now()-interval '2 minutes' or (p_data->>'scheduled_at')::timestamptz>now()+interval '1 year' then raise exception 'invalid_schedule';end if;
 if p_data->'assets' is distinct from (select jsonb_agg(a.value order by s.ordinality) from jsonb_array_elements_text(c.selected_assets) with ordinality s(id,ordinality) join jsonb_array_elements(c.assets) a on a.value->>'id'=s.id) then raise exception 'assets_changed';end if;
 if p_data->>'format'<>'story' and c.caption is distinct from coalesce(p_data->>'caption','') then
  c.revision=c.revision+1;
  update public.central_social_cards set caption=coalesce(p_data->>'caption',''),revision=c.revision,approved_revision=c.revision,approved_by=p_actor,approved_at=now(),approval_evidence='Legenda conferida pela equipe ao confirmar publicação na Central.',token_hash=null,token_expires_at=null where id=p_id;
 end if;
 update public.central_social_cards set stage='agendado',scheduled_at=(p_data->>'scheduled_at')::timestamptz,channel='Instagram · @'||(p_data->>'account_username'),version=version+1,updated_at=now() where id=p_id;
 insert into public.central_social_publications(request_id,card_id,revision,actor,actor_id,account_id,account_username,format,caption,assets,cover_path,cover_offset_ms,scheduled_at)
 values(p_request,p_id,c.revision,p_actor,p_actor_id,p_data->>'account_id',p_data->>'account_username',p_data->>'format',coalesce(p_data->>'caption',''),p_data->'assets',p_data->>'cover_path',(p_data->>'cover_offset_ms')::integer,(p_data->>'scheduled_at')::timestamptz) returning * into j;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details) values(p_id,'programar_publicacao',p_actor,p_actor_id,c.revision,jsonb_build_object('job_id',j.id,'account',j.account_username,'format',j.format,'scheduled_at',j.scheduled_at));
 return to_jsonb(j);
end;$$;

create function public.central_social_publication_card_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.revision is distinct from old.revision or new.stage is distinct from old.stage or new.ingest_pending is distinct from old.ingest_pending then
  if exists(select 1 from public.central_social_publications where card_id=old.id and status in ('publishing','uncertain')) then raise exception 'publication_in_progress';end if;
  update public.central_social_publications set status='canceled',error='Cancelada porque a peça ou a etapa foi alterada.',lease_id=null,lease_until=null,updated_at=now() where card_id=old.id and status in ('queued','preparing','processing');
 end if;
 return new;
end;$$;
create trigger central_social_publication_card_guard before update on public.central_social_cards for each row execute function public.central_social_publication_card_guard();

create function public.central_social_publication_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.central_social_publications;
begin
 select * into j from public.central_social_publications where status in ('queued','preparing','processing','publishing','uncertain') and scheduled_at<=now()+case when status in ('queued','preparing','processing') then interval '30 minutes' else interval '0 minutes' end and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by scheduled_at,created_at for update skip locked limit 1;
 if not found then return null;end if;
 update public.central_social_publications set lease_id=gen_random_uuid(),lease_until=now()+interval '10 minutes',status=case when status='queued' then 'preparing' else status end,attempts=attempts+1,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end;$$;

create function public.central_social_publication_begin(p_job uuid,p_lease uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.central_social_publications; c public.central_social_cards;
begin
 -- Lock order matches staff updates: card, then job.
 select * into c from public.central_social_cards where id=(select card_id from public.central_social_publications where id=p_job) for update;
 select * into j from public.central_social_publications where id=p_job for update;
 if j.lease_id is distinct from p_lease or j.status<>'processing' or j.scheduled_at>now() or c.revision<>j.revision or c.stage<>'agendado' or c.ingest_pending then return false;end if;
 update public.central_social_publications set status='publishing',updated_at=now() where id=p_job;
 return true;
end;$$;

create function public.central_social_publication_finish(p_job uuid,p_lease uuid,p_media text,p_permalink text) returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.central_social_publications; c public.central_social_cards;
begin
 select * into c from public.central_social_cards where id=(select card_id from public.central_social_publications where id=p_job) for update;
 select * into j from public.central_social_publications where id=p_job for update;
 if j.status='published' then return true;end if;
 if j.lease_id is distinct from p_lease or j.status not in ('publishing','uncertain') then return false;end if;
 update public.central_social_publications set status='published',published_at=now(),media_id=p_media,permalink=p_permalink,error=null,lease_id=null,lease_until=null,updated_at=now() where id=p_job;
 update public.central_social_cards set stage='postado',posted_at=now(),posted_url=p_permalink,scheduled_at=null,version=version+1,updated_at=now() where id=c.id;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details) values(c.id,'publicacao_concluida',j.actor,j.actor_id,j.revision,jsonb_build_object('job_id',j.id,'account',j.account_username,'format',j.format,'permalink',p_permalink,'media_id',p_media));
 return true;
end;$$;

create function public.central_social_publication_cancel(p_job uuid,p_actor text,p_actor_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.central_social_publications; c public.central_social_cards;
begin
 if p_actor_id is null then raise exception 'staff_required';end if;
 select * into c from public.central_social_cards where id=(select card_id from public.central_social_publications where id=p_job) for update;
 select * into j from public.central_social_publications where id=p_job for update;
 if not found then raise exception 'publication_missing';end if;
 if j.status not in ('queued','preparing','processing','failed','canceled') then raise exception 'publication_in_progress';end if;
 update public.central_social_publications set status='canceled',lease_id=null,lease_until=null,updated_at=now() where id=p_job returning * into j;
 if c.stage='agendado' then update public.central_social_cards set stage='aprovado',scheduled_at=null,version=version+1,updated_at=now() where id=c.id;end if;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details) values(c.id,'cancelar_publicacao',p_actor,p_actor_id,c.revision,jsonb_build_object('job_id',j.id));
 return to_jsonb(j);
end;$$;
revoke all on function public.central_social_publication_enqueue(text,integer,uuid,jsonb,text,uuid),public.central_social_publication_card_guard(),public.central_social_publication_claim(),public.central_social_publication_begin(uuid,uuid),public.central_social_publication_finish(uuid,uuid,text,text),public.central_social_publication_cancel(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.central_social_publication_enqueue(text,integer,uuid,jsonb,text,uuid),public.central_social_publication_card_guard(),public.central_social_publication_claim(),public.central_social_publication_begin(uuid,uuid),public.central_social_publication_finish(uuid,uuid,text,text),public.central_social_publication_cancel(uuid,text,uuid) to service_role;
create table public.central_social_caption_usage(actor_id uuid not null, hour timestamptz not null, uses integer not null, primary key(actor_id,hour));
alter table public.central_social_caption_usage enable row level security;
revoke all on public.central_social_caption_usage from public,anon,authenticated;
grant all on public.central_social_caption_usage to service_role;
create function public.central_social_caption_allow(p_actor uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_actor is null then return false;end if;
 delete from public.central_social_caption_usage where hour<now()-interval '2 days';
 insert into public.central_social_caption_usage(actor_id,hour,uses) values(p_actor,date_trunc('hour',now()),1)
 on conflict(actor_id,hour) do update set uses=central_social_caption_usage.uses+1 where central_social_caption_usage.uses<30 returning uses into n;
 return n is not null;
end;$$;
revoke all on function public.central_social_caption_allow(uuid) from public,anon,authenticated;
grant execute on function public.central_social_caption_allow(uuid) to service_role;
commit;
