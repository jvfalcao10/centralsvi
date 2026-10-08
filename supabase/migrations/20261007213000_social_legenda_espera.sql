begin;

-- Teto de uso da API não é defeito da peça.
--
-- A chave do Gemini tem limite de requisições. Quando ele estoura, a peça
-- recebia uma tentativa gasta e, com três minutos cheios seguidos, desistia de
-- vez. Foi o que aconteceu com 13 peças: nenhuma tinha problema, só pegaram a
-- fila lotada.
create or replace function public.central_social_caption_retry(p_id text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.central_social_cards
 set caption_attempts=greatest(caption_attempts-1,0)
 where id=p_id and coalesce(caption,'')='';
end; $$;
revoke all on function public.central_social_caption_retry(text) from public,anon,authenticated;
grant execute on function public.central_social_caption_retry(text) to service_role;

-- Devolve à fila quem desistiu por limite de uso, não por defeito.
update public.central_social_cards set caption_attempts=0
where coalesce(caption,'')='' and caption_attempts>=3 and posted_at is null
  and stage not in ('arquivado','postado');

commit;
