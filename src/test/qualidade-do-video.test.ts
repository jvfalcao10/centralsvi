import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { videoAbaixoDoPadrao, bitrateDoVideo, MBPS_MINIMO } = await import('../lib/social-board')

// João, 19/10/2026, depois de uma semana caçando qualidade ruim: "entregue o
// nosso melhor sempre". A régua é o que o Matheus entrega, 19 a 27 Mbps.
// Tudo que foi ao ar abaixo de 8 Mbps nesta semana foi defeito, não escolha.
const MB = 1048576
const video = (mb: number, seg: number, extra = {}) => ({
 id: 'v', name: 'peca.mp4', path: 'x', type: 'video/mp4',
 bytes: mb * MB, duration_ms: seg * 1000, ...extra,
})
const peca = (assets: ReturnType<typeof video>[], stage = 'conferir') =>
 ({ stage, assets, selected_assets: assets.map(a => a.id) }) as Parameters<typeof videoAbaixoDoPadrao>[0]

describe('régua de qualidade do vídeo', () => {
 it('avisa no caso real da Dra. Erika, 5,5 Mbps', () => {
  expect(videoAbaixoDoPadrao(peca([video(36.1, 52.5)]))).toBeCloseTo(5.5, 0)
 })

 it('cala no padrão do Matheus, 19 a 27 Mbps', () => {
  expect(videoAbaixoDoPadrao(peca([video(141, 57)]))).toBeNull()
  expect(videoAbaixoDoPadrao(peca([video(151.3, 44.9)]))).toBeNull()
 })

 it('o corte é 8 Mbps', () => {
  expect(MBPS_MINIMO).toBe(8)
  // 10 MB em 10s é exatamente 8 Mbps: no limite, não avisa.
  expect(videoAbaixoDoPadrao(peca([video(10, 10)]))).toBeNull()
  expect(videoAbaixoDoPadrao(peca([video(9, 10)]))).not.toBeNull()
 })

 it('arte não tem bitrate e não dispara o aviso', () => {
  const arte = { id: 'a', name: 'arte.png', path: 'x', type: 'image/png', bytes: 2 * MB }
  expect(videoAbaixoDoPadrao(peca([arte as never]))).toBeNull()
 })

 it('vídeo sem duração gravada não vira alarme falso', () => {
  expect(bitrateDoVideo(video(30, 0) as never)).toBeNull()
  expect(videoAbaixoDoPadrao(peca([video(30, 0)]))).toBeNull()
 })

 it('não avisa no que já foi postado nem no arquivo', () => {
  for (const stage of ['postado', 'arquivado'])
   expect(videoAbaixoDoPadrao(peca([video(36.1, 52.5)], stage)), stage).toBeNull()
 })

 it('arquivo ruim não marcado não conta: vale o que vai ao cliente', () => {
  const bom = video(141, 57), ruim = { ...video(36.1, 52.5), id: 'ruim' }
  const card = { stage: 'conferir', assets: [bom, ruim], selected_assets: [bom.id] }
  expect(videoAbaixoDoPadrao(card as never)).toBeNull()
 })
})
