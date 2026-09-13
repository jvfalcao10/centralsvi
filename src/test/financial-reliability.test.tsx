import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const fake = vi.hoisted(() => ({
  toast: vi.fn(), writes: vi.fn(), readError: false,
  mutation: 'success' as 'success' | 'error' | 'empty',
  expenseStatus: 'pendente',
  readGate: null as Promise<void> | null,
}))

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: fake.toast }) }))
vi.mock('@/hooks/useUsdRate', () => ({
  useUsdRate: () => 5,
  useUsdRateInfo: () => ({ rate: 5, isEstimate: true, updatedAt: null }),
  mrrBRL: (value: number, currency: string, rate: number) => currency === 'USD' ? value * rate : value,
}))
vi.mock('recharts', () => {
  const empty = () => null
  return Object.fromEntries(['LineChart', 'Line', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'ResponsiveContainer', 'BarChart', 'Bar'].map(name => [name, empty]))
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(table: string) {
      let mutation = ''
      let mutationValues: { status?: string } = {}
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'order', 'range', 'eq', 'neq', 'gte', 'lte', 'in', 'is', 'limit']) {
        builder[method] = () => builder
      }
      for (const method of ['update', 'insert', 'upsert', 'delete']) {
        builder[method] = (values: { status?: string } = {}) => { mutation = method; mutationValues = values; return builder }
      }
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        if (mutation) {
          fake.writes(table, mutation)
          if (table === 'expenses' && fake.mutation === 'success' && mutationValues.status) {
            fake.expenseStatus = mutationValues.status
          }
          return Promise.resolve(fake.mutation === 'error'
            ? { data: null, error: { message: 'Gravação negada no teste' } }
            : { data: fake.mutation === 'empty' ? [] : [{ id: 'teste' }], error: null }).then(resolve, reject)
        }
        const rows: Record<string, unknown[]> = {
          clients: [
            { id: 'ativo', name: 'Cliente fictício', company: 'Teste', status: 'ativo', mrr: 1000, currency: 'BRL', dia_vencimento: 5, inicio_contrato: '2026-08-05', permuta: false, cobranca_inicio: null },
            { id: 'cancelado', name: 'Contrato encerrado', status: 'cancelado', mrr: 500, currency: 'BRL', dia_vencimento: 5 },
          ],
          invoices: [
            { id: 'paga', client_id: 'ativo', valor: 1000, status: 'pago', vencimento: '2026-08-05', data_pagamento: '2026-09-05', clients: { name: 'Cliente fictício' } },
            { id: 'aberta', client_id: 'ativo', valor: 1000, status: 'pendente', vencimento: '2026-09-05', data_pagamento: null, clients: { name: 'Cliente fictício' } },
          ],
          expenses: [
            { id: 'agosto', descricao: 'Custo anterior', categoria: 'pessoal', valor: 900, vencimento: '2026-08-05', status: 'pago', recorrente: true },
            { id: 'setembro', descricao: 'Custo atual', categoria: 'pessoal', valor: 100, vencimento: '2026-09-05', status: fake.expenseStatus, recorrente: true },
          ],
        }
        return Promise.resolve(fake.readGate).then(() => fake.readError
          ? { data: null, error: { message: 'Leitura falhou no teste' } }
          : { data: rows[table] || [], error: null }).then(resolve, reject)
      }
      return builder
    },
  },
}))

