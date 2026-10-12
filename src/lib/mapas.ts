import type { UserRole } from '@/contexts/AuthContext'

/**
 * Mapas mentais: funções puras, sem DOM e sem markmap.
 *
 * O markdown é a fonte da verdade. A primeira linha "# Título" é a raiz e o
 * resto é lista aninhada com 2 espaços. "##" e "###" também viram níveis,
 * porque o markmap entende; ao regerar a partir da árvore tudo vira "- ".
 */

/** Permissão da rota /mapas: todo papel interno entra, cliente não. */
export const MAPAS_ROTA = { requiredRole: 'executor' as UserRole, allowTraffic: true, allowSocial: true }

export const PASTAS_MAPA = [
  { valor: 'geral', rotulo: 'Geral' },
  { valor: 'reunioes', rotulo: 'Reuniões' },
  { valor: 'estudos', rotulo: 'Estudos' },
  { valor: 'carteira', rotulo: 'Carteira' },
] as const

export function rotuloPasta(valor: string) {
  return PASTAS_MAPA.find(p => p.valor === valor)?.rotulo ?? valor
}

/** Cores fixas por ramo de primeiro nível. */
export const CORES_RAMOS = ['#D4A82C', '#6C9BD2', '#3BB273', '#E8A33D', '#E05656', '#B98BDB']
export const DOURADO = '#D4A82C'

export interface NoMapa {
  content: string
  children: NoMapa[]
}

export interface MapaMental {
  id: string
  titulo: string
  slug: string
  pasta: string
  markdown: string
  criado_por: string | null
  atualizado_por: string | null
  created_at: string
  updated_at: string
}

export function gerarSlug(titulo: string) {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'mapa'
}

export function markdownInicial(titulo: string) {
  return `# ${titulo.trim()}\n\n- Primeira ideia\n`
}

export function tituloDoMarkdown(markdown: string): string | null {
  for (const linha of markdown.split('\n')) {
    const m = /^#\s+(.+?)\s*$/.exec(linha)
    if (m) return m[1]
    if (linha.trim()) return null
  }
  return null
}

/** Troca (ou cria) a linha "# Título" sem mexer no resto. */
export function trocarTituloNoMarkdown(markdown: string, titulo: string) {
  const linhas = markdown.split('\n')
  for (let i = 0; i < linhas.length; i++) {
    if (/^#\s+/.test(linhas[i])) { linhas[i] = `# ${titulo.trim()}`; return linhas.join('\n') }
    if (linhas[i].trim()) break
  }
  return `# ${titulo.trim()}\n\n${markdown.replace(/^\n+/, '')}`
}

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

/** Decodifica &#xfa;, &#250;, &amp; e companhia. O markmap devolve conteúdo com entidades. */
export function decodificarEntidades(texto: string) {
  return texto.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (tudo, corpo: string) => {
    if (corpo[0] === '#') {
      const codigo = corpo[1] === 'x' || corpo[1] === 'X' ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10)
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : tudo
    }
    return ENTIDADES[corpo] ?? tudo
  })
}

/** HTML de um nó do markmap vira texto de markdown em uma linha. */
export function htmlParaTexto(html: string) {
  let t = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|div)[^>]*>/gi, ' ')
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
  t = decodificarEntidades(t)
  return t.replace(/\s+/g, ' ').trim()
}

/** Árvore vira markdown: raiz como "# ", nós como "- " com 2 espaços por nível. */
export function arvoreParaMarkdown(raiz: NoMapa) {
  const linhas: string[] = [`# ${htmlParaTexto(raiz.content) || 'Sem título'}`, '']
  const descer = (no: NoMapa, profundidade: number) => {
    linhas.push(`${'  '.repeat(profundidade)}- ${htmlParaTexto(no.content) || '...'}`)
    for (const filho of no.children ?? []) descer(filho, profundidade + 1)
  }
  for (const filho of raiz.children ?? []) descer(filho, 0)
  return linhas.join('\n') + '\n'
}

/**
 * Markdown vira árvore de texto puro. Lê "# " como raiz, "##" e "###" como
 * níveis, e "- " com 2 espaços (ou tab) por nível. Linha solta vira nó.
 */
