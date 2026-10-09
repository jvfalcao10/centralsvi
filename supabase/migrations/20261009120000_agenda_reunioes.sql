-- Agendamento de reunião pelo site, estilo Calendly.
--
-- A disponibilidade real mora no Google Agenda do João. Esta tabela guarda
-- quem marcou, o que marcou e o evento criado lá, para a página conseguir
-- mostrar, confirmar e cancelar sem depender de uma segunda consulta.
--
-- Horário é SEMPRE gravado em UTC (timestamptz) e exibido em Brasília.

create table if not exists public.central_agenda_reunioes (
 id uuid primary key default gen_random_uuid(),
 -- Token do link de confirmação e cancelamento. Guardado em hash: quem tem o
 -- link cancela, e um vazamento do banco não entrega o poder de cancelar.
 token_hash text not null unique,
 nome text not null,
 email text not null,
 whatsapp text not null,
 assunto text not null default '',
 inicio timestamptz not null,
 fim timestamptz not null,
 status text not null default 'confirmada' check (status in ('confirmada','cancelada')),
 google_event_id text,
 meet_url text,
 cancelada_em timestamptz,
 cancelada_por text,
 criado_em timestamptz not null default now(),
 origem text not null default 'site'
);

-- Duas pessoas clicando no mesmo horário ao mesmo tempo é o caso que quebra
-- agenda. O índice resolve no banco, que é o único lugar onde dá para resolver.
create unique index if not exists central_agenda_horario_unico
 on public.central_agenda_reunioes (inicio) where status = 'confirmada';

create index if not exists central_agenda_proximas
 on public.central_agenda_reunioes (inicio) where status = 'confirmada';

-- Tabela nova nasce aberta: fechar e nomear quem pode.
alter table public.central_agenda_reunioes enable row level security;
revoke all on table public.central_agenda_reunioes from public, anon, authenticated;
grant all on table public.central_agenda_reunioes to service_role;

-- Marca a reunião e recusa se o horário já tiver dono. Devolve nulo em vez de
-- erro para a página poder dizer "esse horário acabou de ser tomado".
create or replace function public.central_agenda_marcar(
 p_token_hash text, p_nome text, p_email text, p_whatsapp text, p_assunto text,
 p_inicio timestamptz, p_fim timestamptz)
returns public.central_agenda_reunioes
language plpgsql
set search_path to ''
as $$
declare r public.central_agenda_reunioes;
begin
 insert into public.central_agenda_reunioes (token_hash,nome,email,whatsapp,assunto,inicio,fim)
 values (p_token_hash,p_nome,p_email,p_whatsapp,p_assunto,p_inicio,p_fim)
 on conflict do nothing
 returning * into r;
 return r;
end; $$;

-- Guarda o evento do Google depois de criado. Separado do insert porque a
-- reserva do horário tem de existir ANTES de falar com o Google: sem isso,
-- duas pessoas passam pela verificação ao mesmo tempo.
create or replace function public.central_agenda_anotar_evento(
 p_id uuid, p_event_id text, p_meet_url text)
returns boolean
language plpgsql
set search_path to ''
as $$
begin
 update public.central_agenda_reunioes
 set google_event_id=p_event_id, meet_url=p_meet_url
 where id=p_id and status='confirmada';
 return found;
end; $$;

create or replace function public.central_agenda_cancelar(p_token_hash text, p_por text)
returns public.central_agenda_reunioes
language plpgsql
set search_path to ''
as $$
declare r public.central_agenda_reunioes;
begin
 update public.central_agenda_reunioes
 set status='cancelada', cancelada_em=now(), cancelada_por=left(coalesce(p_por,''),60)
 where token_hash=p_token_hash and status='confirmada'
 returning * into r;
 return r;
end; $$;

revoke all on function public.central_agenda_marcar(text,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.central_agenda_anotar_evento(uuid,text,text) from public, anon, authenticated;
revoke all on function public.central_agenda_cancelar(text,text) from public, anon, authenticated;
grant execute on function public.central_agenda_marcar(text,text,text,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.central_agenda_anotar_evento(uuid,text,text) to service_role;
grant execute on function public.central_agenda_cancelar(text,text) to service_role;
