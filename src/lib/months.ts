// Helpers de mês do módulo financeiro.
// Ficam fora da página porque a conta de data de parcela erra calada:
// somar mês com `new Date()` puro faz 31/01 + 1 mês virar 03/03.

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** '2026-08-15' -> '2026-08' */
export const monthKeyOf = (dateStr: string) => (dateStr || '').slice(0, 7)

/** Date -> '2026-08' (hora local, não UTC) */
export const monthKeyOfDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** '2026-08' -> 'Agosto/2026' */
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-')
  return `${MONTH_NAMES[Number(m) - 1]}/${y}`
}

/** Meses presentes nos dados + o mês atual, do mais recente pro mais antigo. */
export function buildMonthOptions(dates: string[], current: string): string[] {
  const set = new Set(dates.map(monthKeyOf).filter(Boolean))
  set.add(current)
  return Array.from(set).sort().reverse()
}

/** Soma meses sem estourar o dia: 31/01 + 1 mês = 28/02, não 03/03. */
export function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const base = new Date(y, m - 1 + n, 1)
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

/**
 * Vencimento do cliente no mês pedido (padrão: mês atual).
 * Dia 31 em mês de 30 cai no dia 30.
 */
export function getDueDate(dia: number, monthKey?: string): Date {
  const ref = monthKey ? monthKey.split('-').map(Number) : null
  const year = ref ? ref[0] : new Date().getFullYear()
  const monthIdx = ref ? ref[1] - 1 : new Date().getMonth()
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()
  return new Date(year, monthIdx, Math.min(dia, lastDay))
}
