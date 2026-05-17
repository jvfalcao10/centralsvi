-- ============================================================================
-- SVI OS — Inbox WhatsApp (Kommo-like)
-- Estende painel_threads existente pra suportar dois tipos:
--   - svi_chat: conversa cliente <-> equipe SVI (já existia)
--   - whatsapp_lead: conversa lead <-> equipe SVI via WhatsApp
-- Aditivo + idempotente.
-- ============================================================================

-- 1. Adicionar kind + lead_id em painel_threads
alter table public.painel_threads add column if not exists kind text not null default 'svi_chat'
  check (kind in ('svi_chat', 'whatsapp_lead'));
alter table public.painel_threads add column if not exists lead_id uuid references public.painel_leads(id) on delete cascade;
alter table public.painel_threads add column if not exists external_phone text;

create index if not exists idx_painel_threads_kind on public.painel_threads(client_id, kind, last_message_at desc);
create index if not exists idx_painel_threads_lead on public.painel_threads(lead_id);

-- Garantir 1 thread WhatsApp por (client, phone)
create unique index if not exists uq_painel_threads_wa_phone
  on public.painel_threads(client_id, external_phone)
  where kind = 'whatsapp_lead';

-- 2. Expandir actor_kind em messages pra suportar 'lead' (cliente final do cliente)
alter table public.painel_thread_messages drop constraint if exists painel_thread_messages_actor_kind_check;
alter table public.painel_thread_messages add constraint painel_thread_messages_actor_kind_check
  check (actor_kind in ('client', 'svi_team', 'lead'));

-- Direção pra mensagens WhatsApp (inbound vs outbound)
alter table public.painel_thread_messages add column if not exists direction text
  check (direction in ('inbound', 'outbound'));

-- 3. Atualizar trigger painel_update_thread_on_message pra contar leads também
create or replace function public.painel_update_thread_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.painel_threads
    set last_message_at = NEW.created_at,
        last_message_preview = left(NEW.content, 140),
        unread_for_client = case
          when NEW.actor_kind = 'svi_team' then unread_for_client + 1
          else unread_for_client end,
        unread_for_svi = case
          when NEW.actor_kind in ('client', 'lead') then unread_for_svi + 1
          else unread_for_svi end
    where id = NEW.thread_id;
  return NEW;
end $$;
