import { describe, it, expect, vi } from 'vitest'
import { separarPorTipo, statusDaConta, inicioDoMes, fracaoDoMes, META } from '../../api/_lib/social-cadencia'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { getVisibleNavigation } = await import('../lib/navigation')

// Régua do João, 11/10/2026: 4 a 6 posts de feed e 4 vídeos por mês, por
// cliente, somente. Veio da auditoria que achou contas de 2 a 25 posts sem
// critério: a Dra. Ênia postou o dobro e a mediana de engajamento caiu de 82
// para 19. Story não entra na conta.
//
// João, 19/10: "a cadência deve estar dentro da Central SVI, porque quero que
// a social media tenha acesso".
const outubro = (dia: number) => Date.parse(`2026-10-${String(dia).padStart(2, '0')}T12:00:00-03:00`)

describe('contagem do mês', () => {
 it('separa reel de feed e ignora story', () => {
  const m = [
   { timestamp: '2026-10-05T12:00:00+0000', media_type: 'VIDEO', media_product_type: 'REELS' },
   { timestamp: '2026-10-06T12:00:00+0000', media_type: 'IMAGE', media_product_type: 'FEED' },
   { timestamp: '2026-10-07T12:00:00+0000', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED' },
   // Story de vídeo não pode virar vídeo da cadência.
   { timestamp: '2026-10-08T12:00:00+0000', media_type: 'VIDEO', media_product_type: 'STORY' },
  ]
  expect(separarPorTipo(m, inicioDoMes(outubro(19)))).toEqual({ feed: 2, video: 1 })
 })

 it('não conta o que é do mês passado', () => {
  const m = [{ timestamp: '2026-09-28T12:00:00+0000', media_type: 'IMAGE', media_product_type: 'FEED' }]
  expect(separarPorTipo(m, inicioDoMes(outubro(19)))).toEqual({ feed: 0, video: 0 })
 })

 it('o mês começa na virada de Brasília, não de Londres', () => {
  // 01/10 às 00h30 de Brasília é 03h30 UTC: já é do mês novo.
  const m = [{ timestamp: '2026-10-01T03:30:00+0000', media_type: 'IMAGE', media_product_type: 'FEED' }]
  expect(separarPorTipo(m, inicioDoMes(outubro(19))).feed).toBe(1)
  // 30/09 às 23h de Brasília é 02h UTC do dia 1: ainda é do mês passado.
  const antes = [{ timestamp: '2026-10-01T02:00:00+0000', media_type: 'IMAGE', media_product_type: 'FEED' }]
  expect(separarPorTipo(antes, inicioDoMes(outubro(19))).feed).toBe(0)
 })
})

describe('situação de cada conta', () => {
 const ontem = (agora: number) => new Date(agora - 86400000).toISOString()
 it('sete dias sem postar é parado, mesmo com o número do mês fechado', () => {
  const agora = outubro(19)
  expect(statusDaConta({ feed: 6, video: 4, ultimo: new Date(agora - 8 * 86400000).toISOString(), fracao: 0.6, agora })).toBe('parado')
 })

 it('passar do teto é acima, não é capricho', () => {
  const agora = outubro(19)
  expect(statusDaConta({ feed: META.feedMax + 1, video: 4, ultimo: ontem(agora), fracao: 0.6, agora })).toBe('acima')
 })

 it('atraso compara com o ritmo do dia, não com a meta cheia', () => {
  const agora = outubro(10)
  // Dia 10 de 31 com 1 post não é atraso: o esperado ainda é baixo.
  expect(statusDaConta({ feed: 1, video: 1, ultimo: ontem(agora), fracao: 10 / 31, agora })).toBe('em dia')
  // Dia 28 com 1 post é.
  const fim = outubro(28)
  expect(statusDaConta({ feed: 1, video: 1, ultimo: ontem(fim), fracao: 28 / 31, agora: fim })).toBe('atrasado')
 })

 it('conta em dia no fim do mês com a meta cumprida', () => {
  const agora = outubro(28)
  expect(statusDaConta({ feed: 5, video: 4, ultimo: ontem(agora), fracao: 28 / 31, agora })).toBe('em dia')
 })

 it('a fração do mês é o dia sobre os dias que o mês tem', () => {
  expect(fracaoDoMes(outubro(19))).toEqual({ dia: 19, diasNoMes: 31, fracao: 19 / 31 })
 })
})

describe('quem enxerga a cadência', () => {
 it('a social media vê, que foi o motivo de trazer para a Central', () => {
  const nav = getVisibleNavigation({ can: () => false, isSocial: true })
  expect(nav.main.flatMap(a => a.items.map(i => i.url))).toContain('/content/cadencia')
 })
 it('o designer também vê', () => {
  const nav = getVisibleNavigation({ can: () => false, isDesign: true })
  expect(nav.main.flatMap(a => a.items.map(i => i.url))).toContain('/content/cadencia')
 })
 it('o cliente não vê', () => {
  expect(getVisibleNavigation({ can: () => true, isClient: true }).main).toEqual([])
 })
})

// João, 19/10/2026: "quero clicar no cliente e abrir o link das últimas
// postagens, além disso quero filtro para classificar, tipo parado, e
// etiquetas também para clicar e deixar só atrasado".
describe('últimas publicações do cliente', () => {
 const post = (dia: number, tipo: 'REELS' | 'FEED' | 'STORY') => ({
  timestamp: `2026-10-${String(dia).padStart(2, '0')}T12:00:00+0000`,
  media_type: tipo === 'REELS' ? 'VIDEO' : 'IMAGE', media_product_type: tipo,
  permalink: `https://instagram.com/p/dia${dia}`, like_count: dia, comments_count: 1,
 })

 it('devolve da mais nova para a mais velha, com link', async () => {
  const { ultimasPublicacoes } = await import('../../api/_lib/social-cadencia')
  const r = ultimasPublicacoes([post(3, 'FEED'), post(9, 'REELS'), post(6, 'FEED')])
  expect(r.map(p => p.timestamp.slice(8, 10))).toEqual(['09', '06', '03'])
  expect(r[0]).toMatchObject({ tipo: 'video', permalink: 'https://instagram.com/p/dia9', curtidas: 9 })
 })

 it('story fica de fora também aqui', async () => {
  const { ultimasPublicacoes } = await import('../../api/_lib/social-cadencia')
  expect(ultimasPublicacoes([post(5, 'STORY'), post(4, 'FEED')]).map(p => p.tipo)).toEqual(['feed'])
 })

 it('corta em oito, para caber numa tela', async () => {
  const { ultimasPublicacoes } = await import('../../api/_lib/social-cadencia')
  const muitos = Array.from({ length: 14 }, (_, i) => post(i + 1, 'FEED'))
  expect(ultimasPublicacoes(muitos)).toHaveLength(8)
 })

 it('conta sem publicação nenhuma devolve lista vazia, não quebra', async () => {
  const { ultimasPublicacoes } = await import('../../api/_lib/social-cadencia')
  expect(ultimasPublicacoes([])).toEqual([])
 })
})
