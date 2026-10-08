begin;

-- A legenda da IA só entra ANTES de a peça ir para o cliente.
--
-- O worker escrevia a legenda sem mudar a versão da peça, de propósito, para
-- não invalidar link já enviado. O efeito colateral, achado por auditoria
-- externa em 07/10: um link gerado antes da legenda continuava válido, e o
-- cliente aprovava um conteúdo que tinha mudado depois que ele viu. A seleção
-- também pegava peça JÁ APROVADA, trocando o texto por baixo de uma aprovação.
--
-- A regra passa a ser a decisão original do João: a legenda nasce quando a peça
-- entra, na etapa de conferência, antes de qualquer envio. Peça que já está com
-- o cliente, já aprovada ou já com link vivo não recebe mais escrita automática.
-- Quem quiser legenda nessas usa o botão da tela, que passa pela pessoa.
create or replace function public.central_social_caption_next()
returns public.central_social_cards language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards;
begin
 select * into c from public.central_social_cards
 where coalesce(caption,'')=''
   and caption_attempts<3
   and not ingest_pending
   and posted_at is null
   and stage='conferir'
   and approved_at is null
   and token_hash is null
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

-- A escrita também recusa peça que saiu da conferência entre a leitura e a
-- gravação: a leitura do vídeo leva mais de um minuto e a peça pode ter andado.
create or replace function public.central_social_caption_write(p_id text,p_caption text,p_transcript text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id,0));
 -- A transcrição pode ser guardada sempre: ela descreve o arquivo, não a peça,
 -- e entendê-lo foi a parte cara. Só a LEGENDA respeita a janela.
 update public.central_social_cards
 set transcript=coalesce(nullif(p_transcript,''),transcript)
 where id=p_id;
 update public.central_social_cards
 set caption=coalesce(p_caption,''),
     caption_draft=true,
     caption_ai_at=now(),
     caption_error=null
 where id=p_id and coalesce(p_caption,'')<>'' and coalesce(caption,'')=''
   and posted_at is null and stage='conferir' and approved_at is null and token_hash is null;
end; $$;
revoke all on function public.central_social_caption_write(text,text,text) from public,anon,authenticated;
grant execute on function public.central_social_caption_write(text,text,text) to service_role;

commit;
