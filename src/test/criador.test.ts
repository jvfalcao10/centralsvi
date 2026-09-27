import { describe, expect, it } from 'vitest'
import { AGENTES, FRAMEWORKS } from '@/data/criador/agentes'
import { CONHECIMENTO } from '@/data/criador/conhecimento'
import { TEMPLATES } from '@/data/criador/templates'
import { lerJsonDoAgente, paraJsonDoAgente } from '@/lib/criador/contrato'
import { docDoExemplo } from '@/lib/criador/doc'
import { revisar } from '@/lib/criador/revisor'

describe('Criador de carrossel', () => {
  it('carrega a base de conhecimento sem travessão', () => {
    expect(CONHECIMENTO.length).toBeGreaterThanOrEqual(20)
    for (const d of CONHECIMENTO) expect(d.corpo, d.slug).not.toMatch(/[—–]/)
  })

  it('monta os prompts de todos os agentes sem travessão nem ponto e vírgula nas regras da casa', () => {
    for (const tpl of TEMPLATES) for (const a of AGENTES) {
      const prompt = a.montar({ tema: 'teste', template: tpl, framework: FRAMEWORKS[0], laminas: 6, material: '' })
      expect(prompt, `${a.id} ${tpl.id}`).not.toMatch(/[—–]/)
      expect(prompt, `${a.id} ${tpl.id}`).not.toMatch(/;/)
    }
  })

  it('o exemplo de cada template passa pelo contrato ida e volta e não tem bloqueio de texto', () => {
    for (const tpl of TEMPLATES) {
      const doc = docDoExemplo(tpl.id)
      const r = lerJsonDoAgente(paraJsonDoAgente(doc))
      expect('doc' in r && r.doc.slides.length, tpl.id).toBe(doc.slides.length)
      const bloqueios = revisar({ ...doc, legenda: 'Uma linha.\n\nVocê já pesquisou?\n\n#a #b #c' }).filter(a => a.nivel === 'bloqueia')
      expect(bloqueios, `${tpl.id}: ${JSON.stringify(bloqueios)}`).toEqual([])
    }
  })

  it('estático: prompts sem travessão, exemplo em peça única, contrato ida e volta e erro amigável', () => {
    for (const tpl of TEMPLATES.filter(t => t.estatico)) {
      for (const a of AGENTES) {
        const prompt = a.montar({ tema: 'teste', template: tpl, framework: FRAMEWORKS[0], laminas: 1, material: '', formato: 'estatico' })
        expect(prompt, `${a.id} ${tpl.id}`).not.toMatch(/[\u2014\u2013;]/)
        if (a.id === 'roteirista' || a.id === 'revisor') expect(prompt).toContain('"formato": "estatico"')
      }
      const doc = docDoExemplo(tpl.id, 'estatico')
      expect(doc.slides).toHaveLength(1)
      expect(doc.opcoes.formato).toBe('estatico')
      const r = lerJsonDoAgente(paraJsonDoAgente(doc))
      expect('doc' in r && r.doc.formato, tpl.id).toBe('estatico')
      expect('doc' in r && r.doc.slides.length, tpl.id).toBe(1)
      const bloqueios = revisar({ ...doc, legenda: 'Uma linha.\n\nVocê já pesquisou?\n\n#a #b #c' }).filter(x => x.nivel === 'bloqueia')
      expect(bloqueios, `${tpl.id}: ${JSON.stringify(bloqueios)}`).toEqual([])
    }
    const doisSlides = lerJsonDoAgente('{"template":"t9","formato":"estatico","slides":[{"tipo":"quadros","campos":{}},{"tipo":"quadros","campos":{}}]}')
    expect('erros' in doisSlides && doisSlides.erros[0]).toContain('peça única')
    const semEstatico = lerJsonDoAgente('{"template":"t7","formato":"estatico","slides":[{"tipo":"frase","campos":{}}]}')
    expect('erros' in semEstatico && semEstatico.erros[0]).toContain('não tem versão estática')
  })

  it('explica em português o que está errado no JSON colado', () => {
    const r = lerJsonDoAgente('{"template":"t9","slides":[{"tipo":"capa"}]}')
    expect('erros' in r && r.erros[0]).toContain('não existe no T9')
    const r2 = lerJsonDoAgente('isso não é json')
    expect('erros' in r2 && r2.erros[0]).toContain('não é um JSON válido')
  })

  it('o revisor acusa travessão, ponto e vírgula, "a gente", "não é X, é Y" e palavra de marketing', () => {
    const doc = docDoExemplo('t10')
    doc.slides[1].campos.titulo = 'Não é o preço, é a demora — a gente vê isso; o lead some do funil.'
    const regras = revisar(doc).filter(a => a.lamina === 1 && a.nivel === 'bloqueia').map(a => a.regra).join(' | ')
    for (const termo of ['Travessão', 'Ponto e vírgula', 'A gente', 'não é X, é Y', '"lead"', '"funil"']) expect(regras).toContain(termo)
  })
})

describe('Enquadramento do T10 (porte do _T10_JS)', () => {
  it('deixa a cabeça marcada inteira dentro da caixa com respiro', async () => {
    const { enquadrar } = await import('@/lib/criador/enquadrar')
    const r = enquadrar({ W: 952, H: 460, iw: 2560, ih: 1440, cab: [[0.4023, 0.0058, 0.6223, 0.6123]], modo: 'caixa' })
    expect(r.ok).toBe(true)
    for (const c of r.cabecas) {
      expect(c[0]).toBeGreaterThanOrEqual(-1)
      expect(c[2]).toBeLessThanOrEqual(953)
      expect(c[3]).toBeLessThanOrEqual(461)
    }
    expect(r.largura).toBeGreaterThanOrEqual(952)
    expect(r.altura).toBeGreaterThanOrEqual(460)
  })

  it('na foto cheia, a cabeça fica acima do texto ou a foto ancora no alto com máscara', async () => {
    const { enquadrar } = await import('@/lib/criador/enquadrar')
    const r = enquadrar({ W: 1080, H: 1350, iw: 1440, ih: 2560, cab: [[0.2141, 0.1559, 0.6734, 0.4997]], util: [0, 0, 1, 0.52], modo: 'bg', topoTexto: 820 })
    expect(r.ok).toBe(true)
    expect(r.tt).toBe(820)
    for (const c of r.cabecas) expect(c[3]).toBeLessThanOrEqual(781)
  })

  it('sem cabeça marcada, centraliza e avisa que não há mapa', async () => {
    const { enquadrar } = await import('@/lib/criador/enquadrar')
    const r = enquadrar({ W: 952, H: 460, iw: 1000, ih: 1000, cab: [], modo: 'caixa' })
    expect(r.mapa).toBe(false)
    expect(Math.round(r.topo)).toBe(Math.round((460 - r.altura) / 2))
  })
})
