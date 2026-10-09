import { describe, expect, it } from 'vitest'
import { clientFacingTitle } from '../../api/_lib/social-client-title'

// Os casos são títulos reais lidos do quadro em 07/10/2026, não exemplos inventados.
describe('título que o cliente lê', () => {
 it('tira a data da fila, a tag do cliente e o jargão de mídia', () => {
  expect(clientFacingTitle('SPA NATURE', 'HOJE · [SPA NATURE] Estático ANUNCIO Meta: oferta de outubro (R$ 280 e R$ 220)')).toBe('Oferta de outubro')
  expect(clientFacingTitle('A FÓRMULA', 'AMANHÃ 18h · [A FÓRMULA] Estatico ANUNCIO Meta: treinar natural nao e sem estrategia')).toBe('Treinar natural nao e sem estrategia')
 })

 it('tira o formato de produção e o recado interno entre parênteses', () => {
  expect(clientFacingTitle('DRA. ERIKA FIGUEIREDO', '[DRA ERIKA] Carrossel 3 slides · Queda no idoso (AGOSTO)')).toBe('Queda no idoso')
  expect(clientFacingTitle('COLÉGIO CHRISTO REI', '28/09 · [COLÉGIO CHRISTO REI] Estático + carrossel: Matrículas 2027 (pedido da diretora)')).toBe('Matrículas 2027')
 })

 it('tira o marcador de retrabalho e o código interno da peça', () => {
  expect(clientFacingTitle('PROURO', 'ALTERAÇÃO · [PROURO] Estático feed: Semana do Glaucoma')).toBe('Semana do Glaucoma')
  expect(clientFacingTitle('DRA. ÉSIA LOPES', '[DRA ÉSIA] Arte SNA · Coceira que pioura à noite')).toBe('Coceira que pioura à noite')
 })

 it('tira o nome do cliente usado como prefixo', () => {
  expect(clientFacingTitle('Alice salazar', 'Alice Salazar - necessaire da mãe')).toBe('Necessaire da mãe')
  expect(clientFacingTitle('Alpha', 'Alpha - outubro rosa')).toBe('Outubro rosa')
 })

 // Título que só repete o nome do cliente não diz nada a quem vai aprovar.
 it('troca por um genérico honesto quando não sobra assunto', () => {
  expect(clientFacingTitle('DRA. ÉRIKA', 'DOUTORA ÉRIKA')).toBe('Arte para aprovação')
  expect(clientFacingTitle('Dra Enia', 'Dra Enia 04', true)).toBe('Vídeo para aprovação')
  expect(clientFacingTitle('Dra Enia', 'Dra Enia', false, 3)).toBe('Carrossel de 3 artes para aprovação')
  expect(clientFacingTitle('Qualquer', '')).toBe('Arte para aprovação')
 })

 it('trata acento decomposto igual ao acento normal', () => {
  // Arquivo vindo do WhatsApp traz o acento separado da letra. O corte do nome
  // do cliente era feito por diferença de comprimento e saía deslocado: o
  // cliente da GM Gás via "Ídeo 04" no lugar do título.
  const composto = 'GM G\u00e1s - v\u00eddeo 04'
  const decomposto = 'GM Ga\u0301s - vi\u0301deo 04'
  expect(clientFacingTitle('GM GAS', decomposto, true)).toBe(clientFacingTitle('GM GAS', composto, true))
  expect(clientFacingTitle('GM GAS', decomposto, true)).not.toMatch(/^.?deo/i)
  expect(clientFacingTitle('Dra Enia', 'Dra Enia - ansiedade vi\u0301deo 06', true)).toBe('Ansiedade vídeo 06')
 })

 it('deixa em paz o título que já fala com o cliente', () => {
  expect(clientFacingTitle('ESPAÇO SORAIA', 'Coisas que eu acho chique')).toBe('Coisas que eu acho chique')
  expect(clientFacingTitle('Dra Enia', 'Dra Enia - ansiedade vídeo 06', true)).toBe('Ansiedade vídeo 06')
 })
})
