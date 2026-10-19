import { describe, it, expect } from 'vitest'
import { mensagemDeLote, mensagemDeAprovacao } from '../../api/_lib/social-client-message'

// João, 18/10/2026: "se tiver mais de 1 peça que ela mande uma mensagem
// somente com todos já de uma vez, que o cliente já aprova de uma vez,
// melhor né". Antes, cinco peças viravam cinco mensagens no grupo, cada uma
// com seu link, e o cliente respondia em cinco lugares.
const manha = Date.parse('2026-10-18T09:00:00-03:00')
const LINK = 'https://svi.cx/dra-esia/abc123'

describe('mensagem de lote', () => {
 it('manda uma mensagem só, com a lista numerada e um link', () => {
  const texto = mensagemDeLote({
   client: 'Dra. Ésia', url: LINK, agora: manha,
   pecas: [
    { title: 'Dra Esia - caderneta', video: true },
    { title: 'Dra Esia - xixi na cama', video: true },
    { title: 'Dra Esia - papinha', video: true },
   ],
  })
  expect(texto).toContain('Bom dia, pessoal!')
  expect(texto).toContain('Separei três vídeos novos pra vocês:')
  expect(texto).toContain('1. *')
  expect(texto).toContain('3. *')
  // Um link e só um: é o ponto do pedido.
  expect(texto.split(LINK).length - 1).toBe(1)
  expect(texto).toContain('Está tudo no mesmo link')
 })

 it('chama de carrossel quando todas têm várias lâminas', () => {
  const texto = mensagemDeLote({
   client: 'Norte Capital', url: LINK, agora: manha,
   pecas: [{ title: 'Boi pronto', arquivos: 6 }, { title: 'Chicago', arquivos: 6 }],
  })
  expect(texto).toContain('Separei dois carrosséis novos')
 })

 it('mistura de vídeo e arte não inventa um nome só', () => {
  const texto = mensagemDeLote({
   client: 'Spa Nature', url: LINK, agora: manha,
   pecas: [{ title: 'vídeo 05', video: true }, { title: 'estático oferta', arquivos: 1 }],
  })
  expect(texto).toContain('Separei duas peças novas')
 })

 it('cumprimenta uma vez, não uma por peça', () => {
  const texto = mensagemDeLote({
   client: 'Dra. Ésia', url: LINK, agora: manha,
   pecas: [{ title: 'a', video: true }, { title: 'b', video: true }],
  })
  expect(texto.split('Bom dia').length - 1).toBe(1)
 })

 it('recusa lote de uma peça: aí é a mensagem normal', () => {
  expect(() => mensagemDeLote({ client: 'X', url: LINK, pecas: [{ title: 'só uma' }] })).toThrow()
 })

 it('peça sozinha continua com a mensagem de sempre, com link próprio', () => {
  const texto = mensagemDeAprovacao({ client: 'Dra. Ésia', title: 'caderneta', url: LINK, video: true, agora: manha })
  expect(texto).toContain('Separei vídeo novo pra vocês')
  expect(texto).toContain(LINK)
 })
})
