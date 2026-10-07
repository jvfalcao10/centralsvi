begin;

-- Por que a legenda não saiu.
--
-- 13 peças desistiram depois de três tentativas e eu não tinha como saber o
-- motivo: o worker só devolvia o status na resposta HTTP, que ninguém guarda.
-- Sem isso, diagnosticar vira adivinhação.
alter table public.central_social_cards
 add column if not exists caption_error text;

comment on column public.central_social_cards.caption_error is 'Motivo da última falha ao escrever a legenda. Limpo quando a legenda sai.';

create or replace function public.central_social_caption_fail(p_id text,p_motivo text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.central_social_cards set caption_error=left(coalesce(p_motivo,''),300) where id=p_id;
end; $$;
revoke all on function public.central_social_caption_fail(text,text) from public,anon,authenticated;
grant execute on function public.central_social_caption_fail(text,text) to service_role;

-- Quando a legenda sai, o motivo antigo não serve mais.
create or replace function public.central_social_caption_write(p_id text,p_caption text,p_transcript text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id,0));
 update public.central_social_cards
 set transcript=coalesce(nullif(p_transcript,''),transcript),
     caption=case when coalesce(caption,'')='' then coalesce(p_caption,'') else caption end,
     caption_draft=case when coalesce(caption,'')='' and coalesce(p_caption,'')<>'' then true else caption_draft end,
     caption_ai_at=case when coalesce(caption,'')='' and coalesce(p_caption,'')<>'' then now() else caption_ai_at end,
     caption_error=case when coalesce(p_caption,'')<>'' then null else caption_error end
 where id=p_id and posted_at is null;
end; $$;
revoke all on function public.central_social_caption_write(text,text,text) from public,anon,authenticated;
grant execute on function public.central_social_caption_write(text,text,text) to service_role;

commit;
