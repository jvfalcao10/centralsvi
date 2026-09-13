import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const fake = vi.hoisted(() => ({
  role: 'admin', reads: vi.fn(), writes: vi.fn(), toast: vi.fn(), failTable: '', mutation: 'success', paidDate: null as string | null,
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'qa' }, can: (role: string) => role !== 'admin' || fake.role === 'admin' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: fake.toast }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { from(table: string) {
  let single = false
  let payload: Record<string, unknown> | null = null
  const filters: [string, unknown][] = []
  const q: Record<string, unknown> = {}
  for (const method of ['select', 'order', 'range']) q[method] = () => q
  q.eq = (key: string, value: unknown) => { filters.push([key, value]); return q }
  q.is = q.eq
  q.maybeSingle = () => { single = true; return q }
  q.update = (value: Record<string, unknown>) => { payload = value; return q }
  q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    if (payload) {
      fake.writes(table, payload, filters)
      if (fake.mutation === 'success') fake.paidDate = payload.data_pagamento as string
      return Promise.resolve(fake.mutation === 'error' ? { data: null, error: { message: 'Gravação negada' } } : { data: fake.mutation === 'empty' ? [] : [{ id: 'invoice-a' }], error: null }).then(resolve, reject)
    }
    fake.reads(table, filters)
    if (fake.failTable === table) return Promise.resolve({ data: null, error: { message: 'Leitura negada' } }).then(resolve, reject)
    const tables: Record<string, Record<string, unknown>[]> = {
      clients: [{ id: 'A', name: 'Cliente Aurora', company: 'Aurora', mrr: 1300, currency: 'BRL', status: 'ativo', inicio_contrato: '2026-08-05', dia_vencimento: 5 }, { id: 'B', name: 'Cliente Boreal', company: 'Boreal', mrr: 2000, status: 'ativo' }],
      tarefas: [{ id: 'task-a', cliente_id: 'A', titulo: 'Gravar Aurora', dono_id: 'owner', dono_nome: 'Responsável', prazo: '2026-09-12', status: 'aberta', prioridade: 'alta' }, { id: 'task-b', cliente_id: 'B', titulo: 'Gravar Boreal', prazo: '2026-09-13', status: 'aberta' }],
      invoices: [{ id: 'invoice-a', client_id: 'A', valor: 1300, status: 'pago', vencimento: '2026-08-05', data_pagamento: fake.paidDate }, { id: 'invoice-b', client_id: 'B', valor: 2000, status: 'pendente', vencimento: '2026-09-05', data_pagamento: null }],
    }
    const rows = (tables[table] || []).filter(row => filters.every(([key, value]) => row[key] === value))
    return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject)
  }
  return q
} } }))

import ClientManagement from '@/pages/ClientManagement'
import FinancialReview from '@/pages/FinancialReview'

function renderRoute(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}><Routes><Route path="/clients/:clientId" element={<ClientManagement />} /><Route path="/financial/conferencia" element={<FinancialReview />} /></Routes></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { fake.role = 'admin'; fake.failTable = ''; fake.mutation = 'success'; fake.paidDate = null; vi.clearAllMocks() })
afterEach(cleanup)

it('conecta apenas os registros do cliente selecionado e oferece links com o vínculo certo', async () => {
  renderRoute('/clients/A')
  expect(await screen.findByRole('heading', { name: 'Cliente Aurora' })).toBeInTheDocument()
  expect(await screen.findByText('Gravar Aurora')).toBeInTheDocument()
  expect(screen.queryByText('Gravar Boreal')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Demandas do cliente' })).toHaveAttribute('href', '/tarefas?client=A')
  expect(screen.getByRole('link', { name: 'Abrir faturas' })).toHaveAttribute('href', '/financial?tab=receivable&client=A&month=all')
  await waitFor(() => expect(fake.reads).toHaveBeenCalledWith('invoices', [['client_id', 'A']]))
})

it('não consulta nem exibe faturas na página do cliente para um executor', async () => {
  fake.role = 'executor'
  renderRoute('/clients/A')
  expect(await screen.findByText('Gravar Aurora')).toBeInTheDocument()
  expect(screen.queryByText('Cobranças e recebimentos')).not.toBeInTheDocument()
  expect(fake.reads.mock.calls.some(([table]) => table === 'invoices')).toBe(false)
})

it('mostra a falha da fila de demandas sem transformá-la em zero pendências', async () => {
  fake.failTable = 'tarefas'
  renderRoute('/clients/A')
  expect((await screen.findByText('Não foi possível carregar os dados')).closest('[role="alert"]')).toBeInTheDocument()
  expect(screen.queryByText('Nenhuma demanda em aberto vinculada a este cliente.')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Contrato e cadastro' })).toBeInTheDocument()
})

it('conferência falha explicitamente quando uma das fontes não pode ser lida', async () => {
  fake.failTable = 'expenses'
  renderRoute('/financial/conferencia')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados')
  expect(screen.queryByText('Nenhum apontamento neste filtro')).not.toBeInTheDocument()
})

it('conferência só grava a data informada para uma fatura paga que continua sem data', async () => {
  renderRoute('/financial/conferencia?client=A')
  fireEvent.click(await screen.findByRole('button', { name: 'Informar data' }))
  fireEvent.change(screen.getByLabelText('Data real do recebimento'), { target: { value: '2026-08-05' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }))
  await waitFor(() => expect(fake.toast).toHaveBeenCalledWith({ title: 'Data do recebimento registrada' }))
  expect(fake.writes).toHaveBeenCalledWith('invoices', { data_pagamento: '2026-08-05' }, [['id', 'invoice-a'], ['status', 'pago'], ['data_pagamento', null]])
  expect(await screen.findByText('Nenhum apontamento neste filtro')).toBeInTheDocument()
})

it.each(['error', 'empty'])('não informa sucesso ao corrigir data com resposta %s', async mode => {
  fake.mutation = mode
  renderRoute('/financial/conferencia')
  fireEvent.click(await screen.findByRole('button', { name: 'Informar data' }))
  fireEvent.change(screen.getByLabelText('Data real do recebimento'), { target: { value: '2026-08-05' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }))
  await waitFor(() => expect(fake.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alteração não confirmada' })))
  expect(fake.toast).not.toHaveBeenCalledWith({ title: 'Data do recebimento registrada' })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('não consulta fontes financeiras para perfil sem acesso à conferência', () => {
  fake.role = 'executor'
  renderRoute('/financial/conferencia')
  expect(screen.getByText('Esta conferência está disponível para administradores.')).toBeInTheDocument()
  expect(fake.reads).not.toHaveBeenCalled()
})
