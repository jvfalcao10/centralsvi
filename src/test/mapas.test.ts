import { describe, expect, it } from 'vitest'
import {
  adicionarFilho, adicionarIrmao, apagarNo, arvoreParaMarkdown, contarNos, decodificarEntidades, editarNo,
  formatarBrasilia, formatarHoraBrasilia, gerarSlug, htmlParaTexto, linkObsidian, markdownInicial, markdownParaArvore,
  tituloDoMarkdown, trocarTituloNoMarkdown,
} from '@/lib/mapas'

describe('árvore vira markdown', () => {
  it('raiz vira "# " e nós viram "- " com 2 espaços por nível', () => {
    const md = arvoreParaMarkdown({ content: 'Carteira', children: [
      { content: 'Médicos', children: [{ content: 'Dr. Brenno', children: [{ content: 'ortopedia', children: [] }] }] },
      { content: 'Solar', children: [] },
    ] })
    expect(md).toBe('# Carteira\n\n- Médicos\n  - Dr. Brenno\n    - ortopedia\n- Solar\n')
  })

  it('decodifica entidades e devolve negrito, itálico e link como markdown', () => {
    const md = arvoreParaMarkdown({ content: 'T&#xED;tulo', children: [
      { content: '<strong>Cad&#xEA;ncia:</strong> 4 posts <a href="https://x.com">site</a> <em>mês</em>', children: [] },
    ] })
    expect(md).toBe('# Título\n\n- **Cadência:** 4 posts [site](https://x.com) *mês*\n')
  })

  it('texto de nó em uma linha só', () => {
    expect(htmlParaTexto('<p>linha 1<br>linha   2</p>')).toBe('linha 1 linha 2')
    expect(decodificarEntidades('&#xfa;&#250;&amp;&quot;&nbsp;x')).toBe('úú&" x')
  })
})

describe('markdown vira título e lista', () => {
  it('lê o título da primeira linha e a lista aninhada', () => {
    const arvore = markdownParaArvore('# Reunião\n\n- Pauta\n  - Item 1\n  - Item 2\n- Decisões\n')
    expect(arvore.content).toBe('Reunião')
    expect(arvore.children.map(c => c.content)).toEqual(['Pauta', 'Decisões'])
    expect(arvore.children[0].children.map(c => c.content)).toEqual(['Item 1', 'Item 2'])
    expect(contarNos(arvore)).toBe(4)
  })

  it('aceita ## e ### como níveis, com a lista pendurada no último título', () => {
    const arvore = markdownParaArvore('# Carteira\n## Médicos\n### Dr. Brenno\n- ortopedia\n  - dor\n## Solar\n- Exatta\n')
    expect(arvore.children.map(c => c.content)).toEqual(['Médicos', 'Solar'])
    expect(arvore.children[0].children[0].content).toBe('Dr. Brenno')
    expect(arvore.children[0].children[0].children[0].content).toBe('ortopedia')
    expect(arvore.children[0].children[0].children[0].children[0].content).toBe('dor')
    expect(arvore.children[1].children[0].content).toBe('Exatta')
  })

  it('vai e volta sem perder a estrutura', () => {
    const md = '# Mapa\n\n- A\n  - A1\n    - A1a\n- B\n'
    expect(arvoreParaMarkdown(markdownParaArvore(md))).toBe(md)
  })

  it('markdown inicial, leitura e troca do título', () => {
    expect(markdownInicial('Novo')).toBe('# Novo\n\n- Primeira ideia\n')
    expect(tituloDoMarkdown('# Olá\n- x')).toBe('Olá')
    expect(tituloDoMarkdown('- sem título')).toBeNull()
    expect(trocarTituloNoMarkdown('# Velho\n\n- x\n', 'Novo')).toBe('# Novo\n\n- x\n')
    expect(trocarTituloNoMarkdown('- x\n', 'Novo')).toBe('# Novo\n\n- x\n')
  })
})

describe('edições na árvore', () => {
  const base = markdownParaArvore('# M\n- A\n  - A1\n- B\n')

  it('edita, cria filho, cria irmão e apaga sem mexer na original', () => {
    expect(arvoreParaMarkdown(editarNo(base, [0, 0], 'A1 nova'))).toContain('  - A1 nova')
    expect(arvoreParaMarkdown(adicionarFilho(base, [1], 'B1'))).toContain('- B\n  - B1')
    expect(arvoreParaMarkdown(adicionarIrmao(base, [0], 'Entre'))).toBe('# M\n\n- A\n  - A1\n- Entre\n- B\n')
    expect(arvoreParaMarkdown(apagarNo(base, [0]))).toBe('# M\n\n- B\n')
    expect(arvoreParaMarkdown(base)).toBe('# M\n\n- A\n  - A1\n- B\n')
  })

  it('a raiz não some e irmão da raiz vira filho', () => {
    expect(arvoreParaMarkdown(apagarNo(base, []))).toBe(arvoreParaMarkdown(base))
    expect(arvoreParaMarkdown(adicionarIrmao(base, [], 'C'))).toBe('# M\n\n- A\n  - A1\n- B\n- C\n')
  })
})

describe('utilidades', () => {
  it('slug sem acento nem símbolo', () => {
    expect(gerarSlug('Carteira SVI · outubro/2026')).toBe('carteira-svi-outubro-2026')
    expect(gerarSlug('Reunião com a Dra. Margareth')).toBe('reuniao-com-a-dra-margareth')
  })

  it('data em Brasília no formato dd/mm HH:mm', () => {
    expect(formatarBrasilia('2026-10-12T21:05:00Z')).toBe('12/10 18:05')
    expect(formatarHoraBrasilia('2026-10-13T02:30:00Z')).toBe('23:30')
  })

  it('link do Obsidian aponta para recursos/mapas/<slug>', () => {
    expect(linkObsidian('carteira-svi-outubro-2026')).toBe('obsidian://open?vault=claude%20%2B%20obsidian&file=recursos%2Fmapas%2Fcarteira-svi-outubro-2026')
  })
})
