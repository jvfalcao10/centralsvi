begin;
create table public.central_social_client_links (
 client text primary key check(length(client) between 1 and 120 and client <> 'Identificar cliente'),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 ciphertext text not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.central_social_client_links enable row level security;
revoke all on public.central_social_client_links from public,anon,authenticated;
grant all on public.central_social_client_links to service_role;

create function public.central_social_client_link(p_client text,p_hash text,p_ciphertext text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.central_social_client_links(client,token_hash,ciphertext) values(p_client,p_hash,p_ciphertext)
 on conflict(client) do update set token_hash=excluded.token_hash,ciphertext=excluded.ciphertext,revoked_at=null,created_at=now()
 where central_social_client_links.revoked_at is not null;
end; $$;
revoke all on function public.central_social_client_link(text,text,text) from public,anon,authenticated;
grant execute on function public.central_social_client_link(text,text,text) to service_role;

-- Membership, current version and decision are checked under locks before the
-- existing event/outbox transaction runs. A bundle never grants access to drafts.
create function public.central_social_client_answer(p_hash text,p_id text,p_expected integer,p_patch jsonb,p_action text,p_actor text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare link public.central_social_client_links; c public.central_social_cards;
begin
 select * into link from public.central_social_client_links where token_hash=p_hash and revoked_at is null for share;
 if not found then raise exception 'link_unavailable'; end if;
 select * into c from public.central_social_cards where id=p_id for update;
 if not found or c.client<>link.client then raise exception 'link_unavailable'; end if;
 if c.version<>p_expected then raise exception 'version_conflict'; end if;
 if c.stage<>'aguardando' or c.ingest_pending or c.posted_at is not null or jsonb_array_length(c.selected_assets)=0
 or exists(select 1 from jsonb_array_elements_text(c.selected_assets) s(id) where not exists(select 1 from jsonb_array_elements(c.assets) a where a->>'id'=s.id))
 then raise exception 'version_conflict'; end if;
 if p_action not in ('cliente_aprovar','cliente_ajustes','cliente_reprovar') or length(trim(p_actor))<2 then raise exception 'invalid_action'; end if;
 if (p_action='cliente_aprovar' and p_patch->>'stage' is distinct from 'aprovado') or (p_action<>'cliente_aprovar' and p_patch->>'stage' is distinct from 'ajustes') then raise exception 'invalid_action'; end if;
 return public.central_social_apply(p_id,p_expected,p_patch,p_action,p_actor,null);
end; $$;
revoke all on function public.central_social_client_answer(text,text,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.central_social_client_answer(text,text,integer,jsonb,text,text) to service_role;
commit;
