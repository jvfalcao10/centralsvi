begin;
create table public.central_social_cards (
 id text primary key,
 client text not null,
 title text not null,
 author text not null default '',
 source_url text not null,
 source_status text not null default '',
 source_description text not null default '',
 source_updated timestamptz,
 assets jsonb not null default '[]'::jsonb,
 selected_assets jsonb not null default '[]'::jsonb,
 caption text not null default '',
 note text not null default '',
 stage text not null default 'conferir' check (stage in ('conferir','aguardando','ajustes','aprovado','agendado','postado','arquivado')),
 revision integer not null default 1,
 version integer not null default 1,
 approved_revision integer,
 approved_by text,
 approved_at timestamptz,
 approval_evidence text,
 scheduled_at timestamptz,
 posted_at timestamptz,
 posted_url text,
 channel text,
 token_hash text unique,
 token_expires_at timestamptz,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table public.central_social_events (
 id bigint generated always as identity primary key,
 card_id text not null references public.central_social_cards(id) on delete cascade,
 action text not null,
 actor text not null,
 actor_id uuid,
 revision integer not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index central_social_events_card_time on public.central_social_events(card_id, created_at desc);
create index central_social_cards_stage_updated on public.central_social_cards(stage, updated_at desc);
alter table public.central_social_cards enable row level security;
alter table public.central_social_events enable row level security;
revoke all on public.central_social_cards, public.central_social_events from public, anon, authenticated;
grant all on public.central_social_cards, public.central_social_events to service_role;
grant usage, select on sequence public.central_social_events_id_seq to service_role;

-- All writes are authenticated/validated by the Central API. A row lock and expected
-- version protect approvals, client responses and simultaneous edits atomically.
create or replace function public.central_social_apply(p_id text, p_expected integer, p_patch jsonb, p_action text, p_actor text, p_actor_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.central_social_cards; n public.central_social_cards;
begin
 select * into c from public.central_social_cards where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if c.version <> p_expected then raise exception 'version_conflict'; end if;
 n := jsonb_populate_record(c, p_patch - 'id' - 'created_at' - 'version');
 if n.stage in ('aprovado','agendado','postado') and (n.approved_revision is distinct from n.revision or n.approved_by is null or n.approved_at is null or jsonb_array_length(n.selected_assets)=0) then
  raise exception 'approval_required';
 end if;
 if n.stage='agendado' and n.scheduled_at is null then raise exception 'schedule_required'; end if;
 if n.stage='postado' and (n.posted_at is null or nullif(n.channel,'') is null) then raise exception 'publication_required'; end if;
 update public.central_social_cards set
  assets=n.assets, selected_assets=n.selected_assets, caption=n.caption, note=n.note, stage=n.stage,
  revision=n.revision, version=c.version+1, approved_revision=n.approved_revision,
  approved_by=n.approved_by, approved_at=n.approved_at, approval_evidence=n.approval_evidence,
  scheduled_at=n.scheduled_at, posted_at=n.posted_at, posted_url=n.posted_url, channel=n.channel,
  token_hash=n.token_hash, token_expires_at=n.token_expires_at, updated_at=now()
 where id=p_id returning * into n;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details)
 values(p_id,p_action,p_actor,p_actor_id,n.revision,jsonb_build_object('from',c.stage,'to',n.stage,'evidence',n.approval_evidence,'note',n.note,'scheduled_at',n.scheduled_at,'posted_at',n.posted_at,'posted_url',n.posted_url,'channel',n.channel,'caption',n.caption,'selected_assets',n.selected_assets,'assets',n.assets));
 if p_action='postar' then
  update public.postagens_organizador set postado_em=n.posted_at where id=p_id;
 end if;
 return to_jsonb(n);
end; $$;
revoke all on function public.central_social_apply(text,integer,jsonb,text,text,uuid) from public, anon, authenticated;
grant execute on function public.central_social_apply(text,integer,jsonb,text,text,uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values ('central-social','central-social',false,52428800) on conflict (id) do nothing;
commit;
