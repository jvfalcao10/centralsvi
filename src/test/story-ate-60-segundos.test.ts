import { describe, it, expect } from 'vitest'
import { publicationInput } from '../../api/_lib/social-publication-domain'

// Duas peças morreram caladas pelo mesmo motivo, e as duas com prova no mesmo
// minuto: o reel do arquivo publicou e o story do MESMO arquivo falhou, com o
// container em ERROR. "Dra Esia - xixi na cama" (69,1 s) em 19/10 e
// "GM gás - vídeo 05" (62,2 s) em 20/10. Story do Instagram para em 60 s.
const ator = '11111111-1111-4111-8111-111111111111'
const conta = { id: '123', username: 'cliente', name: 'Cliente' }
const video = (duration_ms: number | undefined) => ({
 id: 'v', name: 'video.MP4', type: 'video/mp4', path: 'video.MP4',
 storage: 'drive', drive_id: 'abc', bytes: 60 * 1024 * 1024, duration_ms,
})
const carta = (duration_ms?: number): any => ({
 id: 'qa', client: 'Cliente', title: 'Peça', stage: 'aprovado', version: 1, revision: 1,
 caption: 'Legenda', assets: [video(duration_ms)], selected_assets: ['v'],
})
const pedido = (format: string) => ({
 confirmed: true, request_id: '22222222-2222-4222-8222-222222222222',
 account_id: '123', format, when: 'now',
})

describe('story de vídeo longo não chega no Instagram', () => {
 it('segura antes de criar o container e diz a duração', () => {
  expect(() => publicationInput(carta(62228), pedido('story'), [conta], ator))
   .toThrow('O Story aceita vídeo de até 60 segundos, e este tem 62 segundos')
  expect(() => publicationInput(carta(69100), pedido('story'), [conta], ator)).toThrow('69 segundos')
 })

 it('o mesmo arquivo passa como reel, que é o que de fato aconteceu', () => {
  expect(publicationInput(carta(62228), pedido('reel'), [conta], ator).format).toBe('reel')
  expect(publicationInput(carta(69100), pedido('reel'), [conta], ator).format).toBe('reel')
 })

 it('não bloqueia o que já publicou: 60,4 s saiu sem erro em 17/10', () => {
  expect(publicationInput(carta(60400), pedido('story'), [conta], ator).format).toBe('story')
  expect(publicationInput(carta(56600), pedido('story'), [conta], ator).format).toBe('story')
 })

 it('arquivo sem duração conhecida não vira acusação falsa', () => {
  expect(publicationInput(carta(undefined), pedido('story'), [conta], ator).format).toBe('story')
 })
})
