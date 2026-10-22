import { describe, expect, it, beforeEach } from 'vitest'
import { temVersaoNova } from '@/lib/versao-no-ar'

// 22/10/2026: a Central já estava no ar com a tela nova e o João continuava
// vendo a antiga no app instalado, que não tem botão de recarregar.
const paginaCom = (arquivo: string) =>
  ({ ok: true, text: async () => `<!doctype html><script type="module" src="${arquivo}"></script>` }) as Response

describe('versão no ar', () => {
  beforeEach(() => {
    document.head.innerHTML = '<script type="module" src="/assets/index-AAA111.js"></script>'
  })

  it('acusa versão nova quando o arquivo servido mudou', async () => {
    expect(await temVersaoNova(async () => paginaCom('/assets/index-BBB222.js'))).toBe(true)
  })

  it('fica quieto quando é o mesmo arquivo', async () => {
    expect(await temVersaoNova(async () => paginaCom('/assets/index-AAA111.js'))).toBe(false)
  })

  it('não recarrega por causa de resposta ruim nem de página sem script', async () => {
    expect(await temVersaoNova(async () => ({ ok: false, text: async () => '' }) as Response)).toBe(false)
    expect(await temVersaoNova(async () => paginaCom('/assets/outro.js'))).toBe(false)
    document.head.innerHTML = ''
    expect(await temVersaoNova(async () => paginaCom('/assets/index-BBB222.js'))).toBe(false)
  })
})
