
## Módulo de Cobrança — nova aba "Cobrança" na página Financeiro

### Contexto

Clientes têm `dia_vencimento` (inteiro 1-31) + `mrr`. O módulo deve calcular, para o mês corrente, em que data cada cliente vence e agrupar em: **Vencendo hoje**, **Vencendo esta semana** (próximos 7 dias) e **Vencendo este mês**. Sem criar faturas novas — é uma visão inteligente sobre os clientes.

---

### Lógica de datas

Para cada cliente com `dia_vencimento`:
- Construir `vencDate = new Date(anoAtual, mesAtual, dia_vencimento)`
- Se `dia_vencimento` < hoje.getDate() → já venceu este mês → mostrar no grupo "Venceu este mês" (cinza)
- Se `vencDate === hoje` → "Vence hoje" (vermelho)
- Se `vencDate` entre amanhã e hoje+7 → "Vence esta semana" (amarelo)
- Restante do mês → "Vence este mês" (azul)
- Clientes sem `dia_vencimento` → não aparecem

---

### O que mudar

**Apenas `src/pages/Financial.tsx`:**

1. **fetchData** — ampliar a query de clientes para `select('id, name, company, mrr, status, dia_vencimento, instagram')` e guardar em estado `activeClients`

2. **Lógica de agrupamento** — derivar 4 grupos a partir de `activeClients`:
   - `clientesToday` — vence hoje
   - `clientesThisWeek` — vence nos próximos 7 dias (excluindo hoje)
   - `clientesThisMonth` — vence no restante do mês
   - `clientesOverdue` — dia_vencimento já passou neste mês

3. **Nova aba** — adicionar `<TabsTrigger value="cobranca">Cobrança</TabsTrigger>` e `<TabsContent value="cobranca">`

4. **Layout da aba Cobrança:**

```text
┌─ KPIs ────────────────────────────────────────────────┐
│  Vence hoje: R$ X  │  Esta semana: R$ X  │  Este mês: R$ X  │
└───────────────────────────────────────────────────────┘

┌─ Alerta Vence HOJE ────────────────────────────────────┐  (vermelho)
│  Cliente A   Growth   R$1.750   Dia 9    [Registrar pag.]  │
│  Cliente B   Starter  R$900    Dia 9    [Registrar pag.]  │
└───────────────────────────────────────────────────────┘

┌─ Vence esta semana (próximos 7 dias) ─────────────────┐  (amarelo)
│  ...                                                   │
└───────────────────────────────────────────────────────┘

┌─ Vence este mês ──────────────────────────────────────┐  (azul)
│  ...                                                   │
└───────────────────────────────────────────────────────┘
```

5. **Botão "Registrar pag."** — ao clicar, insere uma nova invoice com `status: 'pago'`, `vencimento` = data calculada, `valor` = mrr do cliente e `data_pagamento` = hoje. Chama `fetchData()` para atualizar os totais do módulo.

6. **Clientes sem `dia_vencimento`** — exibir no rodapé da aba um card cinza "X clientes sem dia de vencimento cadastrado" com link para a página de Clientes.

---

### Arquivos alterados
- `src/pages/Financial.tsx` — único arquivo, sem DB migration necessária
