begin;

-- "O ultimo enviado e o certo" (Joao, 15/10/2026).
--
-- Quando o editor reenvia a peca, o coletor passou a apontar para o card que ja
-- existe em vez de abrir outro. O resto desta funcao ja fazia a coisa certa:
-- volta para Conferir, zera aprovacao, link e agendamento, e sobe a versao.
-- Faltava a SELECAO: ela era limpa, e sem peca selecionada o envio automatico
-- sairia so com o link, sem o video.

create or replace function public.central_social_ingest(p_key text,p_card jsonb,p_assets jsonb,p_complete boolean default true)
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


commit;
