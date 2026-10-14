-- Lista dos clientes com radar ligado, pra tela do Radar (14/10/2026).
-- A view clientes_operacional não inclui o papel social, e a Rayana via o
-- radar sem nome de cliente. Devolve só id, nome e segmento, nada financeiro.
create or replace function public.radar_clientes()
returns table (id uuid, name text, segment text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.segment
    from clients c
   where c.radar_ativo
     and c.status = 'ativo'
     and exists (
       select 1 from user_roles ur
        where ur.user_id = auth.uid()
          and ur.role::text in ('admin','manager','seller','executor','traffic','social')
     )
   order by c.name
$$;

revoke all on function public.radar_clientes() from public;
revoke all on function public.radar_clientes() from anon;
revoke all on function public.radar_clientes() from authenticated;
grant execute on function public.radar_clientes() to authenticated;
