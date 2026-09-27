import { TEMPLATE_POR_ID } from '@/data/criador/templates'
import type { CarrosselDoc } from '@/data/criador/tipos'
import { itens, textoLimpo } from './texto'

// Revisor automático do Criador (sem IA). Portado das regras bloqueantes de
// ~/Dev/conteudo-joao/carrosseis/regras/regras.json e das regras da casa.
// "bloqueia" trava a exportação (a menos que o João marque "exportar mesmo assim").

export type Nivel = 'bloqueia' | 'aviso'

export interface Achado {
  nivel: Nivel
  regra: string
  onde: string
  trecho?: string
  /** Índice da lâmina (0 based) quando o achado é de uma lâmina. */
  lamina?: number
}

interface RegraTexto { regra: string; nivel: Nivel; re: RegExp }

// Emoji: faixas de pictograma. Estrelas (★ ☆) ficam de fora porque a busca simulada do T7 usa.
const EMOJI = /(?![★☆])(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F})/u

export const REGRAS_TEXTO: RegraTexto[] = [
  { regra: 'Travessão ou meia-risca (use vírgula, dois-pontos, parêntese ou ponto)', nivel: 'bloqueia', re: /[—–]|--/ },
  { regra: 'Aspas curvas ou apóstrofo tipográfico (use aspas retas)', nivel: 'bloqueia', re: /[“”‘’]/ },
  { regra: 'Ponto e vírgula', nivel: 'bloqueia', re: /;/ },
  { regra: '"A gente" escrito (troque por nós, eu, você ou a SVI)', nivel: 'bloqueia', re: /(^|[^\p{L}])a gente([^\p{L}]|$)/iu },
  { regra: 'Emoji na arte', nivel: 'bloqueia', re: EMOJI },
  { regra: 'Molde "não é X, é Y"', nivel: 'bloqueia', re: /\bn[ãa]o\s+(é|e|era|foi)\s+[^!?\n]{1,90}?[,.:]\s*(é|era|foi)\s/iu },
  { regra: 'Slogan com quiasmo ("menos X, mais Y")', nivel: 'bloqueia', re: /\bmenos\s+[^,.;\n]{1,30},\s*mais\s+[^,.;\n]{1,30}/iu },
  { regra: 'Fórmula de revelação ("o segredo é", "o método inteiro em uma frase")', nivel: 'bloqueia', re: /(uma frase que (e|é) o m(e|é)todo inteiro|o m(e|é)todo inteiro em uma frase|o segredo (e|é)\b)/iu },
  { regra: 'Regionalismo forçado ("Sul do Pará", "porteira", "no interior")', nivel: 'bloqueia', re: /(sul do par[áa]|porteira|no interior\b)/iu },
  { regra: 'Espaço antes de pontuação', nivel: 'aviso', re: /\s+[,.;:!?](\s|$)/ },
]

// Vocabulário de marketing que o paciente e o médico leigo não usam.
export const PALAVRAS_PROIBIDAS: { termo: string; re: RegExp; nivel: Nivel; troca: string }[] = [
  { termo: 'ficha', re: /\bfichas?\b/iu, nivel: 'bloqueia', troca: 'perfil no Google, o que aparece quando pesquisam' },
  { termo: 'SEO', re: /\bSEO\b/iu, nivel: 'bloqueia', troca: 'aparecer quando pesquisam' },
  { termo: 'AEO', re: /\bAEO\b/iu, nivel: 'bloqueia', troca: 'aparecer quando perguntam ao ChatGPT' },
  { termo: 'funil', re: /\bfun(il|is)\b/iu, nivel: 'bloqueia', troca: 'o caminho do paciente até marcar' },
  { termo: 'lead', re: /\bleads?\b/iu, nivel: 'bloqueia', troca: 'paciente, contato, quem pediu informação' },
  { termo: 'engajamento', re: /\bengajamento\b/iu, nivel: 'bloqueia', troca: 'quem comenta, quem responde' },
  { termo: 'branding', re: /\bbranding\b/iu, nivel: 'bloqueia', troca: 'como o paciente te reconhece' },
  { termo: 'autoridade digital', re: /autoridade digital/iu, nivel: 'bloqueia', troca: 'o paciente confiar antes da consulta' },
  { termo: 'presença digital', re: /presen[çc]a digital/iu, nivel: 'bloqueia', troca: 'o que aparece quando pesquisam o seu nome' },
  { termo: 'jornada', re: /\bjornadas?\b/iu, nivel: 'bloqueia', troca: 'o caminho do paciente' },
  { termo: 'posicionamento', re: /\bposicionamento\b/iu, nivel: 'aviso', troca: 'diga o que isso muda para o paciente, sem o substantivo solto' },
]

