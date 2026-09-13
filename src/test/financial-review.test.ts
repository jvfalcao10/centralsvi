import { describe, expect, it } from 'vitest'
import { financialReview, paymentDateError } from '@/lib/financial-review'
import { clientTaskSummary } from '@/lib/client-management'
import type { Expense, Invoice } from '@/types'

const invoice = (id: string, overrides: Partial<Invoice> = {}): Invoice => ({ id, client_id: 'A', valor: 100, vencimento: '2026-09-05', status: 'pendente', data_pagamento: null, metodo_pagamento: null, ...overrides })
const expense = (id: string, overrides: Partial<Expense> = {}): Expense => ({ id, descricao: 'Ferramenta', categoria: 'ferramentas', valor: 100, vencimento: '2026-09-05', status: 'pendente', recorrente: true, recorrencia_gerada: false, ...overrides })

describe('conferência dos registros financeiros', () => {
  it('aponta data ausente apenas para recebimentos já marcados como pagos', () => {
    const issues = financialReview([invoice('open'), invoice('paid', { status: 'pago', client_id: 'B' }), invoice('dated', { client_id: 'C', status: 'pago', data_pagamento: '2026-09-08' })], [], new Map())
    expect(issues.map(i => i.id)).toEqual(['date:paid'])
  })
  it('agrupa faturas pelo cliente e mês do vencimento e exclui canceladas', () => {
    const issues = financialReview([invoice('one'), invoice('two', { vencimento: '2026-09-25', status: 'pago' }), invoice('cancelled', { status: 'cancelado' }), invoice('other', { client_id: 'B' }), invoice('august', { vencimento: '2026-08-05' })], [], new Map([['A', 'Cliente A']]))
    const group = issues.find(i => i.kind === 'invoice_group')!
    expect(group.records.map(i => i.id)).toEqual(['one', 'two'])
    expect(group.title).toBe('Mais de uma fatura no mês')
    expect(group.records[0].label).toBe('Cliente A')
    expect(issues.filter(i => i.kind === 'invoice_group')).toHaveLength(1)
  })
  it('não confunde parcelas de meses ou valores diferentes com despesas repetidas', () => {
    const issues = financialReview([], [expense('one'), expense('two', { descricao: '  FERRAMENTA  ' }), expense('august', { vencimento: '2026-08-05' }), expense('price', { valor: 200 }), expense('category', { categoria: 'pessoal' })], new Map())
    expect(issues).toHaveLength(1)
    expect(issues[0].records.map(r => r.id)).toEqual(['one', 'two'])
  })
  it('não modifica os registros analisados', () => {
    const rows = [invoice('one'), invoice('two')]
    const before = structuredClone(rows)
    financialReview(rows, [], new Map())
    expect(rows).toEqual(before)
  })
  it.each(['', '2026-02-30', '2026-09-12', '2026-13-01', '09/09/2026'])('rejeita data ausente, impossível ou futura: %s', value => {
    expect(paymentDateError(value, '2026-09-11')).toBeTruthy()
  })
  it.each(['2026-09-11', '2026-08-05', '2024-02-29'])('aceita data real, inclusive recebimento anterior ao vencimento: %s', value => {
    expect(paymentDateError(value, '2026-09-11')).toBeNull()
  })
})

it('a fila do cliente exclui concluídas, prioriza vencidas e identifica legado incompleto', () => {
  const base = { cliente_id: 'A', titulo: 'Tarefa', dono_id: 'owner', dono_nome: 'Pessoa', status: 'aberta', prioridade: 'normal' }
  const result = clientTaskSummary([{ ...base, id: 'future', prazo: '2026-09-20' }, { ...base, id: 'done', status: 'feita', prazo: '2026-09-01' }, { ...base, id: 'late', prazo: '2026-09-02' }, { ...base, id: 'legacy', prazo: null, dono_id: null }], '2026-09-11')
  expect(result.queue.map(t => t.id)).toEqual(['late', 'future', 'legacy'])
  expect(result.overdue).toHaveLength(1)
  expect(result.incomplete).toHaveLength(1)
})
