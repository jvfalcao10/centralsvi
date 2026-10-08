begin;

-- Pedido de ajuste da equipe avisa quem vai executar.
--
-- O aviso só saía para resposta do CLIENTE. Quando alguém da casa pedia ajuste,
-- a peça mudava de etapa no quadro e ninguém ficava sabendo: o designer ou o
-- editor só descobria se olhasse o quadro por conta própria.
--
-- O destino já era deduzido sozinho: com rota configurada usa ela, senão pega a
-- tarefa pelo link de origem da peça e o grupo pelo autor da entrega. É por isso
-- que basta incluir a ação na lista.
create or replace function public.central_social_feedback_enqueue() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; r public.central_social_feedback_routes; g public.central_social_feedback_groups;
 task text; snapshot jsonb;
begin
 if new.action not in ('cliente_aprovar','cliente_ajustes','cliente_reprovar','ajustes','enviar_cliente') then return new; end if;
 select * into c from public.central_social_cards where id=new.card_id;
 select * into r from public.central_social_feedback_routes where card_id=c.id;
 if r.card_id is not null then
  task:=r.task_id; select * into g from public.central_social_feedback_groups where id=r.group_id and enabled;
 else
  task:=substring(c.source_url from '^https://app[.]clickup[.]com/t/([A-Za-z0-9]+)$');
  select * into g from public.central_social_feedback_groups where author=c.author and enabled;
 end if;
 snapshot:=jsonb_build_object('client',c.client,'title',c.title,'revision',new.revision,'actor',new.actor,'action',new.action,
  'comment',case when new.action='cliente_aprovar' then '' else coalesce(new.details->>'note','') end,
  'created_at',new.created_at,'task_id',task,'group_label',g.label,
  -- O prazo e o status da tarefa só mudam no pedido de ajuste da equipe: é o
  -- gesto de devolver a peça para a bancada e botar no dia.
  'retomar_tarefa',(new.action='ajustes'),
  'files',(select coalesce(jsonb_agg(a->>'name' order by s.n),'[]'::jsonb) from jsonb_array_elements_text(c.selected_assets) with ordinality s(id,n) join jsonb_array_elements(c.assets) a on a->>'id'=s.id));
 insert into public.central_social_feedback_outbox(event_id,card_id,channel,destination,payload,status,error) values
 (new.id,c.id,'clickup',task,snapshot,case when task is null then 'blocked' else 'pending' end,case when task is null then 'missing_destination' end),
 (new.id,c.id,'whatsapp',g.jid,snapshot,case when g.jid is null then 'blocked' else 'pending' end,case when g.jid is null then 'missing_destination' end);
 return new;
end; $$;

commit;
