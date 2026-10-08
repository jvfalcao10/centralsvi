begin;

-- Reels e Story do mesmo vídeo, de verdade.
--
-- Eu troquei a trava do enqueue para valer por formato e disse que funcionava,
-- com base num teste de unidade que simulava o banco. Não funcionava: auditoria
-- externa de 07/10 mostrou que o bloqueio estava em outras quatro camadas.
-- Cada bloco abaixo corresponde a uma delas.

-- 1. Os índices únicos ignoravam o formato, então o banco recusava o segundo
--    destino mesmo com a função permitindo.
drop index if exists public.central_social_publications_active;
create unique index central_social_publications_active
 on public.central_social_publications(card_id,format)
 where status in ('queued','preparing','processing','publishing','uncertain');

drop index if exists public.central_social_publications_once;
create unique index central_social_publications_once
 on public.central_social_publications(card_id,revision,format)
 where status='published';

-- 2. O gatilho da peça cancelava o segundo destino quando o primeiro concluía,
--    porque concluir muda a etapa para "postado". Agora mudança de CONTEÚDO
--    (revisão ou importação) continua cancelando e continua bloqueando durante
--    um envio, mas ir para "postado" não cancela nem bloqueia: a peça estar
--    postada num destino não invalida o envio pendente do outro.
create or replace function public.central_social_publication_card_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare mudou_conteudo boolean; virou_postado boolean;
begin
 mudou_conteudo := new.revision is distinct from old.revision or new.ingest_pending is distinct from old.ingest_pending;
 virou_postado := new.stage is distinct from old.stage and new.stage='postado';
 if mudou_conteudo or (new.stage is distinct from old.stage and not virou_postado) then
  if exists(select 1 from public.central_social_publications where card_id=old.id and status in ('publishing','uncertain')) then raise exception 'publication_in_progress';end if;
  update public.central_social_publications set status='canceled',error='Cancelada porque a peça ou a etapa foi alterada.',lease_id=null,lease_until=null,updated_at=now() where card_id=old.id and status in ('queued','preparing','processing');
 end if;
 return new;
end;$$;

-- 3. Começar o envio exigia a etapa "agendado", mas o primeiro destino já
--    deixou a peça em "postado". O segundo nunca saía da fila.
CREATE OR REPLACE FUNCTION public.central_social_publication_begin(p_job uuid, p_lease uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare j public.central_social_publications; c public.central_social_cards;
begin
 -- Lock order matches staff updates: card, then job.
 select * into c from public.central_social_cards where id=(select card_id from public.central_social_publications where id=p_job) for update;
 select * into j from public.central_social_publications where id=p_job for update;
 if j.lease_id is distinct from p_lease or j.status<>'processing' or j.scheduled_at>now() or c.revision<>j.revision or c.stage not in ('agendado','postado') or c.ingest_pending then return false;end if;
 update public.central_social_publications set status='publishing',updated_at=now() where id=p_job;
 return true;
end;$function$;

-- 4. Em duas chamadas, a primeira incrementa a versão da peça e a segunda
--    chegava com a versão velha. Agora os destinos entram juntos.

create or replace function public.central_social_publication_enqueue_many(p_id text,p_expected integer,p_formats jsonb,p_data jsonb,p_actor text,p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare f jsonb; saidas jsonb:='[]'::jsonb; uma jsonb; versao integer:=p_expected;
begin
 if jsonb_typeof(p_formats)<>'array' or jsonb_array_length(p_formats)=0 then raise exception 'format_invalid'; end if;
 if jsonb_array_length(p_formats)>2 then raise exception 'format_invalid'; end if;
 -- Tudo numa transação: ou os dois destinos entram, ou nenhum. Em duas chamadas
 -- separadas a primeira incrementava a versão da peça e a segunda era recusada.
 for f in select * from jsonb_array_elements(p_formats) loop
  uma:=public.central_social_publication_enqueue(
   p_id, versao, (f->>'request_id')::uuid,
   p_data||jsonb_build_object('format',f->>'format'),
   p_actor, p_actor_id);
  saidas:=saidas||jsonb_build_array(uma);
  -- A peça ganha versão nova a cada entrada; o próximo destino precisa dela.
  select version into versao from public.central_social_cards where id=p_id;
 end loop;
 return saidas;
end; $$;
revoke all on function public.central_social_publication_enqueue_many(text,integer,jsonb,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.central_social_publication_enqueue_many(text,integer,jsonb,jsonb,text,uuid) to service_role;

commit;
