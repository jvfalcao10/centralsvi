
## Remover campo "Plano" da interface de clientes

### Onde aparece atualmente

1. **`EMPTY_FORM`** (linha 34) — `plano: 'starter'` → remover
2. **`openEditClient`** (linha 107) — `plano: client.plano` → remover
3. **`handleSaveClient`** (linha 148) — `plano: form.plano` no payload → remover
4. **Filtro** (linhas 235, 263-272) — `planoFilter` state + Select de planos → remover
5. **TableHead** (linha 284) — `<TableHead>Plano</TableHead>` → remover
6. **TableCell** (linhas 314-318) — célula do badge de plano → remover
7. **Formulário modal** (linhas 453-465) — campo `<Select>` de plano → remover; mover Status para ficar sozinho ou pair com outro campo
8. **Modal de detalhes** (linha ~593) — `PLANO_CONFIG[selectedClient.plano]` no grid de info → remover

### Também remover
- `const planoConf = PLANO_CONFIG[client.plano]` na renderização de cada linha da tabela
- Estado `planoFilter` e `setPlanoFilter`
- A linha de filtro `if (planoFilter !== 'all' && c.plano !== planoFilter) return false` no `filtered`

### O que NÃO muda
- Coluna `plano` permanece no banco (não precisamos migração para remover — apenas ignoramos)
- Importação de `PLANO_CONFIG` pode ser removida do import em `@/types` se não for mais usada

### Arquivos alterados
- `src/pages/Clients.tsx` — único arquivo

### Visual resultado
```text
Filtros:  [ Buscar... ]  [ Todos status ▼ ]  [ Novo Cliente ]
Tabela:   Cliente | MRR | Status | Health Score | Início | Instagram | Ações
Formulário: sem campo "Plano", campo Status fica ao lado do campo Venc. Mensalidade
```
