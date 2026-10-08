begin;

-- Quem pediu o link entra no histórico pelo nome certo.
--
-- A função gravava a ação fixa 'solicitar'. Quando o João clicou em "mandar
-- para o cliente", o evento saiu como "gerou link de aprovação" e o código,
-- que procurava o evento 'enviar_cliente' recém-criado para pôr o aviso na
-- fila, não achava nada: a peça ia para Aguardando cliente e a Sofia não
-- mandava. O botão parecia não fazer nada.
--
-- A versão antiga é removida para não ficarem duas com o mesmo nome; o
-- parâmetro novo tem valor padrão, então quem chama sem ele não muda.
drop function if exists public.central_social_request_link(text,integer,jsonb,text,text,uuid);

CREATE OR REPLACE FUNCTION public.central_social_request_link(p_id text, p_expected integer, p_patch jsonb, p_ciphertext text, p_actor text, p_actor_id uuid DEFAULT NULL::uuid, p_action text DEFAULT 'solicitar')
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if p_patch->>'stage' is distinct from 'aguardando' or p_patch->>'token_hash' is null or length(p_ciphertext)<40 then raise exception 'invalid_approval_link'; end if;
 result:=public.central_social_apply(p_id,p_expected,p_patch,coalesce(nullif(p_action,''),'solicitar'),p_actor,p_actor_id);
 insert into public.central_social_approval_links(card_id,token_hash,ciphertext) values(p_id,p_patch->>'token_hash',p_ciphertext)
 on conflict(card_id) do update set token_hash=excluded.token_hash,ciphertext=excluded.ciphertext,updated_at=now();
 return result;
end; $function$;
revoke all on function public.central_social_request_link(text,integer,jsonb,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.central_social_request_link(text,integer,jsonb,text,text,uuid,text) to service_role;

commit;
