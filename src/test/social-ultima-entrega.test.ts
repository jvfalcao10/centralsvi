import { describe, it, expect } from 'vitest'
import { baseDaPeca, pecaQueEleSubstitui } from '../../api/_lib/social-delivery'

// João, 15/10/2026: "o último enviado é o certo". O quadro tinha a papinha da
// Dra. Ésia em dois cards, um aprovado e um aguardando, com título idêntico,
// porque o coletor corta o " v2" do nome ao montar o título e cada reenvio
// nascia como card novo.
const card = (e: Partial<{id:string;client:string;title:string;stage:string;posted_at:string|null;created_at:string}> = {}) => ({
  id: 'c1', client: 'DRA. ÉSIA LOPES', title: 'Dra Esia - papinha de bebê',
  stage: 'aprovado', posted_at: null, created_at: '2026-10-13T21:21:00Z', ...e })
const entrega = (name: string, client = 'DRA. ÉSIA LOPES') => ({ client, payload: { name } })

describe('base da peça', () => {
  it('ignora extensão, versão e caixa', () => {
    expect(baseDaPeca('Dra Esia - papinha de bebê v2.MP4')).toBe(baseDaPeca('Dra Esia - papinha de bebê .MP4'))
    expect(baseDaPeca('soraia - tons de rosa v4.mov')).toBe(baseDaPeca('Soraia - tons de rosa.MOV'))
  })
  it('entende também (novo) e (final), que a casa usa no lugar de vN', () => {
    expect(baseDaPeca('Dra Enia - primeira consulta (novo).MP4')).toBe(baseDaPeca('Dra Enia - primeira consulta .MP4'))
    expect(baseDaPeca('Spa Nature - vídeo 02 (final).MP4')).toBe(baseDaPeca('Spa nature - vídeo 02 .MOV'))
  })
  it('peça diferente nunca compartilha base', () => {
    expect(baseDaPeca('Dra Esia - pré-natal v2.MP4')).not.toBe(baseDaPeca('Dra Esia - outubro rosa v3.MP4'))
  })
})

describe('qual peça a entrega substitui', () => {
  it('acha o card do mesmo cliente com a mesma base', () =>
    expect(pecaQueEleSubstitui(entrega('Dra Esia - papinha de bebê v2.MP4'), [card()])).toBe('c1'))

  it('cliente diferente não é substituído', () =>
    expect(pecaQueEleSubstitui(entrega('Dra Esia - papinha de bebê v2.MP4', 'Dra Enia'), [card()])).toBeNull())

  // O que foi ao ar é história. Entrega depois disso é peça nova.
  it('peça postada nunca é mexida', () =>
    expect(pecaQueEleSubstitui(entrega('Dra Esia - papinha de bebê v2.MP4'),
      [card({ stage: 'postado', posted_at: '2026-10-14T18:00:00Z' })])).toBeNull())

  it('peça arquivada fica de fora, foi tirada do fluxo de propósito', () =>
    expect(pecaQueEleSubstitui(entrega('Dra Esia - papinha de bebê v2.MP4'), [card({ stage: 'arquivado' })])).toBeNull())

  it('sem card parecido, nasce card novo como antes', () =>
    expect(pecaQueEleSubstitui(entrega('Dra Esia - outubro rosa v3.MP4'), [card()])).toBeNull())

  // Dois cards abertos da mesma peça é o próprio defeito que isto corrige.
  it('com mais de um aberto, junta no mais recente', () => {
    const achado = pecaQueEleSubstitui(entrega('Dra Esia - papinha de bebê v3.MP4'), [
      card({ id: 'velho', created_at: '2026-10-13T21:21:00Z' }),
      card({ id: 'novo', created_at: '2026-10-14T21:26:00Z', stage: 'aguardando' }),
    ])
    expect(achado).toBe('novo')
  })

  it('cliente não identificado não arrisca nada', () =>
    expect(pecaQueEleSubstitui(entrega('qualquer coisa v2.MP4', 'Identificar cliente'), [card()])).toBeNull())

  it('nome curto demais não vira regra', () =>
    expect(pecaQueEleSubstitui(entrega('v2.MP4'), [card({ title: '' })])).toBeNull())
})

// Defeito achado ao montar a limpeza, antes de arquivar nada: o corte de
// extensão era /\.[^.]+$/ e, num título com ponto no meio, comia tudo depois
// dele. Os dois anúncios do mesmo teste do Dr. Daniel viravam "qua 09 09 dr" e
// passavam por uma peça só.
describe('ponto no meio do nome não encurta a base', () => {
  const E2 = 'QUA 09/09 · [DR. DANIEL] Estatico ANUNCIO Meta 1080x1350: pomada x consulta com exame (E2)'
  const E1 = 'QUA 09/09 · [DR. DANIEL] Estatico ANUNCIO Meta 1080x1350: pomada, literal (E1)'

  it('dois anúncios do mesmo teste continuam distintos', () => {
    expect(baseDaPeca(E2)).not.toBe(baseDaPeca(E1))
    expect(baseDaPeca(E2).length).toBeGreaterThan(40)
  })

  it('e um não substitui o outro', () => {
    const cards = [{ id: 'e1', client: 'DR. DANIEL PERALBA', title: E1, stage: 'para_anuncio', posted_at: null, created_at: '2026-09-25T19:04:00Z' }]
    expect(pecaQueEleSubstitui({ client: 'DR. DANIEL PERALBA', payload: { name: E2 + '.png' } }, cards)).toBeNull()
  })

  it('extensão de verdade continua saindo', () => {
    expect(baseDaPeca('Dra Esia - papinha de bebê v2.MP4')).toBe('dra esia papinha de bebe')
    expect(baseDaPeca('arquivo.webm')).toBe('arquivo')
    expect(baseDaPeca('Dra.Enia.MOV')).toBe('dra enia')
  })
})
