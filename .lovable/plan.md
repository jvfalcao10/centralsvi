
## Add Instagram column to clients table

### Current state
Table has 7 columns: Cliente | Plano | MRR | Status | Health Score | Início | Ações

### Change: add Instagram column between "Início" and "Ações"

**`src/pages/Clients.tsx` — 2 touch points:**

1. **TableHeader** (line ~287) — add `<TableHead>Instagram</TableHead>` between "Início" and "Ações"

2. **TableRow** (line ~340-358) — add a new `<TableCell>` between the "Início" cell and the "Ações" cell:
   - If `client.instagram` exists: render a clickable icon button with the Instagram icon + handle text, `onClick` opens `https://instagram.com/{handle.replace('@','')}` in new tab, `stopPropagation` to avoid triggering row click
   - If no instagram: render `—` in muted text
   - Style: small pink/purple Instagram-colored icon button, tooltip on hover showing the handle

That's it — 2 small edits, no DB changes needed (column already exists).

### Visual result
```text
| Cliente | Plano | MRR | Status | Health | Início | Instagram | Ações |
|---------|-------|-----|--------|--------|--------|-----------|-------|
| Jordão  | Growth| R$1.750 | Ativo | 80 | 01/03 | @hospitalJordao 🔗 | Ver Editar |
| Spa     | Growth| R$2.000 | Ativo | 80 | 01/03 | —         | Ver Editar |
```

### Files changed
- `src/pages/Clients.tsx` only
