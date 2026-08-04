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

/** '2026-08' -> '2026-08-31' (último dia do mês, respeitando fevereiro e bissexto) */
export function lastDayOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

/**
 * Mês da PRIMEIRA cobrança de um cliente.
 *
 * Regra: a primeira mensalidade cai no primeiro vencimento que acontece
 * DEPOIS da assinatura do contrato, nunca no mesmo dia.
 *
 *   contrato 09/03, vence dia 25 -> primeira em 03/2026 (25 ainda ia chegar)
 *   contrato 30/07, vence dia 30 -> primeira em 08/2026 (o 30 de julho era o próprio dia da entrada)
 *
 * Sem isso, cliente que fecha no fim do mês aparece devendo o mês em que entrou.
 */
export function firstBillingMonth(inicioContrato: string, diaVencimento: number): string {
  const [y, m, d] = inicioContrato.slice(0, 10).split('-').map(Number)
  const mesInicio = `${y}-${String(m).padStart(2, '0')}`
  const lastDay = new Date(y, m, 0).getDate()
  const diaNoMes = Math.min(diaVencimento, lastDay)
  return diaNoMes > d ? mesInicio : monthKeyOf(addMonths(`${mesInicio}-01`, 1))
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
