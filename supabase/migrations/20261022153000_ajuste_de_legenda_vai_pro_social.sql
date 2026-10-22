begin;

-- Pedido do Matheus em 22/10/2026, por áudio: "não sei se tem como disparar a
-- alteração que é de social media, legenda, num grupo que vocês devem ter, e
-- deixar pra ela disparar só realmente se for coisas relacionadas à edição de
-- vídeo. Porque pra não ficar batendo cabeça aqui."
--
-- Ele tem razão e dá para medir: dos 9 avisos de alteração que caíram no grupo
-- dele em 30 dias, 4 não eram dele. Três eram troca de legenda (Norte Capital
-- vídeo 01 e 02 em 15/10, Spa Nature em 15/10) e um foi leitura errada da
-- Central em 22/10.
--
-- "Legenda" sozinha NÃO decide, e esse é o detalhe que faz a regra funcionar:
-- em 12/10 a Dra. Ésia pediu "trocar a LETRA da legenda do vídeo, algo mais
-- nítido", que é legenda queimada, trabalho de edição. Por isso a palavra de
-- ofício de edição tem a última palavra sobre a palavra de legenda.
--
-- Só a PRIMEIRA LINHA do pedido é julgada. O corpo costuma ser a legenda nova
-- inteira, e qualquer palavra solta lá dentro ("som", "corte", "final") faria o
-- aviso mudar de dono sem motivo.
create or replace function public.central_social_sem_acento(p_texto text) returns text
language sql immutable security invoker set search_path='' as $$
 select lower(translate(coalesce(p_texto,''),
  'áàâãäéèêëíìîïóòôõöúùûüñçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇ',
  'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'))
$$;

create or replace function public.central_social_ajuste_de_social(p_texto text) returns boolean
language sql immutable security invoker set search_path='' as $$
 with t as (
  select public.central_social_sem_acento(split_part(coalesce(p_texto,''), E'\n', 1)) as linha
 )
 select (t.linha ~ '\m(legenda|legendas|copy|descricao|hashtag|hashtags)\M' or t.linha ~ '#\w')
    and not t.linha ~ '\m(letra|letras|fonte|nitid\w*|cort\w*|music\w*|audio|som|trilha|transicao|velocidade|trecho|segundos?|minutos?|enquadr\w*|zoom)\M'
 from t
$$;

-- O destino do WhatsApp passa a olhar o que o pedido pede. ClickUp não muda:
-- a tarefa continua sendo a do responsável pela peça.
create or replace function public.central_social_feedback_enqueue() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; r public.central_social_feedback_routes; g public.central_social_feedback_groups;
 s public.central_social_feedback_groups; task text; snapshot jsonb; ajuste boolean; do_cliente boolean; nota text; destino text; rotulo text;
begin
 ajuste := new.action='ajustes' or (new.action='mover' and new.details->>'to'='ajustes');
 if new.action not in ('cliente_aprovar','cliente_ajustes','cliente_reprovar') and not ajuste then return new; end if;
 do_cliente := new.action in ('cliente_ajustes','cliente_reprovar') or (ajuste and new.details->>'from'='aguardando');
 select * into c from public.central_social_cards where id=new.card_id;
 select * into r from public.central_social_feedback_routes where card_id=c.id;
 if r.card_id is not null then
  task:=r.task_id; select * into g from public.central_social_feedback_groups where id=r.group_id and enabled;
 else
  task:=substring(c.source_url from '^https://app[.]clickup[.]com/t/([A-Za-z0-9]+)$');
  select * into g from public.central_social_feedback_groups where author=c.author and enabled;
 end if;
 nota := case when new.action='cliente_aprovar' then '' else coalesce(new.details->>'note',coalesce(c.note,'')) end;
 destino := g.jid; rotulo := g.label;
 -- Aprovação não muda de dono: quem fez a peça é quem recebe a boa notícia.
 if new.action<>'cliente_aprovar' and public.central_social_ajuste_de_social(nota) then
  select * into s from public.central_social_feedback_groups where id='social' and enabled;
  if s.jid is not null then destino:=s.jid; rotulo:=s.label; end if;
 end if;
 snapshot:=jsonb_build_object('client',c.client,'title',c.title,'revision',new.revision,'actor',new.actor,
  'action',case when ajuste then 'ajustes' else new.action end,
  'comment',nota,
  'created_at',new.created_at,'task_id',task,
  'group_label',rotulo,
  'retomar_tarefa',(ajuste or new.action in ('cliente_ajustes','cliente_reprovar')),
  'status_tarefa',case when do_cliente then 'alteração do cliente' else 'fazendo' end,
  'files',(select coalesce(jsonb_agg(a->>'name' order by s2.n),'[]'::jsonb) from jsonb_array_elements_text(c.selected_assets) with ordinality s2(id,n) join jsonb_array_elements(c.assets) a on a->>'id'=s2.id));
 insert into public.central_social_feedback_outbox(event_id,card_id,channel,destination,payload,status,error) values
 (new.id,c.id,'clickup',task,snapshot,case when task is null then 'blocked' else 'pending' end,case when task is null then 'missing_destination' end),
 (new.id,c.id,'whatsapp',destino,snapshot,case when destino is null then 'blocked' else 'pending' end,case when destino is null then 'missing_destination' end);
 return new;
end; $$;

insert into public.central_social_feedback_groups(id,author,label,jid,enabled)
values('social','Social Media','SOCIAL MEDIA | SVI','120363431737365497@g.us',true)
on conflict(id) do update set label=excluded.label,jid=excluded.jid,enabled=excluded.enabled;

commit;
