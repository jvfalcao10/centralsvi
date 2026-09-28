-- Each card retains its version guard and audit event. Failed cards do not block valid ones.
begin;
create function public.central_social_move_many(p_moves jsonb,p_actor text,p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $function$
declare item jsonb; saved jsonb; result jsonb:='[]';
begin
 if p_actor_id is null or nullif(trim(p_actor),'') is null then raise exception 'staff_required';end if;
 if jsonb_typeof(p_moves) is distinct from 'array' then raise exception 'invalid_batch';end if;
 if jsonb_array_length(p_moves) not between 1 and 250 then raise exception 'invalid_batch';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_moves))<>jsonb_array_length(p_moves) then raise exception 'duplicate_card';end if;
 for item in select value from jsonb_array_elements(p_moves) loop
  begin
   if item->'patch'->>'stage'='aguardando' then
    saved:=public.central_social_request_link(item->>'id',(item->>'version')::integer,item->'patch',item->>'ciphertext',p_actor,p_actor_id);
   else
    saved:=public.central_social_apply(item->>'id',(item->>'version')::integer,item->'patch','mover',p_actor,p_actor_id);
   end if;
   result:=result||jsonb_build_array(jsonb_build_object('id',item->>'id','ok',true,'card',saved-'assets'-'source_description'-'token_hash'-'token_expires_at'));
  exception when others then
   result:=result||jsonb_build_array(jsonb_build_object('id',item->>'id','ok',false,'error',sqlerrm));
  end;
 end loop;
 return result;
end;$function$;
revoke all on function public.central_social_move_many(jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.central_social_move_many(jsonb,text,uuid) to service_role;
commit;
