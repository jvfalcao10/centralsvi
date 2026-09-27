// Base de conhecimento do Criador: os .md de ./conhecimento, condensados das fontes editoriais,
// das memórias de setembro/2026 e das skills da casa. Alimenta a aba Conhecimento e os agentes.

const arquivos = import.meta.glob('./conhecimento/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface DocConhecimento {
  slug: string
  titulo: string
  resumo: string
  corpo: string
}

export const CONHECIMENTO: DocConhecimento[] = Object.entries(arquivos)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([caminho, corpo]) => {
    const slug = caminho.split('/').pop()!.replace(/\.md$/, '')
    const titulo = corpo.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug
    const resumo = corpo.match(/^>\s+(.+)$/m)?.[1]?.trim() ?? ''
    return { slug, titulo, resumo, corpo }
  })

export const DOC_POR_SLUG: Record<string, DocConhecimento> = Object.fromEntries(CONHECIMENTO.map(d => [d.slug, d]))

/** Junta os documentos pedidos (pelo prefixo numérico ou slug inteiro), na ordem pedida. */
export function docs(...chaves: string[]): string {
  return chaves
    .map(ch => CONHECIMENTO.find(d => d.slug === ch || d.slug.startsWith(`${ch}-`)))
    .filter((d): d is DocConhecimento => !!d)
    .map(d => d.corpo.trim())
    .join('\n\n')
}
