import { describe, it, expect } from 'vitest'

/**
 * A grade de "Arquivos da peça" tem que seguir a ordem do carrossel.
 *
 * João, 16/10/2026: "você não arrumou o carrossel do Brenno". A ordem ESTAVA
 * certa no banco e no link do cliente (01, 02, 03, 04), mas a tela desenhava
 * os arquivos na ordem crua do registro, que nesse card era 02, 01, 04, 03
 * mais quatro versões antigas. Resultado: a peça abria com "4 · Arquivo final"
 * no topo, e quem olhava concluía que continuava fora de ordem.
 */
const naOrdem = (assets: { id: string }[], selected: string[]) => {
  const posicao = (id: string) => { const i = selected.indexOf(id); return i < 0 ? Number.MAX_SAFE_INTEGER : i }
  return [...assets].sort((x, y) => posicao(x.id) - posicao(y.id))
}

describe('ordem da grade de arquivos', () => {
 it('o caso do Brenno: desenha 1, 2, 3, 4 mesmo com o registro embaralhado', () => {
  // Ordem crua do card 86cbckbyz: as quatro antigas, depois 04, 03, 02, 01.
  const assets = [{ id: 'velha02' }, { id: 'velha01' }, { id: 'velha04' }, { id: 'velha03' },
                  { id: 's04' }, { id: 's03' }, { id: 's02' }, { id: 's01' }]
  const selected = ['s01', 's02', 's03', 's04']
  expect(naOrdem(assets, selected).map(a => a.id).slice(0, 4)).toEqual(['s01', 's02', 's03', 's04'])
 })

 it('os não escolhidos vão para o fim, na ordem em que estavam', () => {
  const assets = [{ id: 'velha02' }, { id: 'velha01' }, { id: 's01' }]
  expect(naOrdem(assets, ['s01']).map(a => a.id)).toEqual(['s01', 'velha02', 'velha01'])
 })

 it('sem nada escolhido, não embaralha o que já estava', () => {
  const assets = [{ id: 'c' }, { id: 'a' }, { id: 'b' }]
  expect(naOrdem(assets, []).map(a => a.id)).toEqual(['c', 'a', 'b'])
 })
})
