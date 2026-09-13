import type { Expense, Invoice } from '@/types'
import { isCalendarDate } from '@/lib/financial-review'
import { shiftDay } from '@/lib/operations-planning'

export type PlannedInvoice = Pick<Invoice, 'id' | 'client_id' | 'vencimento' | 'valor' | 'status'>
export type PlannedExpense = Pick<Expense, 'id' | 'descricao' | 'vencimento' | 'valor' | 'status'>

export type CashEntry = { id: string; kind: 'in' | 'out'; label: string; due: string; cents: number; href: string }
export const cashTotals = (entries: CashEntry[]) => {
  const incoming = entries.filter(e => e.kind === 'in').reduce((s, e) => s + e.cents, 0)
  const outgoing = entries.filter(e => e.kind === 'out').reduce((s, e) => s + e.cents, 0)
  return { incoming, outgoing, net: incoming - outgoing }
}

/** Existing unpaid entries only. Contracts and ungenerated recurrences are not cash entries. */
export function cashPlan(invoices: PlannedInvoice[], expenses: PlannedExpense[], names: Map<string, string>, today: string, days: 7 | 30 | 60) {
  const end = shiftDay(today, days - 1)
  const valid: CashEntry[] = []
  const invalid: { id: string; label: string; href: string }[] = []
  for (const [kind, rows] of [['in', invoices], ['out', expenses]] as const) {
    for (const row of rows) {
      if (!['pendente', 'atrasado'].includes(row.status)) continue
      const label = kind === 'in' ? names.get((row as PlannedInvoice).client_id) || 'Cliente não disponível' : (row as PlannedExpense).descricao || 'Despesa sem descrição'
      const href = `/financial?${new URLSearchParams({ tab: kind === 'in' ? 'receivable' : 'payable', month: 'all', [kind === 'in' ? 'invoice' : 'expense']: row.id })}`
      const amount = row.valor
      const cents = Math.round(Number(amount) * 100)
      if (!isCalendarDate(row.vencimento || '') || amount === null || amount === undefined || String(amount).trim() === '' || !Number.isSafeInteger(cents) || cents < 0) {
        invalid.push({ id: `${kind}:${row.id}`, label, href })
        continue
      }
      valid.push({ id: row.id, kind, label, due: row.vencimento, cents, href })
    }
  }
  valid.sort((a, b) => a.due.localeCompare(b.due) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
  const overdue = valid.filter(e => e.due < today)
  const upcoming = valid.filter(e => e.due >= today && e.due <= end)
  const later = valid.filter(e => e.due > end)
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, index) => {
    const from = shiftDay(today, index * 7)
    const to = shiftDay(today, Math.min(days - 1, index * 7 + 6))
    const entries = upcoming.filter(e => e.due >= from && e.due <= to)
    return { from, to, entries, ...cashTotals(entries) }
  })
  return { end, overdue, upcoming, later, invalid, weeks, totals: cashTotals(upcoming), lateTotals: cashTotals(overdue) }
}
