export type ApprovalStatus = 'pendente' | 'aprovado' | 'enviado' | 'reprovado'

export interface ContentApproval {
  id: string
  tipo: string
  cliente: string
  chatid: string | null
  mes: string | null
  ano: number | null
  titulo: string
  texto: string
  status: ApprovalStatus
  motivo?: string | null
  aprovado_por?: string | null
  criado_em: string
  atualizado_em?: string | null
  enviado_em: string | null
}

export const APPROVAL_STATUSES: { value: ApprovalStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendentes' },
  { value: 'aprovado', label: 'Aprovados' },
  { value: 'enviado', label: 'Envios registrados' },
  { value: 'reprovado', label: 'Ajustes e recusas' },
]

export const approvalTypeLabel = (type: string) => type === 'briefing' ? 'Briefing interno'
  : type === 'plano_mensal' ? 'Plano para o cliente' : 'Outro conteúdo'

export const approvalActionLabel = (type: string) => type === 'briefing' ? 'Aprovar briefing'
  : type === 'plano_mensal' ? 'Aprovar para envio' : 'Aprovar conteúdo'

export const approvalHasDestination = (row: Pick<ContentApproval, 'chatid'>) => !!row.chatid?.trim()

export const approvalDate = (value: string | null | undefined) => {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Data não informada'
}

/** Conteúdo externo só ganha link clicável se a URL absoluta usar HTTP(S). */
export function safeApprovalUrl(value: string): string | undefined {
  if (!/^https?:\/\//i.test(value.trim())) return undefined
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

const FACT_FIELDS = [
  { key: 'objective', label: 'Objetivo', aliases: ['objetivo', 'objetivo principal', 'objetivo da campanha'] },
  { key: 'audience', label: 'Público', aliases: ['público', 'público-alvo', 'público alvo'] },
  { key: 'format', label: 'Formato', aliases: ['formato', 'formato sugerido', 'formato do conteúdo'] },
  { key: 'owner', label: 'Responsável', aliases: ['responsável', 'responsável pela execução', 'executor'] },
  { key: 'deadline', label: 'Prazo', aliases: ['prazo', 'prazo de entrega'] },
] as const

export interface ApprovalFact { key: string; label: string; value: string | null }

export interface RememberedApprovalDraft { baseline: ContentApproval; text: string; reason: string }
// Recuperação ao voltar pela navegação SPA: somente na memória desta aba.
const rememberedDrafts = new Map<string, RememberedApprovalDraft>()
const draftKey = (userId: string, id: string) => `${userId}:${id}`
export const getApprovalDraft = (userId: string, id: string) => rememberedDrafts.get(draftKey(userId, id))
export const forgetApprovalDraft = (userId: string, id: string) => { rememberedDrafts.delete(draftKey(userId, id)) }
export function rememberApprovalDraft(userId: string, draft: RememberedApprovalDraft) {
  rememberedDrafts.set(draftKey(userId, draft.baseline.id), { ...draft, baseline: { ...draft.baseline } })
}
export function retainApprovalDraftsForUser(userId: string | null) {
  for (const key of rememberedDrafts.keys()) if (!userId || !key.startsWith(`${userId}:`)) rememberedDrafts.delete(key)
}

const normalizeLabel = (value: string) => value.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()

/**
 * Extrai somente rótulos explícitos ("**Prazo:** sexta", "## Objetivo", tabelas).
 * Não converte data de criação em prazo nem atribui quem só aparece na narrativa.
 * Ocorrências diferentes permanecem visíveis, sem escolher uma por inferência.
 */
export function extractApprovalFacts(text: string): ApprovalFact[] {
  const found = new Map<string, string[]>()
  const lines = text.split(/\r?\n/)
  let codeFence = false

  const add = (label: string, value: string) => {
    const field = FACT_FIELDS.find(entry => entry.aliases.some(alias => normalizeLabel(alias) === normalizeLabel(label)))
    const clean = value.trim()
    if (!field || !clean || /^(?:-|:|\||\s)+$/.test(clean)) return
    const values = found.get(field.key) || []
    if (!values.includes(clean)) values.push(clean)
    found.set(field.key, values)
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    if (/^(```|~~~)/.test(line)) { codeFence = !codeFence; continue }
    if (codeFence || !line || line.startsWith('>')) continue

    const table = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?$/)
    if (table) { add(table[1].replace(/\*\*|__/g, ''), table[2]); continue }

    const cleaned = line.replace(/^#{1,6}\s+/, '').replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, '').replace(/\*\*|__/g, '')
    const inline = cleaned.match(/^([^:]+):\s*(.+)$/)
    if (inline) { add(inline[1], inline[2]); continue }

    if (/^#{1,6}\s+/.test(line) && FACT_FIELDS.some(entry => entry.aliases.some(alias => normalizeLabel(alias) === normalizeLabel(cleaned)))) {
      const section: string[] = []
      for (let next = index + 1; next < lines.length; next++) {
        const value = lines[next].trim()
        if (/^(#{1,6}\s|```|~~~|---+$|\*\*[^*]+:?\*\*)/.test(value)) break
        if (value) section.push(value)
        else if (section.length) break
      }
      add(cleaned, section.join('\n'))
    }
  }

  return FACT_FIELDS.map(field => ({ key: field.key, label: field.label, value: found.get(field.key)?.join('\n') || null }))
}
