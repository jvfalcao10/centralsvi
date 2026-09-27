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
