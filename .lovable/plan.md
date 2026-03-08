
## Audit + Polish Plan for the SVI Command Center

### What I found after reviewing every page

**Clients CRUD — it's all there and correct:**
- Create form: all 10 fields, validation, slider for health_score ✅
- Edit: pre-populates form from existing client ✅
- Delete: AlertDialog with "Sim, excluir" confirmation ✅
- Detail modal: 5 tabs (Info, Histórico, Entregas, Faturas, Notas) ✅
- Supabase calls: `.insert()`, `.update()`, `.delete()` all correct ✅

**Issues & gaps I found across the whole app:**

### 1. No `created_at` / `updated_at` on the `Client` type interface
`src/types/index.ts` `Client` interface is missing `created_at` and `updated_at` fields. The DB has them (used in sorting etc). Minor but causes TypeScript warnings.

### 2. Pipeline lead detail modal has no Edit/Delete
You can view lead info and move it, but can't edit any field or delete. Inconsistent with Clients page. Creates a dead-end UX when a lead has wrong info.

### 3. Deliveries page has no create/edit form
Only toggling complete/incomplete. No way to add new deliveries or update deadline/type. The "+" button is entirely missing.

### 4. Financial page uses hardcoded MRR/revenue data
`CASH_PROJECTION`, `MONTHLY_DRE`, and `mrr = 28700` are static constants. The real MRR from clients is fetched but then mixed with hardcoded values, making the numbers inconsistent and misleading.

### 5. AppHeader bell icon is non-functional
Has a red dot but clicking it does nothing. Users expect a notification panel. This is a professional polish gap.

### 6. Interactions tab in client detail shows no "Add Interaction" button
You can view history but can't log a new interaction (call, email, meeting) from inside the modal. This breaks the CS workflow.

### 7. No `perdido` stage in PIPELINE_STAGES config
Leads can be marked as "perdido" via the button, but `PIPELINE_STAGES` doesn't include it, so those leads disappear from the kanban visually — they go into a hidden column with no header.

### 8. Dashboard KPIs have hardcoded `conversionRate = '23.5'`
The conversion rate is fake. Could be derived from leads data (fechado/total ratio).

---

## Plan — What to implement

**Priority 1 — UX polish (makes the app fluid for daily use):**

1. **Fix `perdido` stage visibility in Pipeline** — add "Perdido" to `PIPELINE_STAGES` with a gray/red color so lost leads are visible and recoverable
2. **Add Edit + Delete to Pipeline lead detail modal** — same pattern as Clients, reuse the `EMPTY_FORM` logic, add `handleEditLead` + `handleDeleteLead` functions, AlertDialog for delete
3. **Add "Log Interaction" to client detail modal** — inside the History tab, add a small form (tipo select + descricao textarea + submit) that inserts into `interactions` table
4. **Make Dashboard conversion rate dynamic** — calculate from leads data: `fechado / total * 100`
5. **Add "+ Nova Entrega" to Deliveries page** — modal form with: client (select from DB), title, tipo (select), prazo (date), status (select). On submit inserts into `deliveries` table
6. **Wire up AppHeader bell icon** — dropdown showing: overdue invoices, at-risk clients (health_score < 50 OR status risco), late deliveries — fetched live

**Priority 2 — Data integrity:**

7. **Fix `Client` type interface** — add `created_at`, `updated_at` fields
8. **Fix Financial hardcoded MRR** — replace `mrr = 28700` with real sum from clients table, show "Carregando..." until loaded

---

## Implementation order

1. `src/types/index.ts` — add missing fields to `Client` + fix `perdido` in `PIPELINE_STAGES`
2. `src/pages/Pipeline.tsx` — add Edit/Delete to lead detail modal
3. `src/pages/Clients.tsx` — add "Log Interaction" inside History tab
4. `src/pages/Deliveries.tsx` — add "+ Nova Entrega" modal form
5. `src/pages/Dashboard.tsx` — fetch leads to compute real conversion rate
6. `src/pages/Financial.tsx` — replace hardcoded MRR with real DB sum from clients
7. `src/components/AppHeader.tsx` — notifications dropdown

No DB migrations needed — all tables already exist with the right columns.

### Technical notes
- Pipeline edit: reuse the same `EMPTY_FORM` state, add `editingLead` state similar to `editingClient` in Clients
- Lead delete: AlertDialog, `supabase.from('leads').delete().eq('id', ...)`
- Add interaction: `supabase.from('interactions').insert({ client_id, tipo, descricao, user_id: authUser.id })`
- Nova entrega: `supabase.from('deliveries').insert(...)` — `client_id` required
- Notification dropdown: use Radix `Popover` (already installed), query 3 tables in parallel, show colored list items
- Financial real MRR: query `clients` table, sum `mrr` where `status = 'ativo'`
