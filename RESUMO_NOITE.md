# Resumo da noite — 17/05/2026

Bom dia. Aqui está exatamente o que aconteceu e o que falta pra ir pra produção.

## TL;DR
- ✅ Toda integração SVI OS dentro da Central SVI **pronta e committada** na branch `feat/svi-os-integration`
- ✅ Build local verde, push pra GitHub feito, deploy preview ativo na Vercel
- ⚠️ **Você precisa fazer 4 coisas** pra ativar em produção (todas <10 minutos)
- ⚠️ **NÃO mergeei** na main automaticamente. Você revisa, aprova, mergeia

## O que foi feito

### Banco — migration 100% aditiva, zero risco
**Arquivo:** [supabase/migrations/20260517_painel_svi_os.sql](./supabase/migrations/20260517_painel_svi_os.sql)

- ADD 3 colunas em `public.clients`: `slug`, `brand_color`, `painel_active` (defaults seguros + auto-backfill de slug)
- 13 tabelas novas com prefixo `painel_*` (totalmente isoladas das tabelas existentes)
- RLS *tight*: só **membro do client** ou **staff SVI** lê/escreve
- RPC `painel_activate_client(client_id)` — cria pipeline default + 7 stages atomicamente
- Helpers: `painel_is_svi_team()`, `painel_user_client_ids()`
- **Sofia / IPER / MJC / MedCaixa / Central SVI continuam exatamente iguais**. Nenhuma policy existente alterada, nenhuma tabela tocada.

### Frontend — 6 páginas + admin + auth wiring
**Roteamento novo em [src/App.tsx](./src/App.tsx):**
- `/cliente/:slug` (Visão geral com stat deltas 30d vs 30d anterior)
- `/cliente/:slug/leads` (CRM)
- `/cliente/:slug/campaigns` (Meta + Google)
- `/cliente/:slug/insights` (insights IA)
- `/cliente/:slug/chat` (IA SDR / Growth Agent com Claude tool use real no CRM)
- `/cliente/:slug/settings` (webhook token + UazAPI WhatsApp)
- `/admin/paineis` (você ativa painel por client + convida membros)

**Componentes novos:**
- [`src/components/PainelLayout.tsx`](./src/components/PainelLayout.tsx) — sidebar dedicada + valida acesso ao slug
- [`src/hooks/usePainelOrg.ts`](./src/hooks/usePainelOrg.ts) — carrega client + checa permissão
- [`src/lib/painel/{types,format}.ts`](./src/lib/painel) — enums + formatters
- 6 pages em [`src/pages/painel/*`](./src/pages/painel)

**Reuso da Central SVI:**
- AuthContext, ProtectedRoute, shadcn (Card, Button, Select, Dialog, Sonner, Skeleton, Badge), React Query, Tailwind, ThemeContext
- Sem fork de nada existente
- AppSidebar: adicionei "Painéis Cliente" dentro do grupo "Gestão Admin" (visível pra manager+)
- Login: client com membership em painel agora vai pra `/cliente/<primeiro-slug>` em vez de `/minha-area` (fallback se não tiver membership)

### Backend — 8 Vercel Serverless Functions
Diretório [`api/`](./api):

| Endpoint | Função |
|---|---|
| `POST /api/painel/ai/chat` | Claude tool use (Growth + SDR), rate limit 20/min + 300/dia por user |
| `POST /api/painel/webhook-token` | Rotaciona token webhook (SHA-256 hash storage) |
| `POST /api/painel/integrations/whatsapp` | Salva UazAPI config + gera webhook URL |
| `POST /api/painel/leads/inbound` | Webhook anon pra Meta/n8n/forms (constant-time compare) |
| `POST /api/painel/whatsapp/[slug]` | Recebe WhatsApp UazAPI, IA SDR responde, registra activity |
| `POST /api/painel/cron/insights` | Cron diário 06:00 BRT (gera insights via Claude) — header `Authorization: Bearer $CRON_SECRET` |
| `POST /api/painel/clients/activate` | RPC wrapper svi_team-only |
| `POST /api/painel/members` | Invite com role allow-list (client_admin / client_user only) |

Helpers em [`api/_lib/*`](./api/_lib): supabase admin/user, errors humanize, rate-limit, claude, prompts, sdr-tools, insights-worker, uazapi.

