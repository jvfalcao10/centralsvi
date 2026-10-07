begin;

-- Link de aprovação curto e com o nome do cliente.
--
-- O link que vai pro WhatsApp tinha 114 caracteres, com 64 de código, e não
-- dizia de quem era. Agora cada cliente ganha um apelido no endereço, e o
-- código encolhe para 12 caracteres num alfabeto sem letras que se confundem.
--
-- O código antigo continua valendo: a validação é por hash, não por formato,
-- então o link que já está com um cliente não quebra.
alter table public.central_social_client_links
 add column if not exists slug text;

create unique index if not exists central_social_client_links_slug
 on public.central_social_client_links(slug) where slug is not null;

comment on column public.central_social_client_links.slug is 'Apelido do cliente no endereço de aprovação, por exemplo dra-esia-lopes.';

-- Grava o apelido sem tocar no token: trocar o endereço não pode invalidar um
-- link que o cliente já tem na mão.
create or replace function public.central_social_client_slug(p_client text,p_slug text)
returns text language plpgsql security invoker set search_path='' as $$
declare existente text; tentativa text:=p_slug; n integer:=1;
begin
 select slug into existente from public.central_social_client_links where client=p_client;
 if existente is not null then return existente; end if;
 -- Dois clientes de nome parecido não podem disputar o mesmo endereço.
 while exists(select 1 from public.central_social_client_links where slug=tentativa) loop
  n:=n+1; tentativa:=p_slug||'-'||n;
  if n>50 then raise exception 'slug_indisponivel'; end if;
 end loop;
 update public.central_social_client_links set slug=tentativa where client=p_client;
 return tentativa;
end; $$;
revoke all on function public.central_social_client_slug(text,text) from public,anon,authenticated;
grant execute on function public.central_social_client_slug(text,text) to service_role;

commit;