import Financial from '@/pages/Financial'
import Dashboard from '@/pages/Dashboard'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-11T12:00:00-03:00'))
  fake.toast.mockClear()
  fake.writes.mockClear()
  fake.readError = false
  fake.mutation = 'success'
  fake.expenseStatus = 'pendente'
  fake.readGate = null
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('comportamento financeiro na interface', () => {
  it('abre o lançamento indicado pelo link sem misturar outras despesas', async () => {
    render(<MemoryRouter initialEntries={['/financial?tab=payable&expense=agosto&month=all']}><Financial /></MemoryRouter>)
    expect(await screen.findByRole('tab', { name: 'Contas a Pagar' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Custo anterior')).toBeInTheDocument()
    expect(screen.queryByText('Custo atual')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todas' }))
    expect(await screen.findByText('Custo atual')).toBeInTheDocument()
  })

  it('respeita o filtro de cliente vindo da página de gestão', async () => {
    render(<MemoryRouter initialEntries={['/financial?tab=receivable&client=cancelado&month=all']}><Financial /></MemoryRouter>)
    expect(await screen.findByRole('tab', { name: 'Contas a Receber' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Nenhuma fatura com esse filtro.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pago$/ })).not.toBeInTheDocument()
  })

  it('mostra despesa de setembro e recebimento de setembro em bases distintas', async () => {
    render(<MemoryRouter><Financial /></MemoryRouter>)
    const expenseLabel = await screen.findByText('Despesas do mês')
    expect(expenseLabel.parentElement?.parentElement).toHaveTextContent('100,00')
    expect(screen.getByText('Recebido no mês').parentElement?.parentElement).toHaveTextContent('1.000,00')
    expect(screen.getByText('MRR contratado').parentElement?.parentElement).toHaveTextContent('1.000,00')
    expect(screen.queryByText('Lucro Líquido')).not.toBeInTheDocument()
  })

  it.each(['error', 'empty'] as const)('não confirma pagamento quando a gravação retorna %s', async mode => {
    fake.mutation = mode
    render(<MemoryRouter><Financial /></MemoryRouter>)
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Contas a Receber' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('button', { name: /^Pago$/ }))
    await waitFor(() => expect(fake.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alteração não confirmada', variant: 'destructive' })))
    expect(fake.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Pagamento da fatura confirmado' }))
    expect(fake.writes).toHaveBeenCalledTimes(1)
  })

  it('confirma a gravação e impede dois comandos simultâneos no mesmo clique repetido', async () => {
    render(<MemoryRouter><Financial /></MemoryRouter>)
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Contas a Receber' }), { button: 0, ctrlKey: false })
    const button = await screen.findByRole('button', { name: /^Pago$/ })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(fake.toast).toHaveBeenCalledWith({ title: 'Pagamento da fatura confirmado' }))
    expect(fake.writes).toHaveBeenCalledTimes(1)
  })

  it('mantém Contas a Pagar montada durante a atualização e mostra a despesa paga', async () => {
    render(<MemoryRouter><Financial /></MemoryRouter>)
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Contas a Pagar' }), { button: 0, ctrlKey: false })
    const panel = screen.getByRole('tabpanel', { name: 'Contas a Pagar' })
    let release!: () => void
    fake.readGate = new Promise<void>(resolve => { release = resolve })
    try {
      fireEvent.click(screen.getByTitle('Marcar como pago'))
      await waitFor(() => expect(fake.toast).toHaveBeenCalledWith({ title: 'Despesa marcada como paga' }))
      expect(panel).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Contas a Pagar' })).toHaveAttribute('aria-selected', 'true')
    } finally {
      await act(async () => { release() })
    }
    await waitFor(() => expect(screen.queryByText('Confirmando alteração...')).not.toBeInTheDocument())
    expect(screen.getByTitle('Voltar para pendente')).toBeInTheDocument()
    expect(screen.getByText('Custo atual').closest('tr')).toHaveTextContent('pago')
    expect(screen.getByRole('tabpanel', { name: 'Contas a Pagar' })).toBe(panel)
    expect(fake.writes).toHaveBeenCalledTimes(1)
  })

  it('mantém Contas a Pagar ao voltar uma despesa para pendente', async () => {
    fake.expenseStatus = 'pago'
    render(<MemoryRouter><Financial /></MemoryRouter>)
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Contas a Pagar' }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByTitle('Voltar para pendente'))
    await waitFor(() => expect(fake.toast).toHaveBeenCalledWith({ title: 'Despesa marcada como pendente' }))
    await waitFor(() => expect(screen.queryByText('Confirmando alteração...')).not.toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Contas a Pagar' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Custo atual').closest('tr')).toHaveTextContent('pendente')
    expect(screen.getByTitle('Marcar como pago')).toBeInTheDocument()
  })

  it('restaura a aba escolhida ao tentar novamente uma leitura que falhou após salvar', async () => {
    render(<MemoryRouter><Financial /></MemoryRouter>)
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Contas a Pagar' }), { button: 0, ctrlKey: false })
    fake.readError = true
    fireEvent.click(screen.getByTitle('Marcar como pago'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados')
    fake.readError = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('tab', { name: 'Contas a Pagar' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Custo atual').closest('tr')).toHaveTextContent('pago')
  })

  it('mostra erro de leitura sem oferecer totais zerados', async () => {
    fake.readError = true
    render(<MemoryRouter><Financial /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados')
    expect(screen.queryByText('Recebido no mês')).not.toBeInTheDocument()
  })

  it('Dashboard não mostra operação saudável quando a leitura falha', async () => {
    fake.readError = true
    render(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados')
    expect(screen.queryByText(/Nenhum alerta/)).not.toBeInTheDocument()
  })

  it('Dashboard usa contratos elegíveis e não publica percentuais comparativos fixos', async () => {
    render(<Dashboard />)
    const label = await screen.findByText('MRR contratado')
    expect(label.parentElement?.parentElement).toHaveTextContent('1.000,00')
    expect(screen.queryByText('5.4%')).not.toBeInTheDocument()
    expect(screen.queryByText('Churn Mensal')).not.toBeInTheDocument()
    expect(screen.getByText('Clientes em risco')).toBeInTheDocument()
  })
})
