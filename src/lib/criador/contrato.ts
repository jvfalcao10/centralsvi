import { z } from 'zod'
import { TEMPLATE_IDS, TEMPLATE_POR_ID } from '@/data/criador/templates'
import type { CarrosselDoc, SlideDoc, TemplateDef, TemplateId } from '@/data/criador/tipos'

// Contrato JSON único entre os agentes de prompt e a aba Montar.
// O Roteirista e o Revisor devolvem exatamente este formato, e é ele que a aba Montar valida.
//
// {
//   "template": "t10",
//   "titulo": "nome interno do carrossel",
//   "legenda": "legenda do post",
//   "slides": [
//     { "tipo": "capa", "campos": { "titulo": "...", "apoio": "..." }, "foto": "descrição da foto desejada" }
//   ]
// }
// Campo de lista vai como array de textos. Marcações aceitas: **negrito** e ==destaque==. "\n" quebra a linha.

const valorCampo = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number()]))])

const SlideJson = z.object({
  tipo: z.string({ required_error: 'falta o "tipo" da lâmina' }).min(1, 'o "tipo" da lâmina está vazio'),
  campos: z.record(valorCampo, { invalid_type_error: '"campos" precisa ser um objeto { "chave": "texto" }' }).default({}),
  foto: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  fotos: z.union([z.array(z.string()), z.record(z.string())]).optional(),
})

export const CarrosselJson = z.object({
  template: z.enum(TEMPLATE_IDS, { errorMap: () => ({ message: `"template" precisa ser um destes: ${TEMPLATE_IDS.join(', ')}` }) }),
  titulo: z.string().optional().default(''),
  legenda: z.string().optional().default(''),
  slides: z.array(SlideJson, { required_error: 'falta a lista "slides"', invalid_type_error: '"slides" precisa ser uma lista' }).min(1, 'a lista "slides" está vazia'),
})

export type CarrosselJsonT = z.infer<typeof CarrosselJson>

