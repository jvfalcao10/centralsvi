begin;
create or replace function public.central_social_claim(p_source text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.central_social_sync_sources; j public.central_social_inbox;
begin
 if p_source is not null then
  select * into s from public.central_social_sync_sources where id=p_source and enabled and (lease_until is null or lease_until<now()) for update skip locked;
  if not found then return null; end if;
  update public.central_social_sync_sources set lease_until=now()+interval '5 minutes',last_checked_at=now() where id=s.id;
  return to_jsonb(s);
 end if;
 update public.central_social_inbox set status='manual',error='processing_timeout',lease_until=null,updated_at=now() where status='processing' and attempts>=8 and lease_until<now();
 select * into j from public.central_social_inbox where ((status in ('pending','error') and next_attempt_at<=now()) or (status='processing' and lease_until<now())) and attempts<8 order by (provider='whatsapp') desc,created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.central_social_inbox set status='processing',attempts=attempts+1,lease_until=now()+interval '5 minutes',updated_at=now() where key=j.key returning * into j;
 return to_jsonb(j);
end; $$;
revoke all on function public.central_social_claim(text) from public,anon,authenticated;
grant execute on function public.central_social_claim(text) to service_role;


commit;
