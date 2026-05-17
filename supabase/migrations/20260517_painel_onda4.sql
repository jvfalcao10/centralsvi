-- ============================================================================
-- SVI OS — Onda 4 (Painel Cliente Foda)
-- Features: notificações in-app, aprovação de posts, onboarding,
--           threads cliente↔SVI, post comments, financeiro views
-- Idempotente. Aditivo. Zero risco.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. notifications: adicionar client_id pra scoping (já existe a tabela)
-- ----------------------------------------------------------------------------

alter table public.notifications add column if not exists client_id uuid references public.clients(id) on delete cascade;
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read) where read = false;
create index if not exists idx_notifications_client on public.notifications(client_id);

-- ----------------------------------------------------------------------------
-- 2. painel_onboarding_steps — checklist primeiro acesso por client
-- ----------------------------------------------------------------------------

create table if not exists public.painel_onboarding_steps (
  client_id uuid not null references public.clients(id) on delete cascade,
  step text not null,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  primary key (client_id, step)
);
alter table public.painel_onboarding_steps enable row level security;
drop policy if exists painel_onb_read on public.painel_onboarding_steps;
create policy painel_onb_read on public.painel_onboarding_steps for select
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());
drop policy if exists painel_onb_write on public.painel_onboarding_steps;
create policy painel_onb_write on public.painel_onboarding_steps for all
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team())
  with check (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());

-- ----------------------------------------------------------------------------
-- 3. painel_post_approvals — aprovação de posts pelo cliente
--    Referencia content_posts (tabela já existe na Central SVI prod)
-- ----------------------------------------------------------------------------

create table if not exists public.painel_post_approvals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'aguardando' check (status in ('aguardando','aprovado','mudancas_pedidas')),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id)
);
create index if not exists idx_painel_approvals_client_status on public.painel_post_approvals(client_id, status);
alter table public.painel_post_approvals enable row level security;
drop policy if exists painel_approvals_read on public.painel_post_approvals;
create policy painel_approvals_read on public.painel_post_approvals for select
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());
drop policy if exists painel_approvals_write on public.painel_post_approvals;
create policy painel_approvals_write on public.painel_post_approvals for all
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team())
  with check (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());

create trigger trg_painel_approvals_upd before update on public.painel_post_approvals
  for each row execute function public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. painel_post_comments — thread de comentários por post (cliente + SVI)
-- ----------------------------------------------------------------------------

create table if not exists public.painel_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null default 'user' check (actor_kind in ('user','svi_team','client','system')),
  content text not null,
  kind text not null default 'comment' check (kind in ('comment','approval','change_request')),
  created_at timestamptz not null default now()
);
create index if not exists idx_painel_comments_post on public.painel_post_comments(post_id, created_at desc);
create index if not exists idx_painel_comments_client on public.painel_post_comments(client_id, created_at desc);
alter table public.painel_post_comments enable row level security;
drop policy if exists painel_comments_read on public.painel_post_comments;
create policy painel_comments_read on public.painel_post_comments for select
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());
drop policy if exists painel_comments_write on public.painel_post_comments;
create policy painel_comments_write on public.painel_post_comments for all
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team())
  with check (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());

-- ----------------------------------------------------------------------------
-- 5. painel_threads + painel_thread_messages — chat cliente↔SVI (humano)
-- ----------------------------------------------------------------------------

create table if not exists public.painel_threads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null default 'Conversa com a SVI',
  last_message_at timestamptz,
  last_message_preview text,
  unread_for_client int not null default 0,
  unread_for_svi int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_painel_threads_client on public.painel_threads(client_id, last_message_at desc);

create table if not exists public.painel_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.painel_threads(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('client','svi_team')),
  content text not null,
  attachments jsonb,
  read_by_other boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_painel_thread_msgs on public.painel_thread_messages(thread_id, created_at);

alter table public.painel_threads enable row level security;
alter table public.painel_thread_messages enable row level security;

drop policy if exists painel_threads_read on public.painel_threads;
create policy painel_threads_read on public.painel_threads for select
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());
drop policy if exists painel_threads_write on public.painel_threads;
create policy painel_threads_write on public.painel_threads for all
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team())
  with check (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());

drop policy if exists painel_thread_msgs_read on public.painel_thread_messages;
create policy painel_thread_msgs_read on public.painel_thread_messages for select
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());
drop policy if exists painel_thread_msgs_write on public.painel_thread_messages;
create policy painel_thread_msgs_write on public.painel_thread_messages for all
  using (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team())
  with check (client_id in (select public.painel_user_client_ids()) or public.painel_is_svi_team());

