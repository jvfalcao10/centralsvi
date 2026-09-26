begin;
create or replace function public.central_social_intake(p_event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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
 -- A client override applies only to a single file, or an already homogeneous batch.
 -- Never relabel another client's pending videos because the sender answered one question.
 if cardinality(ids)>1 and p_event ? 'client' and exists(select 1 from public.central_social_intake_files where id=any(ids) and delivery->>'client' is distinct from p_event->>'client') then
  result:=jsonb_build_object('route','reply','reply','Há vídeos de clientes diferentes ou ainda sem identificação aguardando. Responda diretamente ao vídeo com POSTAR | CLIENTE | MÊS. Assim cada um vai para a pasta certa.');
  insert into public.central_social_intake_receipts(id,chat_id,result) values(p_event->>'id',chat,result);
  return result;
 end if;
 if coalesce(cardinality(ids),0)=0 then
  result:=jsonb_build_object('route',case when p_event ? 'delivery' then 'ignore' when cmd in ('post','transcribe','approve','month') and nullif(p_event->>'quoted','') is not null then 'reply' else 'pass' end,'reply','Responda diretamente ao vídeo que você quer usar. Se ele ainda não chegou por completo, aguarde o envio terminar.');
 else
  if p_event ? 'client' then update public.central_social_intake_files set delivery=jsonb_set(delivery,'{client}',p_event->'client') where id=any(ids); end if;
  if p_event ? 'month' then update public.central_social_intake_files set delivery=jsonb_set(jsonb_set(delivery,'{payload,month}',p_event->'month'),'{payload,year}',p_event->'year') where id=any(ids); end if;
  if p_event->>'approved'='true' and p_event->>'can_approve'='true' then
   appr:=jsonb_build_object('by',p_event->>'actor','message_id',p_event->>'id','at',p_event->>'at','text',p_event->>'text');
   update public.central_social_intake_files set approval=appr where id=any(ids);
  end if;
  select jsonb_agg(delivery||jsonb_build_object('approval',approval)) into files from public.central_social_intake_files where id=any(ids);
  if cmd='post' and exists(select 1 from public.central_social_intake_files where id=any(ids) and delivery->>'client'='Identificar cliente') then
   result:=jsonb_build_object('route','reply','reply','Para qual cliente? Responda diretamente ao vídeo com POSTAR | CLIENTE | MÊS. Se já estiver liberado, acrescente APROVADO.','files',files);
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
   result:=jsonb_build_object('route','reply','reply',case when cmd='approve' then 'Registrei sua aprovação. ' else '' end||'É para colocar na Central para a Letícia postar, transcrever ou fazer outra coisa? Responda POSTAR, TRANSCREVER ou OUTRA COISA. Para escolher o mês, responda ao vídeo: POSTAR | CLIENTE | SETEMBRO.','files',files);
  else result:=jsonb_build_object('route','pass'); end if;
 end if;
 insert into public.central_social_intake_receipts(id,chat_id,result) values(p_event->>'id',chat,result);
 return result;
end; $$;
commit;
