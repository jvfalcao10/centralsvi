begin;

-- O que protege a legenda não é a etapa, é não haver quem já tenha decidido.
--
-- Eu tinha travado a escrita automática em `stage='conferir'`. Protege, mas
-- protege demais: peça em "agendado" sem aprovação e sem link vivo não tem
-- ninguém para enganar, e ficava sem legenda à toa.
--
-- A regra passa a ser a que corresponde ao risco real: não escreve onde já
-- existe aprovação registrada, nem onde existe link de aprovação VIVO, porque
-- aí alguém poderia aprovar um texto diferente do que viu. Link expirado não
-- aprova mais nada, então não trava.
create or replace function public.central_social_caption_next()
returns public.central_social_cards language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards;
begin
 select * into c from public.central_social_cards
 where coalesce(caption,'')=''
   and caption_attempts<3
   and not ingest_pending
   and posted_at is null
   and stage not in ('arquivado','postado')
   and approved_at is null
   and (token_hash is null or coalesce(token_expires_at,now())<=now())
   and jsonb_array_length(coalesce(selected_assets,'[]'::jsonb))>0
   and created_at>now()-interval '30 days'
 order by created_at desc
 for update skip locked
 limit 1;
 if not found then return null; end if;
 update public.central_social_cards set caption_attempts=caption_attempts+1 where id=c.id;
 return c;
end; $$;
revoke all on function public.central_social_caption_next() from public,anon,authenticated;
grant execute on function public.central_social_caption_next() to service_role;

-- A gravação repete a mesma condição, porque entre reivindicar e escrever a
-- peça pode ter sido aprovada ou ganhado link: a leitura do vídeo leva minutos.
create or replace function public.central_social_caption_write(p_id text,p_caption text,p_transcript text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id,0));
 -- A transcrição descreve o ARQUIVO, não a peça, e entendê-lo é a parte cara:
 -- guarda sempre, mesmo quando a legenda não pode mais entrar.
 update public.central_social_cards
 set transcript=coalesce(nullif(p_transcript,''),transcript)
 where id=p_id;
 update public.central_social_cards
 set caption=coalesce(p_caption,''), caption_draft=true, caption_ai_at=now(), caption_error=null
 where id=p_id and coalesce(p_caption,'')<>'' and coalesce(caption,'')=''
   and posted_at is null and stage not in ('arquivado','postado')
   and approved_at is null
   and (token_hash is null or coalesce(token_expires_at,now())<=now());
end; $$;
revoke all on function public.central_social_caption_write(text,text,text) from public,anon,authenticated;
grant execute on function public.central_social_caption_write(text,text,text) to service_role;

commit;
