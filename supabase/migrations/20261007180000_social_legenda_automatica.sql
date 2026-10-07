begin;

-- Legenda automática da peça.
--
-- Hoje a legenda é manual e depende de alguém colar a transcrição do vídeo na
-- mão, então só 22 das 213 peças têm legenda. A IA não ouvia nada: recebia só
-- título e briefing. Aqui a peça guarda o que foi DITO no vídeo e a Central
-- escreve a legenda assim que a peça entra, antes de ir para o cliente.
--
-- A legenda nasce marcada como rascunho de IA. O aviso só sai quando uma pessoa
-- salva a peça, que é o gesto de revisão: nada vai para fora sem alguém ter
-- lido, como manda a régua da casa.
alter table public.central_social_cards
 add column if not exists transcript text,
 add column if not exists caption_draft boolean not null default false,
 add column if not exists caption_ai_at timestamptz,
 add column if not exists caption_attempts smallint not null default 0;

comment on column public.central_social_cards.transcript is 'Fala transcrita do vídeo da peça. Alimenta a legenda e evita transcrever de novo.';
comment on column public.central_social_cards.caption_draft is 'Legenda escrita pela IA e ainda não revisada por uma pessoa.';
comment on column public.central_social_cards.caption_attempts is 'Tentativas de geração automática. Trava a fila em caso de falha repetida.';

-- Uma peça por chamada, com trava, para dois workers não gerarem a mesma legenda.
-- Só entra peça viva, já importada, com arquivo escolhido e sem legenda escrita.
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
   and jsonb_array_length(coalesce(selected_assets,'[]'::jsonb))>0
   and created_at>now()-interval '30 days'
 order by created_at desc
 for update skip locked
 limit 1;
 if not found then return null; end if;
 -- Conta a tentativa ao reivindicar: falha que repete sai da fila sozinha.
 update public.central_social_cards set caption_attempts=caption_attempts+1 where id=c.id;
 return c;
end; $$;
revoke all on function public.central_social_caption_next() from public,anon,authenticated;
grant execute on function public.central_social_caption_next() to service_role;

-- Grava a legenda sem mexer na versão nem na revisão da peça: escrever legenda
-- não é entrega nova e não pode invalidar aprovação nem link já enviado.
create or replace function public.central_social_caption_write(p_id text,p_caption text,p_transcript text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id,0));
 update public.central_social_cards
 set transcript=coalesce(nullif(p_transcript,''),transcript),
     caption=case when coalesce(caption,'')='' then coalesce(p_caption,'') else caption end,
     caption_draft=case when coalesce(caption,'')='' and coalesce(p_caption,'')<>'' then true else caption_draft end,
     caption_ai_at=case when coalesce(caption,'')='' and coalesce(p_caption,'')<>'' then now() else caption_ai_at end
 where id=p_id and posted_at is null;
end; $$;
revoke all on function public.central_social_caption_write(text,text,text) from public,anon,authenticated;
grant execute on function public.central_social_caption_write(text,text,text) to service_role;

commit;
