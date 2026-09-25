begin;
create table public.central_social_intake_files (
 id text primary key, chat_id text not null, delivery jsonb not null,
 state text not null default 'pending', approval jsonb, received_at timestamptz not null default now()
);
create index central_social_intake_chat on public.central_social_intake_files(chat_id,state,received_at);
create table public.central_social_intake_receipts (id text primary key, chat_id text not null, result jsonb not null, created_at timestamptz not null default now());
create table public.central_social_drive_folders (path text primary key, drive_id text not null unique, created_at timestamptz not null default now());
alter table public.central_social_intake_files enable row level security;
alter table public.central_social_intake_receipts enable row level security;
alter table public.central_social_drive_folders enable row level security;
revoke all on public.central_social_intake_files,public.central_social_intake_receipts,public.central_social_drive_folders from public,anon,authenticated;
grant all on public.central_social_intake_files,public.central_social_intake_receipts,public.central_social_drive_folders to service_role;

create function public.central_social_intake(p_event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.central_social_intake_files; ids text[]; result jsonb; cmd text:=p_event->>'command'; chat text:=p_event->>'chat_id'; files jsonb; appr jsonb; d jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('social-intake:'||chat,0));
 if exists(select 1 from public.central_social_intake_receipts where id=p_event->>'id') then return '{"route":"ignore","duplicate":true}'::jsonb; end if;
 update public.central_social_intake_files set state='expired' where chat_id=chat and state='pending' and received_at<now()-interval '24 hours';
 if p_event ? 'delivery' then
  insert into public.central_social_intake_files(id,chat_id,delivery) values(p_event->>'id',chat,p_event->'delivery') on conflict do nothing;
 end if;
 select array_agg(id order by received_at) into ids from public.central_social_intake_files where chat_id=chat and state='pending'
 and (nullif(p_event->>'quoted','') is null or id=p_event->>'quoted' or delivery->'payload'->>'wa_message_id'=p_event->>'quoted');
 if coalesce(cardinality(ids),0)=0 then
  result:=jsonb_build_object('route',case when p_event ? 'delivery' then 'ignore' else 'pass' end);
 else
  if p_event ? 'client' then update public.central_social_intake_files set delivery=jsonb_set(delivery,'{client}',p_event->'client') where id=any(ids); end if;
  if p_event ? 'month' then update public.central_social_intake_files set delivery=jsonb_set(jsonb_set(delivery,'{payload,month}',p_event->'month'),'{payload,year}',p_event->'year') where id=any(ids); end if;
  if p_event->>'approved'='true' and p_event->>'can_approve'='true' then
   appr:=jsonb_build_object('by',p_event->>'actor','message_id',p_event->>'id','at',p_event->>'at','text',p_event->>'text');
   update public.central_social_intake_files set approval=appr where id=any(ids);
  end if;
  select jsonb_agg(delivery||jsonb_build_object('approval',approval)) into files from public.central_social_intake_files where id=any(ids);
  if cmd='post' and exists(select 1 from public.central_social_intake_files where id=any(ids) and delivery->>'client'='Identificar cliente') then
   result:=jsonb_build_object('route','reply','reply','Para qual cliente? Responda POSTAR | CLIENTE | MÊS. Se já estiver liberado, acrescente APROVADO.','files',files);
  elsif cmd='post' then
   for f in select * from public.central_social_intake_files where id=any(ids) loop
    d:=f.delivery;
    insert into public.central_social_inbox(key,provider,source_id,card_id,payload)
    values(d->>'key','whatsapp',d->>'source_id',d->>'card_id',(d->'payload')||jsonb_build_object('client',d->>'client','title',d->>'title','delivery_version',d->'delivery_version','intake_approval',f.approval,'destination_confirmed_by',p_event->>'id','use_drive',true)) on conflict do nothing;
   end loop;
   update public.central_social_intake_files set state='queued' where id=any(ids);
   result:=jsonb_build_object('route','reply','reply','Vou colocar na Central para a Letícia, nas pastas de ano, mês e cliente. A aprovação registrada vai junto. Os arquivos aparecem depois de terminar a importação: https://central.svicompany.com.br/content/social','files',files);
  elsif cmd='transcribe' then
   if cardinality(ids)>1 then result:=jsonb_build_object('route','reply','reply','Tenho mais de um vídeo aguardando. Responda ao vídeo desejado com TRANSCREVER.');
   elsif (files->0->'payload'->>'bytes')::bigint>24000000 then result:=jsonb_build_object('route','reply','reply','Esse vídeo passa do limite de 25 MB da transcrição atual. Envie o áudio separado ou um trecho menor. Ele não foi colocado na fila de postagem.');
   else
    update public.central_social_intake_files set state='transcribe' where id=any(ids);
    result:=jsonb_build_object('route','transcribe','media_id',ids[1]);
   end if;
  elsif cmd='cancel' then
   update public.central_social_intake_files set state='cancelled' where id=any(ids);
   result:=jsonb_build_object('route','reply','reply','Certo. Esses vídeos saíram da espera e não foram enviados para postagem.');
  elsif cmd='other' then
   update public.central_social_intake_files set state='other' where id=any(ids);
   result:=jsonb_build_object('route','reply','reply','Certo. O que você quer fazer com esses vídeos? Eles não foram enviados para postagem.');
  elsif p_event ? 'delivery' or cmd in ('approve','unknown','month') then
   result:=jsonb_build_object('route','reply','reply',case when cmd='approve' then 'Registrei sua aprovação. ' else '' end||'É para colocar na Central para a Letícia postar, transcrever ou fazer outra coisa? Responda POSTAR, TRANSCREVER ou OUTRA COISA. Para escolher o mês: POSTAR | CLIENTE | SETEMBRO.','files',files);
  else result:=jsonb_build_object('route','pass'); end if;
 end if;
 insert into public.central_social_intake_receipts(id,chat_id,result) values(p_event->>'id',chat,result);
 return result;
