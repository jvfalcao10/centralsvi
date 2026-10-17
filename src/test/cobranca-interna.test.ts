import { describe, it, expect } from 'vitest'
import { paradasNaInterna, textoDaInterna } from '../../api/_lib/social-cobranca'
import type { SocialCard } from '../../api/_lib/social-domain'

// João, 17/10/2026: "Sofia não tá enviando os posts pra aprovação, vários que
// não foi, tipo Ésia os vídeos". A Sofia estava inteira. O que travava era a
// etapa "Aprovação interna", criada no dia anterior: a peça nova para nela, o
// envio automático só olha "Conferir", e nada avisava. Seis peças presas, uma
// por 34 horas.
const H = 3600000
const peca = (extra: Partial<SocialCard>, horas: number, agora: number): SocialCard => ({
 id: 'wa-x', client: 'Dra. Ésia', title: 'Dra Esia - caderneta', stage: 'interna',
 updated_at: new Date(agora - horas * H).toISOString(), ...extra,
} as SocialCard)

const agora = Date.parse('2026-10-17T09:46:00-03:00')

describe('cobrança da Aprovação interna', () => {
 it('cobra o que passou de 6 horas, mais velho primeiro', () => {
  const cards = [
   peca({ id: 'a', client: 'Dra Enia', title: 'caps' }, 34, agora),
   peca({ id: 'b', client: 'TE Mulher', title: 'vídeo 03' }, 13, agora),
   peca({ id: 'c', client: 'Dra. Ésia', title: 'caderneta' }, 22, agora),
  ]
  expect(paradasNaInterna(cards, agora).map(p => p.client)).toEqual(['Dra Enia', 'Dra. Ésia', 'TE Mulher'])
 })

 it('deixa em paz a peça que acabou de entrar', () => {
  // Senão a Sofia cobraria o time no mesmo minuto em que a arte chega.
  expect(paradasNaInterna([peca({}, 2, agora)], agora)).toEqual([])
 })

 it('não cobra peça de outra etapa', () => {
  for (const stage of ['conferir', 'aguardando', 'aprovado', 'postado', 'arquivado'])
   expect(paradasNaInterna([peca({ stage }, 30, agora)], agora), stage).toEqual([])
 })

 it('a mensagem diz quem, quantas horas e o que fazer', () => {
  const texto = textoDaInterna(paradasNaInterna([peca({ client: 'Dra Enia', title: 'caps' }, 34, agora)], agora))
  expect(texto).toContain('1 peça esperando sua liberação')
  expect(texto).toContain('Dra Enia')
  expect(texto).toContain('há 1 dia')
  expect(texto).toContain('não vão pro cliente')
  expect(texto).toContain('etapa=interna')
 })

 it('não vira parede de texto: corta em 10 e diz quantas sobraram', () => {
  const muitas = Array.from({ length: 14 }, (_, i) => peca({ id: 'c' + i, title: 'peça ' + i }, 10 + i, agora))
  const texto = textoDaInterna(paradasNaInterna(muitas, agora))
  expect(texto).toContain('14 peças esperando')
  expect(texto).toContain('E mais 4 no quadro.')
 })

 it('zero paradas não gera mensagem nenhuma', () => {
  expect(paradasNaInterna([], agora)).toEqual([])
 })
})
