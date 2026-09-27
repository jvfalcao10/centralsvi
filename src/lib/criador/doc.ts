import { TEMPLATE_POR_ID } from '@/data/criador/templates'
import type { CarrosselDoc, OpcoesCarrossel, SlideDoc, TemplateId } from '@/data/criador/tipos'
import { novoId } from './contrato'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function dataRodapePadrao(d = new Date()) {
  return `${MESES[d.getMonth()]}, ©${d.getFullYear()}`
}

export function opcoesPadrao(template: TemplateId): OpcoesCarrossel {
  const tpl = TEMPLATE_POR_ID[template]
  return { assinatura: tpl.assinaturaPadrao, ...(tpl.fundoPadrao ? { fundo: tpl.fundoPadrao } : {}), ...(template === 't10' ? { dataRodape: dataRodapePadrao() } : {}) }
}

export function novoSlide(template: TemplateId, tipo: string): SlideDoc {
  const def = TEMPLATE_POR_ID[template].slideTypes.find(t => t.tipo === tipo) ?? TEMPLATE_POR_ID[template].slideTypes[0]
  const campos: Record<string, string> = {}
  for (const c of def.campos) campos[c.chave] = c.padrao ?? ''
  return { id: novoId(), tipo: def.tipo, campos, fotos: {} }
}

export function novoDoc(template: TemplateId): CarrosselDoc {
  const tpl = TEMPLATE_POR_ID[template]
  return { titulo: '', template, legenda: '', slides: tpl.estrutura.map(t => novoSlide(template, t)), opcoes: opcoesPadrao(template) }
}

export function docDoExemplo(template: TemplateId): CarrosselDoc {
  const tpl = TEMPLATE_POR_ID[template]
  return {
    titulo: `Exemplo ${tpl.codigo} · ${tpl.nome}`, template, legenda: '',
    slides: tpl.exemplo.map(s => ({ ...s, id: novoId(), campos: { ...s.campos }, fotos: { ...s.fotos } })),
    opcoes: opcoesPadrao(template),
  }
}

/** Aplica o foco padrão de cada vaga quando a foto chega sem foco. */
export function focoPadrao(template: TemplateId, tipo: string, chave: string): [number, number] {
  const f = TEMPLATE_POR_ID[template].slideTypes.find(t => t.tipo === tipo)?.fotos.find(x => x.chave === chave)
  return f?.foco ?? [50, 30]
}