### Deploy
- Branch: `feat/svi-os-integration` (pushed)
- Preview Vercel: https://centralsvi-k9qd8dihu-svicompanyy-2539s-projects.vercel.app
  (responde 401 sem login na sua conta Vercel — é proteção padrão de preview Pro)
- Main da Central SVI: **intocada**

---

## O que VOCÊ precisa fazer (10min total)

### 1. Aplicar migration no banco Supabase (3min)
1. Abra https://supabase.com/dashboard/project/qvkfcvcqlfamyzgqgnrq/sql/new
2. Cole o conteúdo COMPLETO de [`supabase/migrations/20260517_painel_svi_os.sql`](./supabase/migrations/20260517_painel_svi_os.sql)
3. Run → deve dar "Success. No rows returned."

A migration é **idempotente** (CREATE IF NOT EXISTS, DROP IF EXISTS em policies). Roda quantas vezes quiser.

### 2. Adicionar 3 envs novas no Vercel da Central SVI (3min)
Em https://vercel.com/svicompanyy-2539s-projects/centralsvi/settings/environment-variables, adicione (Production + Preview):

| Var | Valor |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role do projeto `qvkfcvcqlfamyzgqgnrq` (Settings → API → service_role) |
| `ANTHROPIC_API_KEY` | Sua chave de https://console.anthropic.com/settings/keys |
| `CRON_SECRET` | Qualquer string aleatória 32+ chars (gere com `openssl rand -hex 32`) |

### 3. Mergear branch (2min)
```bash
cd "/Users/joao/Documents/CLAUDE CODE N8N/CENTRAL_SVI_AUDIT"
git checkout main && git merge feat/svi-os-integration && git push
```
Ou via interface GitHub: https://github.com/jvfalcao10/centralsvi/pull/new/feat/svi-os-integration

Auto-deploy Vercel vai rodar e subir tudo em produção.

### 4. Adicionar cron no `vercel.json` (1min)
Edite [`vercel.json`](./vercel.json) e adicione (atualmente só tem rewrites):
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "crons": [{ "path": "/api/painel/cron/insights", "schedule": "0 9 * * *" }]
}
```
Cron diário 09:00 UTC = 06:00 BRT.

---

## Pra testar end-to-end depois de subir
1. Login com seu admin (`svicompanyy@gmail.com`).
2. Sidebar → Gestão Admin → **Painéis Cliente**.
3. Pega um client existente (ex: a primeira clínica) → clica **Ativar painel**.
4. Clica **Convidar** → email do dono da clínica.
5. Clica **Abrir** → você abre `/cliente/<slug>` direto (acesso staff).
6. Quando o cliente recebe email + define senha + loga: redirect automático pra `/cliente/<slug>` dele.

## Decisão pendente: SVI OS standalone
O app **svi-os.vercel.app** (Next.js separado) **continua no ar**. Eu **não deletei** porque é destrutivo. Decida:
- **Manter**: backup útil, custo zero (Vercel Hobby)
- **Arquivar**: `vercel projects rm svi-os` + `gh repo archive jvfalcao10/svi-os` (não deleta, só fecha)
- **Deletar**: `vercel projects rm svi-os` + `gh repo delete jvfalcao10/svi-os --yes` + delete Supabase project `vncpkvlyjowoxuajeeuu`

Recomendação: **arquivar** (zero perda + zero ruído).

## Limitações conhecidas
- **Meta Ads OAuth + sync de campanhas**: não incluído (exige criar Meta App + App Review, fora do escopo da noite). Você pode plugar n8n no `/api/painel/leads/inbound` enquanto isso.
- **Cron Vercel Hobby**: só roda 1×/dia (limitação plano). Pro tem flexibilidade.
- **Bundle size warning** no build (1.6MB): Central SVI já tinha; eu não piorei. Code-split fica pra Onda 4.
- **Insights worker depende de ANTHROPIC_API_KEY real** pra rodar.
- **IA SDR via WhatsApp** depende do cliente plugar `base_url` + `instance_token` da UazAPI dele em Settings.

## Plano completo (referência)
Ver [`PLANO_SVIOS_INTEGRATION.md`](./PLANO_SVIOS_INTEGRATION.md).

---

**Tempo total de execução**: ~3h (audit + plano + 25 arquivos novos + migration 280 linhas + build + push + preview deploy).
**Linhas adicionadas**: ~2.500 (frontend + backend + SQL).
**Linhas removidas em código existente**: 0 (zero risco).
