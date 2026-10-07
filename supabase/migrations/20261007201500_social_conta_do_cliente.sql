begin;

-- Qual conta do Instagram pertence a cada cliente.
--
-- A Graph API não diz isso, e casar pelo nome falha em casos reais: a peça da
-- "VANESSA BACK" publica em @backesteticaa, nomes que não se parecem. Em vez de
-- chutar, a Central aprende: a conta escolhida na publicação fica gravada e nas
-- próximas já vem pronta.
create table if not exists public.central_social_client_accounts(
 client text primary key,
 account_id text not null,
 account_username text not null,
 actor text,
 updated_at timestamptz not null default now()
);
alter table public.central_social_client_accounts enable row level security;
revoke all on public.central_social_client_accounts from public,anon,authenticated;
grant select,insert,update on public.central_social_client_accounts to service_role;

comment on table public.central_social_client_accounts is 'Conta do Instagram de cada cliente, aprendida na publicação. Evita escolher de novo a cada peça.';

-- Guarda a escolha sem nunca decidir por ninguém: só registra o que a pessoa
-- confirmou na tela de publicar.
create or replace function public.central_social_client_account_set(p_client text,p_account_id text,p_username text,p_actor text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(trim(p_client),'')='' or p_client='Identificar cliente' or coalesce(trim(p_account_id),'')='' then return; end if;
 insert into public.central_social_client_accounts(client,account_id,account_username,actor)
 values(p_client,p_account_id,p_username,p_actor)
 on conflict(client) do update set account_id=excluded.account_id,account_username=excluded.account_username,actor=excluded.actor,updated_at=now();
end; $$;
revoke all on function public.central_social_client_account_set(text,text,text,text) from public,anon,authenticated;
grant execute on function public.central_social_client_account_set(text,text,text,text) to service_role;

-- Semeia com o que já aconteceu: quem já publicou não precisa escolher de novo.
insert into public.central_social_client_accounts(client,account_id,account_username,actor)
select distinct on (c.client) c.client,p.account_id,p.account_username,'histórico'
from public.central_social_publications p join public.central_social_cards c on c.id=p.card_id
where c.client<>'Identificar cliente' and p.account_id is not null
order by c.client,(p.status='published') desc,p.created_at desc
on conflict(client) do nothing;

commit;
