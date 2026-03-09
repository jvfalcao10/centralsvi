
## Adding Instagram field + vencimento de mensalidade to Clients & Leads

### What needs to change

**1. Database migration** — add 2 columns to `clients` and 1 to `leads`:
- `clients.instagram` — `text`, nullable (ex: `@hospitalJordao`)
- `clients.dia_vencimento` — `integer`, nullable (1-31, day of month for billing)
- `leads.instagram` — `text`, nullable (prospects already have Instagram handles in the data)

**2. `src/types/index.ts`** — add `instagram: string | null` and `dia_vencimento: number | null` to `Client` interface; add `instagram: string | null` to `Lead` interface

**3. `src/pages/Clients.tsx`** — 6 touch points:
- `EMPTY_FORM` — add `instagram: ''`, `dia_vencimento: ''`
- `openEditClient` — populate new fields from client
- `validateForm` — validate dia_vencimento is 1-31 if provided
- `handleSaveClient` payload — include new fields
- **Create/Edit form** — add Instagram input (with `@` prefix) + dia_vencimento number input (1-31) in a new row
- **Detail modal Info tab** — Instagram shown as clickable link `https://instagram.com/{handle}` opening new tab; dia_vencimento shown as "Dia X de cada mês"

**4. `src/pages/Pipeline.tsx`** — 3 touch points:
- `EMPTY_FORM` — add `instagram: ''`
- `handleCreateLead` / `handleEditLead` payloads — include instagram
- `LeadFormFields` component — add Instagram input field
- Lead detail modal — show Instagram as clickable link

### Form layout (Clients create/edit modal)
New row added between email/segment row and plano/status row:
```text
[ Instagram @handle    ] [ Venc. mensalidade (dia 1-31) ]
```

### Detail modal display (Info tab)
Instagram card shows:
```text
Instagram
@hospitalJordao  →  link to instagram.com/hospitalJordao
```
With external link icon (ExternalLink from lucide-react, already imported or easy to add).

Vencimento card shows:
```text
Venc. Mensalidade
Dia 5 de cada mês
```

### No existing data affected
All new columns are nullable with no default — existing 24 clients and 5 leads won't be touched. They'll just show `—` until updated via the edit form.

### Files to change
1. **DB migration** — ALTER TABLE clients ADD COLUMN instagram, dia_vencimento; ALTER TABLE leads ADD COLUMN instagram
2. `src/types/index.ts` — interface updates
3. `src/pages/Clients.tsx` — form + detail modal + save logic
4. `src/pages/Pipeline.tsx` — form fields + lead detail display + save logic
