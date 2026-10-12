-- Espera entre tentativas de legenda (12/10/2026).
--
-- A esteira de legenda roda a cada minuto (sync da Central chamado pelo n8n).
-- Quando a API de IA devolvia 429/503, a peça voltava inteira para a fila e,
-- um minuto depois, o vídeo era baixado de novo do Storage para uma nova
-- tentativa. Em dia de limite da API isso virou dezenas de GB de saída do
-- Supabase e estourou a cota da organização. Agora toda peça reivindicada
-- ganha uma espera mínima, e limite de API pausa a fila inteira.

alter table public.central_social_cards
  add column if not exists caption_retry_at timestamptz;

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
   and coalesce(caption_retry_at,'-infinity'::timestamptz)<=now()
 order by created_at desc
 for update skip locked
 limit 1;
 if not found then return null; end if;
 -- Uma peça nunca é tentada duas vezes em menos de 15 minutos, mesmo que a
 -- função caia no meio: o vídeo custa caro para baixar e ouvir.
 update public.central_social_cards
   set caption_attempts=caption_attempts+1, caption_retry_at=now()+interval '15 minutes'
 where id=c.id;
 return c;
end; $$;
revoke all on function public.central_social_caption_next() from public,anon,authenticated;
grant execute on function public.central_social_caption_next() to service_role;

-- Limite de uso da API não é defeito da peça: devolve a tentativa e espera 30 min.
create or replace function public.central_social_caption_retry(p_id text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.central_social_cards
 set caption_attempts=greatest(caption_attempts-1,0),
     caption_retry_at=greatest(coalesce(caption_retry_at,now()),now()+interval '30 minutes')
 where id=p_id and coalesce(caption,'')='';
end; $$;
revoke all on function public.central_social_caption_retry(text) from public,anon,authenticated;
grant execute on function public.central_social_caption_retry(text) to service_role;

-- Pausa a fila inteira por p_minutos: o limite da API vale para todas as peças,
-- então não adianta a próxima tentar um minuto depois.
create or replace function public.central_social_caption_pause(p_minutos integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 update public.central_social_cards
 set caption_retry_at=greatest(coalesce(caption_retry_at,now()),now()+make_interval(mins=>greatest(coalesce(p_minutos,10),1)))
 where coalesce(caption,'')='' and posted_at is null and stage not in ('arquivado','postado');
 get diagnostics n=row_count;
 return n;
end; $$;
revoke all on function public.central_social_caption_pause(integer) from public,anon,authenticated;
grant execute on function public.central_social_caption_pause(integer) to service_role;

comment on column public.central_social_cards.caption_retry_at is 'Antes deste instante a esteira de legenda não volta a tentar esta peça.';
