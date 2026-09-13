import { emPermutaNoMes } from '@/types'
import { mrrBRL } from '@/hooks/useUsdRate'
import { firstBillingMonth, monthKeyOf, monthKeyOfDate } from '@/lib/months'

export type ContractMetric = {
  status: string
  mrr: number
  currency?: string
  permuta?: boolean
  permuta_ate?: string | null
}

export type InvoiceMetric = {
  valor: number
  vencimento: string
  status: string
  data_pagamento?: string | null
}

export const isOperatingClient = (client: { status: string }) =>
  ['ativo', 'risco', 'inadimplente'].includes(client.status)

export const localDateISO = (date = new Date()) =>
  `${monthKeyOfDate(date)}-${String(date.getDate()).padStart(2, '0')}`

export const formatAxisCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
}).format(value)

export function contractTotals(clients: ContractMetric[], month: string, usdRate: number) {
  const active = clients.filter(isOperatingClient)
  const total = active.reduce((sum, client) => sum + mrrBRL(Number(client.mrr), client.currency, usdRate), 0)
  const barter = active.filter(client => emPermutaNoMes(client, month))
    .reduce((sum, client) => sum + mrrBRL(Number(client.mrr), client.currency, usdRate), 0)
  return { active, total, barter, monetary: total - barter }
}

export function expensesDueInMonth<T extends { valor: number; vencimento: string }>(expenses: T[], month: string) {
  return expenses.filter(expense => monthKeyOf(expense.vencimento) === month)
}

export function receivedInMonth(invoices: InvoiceMetric[], month: string) {
  return invoices.filter(invoice => invoice.status === 'pago' && monthKeyOf(invoice.data_pagamento || '') === month)
    .reduce((sum, invoice) => sum + Number(invoice.valor), 0)
}

export const isOpenInvoice = (invoice: { status: string }) =>
  ['pendente', 'atrasado'].includes(invoice.status)

/** Chave estável da criação manual mensal, inclusive para clientes em outra moeda. */
export async function monthlyInvoiceId(clientId: string, month: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(`central-svi:mensalidade:${clientId}:${month}`))).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const isOverdueInvoice = (invoice: Pick<InvoiceMetric, 'status' | 'vencimento'>, today: string) =>
  isOpenInvoice(invoice) && invoice.vencimento < today

export function isBillableInMonth(client: {
  dia_vencimento: number | null
  inicio_contrato: string | null
  cobranca_inicio?: string | null
  permuta?: boolean
  permuta_ate?: string | null
}, month: string) {
  if (!client.dia_vencimento || emPermutaNoMes(client, month)) return false
  return client.cobranca_inicio
    ? monthKeyOf(client.cobranca_inicio) <= month
    : !client.inicio_contrato || firstBillingMonth(client.inicio_contrato, client.dia_vencimento) <= month
}

export function validateTaskAssignment(task: { dono_id?: string | null; prazo?: string | null }) {
  if (!task.dono_id?.trim()) return 'Escolha um responsável para a tarefa'
  if (!task.prazo || !/^\d{4}-\d{2}-\d{2}$/.test(task.prazo)) return 'Defina um prazo válido para a tarefa'
  const date = new Date(`${task.prazo}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== task.prazo) return 'Defina um prazo válido para a tarefa'
  return null
}
