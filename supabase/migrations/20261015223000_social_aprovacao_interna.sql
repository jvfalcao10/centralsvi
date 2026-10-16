-- Aprovação interna na frente do quadro (João, 15/10/2026, 22h20).
--
-- O quadro de peças passa a espelhar as etapas do ClickUp e ganha uma etapa
-- NOVA na frente, `interna` ("Aprovação interna"), que NÃO manda nada ao
-- cliente. Motivo: duas peças foram sozinhas ao grupo do Rafael em 15/10 sem o
-- João ver, porque toda entrega caía em `conferir` e de lá a Sofia envia.
--
-- Agora toda entrada que caía em `conferir` cai em `interna`:
--  * default da coluna (card novo do coletor nasce sem etapa explícita);
--  * central_social_ingest: entrega nova ou reentrega volta para `interna`;
--  * central_social_notice: aviso de entrega chegando, idem;
--  * central_social_complete: a autorização dada pelo WhatsApp no envio da
--    peça (POSTAR ... APROVADO) continua valendo com a peça em `interna`.
-- `conferir` continua existindo ("Enviar pra aprovação") e é só ela que
-- dispara o envio automático. central_social_apply não muda: `interna` fica
-- fora das listas que exigem arquivo e aprovação, igual a `conferir`.

begin;

alter table public.central_social_cards drop constraint central_social_cards_stage_check;
alter table public.central_social_cards add constraint central_social_cards_stage_check
 check (stage in ('interna','conferir','aguardando','ajustes','aprovado','para_anuncio','agendado','postado','arquivado'));
alter table public.central_social_cards alter column stage set default 'interna';

CREATE OR REPLACE FUNCTION public.central_social_ingest(p_key text, p_card jsonb, p_assets jsonb, p_complete boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
   selected_assets=case
     when jsonb_array_length(c.assets)=0 then (select jsonb_agg(a->>'id') from jsonb_array_elements(added) a)
     -- Reenvio de VIDEO troca a selecao: o ultimo enviado e o certo (Joao,
     -- 15/10/2026). Sem isto a selecao ficava vazia e o envio automatico saia
     -- so com o link, sem o video. Carrossel de imagem nao entra nesta regra:
     -- arte nova numa peca de 7 laminas nao substitui as outras 6.
     when not exists(select 1 from jsonb_array_elements(added) a where a->>'type' not like 'video/%')
      and not exists(select 1 from jsonb_array_elements(c.assets) x where x->>'type' not like 'video/%')
      then (select jsonb_agg(a->>'id') from jsonb_array_elements(added) a)
     else '[]'::jsonb end,
   stage=case when c.stage in ('ajustes','arquivado') then c.stage else 'interna' end,
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
end; $function$;

CREATE OR REPLACE FUNCTION public.central_social_notice(p_key text, p_card jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 values(c.id,'receber','Sincronização · '||j.provider,c.revision,jsonb_build_object('from',c.stage,'to',case when c.stage in ('ajustes','arquivado') then c.stage else 'interna' end,'note','Uma entrega nova está sendo importada. A aprovação anterior foi invalidada.','source_key',j.key,'previous',jsonb_build_object('assets',c.assets,'selected_assets',c.selected_assets,'caption',c.caption,'approved_by',c.approved_by,'approved_at',c.approved_at,'revision',c.revision)));
 update public.central_social_cards set ingest_pending=true,stage=case when stage in ('ajustes','arquivado') then stage else 'interna' end,
 approved_revision=null,approved_by=null,approved_at=null,approval_evidence=null,token_hash=null,token_expires_at=null,scheduled_at=null,version=version+1,updated_at=now() where id=c.id;
 update public.central_social_inbox set payload=payload||'{"noticed":true}'::jsonb where key=p_key;
end; $function$;

CREATE OR REPLACE FUNCTION public.central_social_complete(p_key text, p_card jsonb, p_assets jsonb, p_complete boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb; j public.central_social_inbox; c public.central_social_cards; a jsonb;
begin
 result:=public.central_social_ingest(p_key,p_card,p_assets,p_complete);
 select * into j from public.central_social_inbox where key=p_key;
 a:=j.payload->'intake_approval';
 if a is not null and a<>'null'::jsonb and result->>'changed'='true' and p_complete then
  select * into c from public.central_social_cards where id=j.card_id for update;
  if not c.ingest_pending and c.stage in ('interna','conferir') and c.posted_at is null and c.client<>'Identificar cliente'
   and c.caption='' and c.source_updated<=(j.payload->>'at')::timestamptz
   and exists(select 1 from jsonb_array_elements(p_assets) v where v->>'id'=j.source_id)
   and not exists(select 1 from public.central_social_events where card_id=c.id and created_at>=j.created_at and action not in ('importar','receber')) then
    perform public.central_social_apply(c.id,c.version,jsonb_build_object('selected_assets',jsonb_build_array(j.source_id),'stage','aprovado','approved_revision',c.revision,'approved_by',a->>'by','approved_at',a->>'at','approval_evidence','WhatsApp · autorização de '||(a->>'by')||' · mensagem '||(a->>'message_id')||' · '||(a->>'text')||' · destino confirmado: '||(j.payload->>'destination_confirmed_by')),'aprovar',a->>'by',null);
    result:=result||'{"approved":true}'::jsonb;
   end if;
 end if;
 return result;
end; $function$;

commit;
