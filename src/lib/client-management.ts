export type ClientTask = {
  id: string
  cliente_id: string | null
  titulo: string
  status: string
  prazo: string | null
  dono_id: string | null
  dono_nome: string | null
  prioridade: string
}

export function clientTaskSummary(tasks: ClientTask[], today: string) {
  const open = tasks.filter(task => task.status !== 'feita')
  const overdue = open.filter(task => task.prazo && task.prazo < today)
  const incomplete = open.filter(task => !task.dono_id || !task.prazo)
  const queue = [...open].sort((a, b) => {
    const aLate = a.prazo && a.prazo < today ? 0 : 1
    const bLate = b.prazo && b.prazo < today ? 0 : 1
    return aLate - bLate || (a.prazo || '9999').localeCompare(b.prazo || '9999') || a.id.localeCompare(b.id)
  })
  return { open, overdue, incomplete, queue }
}

export const clientPath = (id: string) => `/clients/${encodeURIComponent(id)}`
export const clientTasksPath = (id: string, task?: string) => `/tarefas?${new URLSearchParams({ client: id, ...(task ? { task } : {}) })}`
export const clientInvoicesPath = (id: string) => `/financial?${new URLSearchParams({ tab: 'receivable', client: id, month: 'all' })}`
