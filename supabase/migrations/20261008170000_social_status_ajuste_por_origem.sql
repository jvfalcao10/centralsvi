begin;

-- O status no ClickUp diz de onde veio o ajuste.
--
-- Eu estava mandando tudo para "fazendo". Perde informação: a lista tem o
-- status "alteração do cliente" justamente para separar o retrabalho que o
-- cliente pediu daquele que a casa pediu, e quem olha a fila precisa saber a
-- diferença.
--
-- A origem sai sozinha: resposta vinda do link ou do grupo é do cliente, e peça
-- que estava em "aguardando" e voltou para ajustes também, porque ela estava na
-- mão dele. Ajuste pedido numa peça que ainda estava em conferência é da casa.
create or replace function public.central_social_feedback_enqueue() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; r public.central_social_feedback_routes; g public.central_social_feedback_groups;
 task text; snapshot jsonb; ajuste boolean; do_cliente boolean;
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
 snapshot:=jsonb_build_object('client',c.client,'title',c.title,'revision',new.revision,'actor',new.actor,
  'action',case when ajuste then 'ajustes' else new.action end,
  'comment',case when new.action='cliente_aprovar' then '' else coalesce(new.details->>'note',coalesce(c.note,'')) end,
  'created_at',new.created_at,'task_id',task,'group_label',g.label,
  -- Prazo e status só mudam quando há retrabalho; aprovação do cliente não mexe
  -- na tarefa. O status carrega a origem do pedido.
  'retomar_tarefa',(ajuste or new.action in ('cliente_ajustes','cliente_reprovar')),
  'status_tarefa',case when do_cliente then 'alteração do cliente' else 'fazendo' end,
  'files',(select coalesce(jsonb_agg(a->>'name' order by s.n),'[]'::jsonb) from jsonb_array_elements_text(c.selected_assets) with ordinality s(id,n) join jsonb_array_elements(c.assets) a on a->>'id'=s.id));
 insert into public.central_social_feedback_outbox(event_id,card_id,channel,destination,payload,status,error) values
 (new.id,c.id,'clickup',task,snapshot,case when task is null then 'blocked' else 'pending' end,case when task is null then 'missing_destination' end),
 (new.id,c.id,'whatsapp',g.jid,snapshot,case when g.jid is null then 'blocked' else 'pending' end,case when g.jid is null then 'missing_destination' end);
 return new;
end; $$;

commit;
