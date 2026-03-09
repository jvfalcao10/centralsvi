
## Adicionar card de cotação USD no Dashboard

### O que mudar

**`src/hooks/useUsdRate.ts`** — ampliar o hook para também expor `rateUpdatedAt: Date | null` e um segundo hook `useUsdRateInfo()` que retorna `{ rate, updatedAt }`.

**`src/pages/Dashboard.tsx`** — 
1. Importar o novo hook e `RefreshCw` do lucide-react
2. Adicionar um 5º card na seção de KPIs (ajustar grid para `xl:grid-cols-5` ou manter 4 e colocar o card USD separado numa linha mais estreita)
3. Card visual:
   - Ícone: bandeira 🇺🇸 ou `DollarSign` com badge "USD"
   - Título: "Cotação USD"
   - Valor: `R$ 5,85` (formatado com vírgula e 2 casas)
   - Subtexto: `Atualizado às HH:mm` (timestamp da última fetch)
   - Se `rate === 5.0` e sem timestamp → mostrar "Carregando..." ou badge "Estimado"

### Detalhes técnicos

**`useUsdRate.ts`**: adicionar `cachedAt` (módulo-level) e retornar `{ rate, updatedAt }` num segundo hook `useUsdRateInfo`.

```ts
let cachedAt: Date | null = null

export function useUsdRateInfo() {
  const [rate, setRate] = useState(cachedRate ?? 5.0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(cachedAt)
  // fetch lógico igual, mas salva cachedAt = new Date()
  return { rate, updatedAt }
}
```

**`Dashboard.tsx`**: card separado abaixo dos 4 KPIs OU como 5º card na grid.

Melhor posição: linha separada de 1 card pequeno ao lado dos gráficos (mais elegante) — inserir entre os KPIs e os gráficos, com `grid-cols-1 sm:grid-cols-3` contendo o card USD na última coluna.

Ou mais simples: adicionar como **5º card na grid dos KPIs** ajustando para `xl:grid-cols-5`.

**Escolha final**: 5º card na grid `xl:grid-cols-5` — mantém consistência visual.

### Arquivos alterados
- `src/hooks/useUsdRate.ts` — adicionar `cachedAt` + `useUsdRateInfo()`
- `src/pages/Dashboard.tsx` — usar `useUsdRateInfo()`, adicionar card USD, ajustar grid
