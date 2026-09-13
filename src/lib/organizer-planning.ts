import { isCalendarDate } from '@/lib/financial-review'
import { localDateISO } from '@/lib/management-metrics'
import { shiftDay } from '@/lib/operations-planning'

/** Campos do organizador usados nos filtros; dono/lista não identificam assignees. */
export interface OrganizerPiece {
  id: string
  nome: string
  cli: string
  tipo: string
  etapa: string
  status: string
  updated: number
  due?: number | null
  postado_em?: string | null
  prioridade?: boolean
  oculto?: boolean
  descricao?: string | null
  assignees?: string[] | null
  etapa_manual?: string | null
  etapa_manual_status?: string | null
}

export interface OrganizerStage { id: string; base: string }
export type OrganizerPeriod = '21' | '90' | 'all'
export type OrganizerFilter = 'all' | 'overdue' | 'week' | 'unassigned' | 'undated' | 'client_wait'
export type OrganizerOrder = 'priority' | 'due' | 'updated' | 'posted'
export type OrganizerPriority = 'all' | 'yes' | 'no'

export const ORGANIZER_ORDERS: { value: OrganizerOrder; label: string }[] = [
  { value: 'priority', label: 'Prioridade e prazo' },
  { value: 'due', label: 'Prazo mais próximo' },
  { value: 'updated', label: 'Atualização recente' },
  { value: 'posted', label: 'Postagem recente' },
]

export const ORGANIZER_PRIORITIES: { value: OrganizerPriority; label: string }[] = [
  { value: 'all', label: 'Todas as prioridades' },
  { value: 'yes', label: 'Com prioridade' },
  { value: 'no', label: 'Sem prioridade' },
]

export const parseOrganizerOrder = (value: string | null | undefined): OrganizerOrder =>
  ORGANIZER_ORDERS.find(order => order.value === value)?.value || 'priority'

export const parseOrganizerPriority = (value: string | null | undefined): OrganizerPriority =>
  ORGANIZER_PRIORITIES.find(priority => priority.value === value)?.value || 'all'

export const ORGANIZER_PERIODS: { value: OrganizerPeriod; label: string }[] = [
  { value: '21', label: 'Atualizadas nos últimos 21 dias' },
  { value: '90', label: 'Atualizadas nos últimos 90 dias' },
  { value: 'all', label: 'Todo histórico disponível' },
]

export const ORGANIZER_FILTERS: { value: OrganizerFilter; label: string }[] = [
  { value: 'all', label: 'Todas no recorte' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'week', label: 'Próximos 7 dias' },
  { value: 'unassigned', label: 'Sem responsável' },
  { value: 'undated', label: 'Sem prazo válido' },
  { value: 'client_wait', label: 'Com o cliente' },
]

export const parseOrganizerPeriod = (value: string | null | undefined): OrganizerPeriod =>
  ORGANIZER_PERIODS.find(period => period.value === value)?.value || '21'

export const parseOrganizerFilter = (value: string | null | undefined): OrganizerFilter =>
  ORGANIZER_FILTERS.find(filter => filter.value === value)?.value || 'all'

/** Limite inclusivo por updated (Unix em milissegundos), sem depender do relógio global. */
export const organizerPeriodStart = (period: OrganizerPeriod, nowMs: number): number | null =>
  period === 'all' ? null : nowMs - Number(period) * 24 * 60 * 60 * 1000

/** Conclusão no ClickUp não comprova postagem. O registro explícito prevalece. */
export const organizerPosted = (piece: Pick<OrganizerPiece, 'postado_em'>): boolean => !!piece.postado_em

/** A coluna Postado é uma visão do registro local; não cria uma base para sincronização. */
export function organizerStage(piece: OrganizerPiece, config: readonly OrganizerStage[]): string {
  if (organizerPosted(piece) && config.some(stage => stage.id === 'postado')) return 'postado'
  return piece.etapa_manual && piece.etapa_manual_status === piece.status && config.some(stage => stage.id === piece.etapa_manual)
    ? piece.etapa_manual : piece.etapa
}

export function organizerBaseStage(piece: OrganizerPiece, config: readonly OrganizerStage[]): string {
  const stage = organizerStage(piece, config)
  return config.find(entry => entry.id === stage)?.base || stage
}

