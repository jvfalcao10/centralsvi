import { describe, it, expect } from 'vitest'
import { diaBrasilia, intervalos, lerLinha, lerSaldo, nomeLimpo } from '../../api/_lib/anuncios-ao-vivo'

// 22/10/2026 às 01h00 UTC ainda é 21/10 em Brasília (22h00).
const MADRUGADA_UTC = Date.UTC(2026, 9, 22, 1, 0)
const TARDE_UTC = Date.UTC(2026, 9, 22, 22, 50) // 19h50 em Brasília

describe('anúncios ao vivo', () => {
  it('conta o dia pelo relógio de Brasília, não pelo UTC', () => {
    expect(diaBrasilia(MADRUGADA_UTC)).toBe('2026-10-21')
    expect(diaBrasilia(TARDE_UTC)).toBe('2026-10-22')
  })

  it('monta as janelas sem sobrepor a semana atual com a anterior', () => {
    const f = intervalos(TARDE_UTC)
    expect(f.hoje).toEqual({ since: '2026-10-22', until: '2026-10-22' })
    expect(f.ontem).toEqual({ since: '2026-10-21', until: '2026-10-21' })
    expect(f['7d']).toEqual({ since: '2026-10-15', until: '2026-10-21' })
    expect(f['7d_ant']).toEqual({ since: '2026-10-08', until: '2026-10-14' })
    expect(f['30d']).toEqual({ since: '2026-09-22', until: '2026-10-21' })
    expect(f['30d_ant']).toEqual({ since: '2026-08-23', until: '2026-09-21' })
  })

  it('lê conversa, segunda mensagem e lead da linha da Meta', () => {
    const n = lerLinha({
      spend: '399.82',
      impressions: '18000',
      inline_link_clicks: '210',
      actions: [
        { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '45' },
        { action_type: 'onsite_conversion.messaging_user_depth_2_message_send', value: '27' },
        { action_type: 'onsite_conversion.lead_grouped', value: '3' },
      ],
    })
    expect(n).toEqual({ gasto: 399.82, conversas: 45, segunda: 27, leads: 3, impressoes: 18000, cliques: 210 })
  })

  it('lê o saldo da pré-paga e deixa cartão sem saldo', () => {
    expect(lerSaldo('Saldo disponível (R$1.084,29 BRL)')).toBe(1084.29)
    expect(lerSaldo('Saldo disponível (R$0,00 BRL)')).toBe(0)
    expect(lerSaldo('VISA *0113')).toBeNull()
    expect(lerSaldo(undefined)).toBeNull()
  })

  it('tira o prefixo da conta e deixa o nome do cliente', () => {
    expect(nomeLimpo('C1 - Exatta')).toBe('Exatta')
    expect(nomeLimpo('CA 01 - TE Mulher')).toBe('TE Mulher')
    expect(nomeLimpo('C.A Urologia Redenção')).toBe('Urologia Redenção')
    expect(nomeLimpo('CONTA 01 - SPA NATURE')).toBe('SPA NATURE')
    expect(nomeLimpo('C01 - DR GERALDO')).toBe('DR GERALDO')
    expect(nomeLimpo('C1- Dra Esia Lopes')).toBe('Dra Esia Lopes')
    expect(nomeLimpo('Clinica Essenc')).toBe('Clinica Essenc')
    expect(nomeLimpo('Liv Centro')).toBe('Liv Centro')
  })
})
