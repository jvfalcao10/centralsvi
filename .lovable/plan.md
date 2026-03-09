
## Clientes em USD com conversão automática para BRL

### Problema
Os 4 clientes americanos (MJC Pavers, Ma Pavers, Botelho Construction, MJC Kitchen) têm MRR armazenado como `500` (USD), mas o sistema mostra como R$500. O valor real é ~R$3.000 dependendo do dólar do dia.

### Solução

**1. DB — adicionar coluna `currency` na tabela `clients`**
- Coluna `text`, default `'BRL'`
- Atualizar os 4 clientes americanos para `currency = 'USD'`
- Identificados pelo segmento `construcao` (todos os 4 são construção EUA)

**2. Edge Function `get-usd-rate`**
- Busca cotação USD→BRL da API pública gratuita `https://economia.awesomeapi.com.br/json/last/USD-BRL` (sem chave, brasileira, confiável)
- Retorna `{ rate: 5.85 }` (ou valor atual)

**3. Frontend — hook `useUsdRate`**
- Chama a edge function uma vez por sessão
- Expõe `usdRate: number` (fallback: `5.0` se falhar)
- Helper `mrrBRL(client)` = `client.mrr * (client.currency === 'USD' ? usdRate : 1)`

**4. Exibição — badges diferenciados**
- Clientes USD mostram: `R$ 2.943` + badge `🇺🇸 USD`
- MRR salvo permanece em USD (500) — só a exibição converte

### Arquivos alterados
- `supabase/migrations/` — migration: adiciona `currency`, atualiza 4 clientes
- `supabase/functions/get-usd-rate/index.ts` — nova edge function (pública, sem JWT)
- `supabase/config.toml` — `verify_jwt = false` para essa função
- `src/hooks/useUsdRate.ts` — novo hook
- `src/types/index.ts` — adicionar `currency` no tipo `Client`
- `src/pages/Clients.tsx` — usar `mrrBRL()` + badge USD
- `src/pages/Financial.tsx` — usar `mrrBRL()` nos cálculos de MRR
- `src/pages/Dashboard.tsx` — usar cotação no total MRR

### Visual na tabela de clientes
```text
| MJC Pavers | Starter | R$ 2.943  🇺🇸 USD | Ativo | ...
| Spa Nature  | Growth  | R$ 2.000          | Ativo | ...
```