end; $$;
revoke all on function public.central_social_intake(jsonb) from public,anon,authenticated;
grant execute on function public.central_social_intake(jsonb) to service_role;

create function public.central_social_job_data(p_key text,p_attempt integer,p_patch jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare value jsonb;
begin
 update public.central_social_inbox set payload=payload||p_patch where key=p_key and status='processing' and attempts=p_attempt and lease_until>now() returning payload into value;
 if not found then raise exception 'job_lease_lost'; end if;
 return value;
end; $$;
revoke all on function public.central_social_job_data(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.central_social_job_data(text,integer,jsonb) to service_role;

create function public.central_social_complete(p_key text,p_card jsonb,p_assets jsonb,p_complete boolean default true) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; j public.central_social_inbox; c public.central_social_cards; a jsonb;
begin
 result:=public.central_social_ingest(p_key,p_card,p_assets,p_complete);
 select * into j from public.central_social_inbox where key=p_key;
 a:=j.payload->'intake_approval';
 if a is not null and a<>'null'::jsonb and result->>'changed'='true' and p_complete then
  select * into c from public.central_social_cards where id=j.card_id for update;
  if not c.ingest_pending and c.stage='conferir' and c.posted_at is null and c.client<>'Identificar cliente'
   and c.caption='' and c.source_updated<=(j.payload->>'at')::timestamptz
   and exists(select 1 from jsonb_array_elements(p_assets) v where v->>'id'=j.source_id)
   and not exists(select 1 from public.central_social_events where card_id=c.id and created_at>=j.created_at and action not in ('importar','receber')) then
    perform public.central_social_apply(c.id,c.version,jsonb_build_object('selected_assets',jsonb_build_array(j.source_id),'stage','aprovado','approved_revision',c.revision,'approved_by',a->>'by','approved_at',a->>'at','approval_evidence','WhatsApp · autorização de '||(a->>'by')||' · mensagem '||(a->>'message_id')||' · '||(a->>'text')||' · destino confirmado: '||(j.payload->>'destination_confirmed_by')),'aprovar',a->>'by',null);
    result:=result||'{"approved":true}'::jsonb;
   end if;
 end if;
 return result;
end; $$;
revoke all on function public.central_social_complete(text,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.central_social_complete(text,jsonb,jsonb,boolean) to service_role;
commit;
