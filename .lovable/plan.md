
## Plan: Add "+ Novo Lead" button to Pipeline page

### What I'll build
A "Novo Lead" button in the Pipeline filter bar that opens a modal form with all lead fields. On submit it inserts the new lead into the database and immediately refreshes the kanban board.

### Changes to `src/pages/Pipeline.tsx` only — no other files needed

**1. New state**
```
const [showNewLead, setShowNewLead] = useState(false)
const [saving, setSaving] = useState(false)
const [form, setForm] = useState({ name, company, phone, email, segment, source, stage, plano, ticket_estimado, notes })
```

**2. `handleCreateLead` function**
- Validate: `name` required
- Call `supabase.from('leads').insert(...)` with form data
- On success: toast, reset form, close modal, `fetchLeads()`
- On error: show destructive toast

**3. UI changes**
- Add `Plus` icon import from lucide-react
- Add `<Button onClick={() => setShowNewLead(true)}>` with `Plus` icon at the right end of the filter bar
- Add a second `<Dialog>` for the new lead form (separate from the detail modal)

**4. Form layout** (in the new Dialog)
- Row 1: Nome* (full width) — required, validated
- Row 2: Empresa | Telefone (2 cols)
- Row 3: Email | Segmento (2 cols, text input for segment)
- Row 4: Origem (Select: Orgânico/Pago/Indicação/Evento) | Etapa (Select: all pipeline stages)
- Row 5: Plano (Select: starter/growth/pro/enterprise) | Ticket Estimado (number input)
- Row 6: Notas (Textarea, full width)
- Footer: Cancel + Salvar buttons (Salvar shows loading state)

**Form default values**: `source: 'organico'`, `stage: 'lead'`

### Validation
- `name` must not be empty (trim check before submit)
- `ticket_estimado` converted to number or null
- All other fields optional per DB schema

### No DB migration needed — `leads` table already has all these columns.
