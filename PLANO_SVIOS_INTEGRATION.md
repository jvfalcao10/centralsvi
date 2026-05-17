# Plano: integração SVI OS dentro da Central SVI

**Branch:** `feat/svi-os-integration`
**Data:** 2026-05-17 (noite)
**Decisão:** opção **B1** confirmada — portar features SVI OS pra dentro da Central SVI (Vite SPA), sem mexer no app Next.js separado.

## Arquitetura escolhida

### Banco
- **Reusar `public.clients`** como "organização tenant" (cada client da SVI vira potencialmente uma org de painel)
- ADD colunas `slug`, `brand_color`, `painel_active` em `clients` (não destrutivo)
- **Schema separado `painel`** pra todas as tabelas SVI OS:
  - `painel.members` (junction profile↔client)
  - `painel.integrations`, `painel.campaigns`, `painel.campaign_metrics_daily`, `painel.creatives`
  - `painel.pipelines`, `painel.pipeline_stages`
  - `painel.leads`, `painel.lead_activities`
  - `painel.insights`, `painel.alerts`
  - `painel.ai_conversations`, `painel.ai_messages`
- RLS **tight** apenas em `painel.*` — Sofia/IPER/MJC/MedCaixa intactas
- Helper functions: `painel.is_member(client_id)`, `painel.is_svi_team()` que lê de `public.user_roles`

### Frontend
- Novo modo `painelAccessCheck` em `ProtectedRoute` que valida user∈painel.members do slug ou é staff (admin/manager)
- 6 páginas novas em `src/pages/painel/`:
  - `Dashboard.tsx` (stat deltas 30d vs prev 30d)
  - `Leads.tsx` (CRM)
  - `Campaigns.tsx`
  - `Insights.tsx`
  - `Chat.tsx` (Growth Agent + IA SDR)
  - `Settings.tsx` (webhook token + UazAPI integration)
- Wrapper `PainelLayout.tsx` que reusa shadcn da Central SVI + sidebar específica
- Hook `usePainelOrg(slug)` que valida acesso e carrega contexto
- Reusar AuthContext existente (sem fork)

### Backend (Vercel Serverless Functions, Node runtime)
Diretório `/api/painel/` com:
- `ai/chat.ts` — Claude + tool use (Growth + SDR agent)
- `webhook-token.ts` — rotaciona token webhook
- `integrations/whatsapp.ts` — salva UazAPI config
- `leads/inbound.ts` — webhook público pra Meta/n8n/forms
- `whatsapp/[slug].ts` — webhook UazAPI inbound
- `cron/insights.ts` — Vercel cron diário 06:00 BRT
- `clients/[slug]/seed.ts` — cria pipeline + stages default ao ativar

Arquivos compartilhados:
- `api/_lib/supabase.ts` — admin client
- `api/_lib/auth.ts` — extrai userId do JWT Bearer
- `api/_lib/errors.ts` — humanizeDbError + safeEqual + safeNextPath
- `api/_lib/rate-limit.ts` — bucket in-memory
- `api/_lib/ai/*` — claude.ts, system-prompts.ts, sdr-tools.ts, insights-worker.ts
- `api/_lib/integrations/uazapi.ts`

### Sidebar (AppSidebar)
Novo grupo "**Painéis Cliente**" pra staff (`minRole: 'manager'`) listando clients que têm `painel_active=true`. Cada item leva pra `/cliente/:slug`.

### Auth flow
- `client_admin` / `client_user` aprovados: `defaultRouteForRole` aponta pra `/cliente/<primeiro-slug-acessível>` (lookup em `painel.members`)
- Staff: acessa via sidebar
- Página `/cliente/:slug/*` valida acesso server-side via RLS no banco

## O que NÃO mexer (risco prod)
- Tabelas `clients`, `leads`, `deliveries`, `invoices`, `expenses`, `interactions`, `prospects`, `onboarding_tasks`, `activity_log`, `notifications`, `commercial_*` — apenas leitura ou ADD column.
- Tabelas Sofia (`sofia_chat_histories`, `sofia_skills`) — não tocar.
- Tabelas IPER, MJC, content_* — não tocar.
- `public.profiles`, `public.user_roles` — não tocar schema, só LEITURA.
- Auth flow atual (AuthContext) — não modificar comportamento staff.

## Deploy
- Branch `feat/svi-os-integration` (não main)
- Vercel preview URL gerado por push
- Migrations aplicadas no **mesmo projeto Supabase qvkfcvcqlfamyzgqgnrq** (Central SVI prod) mas **só schema `painel.*`** + colunas novas em `clients`
- Idempotente (CREATE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS)

## Estado pré-merge
Quando user aprovar de manhã:
1. Merge `feat/svi-os-integration` → `main`
2. Push → auto-deploy Vercel prod
3. Deletar SVI OS (`svi-os.vercel.app` + projeto Supabase `vncpkvlyjowoxuajeeuu`) OU manter como backup

## Limitações conhecidas
- **ANTHROPIC_API_KEY** precisa ser adicionada nas envs Vercel pra Central SVI (placeholder até user passar)
- **CRON_SECRET** idem
- IA SDR via WhatsApp precisa setup UazAPI manual por cliente (UI feita, mas user precisa criar instância na UazAPI)
- Meta Ads OAuth não incluído (precisa Meta App + App Review fora do escopo dessa sessão)
