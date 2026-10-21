import { describe, it, expect } from 'vitest'
import { pedidoDeAjuste, pecasParadas, pecasQueVoltaram } from '../../api/_lib/social-cobranca'
import type { SocialCard } from '../../api/_lib/social-domain'

// João, 21/10/2026: "ele já fez isso e mandou ontem no grupo, não viu?".
// O Matheus entregou o corte da caderneta da Dra. Ésia em 20/10 às 11h29, o
// card foi atualizado às 11h31 pela PRÓPRIA entrega, e na manhã seguinte a
// Sofia cobrou dele a mesma peça. Dois minutos faziam o arquivo parecer velho.
const PEDIDO = '2026-10-18T23:16:00-03:00'
const ENTREGA = '2026-10-20T11:29:00-03:00'
const AGORA = Date.parse('2026-10-21T08:30:00-03:00')
const card = (extra: Partial<SocialCard> = {}) => ({
 id: 'cad', client: 'DRA. ÉSIA LOPES', title: 'Dra Esia - caderneta', author: 'Math', stage: 'ajustes',
 note: 'tirar o final do dia da vacinação', selected_assets: ['a'],
 assets: [{ id: 'a', name: 'caderneta v3.MP4', type: 'video/mp4', date: ENTREGA }],
 // a entrega mexe no card: updated_at fica DEPOIS do arquivo
 updated_at: '2026-10-20T11:31:00-03:00', ...extra,
} as unknown as SocialCard)
const eventos = [
 { card_id: 'cad', created_at: PEDIDO, details: { to: 'ajustes', from: 'aprovado', note: 'tirar o final' } },
 { card_id: 'cad', created_at: '2026-10-20T11:31:00-03:00', details: { to: 'ajustes', from: 'ajustes', note: 'Nova entrega recebida. Confira os arquivos finais antes de aprovar.' } },
]

describe('quando a alteração foi pedida', () => {
 it('é o evento que moveu para Ajustes, não o último toque no card', () => {
  expect(pedidoDeAjuste(card(), eventos)).toBe(Date.parse(PEDIDO))
 })

 it('a entrega não conta como pedido novo', () => {
  const so_entrega = [eventos[1]]
  // Sem evento de pedido de verdade, cai no updated_at, que é o que existia antes.
  expect(pedidoDeAjuste(card(), so_entrega)).toBe(Date.parse('2026-10-20T11:31:00-03:00'))
 })

 it('sem histórico nenhum, continua valendo o card', () => {
  expect(pedidoDeAjuste(card(), [])).toBe(Date.parse('2026-10-20T11:31:00-03:00'))
 })
})

describe('peça que já voltou corrigida', () => {
 it('sai da cobrança do designer', () => {
  expect(pecasParadas([card()], AGORA, eventos)).toHaveLength(0)
 })

 it('e vira aviso de peça pronta parada', () => {
  const v = pecasQueVoltaram([card()], eventos)
  expect(v).toHaveLength(1)
  expect(v[0].author).toBe('Math')
  expect(v[0].client).toBe('DRA. ÉSIA LOPES')
 })

 it('peça que ainda não voltou segue sendo cobrada', () => {
  const sem = card({ assets: [{ id: 'a', name: 'caderneta v2.MP4', type: 'video/mp4', date: '2026-10-16T14:57:00-03:00' }] as never })
  expect(pecasParadas([sem], AGORA, eventos)).toHaveLength(1)
  expect(pecasQueVoltaram([sem], eventos)).toHaveLength(0)
 })

 // Sem arquivo marcado ninguém publica: isso é outro problema, não "voltou".
 it('arquivo novo sem marcação não conta como voltou', () => {
  expect(pecasQueVoltaram([card({ selected_assets: [] })], eventos)).toHaveLength(0)
 })
})