function contarNegacao(texto: string) {
  return (texto.match(/\bn[ãa]o\s+(é\s+)?[^.!?\n]{2,60}?,\s*(mas|é)\s/giu) || []).length
}

const normalizar = (s: string) => textoLimpo(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

function frases(texto: string) {
  // a quebra de linha é visual: a frase vai até o ponto
  return textoLimpo(texto).replace(/\s*\n\s*/g, ' ').split(/(?<=[.!?])\s+/).map(normalizar).filter(f => f.length >= 20)
}

function checarTexto(texto: string, onde: string, lamina: number | undefined, out: Achado[]) {
  const limpo = textoLimpo(texto)
  if (!limpo.trim()) return
  for (const r of REGRAS_TEXTO) {
    const m = limpo.match(r.re)
    if (m) out.push({ nivel: r.nivel, regra: r.regra, onde, trecho: trecho(limpo, m.index ?? 0), lamina })
  }
  for (const p of PALAVRAS_PROIBIDAS) {
    const m = limpo.match(p.re)
    if (m) out.push({ nivel: p.nivel, regra: `Palavra de marketing "${p.termo}" (troque por: ${p.troca})`, onde, trecho: trecho(limpo, m.index ?? 0), lamina })
  }
}

function trecho(texto: string, i: number) {
  const ini = Math.max(0, i - 25)
  const fim = Math.min(texto.length, i + 35)
  return (ini > 0 ? '…' : '') + texto.slice(ini, fim).replace(/\n/g, ' ') + (fim < texto.length ? '…' : '')
}

/** Roda todas as regras no carrossel e na legenda. Determinístico: mesmo texto, mesmo resultado. */
export function revisar(doc: CarrosselDoc): Achado[] {
  const out: Achado[] = []
  const tpl = TEMPLATE_POR_ID[doc.template]
  if (!doc.slides.length) out.push({ nivel: 'bloqueia', regra: 'Carrossel sem lâminas', onde: 'Carrossel' })

  const vistas = new Map<string, number>()
  let textoTodo = ''

  doc.slides.forEach((s, i) => {
    const onde = `Lâmina ${i + 1}`
    const def = tpl.slideTypes.find(t => t.tipo === s.tipo)
    if (!def) { out.push({ nivel: 'bloqueia', regra: `Tipo "${s.tipo}" não existe no ${tpl.codigo}`, onde, lamina: i }); return }

    for (const c of def.campos) {
      const valor = s.campos[c.chave] ?? ''
      const rotulo = `${onde} · ${c.rotulo}`
      if (c.tipo === 'opcao') continue
      if (c.obrigatorio && !textoLimpo(valor).trim()) out.push({ nivel: 'bloqueia', regra: 'Campo obrigatório vazio', onde: rotulo, lamina: i })
      if (c.tipo === 'lista') {
        const lista = itens(valor)
        if (c.maxItens && lista.length > c.maxItens) out.push({ nivel: 'bloqueia', regra: `Lista com ${lista.length} itens (máximo ${c.maxItens})`, onde: rotulo, lamina: i })
        lista.forEach((item, k) => {
          const n = textoLimpo(item).length
          if (n > c.limite) out.push({ nivel: 'bloqueia', regra: `Item ${k + 1} passou do limite: ${n} de ${c.limite} caracteres`, onde: rotulo, trecho: item, lamina: i })
        })
      } else {
        const n = textoLimpo(valor).length
        if (n > c.limite) out.push({ nivel: 'bloqueia', regra: `Passou do limite: ${n} de ${c.limite} caracteres`, onde: rotulo, lamina: i })
      }
      checarTexto(valor, rotulo, i, out)
      textoTodo += '\n' + textoLimpo(valor)
      if (/\d/.test(textoLimpo(valor)) && /\b\d+([.,]\d+)?\s*(%|mil\b|milh)/iu.test(textoLimpo(valor))) {
        out.push({ nivel: 'aviso', regra: 'Número ou percentual na copy: confira a fonte antes de publicar (número sem fonte não vira manchete)', onde: rotulo, trecho: textoLimpo(valor).slice(0, 70), lamina: i })
      }
      for (const f of frases(valor)) {
        const antes = vistas.get(f)
        // a última lâmina pode ecoar a capa de propósito (loop do framework F), então ali vira aviso
        if (antes !== undefined && antes !== i) out.push({ nivel: i === doc.slides.length - 1 ? 'aviso' : 'bloqueia', regra: `Frase repetida da lâmina ${antes + 1}`, onde: rotulo, trecho: f.slice(0, 70), lamina: i })
        else vistas.set(f, i)
      }
    }

    for (const f of def.fotos) {
      const temFoto = !!(s.fotos[f.chave]?.path || s.fotos[f.chave]?.url)
      if (f.obrigatoria && !temFoto) out.push({ nivel: 'bloqueia', regra: `Falta a foto "${f.rotulo}" (${f.proporcao})`, onde, lamina: i })
      // T10: sem cabeça marcada não há enquadramento automático (na Central não existe detector de rosto)
      if (temFoto && doc.template === 't10' && !s.fotos[f.chave]?.cab?.length) {
        out.push({ nivel: 'aviso', regra: `Marque o rosto na foto "${f.rotulo}" para o enquadramento automático (sem marcação, o foco é manual e ninguém confere a cabeça)`, onde, lamina: i })
      }
      // Foto cheia com texto no pé: o rosto precisa ficar no terço de cima.
      const cheia = (doc.template === 't10' && ['capa', 'foto', 'fecho'].includes(s.tipo)) || doc.template === 't9'
      const foco = s.fotos[f.chave]
      if (temFoto && cheia && foco && !foco.cab?.length && foco.y > 45) {
        out.push({ nivel: 'aviso', regra: `Foco vertical em ${foco.y}%: confira se o rosto ficou no terço de cima e fora da área do texto`, onde: `${onde} · ${f.rotulo}`, lamina: i })
      }
    }
  })

  const negacoes = contarNegacao(textoTodo)
  if (negacoes > 4) out.push({ nivel: 'aviso', regra: `Negação e contraste em ${negacoes} lâminas (dose máxima 4)`, onde: 'Carrossel' })

  checarTexto(doc.titulo, 'Título interno', undefined, out)

  const legenda = doc.legenda || ''
  if (legenda.trim()) {
    for (const r of REGRAS_TEXTO) {
      const m = legenda.match(r.re)
      if (m) out.push({ nivel: r.nivel, regra: r.regra, onde: 'Legenda', trecho: trecho(legenda, m.index ?? 0) })
    }
    for (const p of PALAVRAS_PROIBIDAS) {
      const m = legenda.match(p.re)
      if (m) out.push({ nivel: 'aviso', regra: `Palavra de marketing "${p.termo}" na legenda (troque por: ${p.troca})`, onde: 'Legenda', trecho: trecho(legenda, m.index ?? 0) })
    }
    const tags = legenda.match(/#[\p{L}\d_]+/gu) || []
    if (tags.length < 3 || tags.length > 5) out.push({ nivel: 'aviso', regra: `Legenda com ${tags.length} hashtags (o combinado é de 3 a 5, no fim)`, onde: 'Legenda' })
    if (tags.length && !/(#[\p{L}\d_]+\s*)+$/u.test(legenda.trim())) out.push({ nivel: 'aviso', regra: 'Hashtag no meio do texto (hashtags só no fim)', onde: 'Legenda' })
    if (/[^\n]{500,}/.test(legenda)) out.push({ nivel: 'aviso', regra: 'Parede de texto na legenda (parágrafo com mais de 500 caracteres)', onde: 'Legenda' })
    if (!/\?/.test(legenda)) out.push({ nivel: 'aviso', regra: 'Legenda sem pergunta ao leitor', onde: 'Legenda' })
  } else {
    out.push({ nivel: 'aviso', regra: 'Legenda vazia', onde: 'Legenda' })
  }

  return out
}

export const temBloqueio = (achados: Achado[]) => achados.some(a => a.nivel === 'bloqueia')
