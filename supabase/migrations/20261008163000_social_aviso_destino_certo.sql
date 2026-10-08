begin;

-- Dois defeitos na mesma função, achados em produção em 08/10.
--
-- 1. O ENVIO PELA SOFIA NÃO SAÍA. A fila tem índice único por (evento, canal).
--    Ao incluir `enviar_cliente` aqui, o gatilho já criava a linha de WhatsApp
--    apontando para o grupo do RESPONSÁVEL, e a linha que o código criava em
--    seguida, apontando para o grupo do CLIENTE, era recusada por duplicidade.
--    O destino certo nesse caso é o cliente, e quem sabe qual é o grupo é o
--    código, não esta função. Então `enviar_cliente` sai daqui.
--
-- 2. AJUSTE PELO SELETOR NÃO AVISAVA NINGUÉM. Mover a peça para Ajustes pelo
--    seletor de etapa registra a ação `mover`, não `ajustes`, então o designer
--    não era avisado e a tarefa no ClickUp continuava em "com o cliente"
--    enquanto a Central já mostrava "ajustes". Foi o que aconteceu com a peça
--    da Norte Capital. Agora mover para Ajustes vale como pedido de ajuste.
create or replace function public.central_social_feedback_enqueue() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.central_social_cards; r public.central_social_feedback_routes; g public.central_social_feedback_groups;
 task text; snapshot jsonb; ajuste boolean;
begin
 ajuste := new.action='ajustes' or (new.action='mover' and new.details->>'to'='ajustes');
 if new.action not in ('cliente_aprovar','cliente_ajustes','cliente_reprovar') and not ajuste then return new; end if;
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
  -- Prazo e status da tarefa só mudam no pedido de ajuste: é o gesto de
  -- devolver a peça para a bancada e botar no dia.
  'retomar_tarefa',ajuste,
  'files',(select coalesce(jsonb_agg(a->>'name' order by s.n),'[]'::jsonb) from jsonb_array_elements_text(c.selected_assets) with ordinality s(id,n) join jsonb_array_elements(c.assets) a on a->>'id'=s.id));
 insert into public.central_social_feedback_outbox(event_id,card_id,channel,destination,payload,status,error) values
 (new.id,c.id,'clickup',task,snapshot,case when task is null then 'blocked' else 'pending' end,case when task is null then 'missing_destination' end),
 (new.id,c.id,'whatsapp',g.jid,snapshot,case when g.jid is null then 'blocked' else 'pending' end,case when g.jid is null then 'missing_destination' end);
 return new;
end; $$;

commit;