export function markdownParaArvore(markdown: string): NoMapa {
  const raiz: NoMapa = { content: '', children: [] }
  // pilha[p] é o último nó na profundidade p (0 = raiz)
  const pilha: NoMapa[] = [raiz]
  let baseLista = 1
  let tituloLido = false

  const inserir = (profundidade: number, texto: string) => {
    const p = Math.max(1, Math.min(profundidade, pilha.length))
    const no: NoMapa = { content: texto, children: [] }
    pilha[p - 1].children.push(no)
    pilha.length = p
    pilha.push(no)
  }

  for (const bruta of markdown.split('\n')) {
    const linha = bruta.replace(/\s+$/, '')
    if (!linha.trim()) continue
    const titulo = /^#{1,6}\s+(.+)$/.exec(linha)
    if (titulo) {
      const nivel = /^#+/.exec(linha)![0].length
      const texto = titulo[1].trim()
      if (nivel === 1 && !tituloLido) { raiz.content = texto; tituloLido = true; baseLista = 1; continue }
      const profundidade = Math.max(1, nivel - 1)
      inserir(profundidade, texto)
      baseLista = profundidade + 1
      continue
    }
    const item = /^([ \t]*)[-*+]\s+(.*)$/.exec(linha)
    if (item) {
      const recuo = item[1].replace(/\t/g, '  ').length
      inserir(baseLista + Math.floor(recuo / 2), item[2].trim())
      continue
    }
    inserir(baseLista, linha.trim())
  }
  if (!raiz.content) raiz.content = 'Sem título'
  return raiz
}

export function contarNos(raiz: NoMapa): number {
  return (raiz.children ?? []).reduce((soma, filho) => soma + contarNos(filho), (raiz.children ?? []).length)
}

/** Caminho por índices (a partir da raiz) até o nó alvo, comparando por identidade. */
export function caminhoDoNo<T extends { children: T[] }>(raiz: T, alvo: T): number[] | null {
  if (raiz === alvo) return []
  for (let i = 0; i < (raiz.children ?? []).length; i++) {
    const dentro = caminhoDoNo(raiz.children[i], alvo)
    if (dentro) return [i, ...dentro]
  }
  return null
}

export function noPeloCaminho<T extends { children: T[] }>(raiz: T, caminho: number[]): T | null {
  let atual: T | undefined = raiz
  for (const i of caminho) {
    atual = atual?.children?.[i]
    if (!atual) return null
  }
  return atual ?? null
}

function clonar(no: NoMapa): NoMapa {
  return { content: no.content, children: (no.children ?? []).map(clonar) }
}

/** Edições na árvore devolvem uma cópia; a original não muda. */
export function editarNo(raiz: NoMapa, caminho: number[], texto: string): NoMapa {
  const copia = clonar(raiz)
  const no = noPeloCaminho(copia, caminho)
  if (no) no.content = texto
  return copia
}

export function adicionarFilho(raiz: NoMapa, caminho: number[], texto: string): NoMapa {
  const copia = clonar(raiz)
  const no = noPeloCaminho(copia, caminho)
  if (no) no.children.push({ content: texto, children: [] })
  return copia
}

export function adicionarIrmao(raiz: NoMapa, caminho: number[], texto: string): NoMapa {
  if (caminho.length === 0) return adicionarFilho(raiz, caminho, texto)
  const copia = clonar(raiz)
  const pai = noPeloCaminho(copia, caminho.slice(0, -1))
  if (pai) pai.children.splice(caminho[caminho.length - 1] + 1, 0, { content: texto, children: [] })
  return copia
}

export function apagarNo(raiz: NoMapa, caminho: number[]): NoMapa {
  if (caminho.length === 0) return clonar(raiz)
  const copia = clonar(raiz)
  const pai = noPeloCaminho(copia, caminho.slice(0, -1))
  if (pai) pai.children.splice(caminho[caminho.length - 1], 1)
  return copia
}

const FUSO = 'America/Sao_Paulo'

function partesBrasilia(iso: string) {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(data)
  const pegar = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? '00'
  return { dia: pegar('day'), mes: pegar('month'), hora: pegar('hour').replace('24', '00'), minuto: pegar('minute') }
}

/** dd/mm HH:mm em Brasília. A API devolve UTC. */
export function formatarBrasilia(iso: string) {
  const p = partesBrasilia(iso)
  return p ? `${p.dia}/${p.mes} ${p.hora}:${p.minuto}` : ''
}

export function formatarHoraBrasilia(iso: string) {
  const p = partesBrasilia(iso)
  return p ? `${p.hora}:${p.minuto}` : ''
}

export function linkObsidian(slug: string) {
  return `obsidian://open?vault=claude%20%2B%20obsidian&file=recursos%2Fmapas%2F${encodeURIComponent(slug)}`
}
