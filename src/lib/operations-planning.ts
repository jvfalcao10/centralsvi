import { isCalendarDate } from '@/lib/financial-review'
import type { ClientTask } from '@/lib/client-management'

export type WorkTask = ClientTask & { cliente_nome: string | null }
export type WorkFilter = 'all' | 'overdue' | 'week' | 'unassigned' | 'undated'
export const WORK_FILTERS: { value: WorkFilter; label: string }[] = [
  { value: 'all', label: 'Todas em aberto' }, { value: 'overdue', label: 'Atrasadas' },
  { value: 'week', label: 'Próximos 7 dias' }, { value: 'unassigned', label: 'Sem responsável' },
  { value: 'undated', label: 'Sem prazo válido' },
]

export function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export const taskOverdue = (task: WorkTask, today: string) => !!task.prazo && isCalendarDate(task.prazo) && task.prazo < today
export const taskThisWeek = (task: WorkTask, today: string) => !!task.prazo && isCalendarDate(task.prazo) && task.prazo >= today && task.prazo <= shiftDay(today, 6)
export const taskUndated = (task: WorkTask) => !task.prazo || !isCalendarDate(task.prazo)

export function filterWork(tasks: WorkTask[], today: string, filter: WorkFilter, client = '') {
  return tasks.filter(t => ['aberta', 'fazendo'].includes(t.status))
    .filter(t => !client || (client === 'unlinked' ? !t.cliente_id : t.cliente_id === client))
    .filter(t => filter === 'overdue' ? taskOverdue(t, today) : filter === 'week' ? taskThisWeek(t, today) : filter === 'unassigned' ? !t.dono_id : filter === 'undated' ? taskUndated(t) : true)
    .sort((a, b) => Number(taskOverdue(b, today)) - Number(taskOverdue(a, today)) || (taskUndated(a) ? '9999' : a.prazo!).localeCompare(taskUndated(b) ? '9999' : b.prazo!) || Number(b.prioridade === 'alta') - Number(a.prioridade === 'alta') || a.id.localeCompare(b.id))
}

export function groupWork(tasks: WorkTask[], today: string, names: Map<string, string>) {
  const groups = new Map<string, { id: string; name: string; tasks: WorkTask[]; overdue: number; week: number; doing: number; undated: number }>()
  for (const task of tasks) {
    const id = task.dono_id || 'unassigned'
    let row = groups.get(id)
    if (!row) {
      row = { id, name: task.dono_id ? names.get(id) || task.dono_nome || 'Responsável sem nome' : 'Sem responsável', tasks: [], overdue: 0, week: 0, doing: 0, undated: 0 }
      groups.set(id, row)
    }
    row.tasks.push(task)
    row.overdue += Number(taskOverdue(task, today))
    row.week += Number(taskThisWeek(task, today))
    row.doing += Number(task.status === 'fazendo')
    row.undated += Number(taskUndated(task))
  }
  return [...groups.values()].sort((a, b) => b.overdue - a.overdue || b.tasks.length - a.tasks.length || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id))
}
export function workTaskPath(task: WorkTask) {
  return `/tarefas?${new URLSearchParams({ ...(task.cliente_id ? { client: task.cliente_id } : { view: 'todas' }), task: task.id })}`
}