export const organizerDone = (piece: OrganizerPiece, config: readonly OrganizerStage[]): boolean =>
  organizerPosted(piece) || organizerBaseStage(piece, config) === 'feito'

export const organizerAssignees = (piece: Pick<OrganizerPiece, 'assignees'>): string[] =>
  [...new Set((piece.assignees || []).map(name => name.trim()).filter(Boolean))]

/** O prazo é um instante Unix positivo; zero/negativos são ausência no legado. */
export function organizerDueDay(piece: Pick<OrganizerPiece, 'due'>): string | null {
  if (typeof piece.due !== 'number' || !Number.isFinite(piece.due) || piece.due <= 0) return null
  const date = new Date(piece.due)
  if (!Number.isFinite(date.getTime())) return null
  const day = localDateISO(date) // Mesmo calendário local usado na exibição do app.
  return isCalendarDate(day) ? day : null
}

export interface OrganizerFilters {
  today: string
  filter?: OrganizerFilter
  person?: string
  client?: string
  type?: string
  text?: string
  mostrarFeito?: boolean
  mostrarOcultos?: boolean
  showPosted?: boolean
  order?: OrganizerOrder
  priority?: OrganizerPriority
}

const validDue = (piece: OrganizerPiece): number | null => organizerDueDay(piece) === null ? null : piece.due!
const validPostedAt = (piece: OrganizerPiece): number | null => {
  const value = piece.postado_em ? Date.parse(piece.postado_em) : NaN
  return Number.isFinite(value) ? value : null
}
const compareOptionalTime = (a: number | null, b: number | null, newest = false): number => {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  return newest ? b - a : a - b
}

/** Ausências ficam ao fim; empates conservam a ordem recebida, sem mudar a entrada. */
function comparePieces(a: OrganizerPiece, b: OrganizerPiece, order: OrganizerOrder): number {
  const updated = (Number.isFinite(b.updated) ? b.updated : 0) - (Number.isFinite(a.updated) ? a.updated : 0)
  const priority = Number(!!b.prioridade) - Number(!!a.prioridade)
  if (order === 'updated') return updated || priority
  if (order === 'posted') return compareOptionalTime(validPostedAt(a), validPostedAt(b), true) || priority || updated
  const due = compareOptionalTime(validDue(a), validDue(b))
  return order === 'due' ? due || priority || updated : priority || due || updated
}

/**
 * Filtra sem modificar rows. Pendências sempre excluem concluídos; em "all",
 * mostrarFeito inclui concluídos e showPosted exibe os registrados como postados.
 * Cliente e pessoa são os nomes existentes no
 * organizador, sem inferir vínculos com IDs de outros cadastros.
 */
export function filterOrganizerPieces<T extends OrganizerPiece>(
  rows: readonly T[], config: readonly OrganizerStage[], options: OrganizerFilters,
): T[] {
  const { today, filter = 'all', person = '', client = '', type = '', text = '', mostrarFeito = false, mostrarOcultos = false,
    showPosted = false, order = 'priority', priority = 'all' } = options
  const query = text.toLowerCase()
  const selectedPerson = person.trim()
  const validToday = isCalendarDate(today)
  const weekEnd = validToday ? shiftDay(today, 6) : null

  return rows.filter(piece => {
    if (client && piece.cli !== client) return false
    if (type && piece.tipo !== type) return false
    if (query && !(piece.nome + ' ' + piece.cli + ' ' + (piece.descricao || '')).toLowerCase().includes(query)) return false
    if (!mostrarOcultos && piece.oculto) return false
    if (priority === 'yes' && !piece.prioridade) return false
    if (priority === 'no' && piece.prioridade) return false
    if (organizerDone(piece, config) && (filter !== 'all' || (!mostrarFeito && !(showPosted && organizerPosted(piece))))) return false

    const assignees = organizerAssignees(piece)
    if (selectedPerson && !assignees.includes(selectedPerson)) return false
    if (filter === 'unassigned') return assignees.length === 0
    if (filter === 'client_wait') return organizerBaseStage(piece, config) === 'cliente'

    const due = organizerDueDay(piece)
    if (filter === 'undated') return due === null
    if (filter === 'overdue') return validToday && due !== null && due < today
    if (filter === 'week') return weekEnd !== null && due !== null && due >= today && due <= weekEnd
    return true
  }).sort((a, b) => comparePieces(a, b, order))
}
