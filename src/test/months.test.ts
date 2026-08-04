import { describe, it, expect } from 'vitest'
import { addMonths, getDueDate, monthKeyOf, monthLabel, buildMonthOptions } from '@/lib/months'

describe('addMonths (data de parcela)', () => {
  it('soma mês simples', () => {
    expect(addMonths('2026-08-10', 0)).toBe('2026-08-10')
    expect(addMonths('2026-08-10', 1)).toBe('2026-09-10')
    expect(addMonths('2026-08-10', 5)).toBe('2027-01-10')
  })

  it('não estoura o dia em mês curto (31/01 vira 28/02, não 03/03)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonths('2026-01-31', 3)).toBe('2026-04-30')
  })

  it('respeita ano bissexto', () => {
    // 2028 é bissexto
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('vira o ano corretamente numa compra em 12x', () => {
    const primeira = '2026-11-15'
    const parcelas = Array.from({ length: 12 }, (_, i) => addMonths(primeira, i))
    expect(parcelas[0]).toBe('2026-11-15')
    expect(parcelas[1]).toBe('2026-12-15')
    expect(parcelas[2]).toBe('2027-01-15')
    expect(parcelas[11]).toBe('2027-10-15')
    expect(new Set(parcelas).size).toBe(12) // nenhuma parcela repetida
  })
})

describe('getDueDate (vencimento do cliente no mês)', () => {
  it('monta o vencimento no mês pedido', () => {
    const d = getDueDate(5, '2026-07')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6) // julho
    expect(d.getDate()).toBe(5)
  })

  it('clampa dia 31 em mês de 30 dias', () => {
    expect(getDueDate(31, '2026-06').getDate()).toBe(30)
    expect(getDueDate(31, '2026-02').getDate()).toBe(28)
  })

  it('sem monthKey, usa o mês corrente', () => {
    const now = new Date()
    const d = getDueDate(1)
    expect(d.getMonth()).toBe(now.getMonth())
    expect(d.getFullYear()).toBe(now.getFullYear())
  })
})

describe('helpers de mês', () => {
  it('monthKeyOf recorta a data', () => {
    expect(monthKeyOf('2026-08-15')).toBe('2026-08')
    expect(monthKeyOf('')).toBe('')
  })

  it('monthLabel escreve em português', () => {
    expect(monthLabel('2026-08')).toBe('Agosto/2026')
    expect(monthLabel('2026-03')).toBe('Março/2026')
  })

  it('buildMonthOptions ordena do mais recente e inclui o mês atual', () => {
    const opts = buildMonthOptions(['2026-05-10', '2026-07-01', '2026-05-22'], '2026-08')
    expect(opts).toEqual(['2026-08', '2026-07', '2026-05'])
  })
})