-- Trigger: atualiza last_message_* na thread quando mensagem é inserida
create or replace function public.painel_update_thread_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.painel_threads
    set last_message_at = NEW.created_at,
        last_message_preview = left(NEW.content, 140),
        unread_for_client = case when NEW.actor_kind = 'svi_team' then unread_for_client + 1 else unread_for_client end,
        unread_for_svi    = case when NEW.actor_kind = 'client'   then unread_for_svi    + 1 else unread_for_svi    end
    where id = NEW.thread_id;
  return NEW;
end $$;
drop trigger if exists trg_painel_thread_msg_ins on public.painel_thread_messages;
create trigger trg_painel_thread_msg_ins after insert on public.painel_thread_messages
  for each row execute function public.painel_update_thread_on_message();

-- ----------------------------------------------------------------------------
-- 6. Trigger: novo lead → notifications pros members
-- ----------------------------------------------------------------------------

create or replace function public.painel_notify_new_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  select slug into v_slug from public.clients where id = NEW.client_id;
  insert into public.notifications (user_id, client_id, title, message, type, link, read)
  select pm.user_id, NEW.client_id,
    'Novo lead: ' || NEW.full_name,
    coalesce(NEW.source, 'origem desconhecida') ||
      case when NEW.email is not null then ' · ' || NEW.email
           when NEW.phone is not null then ' · ' || NEW.phone
           else '' end,
    'info',
    '/cliente/' || v_slug || '/leads',
    false
  from public.painel_members pm where pm.client_id = NEW.client_id;
  return NEW;
end $$;
drop trigger if exists trg_painel_notify_new_lead on public.painel_leads;
create trigger trg_painel_notify_new_lead after insert on public.painel_leads
  for each row execute function public.painel_notify_new_lead();

-- ----------------------------------------------------------------------------
-- 7. Trigger: novo insight critical/high → notifications
-- ----------------------------------------------------------------------------

create or replace function public.painel_notify_new_insight()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  if NEW.severity not in ('high', 'critical') then return NEW; end if;
  select slug into v_slug from public.clients where id = NEW.client_id;
  insert into public.notifications (user_id, client_id, title, message, type, link, read)
  select pm.user_id, NEW.client_id,
    'Insight ' || NEW.severity || ': ' || NEW.title,
    left(NEW.body, 200),
    case when NEW.severity = 'critical' then 'error' else 'warning' end,
    '/cliente/' || v_slug || '/insights',
    false
  from public.painel_members pm where pm.client_id = NEW.client_id;
  return NEW;
end $$;
drop trigger if exists trg_painel_notify_insight on public.painel_insights;
create trigger trg_painel_notify_insight after insert on public.painel_insights
  for each row execute function public.painel_notify_new_insight();

-- ----------------------------------------------------------------------------
-- 8. Trigger: aprovação solicitada (status=aguardando) → notifications
-- ----------------------------------------------------------------------------

create or replace function public.painel_notify_approval_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  if NEW.status <> 'aguardando' then return NEW; end if;
  if (TG_OP = 'UPDATE' and OLD.status = 'aguardando') then return NEW; end if;
  select slug into v_slug from public.clients where id = NEW.client_id;
  insert into public.notifications (user_id, client_id, title, message, type, link, read)
  select pm.user_id, NEW.client_id,
    'Post aguardando sua aprovação',
    'Há um novo conteúdo pra você revisar.',
    'info',
    '/cliente/' || v_slug || '/aprovacoes',
    false
  from public.painel_members pm where pm.client_id = NEW.client_id;
  return NEW;
end $$;
drop trigger if exists trg_painel_notify_approval on public.painel_post_approvals;
create trigger trg_painel_notify_approval after insert or update on public.painel_post_approvals
  for each row execute function public.painel_notify_approval_request();

-- ----------------------------------------------------------------------------
-- 9. RPC marcar notificações como lidas
-- ----------------------------------------------------------------------------

create or replace function public.painel_mark_notifications_read(p_ids uuid[])
returns int language sql security definer set search_path = public as $$
  with updated as (
    update public.notifications
      set read = true
      where id = any(p_ids) and user_id = auth.uid()
      returning 1
  )
  select count(*)::int from updated;
$$;
grant execute on function public.painel_mark_notifications_read(uuid[]) to authenticated;

create or replace function public.painel_mark_all_notifications_read()
returns int language sql security definer set search_path = public as $$
  with updated as (
    update public.notifications
      set read = true
      where user_id = auth.uid() and read = false
      returning 1
  )
  select count(*)::int from updated;
$$;
grant execute on function public.painel_mark_all_notifications_read() to authenticated;