export const novoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`)

function paraTexto(v: z.infer<typeof valorCampo>): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean).join('\n')
  return String(v)
}

/** Tira cerca de código (```json) e texto em volta, pegando do primeiro { ao último }. */
export function extrairJson(bruto: string): string {
  const semCerca = bruto.replace(/```(?:json)?/gi, '')
  const ini = semCerca.indexOf('{')
  const fim = semCerca.lastIndexOf('}')
  return ini >= 0 && fim > ini ? semCerca.slice(ini, fim + 1) : semCerca.trim()
}

function caminhoAmigavel(path: (string | number)[]): string {
  const partes: string[] = []
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    if (p === 'slides' && typeof path[i + 1] === 'number') { partes.push(`lâmina ${(path[i + 1] as number) + 1}`); i++; continue }
    partes.push(`"${p}"`)
  }
  return partes.join(', ')
}

export type ResultadoContrato =
  | { ok: true; doc: Omit<CarrosselDoc, 'opcoes' | 'id'>; avisos: string[] }
  | { ok: false; erros: string[] }

/** Valida o JSON colado e converte para o documento da aba Montar. Nunca lança erro. */
export function lerJsonDoAgente(bruto: string, templatePadrao?: TemplateId): ResultadoContrato {
  if (!bruto.trim()) return { ok: false, erros: ['Cole o JSON que o agente devolveu.'] }
  let dado: unknown
  try {
    dado = JSON.parse(extrairJson(bruto))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, erros: [`O texto colado não é um JSON válido (${msg}). Peça ao agente para devolver só o JSON, sem comentários.`] }
  }
  if (dado && typeof dado === 'object' && !Array.isArray(dado) && !(dado as Record<string, unknown>).template && templatePadrao) {
    dado = { ...(dado as object), template: templatePadrao }
  }
  const r = CarrosselJson.safeParse(dado)
  if (!r.success) {
    return { ok: false, erros: r.error.issues.slice(0, 12).map(i => `${i.path.length ? caminhoAmigavel(i.path) + ': ' : ''}${i.message}`) }
  }
  const tpl: TemplateDef = TEMPLATE_POR_ID[r.data.template]
  const erros: string[] = []
  const avisos: string[] = []
  const slides: SlideDoc[] = r.data.slides.map((s, i) => {
    const def = tpl.slideTypes.find(t => t.tipo === s.tipo)
    if (!def) {
      erros.push(`lâmina ${i + 1}: o tipo "${s.tipo}" não existe no ${tpl.codigo}. Tipos válidos: ${tpl.slideTypes.map(t => t.tipo).join(', ')}.`)
      return { id: novoId(), tipo: s.tipo, campos: {}, fotos: {} }
    }
    const campos: Record<string, string> = {}
    for (const campo of def.campos) {
      const v = s.campos[campo.chave]
      campos[campo.chave] = v === undefined ? (campo.padrao ?? '') : paraTexto(v)
    }
    const extras = Object.keys(s.campos).filter(k => !def.campos.some(c => c.chave === k))
    if (extras.length) avisos.push(`lâmina ${i + 1}: campo(s) ignorado(s) porque o tipo "${s.tipo}" não usa: ${extras.join(', ')}.`)
    const fotoPedida = [
      ...(Array.isArray(s.foto) ? s.foto : s.foto ? [s.foto] : []),
      ...(Array.isArray(s.fotos) ? s.fotos : s.fotos ? Object.entries(s.fotos).map(([k, v]) => `${k}: ${v}`) : []),
    ].filter(Boolean).join(' / ')
    return { id: novoId(), tipo: s.tipo, campos, foto: fotoPedida || undefined, fotos: {} }
  })
  if (erros.length) return { ok: false, erros }
  return { ok: true, doc: { template: r.data.template, titulo: r.data.titulo, legenda: r.data.legenda, slides }, avisos }
}

/** Converte o documento atual de volta para o contrato (para levar ao Revisor ou guardar). */
export function paraJsonDoAgente(doc: Pick<CarrosselDoc, 'template' | 'titulo' | 'legenda' | 'slides'>): string {
  const tpl = TEMPLATE_POR_ID[doc.template]
  return JSON.stringify({
    template: doc.template,
    titulo: doc.titulo,
    legenda: doc.legenda,
    slides: doc.slides.map(s => {
      const def = tpl.slideTypes.find(t => t.tipo === s.tipo)
      const campos: Record<string, string | string[]> = {}
      for (const [k, v] of Object.entries(s.campos)) {
        const c = def?.campos.find(x => x.chave === k)
        if (!v) continue
        campos[k] = c?.tipo === 'lista' ? v.split('\n').map(x => x.trim()).filter(Boolean) : v
      }
      return { tipo: s.tipo, campos, ...(s.foto ? { foto: s.foto } : {}) }
    }),
  }, null, 2)
}

/** Especificação legível do template para os prompts: cada tipo de lâmina, campos, limites e fotos. */
export function especificacaoDoTemplate(tpl: TemplateDef): string {
  const linhas: string[] = [`TEMPLATE ${tpl.codigo} · ${tpl.nome} (id "${tpl.id}")`, `Quando usar: ${tpl.quandoUsar}`]
  if (tpl.uso) linhas.push(`Uso: ${tpl.uso}`)
  linhas.push(`Sequência padrão de lâminas: ${tpl.estrutura.join(', ')}.`, '', 'Tipos de lâmina aceitos:')
  for (const st of tpl.slideTypes) {
    linhas.push(`- "${st.tipo}" (${st.nome}): ${st.descricao}`)
    for (const c of st.campos) {
      const lim = c.tipo === 'lista' ? `lista de até ${c.maxItens ?? 5} itens, até ${c.limite} caracteres por item` : c.tipo === 'opcao' ? `opção: ${(c.opcoes ?? []).map(o => `"${o.valor}"`).join(' ou ')}` : `até ${c.limite} caracteres`
      linhas.push(`    · campos.${c.chave}: ${c.rotulo}, ${lim}${c.obrigatorio ? ', obrigatório' : ', opcional'}${c.ajuda ? `. ${c.ajuda}` : ''}`)
    }
    for (const f of st.fotos) linhas.push(`    · foto "${f.chave}": ${f.rotulo}, proporção ${f.proporcao}${f.obrigatoria ? ', obrigatória' : ', opcional'}`)
  }
  return linhas.join('\n')
}

/** Exemplo do contrato preenchido com a primeira lâmina de cada tipo do template. */
export function exemploDoContrato(tpl: TemplateDef): string {
  const vistos = new Set<string>()
  const slides = tpl.exemplo.filter(s => (vistos.has(s.tipo) ? false : (vistos.add(s.tipo), true))).map(s => {
    const def = tpl.slideTypes.find(t => t.tipo === s.tipo)
    const campos: Record<string, string | string[]> = {}
    for (const c of def?.campos ?? []) {
      const v = s.campos[c.chave]
      if (!v) continue
      campos[c.chave] = c.tipo === 'lista' ? v.split('\n') : v
    }
    return { tipo: s.tipo, campos, ...(def?.usaFoto ? { foto: 'descrição curta da foto desejada para esta lâmina' } : {}) }
  })
  return JSON.stringify({ template: tpl.id, titulo: 'nome interno do carrossel', legenda: 'legenda do post', slides }, null, 2)
}
