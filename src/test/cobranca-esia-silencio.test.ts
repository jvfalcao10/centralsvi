import { describe, it, expect } from 'vitest'
import { pecasComOCliente, clienteEmSilencio, textoDasAprovadas, aprovadasSemData } from '../../api/_lib/social-cobranca'
import type { SocialCard } from '../../api/_lib/social-domain'

// João, 18/10/2026, 23h: "não enviar nada Ésia, já tá tudo aprovado" e
// "a Ésia já foi aprovado e aí é só programar, aí isso você deve cobrar a
// Rayana no grupo de social media, Sofia tá lá".
const agora = Date.parse('2026-10-19T11:30:00-03:00')
const H = 3600000
const card = (extra: Partial<SocialCard>, horas = 62): SocialCard => ({
 id: 'manual-esia-sna', client: 'DRA. ÉSIA LOPES', title: 'Arte SNA · Coceira que piora à noite',
 stage: 'aguardando', assets: [{ id: 'a', type: 'image/png', name: 'a.png' }], selected_assets: ['a'],
 updated_at: new Date(agora - horas * H).toISOString(), approved_at: null, scheduled_at: null,
 ...extra,
} as SocialCard)

describe('silêncio da Ésia', () => {
 it('não cobra a Ésia, mesmo com peça parada há 62 horas', () => {
  expect(pecasComOCliente([card({})], agora)).toEqual([])
 })

 it('casa o nome mesmo escrito diferente no card', () => {
  for (const nome of ['DRA. ÉSIA LOPES', 'Dra. Ésia', 'dra esia', 'DRA ESIA'])
   expect(clienteEmSilencio(nome), nome).toBe(true)
 })

 it('não cala os outros clientes por engano', () => {
  for (const nome of ['Dra. Ênia', 'Dra. Erika Figueiredo', 'Spa Nature', 'TE Mulher'])
   expect(clienteEmSilencio(nome), nome).toBe(false)
  expect(pecasComOCliente([card({ client: 'Dra. Ênia' })], agora)).toHaveLength(1)
 })
})

describe('cobrança de programar fala com a Rayana', () => {
 it('a mensagem chama a Rayana pelo nome e diz que o cliente já aprovou', () => {
  const pecas = aprovadasSemData([card({
   stage: 'aprovado', approved_at: new Date(agora - 48 * H).toISOString(),
  })], agora)
  const texto = textoDasAprovadas(pecas, agora)
  expect(texto).toContain('Rayana')
  expect(texto).toContain('O cliente já aprovou, falta só a data')
  expect(texto).toContain('etapa=aprovado')
 })

 it('uma peça só não vira "1 peças"', () => {
  const pecas = aprovadasSemData([card({ stage: 'aprovado', approved_at: new Date(agora - 48 * H).toISOString() })], agora)
  expect(textoDasAprovadas(pecas, agora)).toContain('1 peça aprovada')
 })
})
