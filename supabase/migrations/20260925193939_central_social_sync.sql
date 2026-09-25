begin;
alter table public.central_social_cards add column ingest_pending boolean not null default false;
create table public.central_social_sync_sources (
 id text primary key, label text not null, enabled boolean not null default true,
 cursor_ms bigint not null, lease_until timestamptz, last_checked_at timestamptz,
 last_success_at timestamptz, error text, updated_at timestamptz not null default now()
);
create table public.central_social_inbox (
 key text primary key, provider text not null check(provider in ('clickup','whatsapp')),
 source_id text not null, card_id text not null, payload jsonb not null default '{}',
 status text not null default 'pending' check(status in ('pending','processing','done','error','manual')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 lease_until timestamptz, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index central_social_inbox_pending on public.central_social_inbox(status,next_attempt_at);
alter table public.central_social_sync_sources enable row level security;
alter table public.central_social_inbox enable row level security;
revoke all on public.central_social_sync_sources,public.central_social_inbox from public,anon,authenticated;
grant all on public.central_social_sync_sources,public.central_social_inbox to service_role;

create function public.central_social_claim(p_source text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.central_social_sync_sources; j public.central_social_inbox;
begin
 if p_source is not null then
  select * into s from public.central_social_sync_sources where id=p_source and enabled and (lease_until is null or lease_until<now()) for update skip locked;
  if not found then return null; end if;
  update public.central_social_sync_sources set lease_until=now()+interval '5 minutes',last_checked_at=now() where id=s.id;
  return to_jsonb(s);
 end if;
 select * into j from public.central_social_inbox where ((status in ('pending','error') and next_attempt_at<=now()) or (status='processing' and lease_until<now())) and attempts<8 order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.central_social_inbox set status='processing',attempts=attempts+1,lease_until=now()+interval '5 minutes',updated_at=now() where key=j.key returning * into j;
 return to_jsonb(j);
end; $$;
revoke all on function public.central_social_claim(text) from public,anon,authenticated;
grant execute on function public.central_social_claim(text) to service_role;

create function public.central_social_notice(p_key text,p_card jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare j public.central_social_inbox; c public.central_social_cards;
begin
 select * into j from public.central_social_inbox where key=p_key for update;
 if not found or j.payload->>'noticed'='true' then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(j.card_id,0));
 select * into c from public.central_social_cards where id=j.card_id for update;
 if found and c.posted_at is not null then return; end if;
 if not found then
  insert into public.central_social_cards(id,client,title,author,source_url,source_status,source_description,source_updated)
  values(j.card_id,p_card->>'client',p_card->>'title',p_card->>'author',p_card->>'source_url',coalesce(p_card->>'source_status',''),coalesce(p_card->>'source_description',''),(p_card->>'source_updated')::timestamptz) returning * into c;
 end if;
 insert into public.central_social_events(card_id,action,actor,revision,details)
 values(c.id,'receber','Sincronização · '||j.provider,c.revision,jsonb_build_object('from',c.stage,'to',case when c.stage in ('ajustes','arquivado') then c.stage else 'conferir' end,'note','Uma entrega nova está sendo importada. A aprovação anterior foi invalidada.','source_key',j.key,'previous',jsonb_build_object('assets',c.assets,'selected_assets',c.selected_assets,'caption',c.caption,'approved_by',c.approved_by,'approved_at',c.approved_at,'revision',c.revision)));
 update public.central_social_cards set ingest_pending=true,stage=case when stage in ('ajustes','arquivado') then stage else 'conferir' end,
 approved_revision=null,approved_by=null,approved_at=null,approval_evidence=null,token_hash=null,token_expires_at=null,scheduled_at=null,version=version+1,updated_at=now() where id=c.id;
 update public.central_social_inbox set payload=payload||'{"noticed":true}'::jsonb where key=p_key;
end; $$;
revoke all on function public.central_social_notice(text,jsonb) from public,anon,authenticated;
grant execute on function public.central_social_notice(text,jsonb) to service_role;

-- Appends immutable assets and invalidates approval in the same transaction as queue completion.
create function public.central_social_ingest(p_key text,p_card jsonb,p_assets jsonb,p_complete boolean default true)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.central_social_inbox; c public.central_social_cards; previous public.central_social_cards;
 added jsonb; target text; before_stage text; was_new boolean:=false;
begin
 select * into j from public.central_social_inbox where key=p_key for update;
 if not found then raise exception 'job_not_found'; end if;
 if j.status='done' then return jsonb_build_object('changed',false,'id',j.card_id); end if;
 target:=j.card_id;
 perform pg_advisory_xact_lock(hashtextextended(target,0));
 select * into c from public.central_social_cards where id=target for update;
 -- Never mutate a published piece. A subsequent delivery gets a separate card.
 if found and c.posted_at is not null then
  select coalesce(jsonb_agg(a),'[]'::jsonb) into p_assets from jsonb_array_elements(p_assets) a
  where not exists(select 1 from jsonb_array_elements(c.assets) old where old->>'id'=a->>'id' or old->>'path'=a->>'path');
  target:=target||':new:'||substr(md5(p_key),1,12);
  select * into c from public.central_social_cards where id=target for update;
 end if;
 if not found then
  if jsonb_array_length(p_assets)=0 then
   update public.central_social_inbox set status=case when p_complete then 'done' else 'pending' end,lease_until=null,updated_at=now(),error=null where key=p_key;
   return jsonb_build_object('changed',false);
  end if;
  insert into public.central_social_cards(id,client,title,author,source_url,source_status,source_description,source_updated)
  values(target,p_card->>'client',p_card->>'title',p_card->>'author',p_card->>'source_url',coalesce(p_card->>'source_status',''),coalesce(p_card->>'source_description',''),(p_card->>'source_updated')::timestamptz)
  returning * into c;
  was_new:=true;
 end if;
 previous:=c; before_stage:=c.stage;
 select coalesce(jsonb_agg(a),'[]'::jsonb) into added from jsonb_array_elements(p_assets) a
 where not exists(select 1 from jsonb_array_elements(c.assets) old where old->>'id'=a->>'id' or old->>'path'=a->>'path');
 if jsonb_array_length(added)>0 then
  update public.central_social_cards set assets=c.assets||added,
   selected_assets=case when jsonb_array_length(c.assets)=0 then (select jsonb_agg(a->>'id') from jsonb_array_elements(added) a) else '[]'::jsonb end,
   stage=case when c.stage in ('ajustes','arquivado') then c.stage else 'conferir' end,
   revision=case when was_new then 1 else c.revision+1 end,version=c.version+1,
   approved_revision=null,approved_by=null,approved_at=null,approval_evidence=null,
   token_hash=null,token_expires_at=null,scheduled_at=null,
   source_updated=greatest(c.source_updated,(p_card->>'source_updated')::timestamptz),updated_at=now()
  where id=target returning * into c;
  insert into public.central_social_events(card_id,action,actor,revision,details)
  values(target,'importar','Sincronização · '||j.provider,c.revision,jsonb_build_object('from',before_stage,'to',c.stage,'source_key',p_key,'added',added,'previous',jsonb_build_object('assets',previous.assets,'selected_assets',previous.selected_assets,'caption',previous.caption,'approved_by',previous.approved_by,'approved_at',previous.approved_at,'revision',previous.revision),'note','Nova entrega recebida. Confira os arquivos finais antes de aprovar.'));
 end if;
 update public.central_social_inbox set status=case when p_complete then 'done' else 'pending' end,attempts=case when p_complete then attempts else 0 end,card_id=target,lease_until=null,error=null,updated_at=now() where key=p_key;
 update public.central_social_cards set ingest_pending=exists(select 1 from public.central_social_inbox i where i.card_id=target and i.status<>'done' and i.payload->>'noticed'='true') where id=target;
 return jsonb_build_object('changed',jsonb_array_length(added)>0,'id',target,'added',jsonb_array_length(added));
end; $$;
revoke all on function public.central_social_ingest(text,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.central_social_ingest(text,jsonb,jsonb,boolean) to service_role;
create or replace function public.central_social_apply(p_id text, p_expected integer, p_patch jsonb, p_action text, p_actor text, p_actor_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.central_social_cards; n public.central_social_cards;
begin
 select * into c from public.central_social_cards where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if c.version <> p_expected then raise exception 'version_conflict'; end if;
 n := jsonb_populate_record(c, p_patch - 'id' - 'created_at' - 'version');
 if n.ingest_pending and n.stage in ('aguardando','aprovado','agendado','postado') then raise exception 'import_pending'; end if;
 if n.stage in ('aprovado','agendado','postado') and (n.approved_revision is distinct from n.revision or n.approved_by is null or n.approved_at is null or jsonb_array_length(n.selected_assets)=0) then
  raise exception 'approval_required';
 end if;
 if n.stage='agendado' and n.scheduled_at is null then raise exception 'schedule_required'; end if;
 if n.stage='postado' and (n.posted_at is null or nullif(n.channel,'') is null) then raise exception 'publication_required'; end if;
 update public.central_social_cards set
  client=n.client, title=n.title, assets=n.assets, selected_assets=n.selected_assets, caption=n.caption, note=n.note, stage=n.stage,
  revision=n.revision, version=c.version+1, approved_revision=n.approved_revision,
  approved_by=n.approved_by, approved_at=n.approved_at, approval_evidence=n.approval_evidence,
  scheduled_at=n.scheduled_at, posted_at=n.posted_at, posted_url=n.posted_url, channel=n.channel,
  token_hash=n.token_hash, token_expires_at=n.token_expires_at, updated_at=now()
 where id=p_id returning * into n;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details)
 values(p_id,p_action,p_actor,p_actor_id,n.revision,jsonb_build_object('client',n.client,'title',n.title,'from',c.stage,'to',n.stage,'evidence',n.approval_evidence,'note',n.note,'scheduled_at',n.scheduled_at,'posted_at',n.posted_at,'posted_url',n.posted_url,'channel',n.channel,'caption',n.caption,'selected_assets',n.selected_assets,'assets',n.assets));
 if p_action='postar' then
  update public.postagens_organizador set postado_em=n.posted_at where id=p_id;
 end if;
 return to_jsonb(n);
end; $$;
revoke all on function public.central_social_apply(text,integer,jsonb,text,text,uuid) from public, anon, authenticated;
grant execute on function public.central_social_apply(text,integer,jsonb,text,text,uuid) to service_role;

commit;
