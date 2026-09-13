import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const fake = vi.hoisted(() => ({ role: 'admin', reads: vi.fn(), fail: '', extra: 0 }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test' }, can: (role: string) => fake.role === 'admin' || role === 'manager' && fake.role === 'manager' }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { from(table: string) {
  let range = [0, 499]
  const q: Record<string, unknown> = {}
  for (const method of ['select', 'order', 'in']) q[method] = () => q
  q.range = (from: number, to: number) => { range = [from, to]; return q }
  q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    fake.reads(table, range)
    if (fake.fail === table) return Promise.resolve({ data: null, error: { message: 'Consulta indisponível' } }).then(resolve, reject)
    const tables: Record<string, Record<string, unknown>[]> = {
      tarefas: [
        { id: 'late', titulo: 'Demanda Aurora', cliente_id: 'A', cliente_nome: 'Aurora', dono_id: 'P', dono_nome: 'Nome antigo', prazo: '2026-01-01', status: 'aberta', prioridade: 'normal' },
        { id: 'none', titulo: 'Definir responsável', cliente_id: 'B', cliente_nome: 'Boreal', dono_id: null, dono_nome: null, prazo: null, status: 'aberta', prioridade: 'alta' },
        ...Array.from({ length: fake.extra }, (_, n) => ({ id: `extra-${n}`, titulo: `Extra ${n}`, cliente_id: 'A', cliente_nome: 'Aurora', dono_id: 'P', dono_nome: 'Nome antigo', prazo: '2026-09-15', status: 'aberta', prioridade: 'normal' })),
      ],
      profiles: [{ user_id: 'P', name: 'Nome atual' }], clients: [{ id: 'A', name: 'Aurora' }],
      invoices: [{ id: 'invoice-a', client_id: 'A', valor: 1000, status: 'pendente', vencimento: '2026-09-12' }],
      expenses: [{ id: 'expense-a', descricao: 'Ferramentas', valor: 300, status: 'pendente', vencimento: '2026-09-12' }, { id: 'late-expense', descricao: 'Despesa vencida', valor: 50, status: 'pendente', vencimento: '2026-01-01' }],
    }
    return Promise.resolve({ data: (tables[table] || []).slice(range[0], range[1] + 1), error: null }).then(resolve, reject)
  }
  return q
} } }))
import Workload from '@/pages/Workload'
import CashPlanning from '@/pages/CashPlanning'

function renderPage(page: 'work' | 'cash', search = '') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={['/' + search]}>{page === 'work' ? <Workload /> : <CashPlanning />}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { fake.role = 'admin'; fake.fail = ''; fake.extra = 0; vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-11T15:00:00Z')) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('filtra o cliente da URL e abre a demanda exata', async () => {
  renderPage('work', '?client=A')
  const link = await screen.findByRole('link', { name: /Demanda Aurora/ })
  expect(link).toHaveAttribute('href', '/tarefas?client=A&task=late')
  expect(screen.queryByRole('link', { name: /Definir responsável/ })).not.toBeInTheDocument()
  expect(await screen.findByRole('button', { name: /Nome atual/ })).toBeInTheDocument()
})
it('permite identificar e abrir a demanda sem dono ou prazo', async () => {
  renderPage('work')
  fireEvent.click(await screen.findByRole('button', { name: /Sem responsável$/ }))
  expect(screen.getByRole('link', { name: /Definir responsável/ })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Demanda Aurora/ })).not.toBeInTheDocument()
})
it('não informa fila zerada quando tarefas falham', async () => {
  fake.fail = 'tarefas'; renderPage('work')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados')
  expect(screen.queryByText('Nenhuma demanda neste recorte.')).not.toBeInTheDocument()
})
it('preserva nomes registrados e informa falha do cadastro de pessoas', async () => {
  fake.fail = 'profiles'; renderPage('work')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar os nomes')
  expect(screen.getByRole('button', { name: /Nome antigo/ })).toBeInTheDocument()
})
it('lê todas as páginas e expande a fila sem perder registros', async () => {
  fake.extra = 501; renderPage('work')
  const more = await screen.findByRole('button', { name: /Mostrar mais \(473\)/ })
  expect(fake.reads).toHaveBeenCalledWith('tarefas', [500, 999])
  fireEvent.click(more)
  expect(screen.getByRole('button', { name: /Mostrar mais \(443\)/ })).toBeInTheDocument()
})
it.each(['tarefas', 'invoices'])('respeita acesso do executor à tela %s sem consultar registros', table => {
  fake.role = 'executor'; renderPage(table === 'tarefas' ? 'work' : 'cash')
  expect(fake.reads).not.toHaveBeenCalled()
})
it('previsão falha inteira se uma fonte financeira falhar', async () => {
  fake.fail = 'expenses'; renderPage('cash')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados')
  expect(screen.queryByText('Diferença no período')).not.toBeInTheDocument()
})
it('abre a despesa vencida com o filtro correto', async () => {
  renderPage('cash', '?view=overdue')
  expect(await screen.findByRole('link', { name: /Despesa vencida/ })).toHaveAttribute('href', '/financial?tab=payable&month=all&expense=late-expense')
  expect(screen.queryByRole('link', { name: /Ferramentas/ })).not.toBeInTheDocument()
  await waitFor(() => expect(fake.reads).toHaveBeenCalledWith('invoices', [0, 499]))
})
