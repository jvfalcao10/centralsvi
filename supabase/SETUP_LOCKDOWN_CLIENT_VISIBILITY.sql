-- ============================================================================
-- CENTRAL SVI — Lockdown de visibilidade para clientes externos
-- ============================================================================
-- Aplicado em qvkfcvcqlfamyzgqgnrq em 2026-04-18
--
-- Antes deste lockdown, um cliente externo (role='client') podia ler:
--   - interactions: TODAS as notas internas de qualquer cliente
--   - activity_log: histórico completo de ações da equipe SVI
--   - invitations: emails de convidados (futuros funcionários)
--   - profiles: nomes/avatares de toda equipe
-- E NÃO conseguia ler o próprio registro em clients (bug funcional).
--
-- Este arquivo corrige todas essas superfícies.
-- ============================================================================

-- 1. clients: cliente agora vê o próprio registro (precisa para /minha-area)
DROP POLICY IF EXISTS "Clients by role" ON public.clients;
DROP POLICY IF EXISTS "Clients access" ON public.clients;
CREATE POLICY "Clients access" ON public.clients
  FOR ALL USING (
    public.has_min_role('manager')
    OR owner_id = auth.uid()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.client_id = clients.id AND d.responsavel_id = auth.uid()
    )
  );

-- 2. interactions: notas internas — apenas staff (executor+)
DROP POLICY IF EXISTS "Auth users manage interactions" ON public.interactions;
DROP POLICY IF EXISTS "Interactions by role" ON public.interactions;
DROP POLICY IF EXISTS "Interactions staff only" ON public.interactions;
CREATE POLICY "Interactions staff only" ON public.interactions
  FOR ALL USING (public.has_min_role('executor'));

-- 3. activity_log: manager+ vê tudo, demais só o próprio
DROP POLICY IF EXISTS "Auth users view activity" ON public.activity_log;
DROP POLICY IF EXISTS "Activity log by role" ON public.activity_log;
DROP POLICY IF EXISTS "Activity log insert" ON public.activity_log;
DROP POLICY IF EXISTS "Activity log staff all" ON public.activity_log;
DROP POLICY IF EXISTS "Activity log own" ON public.activity_log;
CREATE POLICY "Activity log staff all" ON public.activity_log
  FOR SELECT USING (public.has_min_role('manager'));
CREATE POLICY "Activity log own" ON public.activity_log
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Activity log insert" ON public.activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. invitations: só staff lê. Trigger apply_invitation é SECURITY DEFINER.
DROP POLICY IF EXISTS "invitations_read_all" ON public.invitations;
DROP POLICY IF EXISTS "Anyone can read invitations by email" ON public.invitations;
DROP POLICY IF EXISTS "Invitations staff read" ON public.invitations;
CREATE POLICY "Invitations staff read" ON public.invitations
  FOR SELECT USING (public.has_min_role('manager'));

-- 5. profiles: staff vê todos, cliente só o próprio
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles staff all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles own" ON public.profiles;
CREATE POLICY "Profiles staff all" ON public.profiles
  FOR SELECT USING (public.has_min_role('executor'));
CREATE POLICY "Profiles own" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());
