import { describe, expect, it } from 'vitest'
import { cashPlan, cashTotals } from '@/lib/cash-planning'
import { filterWork, groupWork, shiftDay, workTaskPath, type WorkTask } from '@/lib/operations-planning'
import type { Expense, Invoice } from '@/types'

const day = '2026-09-11'
const task = (id: string, patch: Partial<WorkTask> = {}): WorkTask => ({ id, titulo: id, status: 'aberta', cliente_id: 'A', cliente_nome: 'Aurora', dono_id: 'owner-a', dono_nome: 'Nome antigo', prazo: day, prioridade: 'normal', ...patch })
const invoice = (id: string, due: string, amount: number, status = 'pendente') => ({ id, client_id: 'A', vencimento: due, valor: amount, status }) as Invoice
const expense = (id: string, due: string, amount: number, status = 'pendente') => ({ id, descricao: id, vencimento: due, valor: amount, status }) as Expense

describe('Carga operacional', () => {
  it('separa atrasos do período de 7 dias sem incluir tarefa concluída', () => {
    const rows = [task('late', { prazo: '2026-09-10' }), task('today'), task('last', { prazo: '2026-09-17' }), task('later', { prazo: '2026-09-18' }), task('done', { status: 'feita' }), task('other', { status: 'cancelada' })]
    expect(filterWork(rows, day, 'all').map(t => t.id)).toEqual(['late', 'today', 'last', 'later'])
    expect(filterWork(rows, day, 'overdue').map(t => t.id)).toEqual(['late'])
    expect(filterWork(rows, day, 'week').map(t => t.id)).toEqual(['today', 'last'])
  })
  it('identifica ausência de dono pelo ID e datas inválidas sem criar falso atraso', () => {
    const rows = [task('unknown', { dono_id: null, dono_nome: 'Nome solto', prazo: null }), task('invalid', { prazo: '2026-02-30' })]
    expect(filterWork(rows, day, 'unassigned').map(t => t.id)).toEqual(['unknown'])
    expect(filterWork(rows, day, 'undated')).toHaveLength(2)
    expect(filterWork(rows, day, 'overdue')).toHaveLength(0)
  })
  it('preserva vínculo por ID mesmo com clientes e responsáveis homônimos', () => {
    const rows = [task('a'), task('b', { cliente_id: 'B', dono_id: 'owner-b' }), task('c', { cliente_id: null, dono_id: null })]
    expect(filterWork(rows, day, 'all', 'A').map(t => t.id)).toEqual(['a'])
    expect(filterWork(rows, day, 'all', 'unlinked').map(t => t.id)).toEqual(['c'])
    const groups = groupWork(rows, day, new Map([['owner-a', 'Atualizado']]))
    expect(groups).toHaveLength(3)
    expect(groups.find(g => g.id === 'owner-a')?.name).toBe('Atualizado')
    expect(groups.find(g => g.id === 'unassigned')?.name).toBe('Sem responsável')
  })
  it('prioriza prazo antes da prioridade e mantém ordem determinística', () => {
    const rows = [task('z', { prioridade: 'alta', prazo: '2026-09-12' }), task('b'), task('a'), task('urgent', { prioridade: 'alta' })]
    expect(filterWork(rows, day, 'all').map(t => t.id)).toEqual(['urgent', 'a', 'b', 'z'])
  })
  it('abre a tarefa exata com e sem cliente, escapando os IDs', () => {
    expect(workTaskPath(task('a&b'))).toBe('/tarefas?client=A&task=a%26b')
    expect(workTaskPath(task('a', { cliente_id: null }))).toBe('/tarefas?view=todas&task=a')
  })
})

describe('Previsão financeira por vencimento', () => {
  it('separa vencidos, intervalo inclusivo e posteriores; exclui pagos e cancelados', () => {
    const plan = cashPlan([
      invoice('late', '2026-09-10', 500), invoice('today', day, 1000), invoice('last', '2026-09-17', 200),
      invoice('later', '2026-09-18', 900), invoice('paid', day, 9000, 'pago'), invoice('cancel', day, 9000, 'cancelado'),
    ], [expense('out', day, 300), expense('paid-out', day, 10000, 'pago')], new Map([['A', 'Aurora']]), day, 7)
    expect(plan.end).toBe('2026-09-17')
    expect(plan.totals).toEqual({ incoming: 120000, outgoing: 30000, net: 90000 })
    expect(plan.lateTotals.incoming).toBe(50000)
    expect(plan.later.map(e => e.id)).toEqual(['later'])
    expect(plan.weeks).toHaveLength(1)
    expect(plan.upcoming.find(e => e.id === 'today')?.label).toBe('Aurora')
  })
  it('usa a data real de vencimento mesmo se o status atrasado estiver desatualizado', () => {
    const plan = cashPlan([invoice('future', '2026-09-12', 100, 'atrasado')], [expense('late', '2026-09-10', 50)], new Map(), day, 30)
    expect(plan.upcoming.map(e => e.id)).toEqual(['future'])
    expect(plan.overdue.map(e => e.id)).toEqual(['late'])
  })
  it('não converte ausências, datas impossíveis e valores inválidos em zero silencioso', () => {
    const plan = cashPlan([invoice('bad-date', '2026-02-30', 100), invoice('bad-money', day, NaN), invoice('negative', day, -5), invoice('missing', day, null as unknown as number)], [], new Map(), day, 30)
    expect(plan.invalid).toHaveLength(4)
    expect(plan.upcoming).toHaveLength(0)
    expect(plan.invalid[0].href).toBe('/financial?tab=receivable&month=all&invoice=bad-date')
  })
  it('soma centavos e reconcilia intervalos semanais sem duplicar os limites', () => {
    const plan = cashPlan([invoice('a', day, 0.1), invoice('b', day, 0.2), invoice('c', '2026-09-18', 0.3), invoice('d', '2026-10-10', 10)], [expense('out', '2026-10-10', 0.3)], new Map(), day, 30)
    expect(plan.weeks).toHaveLength(5)
    expect(plan.weeks[4].to).toBe('2026-10-10')
    expect(cashTotals(plan.weeks.flatMap(w => w.entries))).toEqual(plan.totals)
    expect(plan.totals.net).toBe(1030)
    expect(plan.weeks[0].incoming).toBe(30)
  })
  it('atravessa ano e fevereiro bissexto sem deslocar data local', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29')
    expect(cashPlan([], [], new Map(), '2026-12-31', 60).end).toBe('2027-02-28')
  })
})
