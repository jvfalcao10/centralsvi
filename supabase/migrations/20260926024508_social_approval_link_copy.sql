begin;
create table public.central_social_approval_links (
 card_id text primary key references public.central_social_cards(id) on delete cascade,
 token_hash text not null,
 ciphertext text not null,
 updated_at timestamptz not null default now()
);
alter table public.central_social_approval_links enable row level security;
revoke all on public.central_social_approval_links from public,anon,authenticated;
grant all on public.central_social_approval_links to service_role;
-- Link and approval state commit together. The capability is encrypted with a server-only key.
create function public.central_social_request_link(p_id text,p_expected integer,p_patch jsonb,p_ciphertext text,p_actor text,p_actor_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_patch->>'stage' is distinct from 'aguardando' or p_patch->>'token_hash' is null or length(p_ciphertext)<40 then raise exception 'invalid_approval_link'; end if;
 result:=public.central_social_apply(p_id,p_expected,p_patch,'solicitar',p_actor,p_actor_id);
 insert into public.central_social_approval_links(card_id,token_hash,ciphertext) values(p_id,p_patch->>'token_hash',p_ciphertext)
 on conflict(card_id) do update set token_hash=excluded.token_hash,ciphertext=excluded.ciphertext,updated_at=now();
 return result;
end; $$;
revoke all on function public.central_social_request_link(text,integer,jsonb,text,text,uuid) from public,anon,authenticated;
grant execute on function public.central_social_request_link(text,integer,jsonb,text,text,uuid) to service_role;
-- Answers can be recorded before production routing is complete. Saving a verified
-- route releases ONLY deliveries that never had a destination and were never sent.
create or replace function public.central_social_feedback_route(p_id text,p_expected integer,p_task text,p_task_name text,p_group text,p_actor text,p_actor_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; g public.central_social_feedback_groups;
begin
 select * into c from public.central_social_cards where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if c.version<>p_expected then raise exception 'version_conflict'; end if;
 select * into g from public.central_social_feedback_groups where id=p_group and enabled;
 if not found then raise exception 'invalid_group'; end if;
 insert into public.central_social_feedback_routes(card_id,task_id,task_name,group_id) values(p_id,p_task,p_task_name,p_group)
 on conflict(card_id) do update set task_id=excluded.task_id,task_name=excluded.task_name,group_id=excluded.group_id,updated_at=now();
 update public.central_social_cards set version=version+1,updated_at=now() where id=p_id;
 update public.central_social_feedback_outbox set
  destination=case when channel='clickup' then p_task else g.jid end,
  payload=payload||jsonb_build_object('task_id',p_task,'group_label',g.label),
  status='pending',error=null,next_attempt_at=now(),updated_at=now()
 where card_id=p_id and status='blocked' and error='missing_destination' and destination is null and dispatched_at is null and sent_at is null;
 insert into public.central_social_events(card_id,action,actor,actor_id,revision,details)
 values(p_id,'destino',p_actor,p_actor_id,c.revision,jsonb_build_object('task_id',p_task,'group_id',p_group));
end; $$;
commit;
