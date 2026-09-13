import { describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { contractTotals, expensesDueInMonth, receivedInMonth, isOverdueInvoice, isBillableInMonth, validateTaskAssignment, monthlyInvoiceId, formatAxisCurrency } from '@/lib/management-metrics'
import { fetchAllRows, confirmSaved } from '@/lib/data-access'

describe('regras de gestão com dados fictícios', () => {
  it('não arredonda valores menores que mil para zero no eixo dos gráficos', () => {
    expect(formatAxisCurrency(200)).toContain('200')
    expect(formatAxisCurrency(800)).toContain('800')
    expect(formatAxisCurrency(1200)).toContain('1,2')
  })
  it('preserva contratos em risco e separa permuta, sem incluir encerrados', () => {
    const result = contractTotals([
      { status: 'ativo', mrr: 1000 }, { status: 'risco', mrr: 200 },
      { status: 'inadimplente', mrr: 100, currency: 'USD' },
      { status: 'ativo', mrr: 300, permuta: true },
      { status: 'cancelado', mrr: 700 }, { status: 'encerrado', mrr: 800 },
    ], '2026-09', 5)
    expect(result).toMatchObject({ total: 2000, barter: 300, monetary: 1700 })
    expect(result.active).toHaveLength(4)
  })

  it('conta apenas a instância mensal da despesa recorrente', () => {
    const rows = [
      { valor: 100, vencimento: '2026-08-05', recorrente: true },
      { valor: 100, vencimento: '2026-09-05', recorrente: true },
      { valor: 800, vencimento: '2026-10-05', recorrente: false },
    ]
    expect(expensesDueInMonth(rows, '2026-09').reduce((sum, row) => sum + row.valor, 0)).toBe(100)
  })

  it('atribui o recebimento atrasado ao mês do pagamento e não inventa data ausente', () => {
    const invoices = [
      { valor: 1000, vencimento: '2026-08-05', data_pagamento: '2026-09-05', status: 'pago' },
      { valor: 500, vencimento: '2026-09-05', data_pagamento: null, status: 'pago' },
      { valor: 400, vencimento: '2026-09-05', data_pagamento: '2026-09-05', status: 'pendente' },
    ]
    expect(receivedInMonth(invoices, '2026-08')).toBe(0)
    expect(receivedInMonth(invoices, '2026-09')).toBe(1000)
  })

  it('fatura paga ou cancelada não é dívida vencida', () => {
    const date = { vencimento: '2026-09-05' }
    expect(isOverdueInvoice({ ...date, status: 'pago' }, '2026-09-11')).toBe(false)
    expect(isOverdueInvoice({ ...date, status: 'cancelado' }, '2026-09-11')).toBe(false)
    expect(isOverdueInvoice({ ...date, status: 'pendente' }, '2026-09-11')).toBe(true)
    expect(isOverdueInvoice({ vencimento: '2026-10-05', status: 'atrasado' }, '2026-09-11')).toBe(false)
  })

  it('respeita carência explícita e o primeiro vencimento posterior à assinatura', () => {
    const client = { dia_vencimento: 5, inicio_contrato: '2026-08-05' }
    expect(isBillableInMonth(client, '2026-08')).toBe(false)
    expect(isBillableInMonth(client, '2026-09')).toBe(true)
    expect(isBillableInMonth({ ...client, cobranca_inicio: '2026-10-05' }, '2026-09')).toBe(false)
    expect(isBillableInMonth({ ...client, permuta: true }, '2026-09')).toBe(false)
  })

  it.each([
    [{ dono_id: null, prazo: '2026-09-12' }, 'responsável'],
    [{ dono_id: 'usuario', prazo: null }, 'prazo'],
    [{ dono_id: 'usuario', prazo: '2026-02-30' }, 'prazo'],
  ])('recusa tarefa incompleta ou data impossível: %j', (task, message) => {
    expect(validateTaskAssignment(task)).toContain(message)
  })

  it('aceita prazo real, inclusive para corrigir tarefa antiga', () => {
    expect(validateTaskAssignment({ dono_id: 'usuario', prazo: '2024-02-29' })).toBeNull()
  })

  it('mantém a identidade da criação manual em tentativas repetidas', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
    try {
      const first = await monthlyInvoiceId('cliente-teste', '2026-09')
      expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(await monthlyInvoiceId('cliente-teste', '2026-09')).toBe(first)
      expect(await monthlyInvoiceId('cliente-teste', '2026-10')).not.toBe(first)
      expect(await monthlyInvoiceId('outro-cliente', '2026-09')).not.toBe(first)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
    }
  })
})

describe('confirmação de gravação e leitura completa', () => {
  it('recusa erro de gravação e também alteração de zero linhas', async () => {
    await expect(confirmSaved(Promise.resolve({ data: null, error: { message: 'Sem acesso' } }))).rejects.toThrow('Sem acesso')
    await expect(confirmSaved(Promise.resolve({ data: [], error: null }))).rejects.toThrow('não foi confirmada')
    await expect(confirmSaved(Promise.resolve({ data: [{ id: 'a' }], error: null }), 2)).rejects.toThrow('não foi confirmada')
  })

  it('confirma todas as parcelas esperadas', async () => {
    await expect(confirmSaved(Promise.resolve({ data: [{ id: 'a' }, { id: 'b' }], error: null }), 2)).resolves.toHaveLength(2)
  })

  it('busca registros além da primeira página sem truncar os totais', async () => {
    const rows = Array.from({ length: 1001 }, (_, id) => ({ id }))
    const result = await fetchAllRows((from, to) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }))
    expect(result).toEqual(rows)
  })

  it('não trata falha de página como coleção vazia ou total completo', async () => {
    await expect(fetchAllRows((from) => Promise.resolve(from === 0
      ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
      : { data: null, error: { message: 'Conexão interrompida' } }))).rejects.toThrow('Conexão interrompida')
  })
})
