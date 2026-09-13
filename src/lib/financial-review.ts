import type { Expense, Invoice } from '@/types'
import { isOpenInvoice } from '@/lib/management-metrics'

export type ReviewIssue = {
  id: string
  kind: 'payment_date' | 'invoice_group' | 'expense_group'
  title: string
  reason: string
  clientId?: string
  records: { id: string; label: string; due: string; amount: number; status: string }[]
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function paymentDateError(value: string, today: string) {
  if (!isCalendarDate(value)) return 'Informe a data real do recebimento.'
  if (value > today) return 'A data de um recebimento realizado não pode estar no futuro.'
  return null
}

function groups<T>(rows: T[], keyOf: (row: T) => string) {
  const map = new Map<string, T[]>()
  rows.forEach(row => {
    const key = keyOf(row)
    const group = map.get(key)
    if (group) group.push(row)
    else map.set(key, [row])
  })
  return [...map.entries()].filter(([, rows]) => rows.length > 1)
}

/** Sinais para conferência. Mais de uma fatura não comprova duplicidade. */
export function financialReview(invoices: Invoice[], expenses: Expense[], names: Map<string, string>): ReviewIssue[] {
  const label = (invoice: Invoice) => names.get(invoice.client_id) || 'Cliente não disponível'
  const record = (invoice: Invoice) => ({ id: invoice.id, label: label(invoice), due: invoice.vencimento, amount: Number(invoice.valor), status: invoice.status })
  const paidWithoutDate: ReviewIssue[] = invoices.filter(i => i.status === 'pago' && !i.data_pagamento).map(i => ({
    id: `date:${i.id}`, kind: 'payment_date', title: 'Recebimento sem data', clientId: i.client_id,
    reason: 'A fatura está paga, mas não entra no caixa de nenhum mês enquanto a data estiver ausente.', records: [record(i)],
  }))
  const repeatedInvoices: ReviewIssue[] = groups(invoices.filter(i => (isOpenInvoice(i) || i.status === 'pago') && i.client_id && isCalendarDate(i.vencimento)),
    i => `${i.client_id}:${i.vencimento.slice(0, 7)}`).map(([key, rows]) => ({
      id: `invoices:${key}`, kind: 'invoice_group', title: 'Mais de uma fatura no mês', clientId: rows[0].client_id,
      reason: 'Confira se são cobranças distintas ou repetidas antes de registrar outra baixa. O vencimento define o mês deste agrupamento.', records: rows.map(record),
    }))
  const repeatedExpenses: ReviewIssue[] = groups(expenses.filter(e => e.descricao?.trim() && isCalendarDate(e.vencimento) && Number.isFinite(Number(e.valor))),
    e => JSON.stringify([e.descricao.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' '), e.categoria, e.vencimento, Number(e.valor)]))
    .map(([key, rows]) => ({
      id: `expenses:${key}`, kind: 'expense_group', title: 'Despesas semelhantes',
      reason: 'Mesma descrição, categoria, valor e vencimento. Confira o documento de origem antes de editar ou excluir.',
      records: rows.map(e => ({ id: e.id, label: e.descricao, due: e.vencimento, amount: Number(e.valor), status: e.status })),
    }))
  return [...paidWithoutDate, ...repeatedInvoices, ...repeatedExpenses]
}
