begin;
create table public.central_social_feedback_groups (
 id text primary key, author text not null unique, label text not null,
 jid text not null unique check(jid ~ '^[0-9]+@g.us$'), enabled boolean not null default true
);
insert into public.central_social_feedback_groups(id,author,label,jid) values
 ('jose','José','JOSÉ | DESIGN | SVI','120363425264332830@g.us'),
 ('lais','Laís','LAÍS | DESIGN | SVI','120363427037159263@g.us'),
 ('math','Math','MATH | EDITOR | SVI','120363411761185563@g.us'),
 ('sarah','Sarah','SARAH | FILMMAKER | EDITORA | SVI','120363429541277814@g.us');
create table public.central_social_feedback_routes (
 card_id text primary key references public.central_social_cards(id) on delete cascade,
 task_id text not null check(task_id ~ '^[A-Za-z0-9]+$'), task_name text not null,
 group_id text not null references public.central_social_feedback_groups(id),
 updated_at timestamptz not null default now()
);
create index central_social_feedback_routes_group on public.central_social_feedback_routes(group_id);
create table public.central_social_feedback_outbox (
 id bigint generated always as identity primary key,
 event_id bigint not null references public.central_social_events(id) on delete cascade,
 card_id text not null references public.central_social_cards(id) on delete cascade,
 channel text not null check(channel in ('whatsapp','clickup')),
 destination text, payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','retry','sent','blocked','uncertain')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), lease_until timestamptz,
 dispatched_at timestamptz, sent_at timestamptz, remote_id text, error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(event_id,channel)
);
create index central_social_feedback_due on public.central_social_feedback_outbox(status,next_attempt_at);
create index central_social_feedback_card on public.central_social_feedback_outbox(card_id,id desc);
alter table public.central_social_feedback_groups enable row level security;
alter table public.central_social_feedback_routes enable row level security;
alter table public.central_social_feedback_outbox enable row level security;
revoke all on public.central_social_feedback_groups,public.central_social_feedback_routes,public.central_social_feedback_outbox from public,anon,authenticated;
grant all on public.central_social_feedback_groups,public.central_social_feedback_routes,public.central_social_feedback_outbox to service_role;
grant usage,select on sequence public.central_social_feedback_outbox_id_seq to service_role;

create function public.central_social_feedback_route(p_id text,p_expected integer,p_task text,p_task_name text,p_group text,p_actor text,p_actor_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards;
begin
 select * into c from public.central_social_cards where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if c.version<>p_expected then raise exception 'version_conflict'; end if;
 if not exists(select 1 from public.central_social_feedback_groups where id=p_group and enabled) then raise exception 'invalid_group'; end if;
 insert into public.central_social_feedback_routes(card_id,task_id,task_name,group_id) values(p_id,p_task,p_task_name,p_group)
 on conflict(card_id) do update set task_id=excluded.task_id,task_name=excluded.task_name,group_id=excluded.group_id,updated_at=now();
 update public.central_social_cards set version=version+1,updated_at=now() where id=p_id;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details)
 values(p_id,'destino',p_actor,p_actor_id,c.revision,jsonb_build_object('task_id',p_task,'group_id',p_group));
end; $$;

-- Only new client replies enqueue deliveries. Old approvals are never backfilled.
create function public.central_social_feedback_enqueue() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; r public.central_social_feedback_routes; g public.central_social_feedback_groups;
 task text; snapshot jsonb;
begin
 if new.action not in ('cliente_aprovar','cliente_ajustes','cliente_reprovar') then return new; end if;
 select * into c from public.central_social_cards where id=new.card_id;
 select * into r from public.central_social_feedback_routes where card_id=c.id;
 if r.card_id is not null then
  task:=r.task_id; select * into g from public.central_social_feedback_groups where id=r.group_id and enabled;
 else
  task:=substring(c.source_url from '^https://app[.]clickup[.]com/t/([A-Za-z0-9]+)$');
  select * into g from public.central_social_feedback_groups where author=c.author and enabled;
 end if;
 snapshot:=jsonb_build_object('client',c.client,'title',c.title,'revision',new.revision,'actor',new.actor,'action',new.action,
  'comment',case when new.action='cliente_aprovar' then '' else coalesce(new.details->>'note','') end,
  'created_at',new.created_at,'task_id',task,'group_label',g.label,
  'files',(select coalesce(jsonb_agg(a->>'name' order by s.n),'[]'::jsonb) from jsonb_array_elements_text(c.selected_assets) with ordinality s(id,n) join jsonb_array_elements(c.assets) a on a->>'id'=s.id));
 insert into public.central_social_feedback_outbox(event_id,card_id,channel,destination,payload,status,error) values
 (new.id,c.id,'clickup',task,snapshot,case when task is null then 'blocked' else 'pending' end,case when task is null then 'missing_destination' end),
 (new.id,c.id,'whatsapp',g.jid,snapshot,case when g.jid is null then 'blocked' else 'pending' end,case when g.jid is null then 'missing_destination' end);
 return new;
end; $$;
create trigger central_social_feedback_enqueue after insert on public.central_social_events for each row execute function public.central_social_feedback_enqueue();

create function public.central_social_feedback_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.central_social_feedback_outbox;
begin
 select * into j from public.central_social_feedback_outbox
 where ((status in ('pending','retry','uncertain') and next_attempt_at<=now()) or (status='processing' and lease_until<now()))
 order by id for update skip locked limit 1;
 if not found then return null; end if;
 update public.central_social_feedback_outbox set status='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes',updated_at=now()
 where id=j.id returning * into j;
 return to_jsonb(j);
end; $$;
revoke all on function public.central_social_feedback_route(text,integer,text,text,text,text,uuid),public.central_social_feedback_enqueue(),public.central_social_feedback_claim() from public,anon,authenticated;
grant execute on function public.central_social_feedback_route(text,integer,text,text,text,text,uuid),public.central_social_feedback_enqueue(),public.central_social_feedback_claim() to service_role;
commit;
