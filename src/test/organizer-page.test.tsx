import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { OrganizerPiece } from '@/lib/organizer-planning'

type TestPiece = OrganizerPiece & {
  dono: string; url: string; thumb: null; lista_id: string; resp: null
  resp_por: null; resp_quando: null; anexos_lista: null; nota: null
}
type Request = {
  table: string
  mutation?: { method: string; payload: Record<string, unknown> }
  selected?: string
  range?: [number, number]
  filters: { method: string; column: string; value: unknown }[]
  orders: { column: string; options: unknown }[]
  single: boolean
}
type Result = { data: unknown; error: { message: string } | null }

const fake = vi.hoisted(() => ({ role: 'admin', mobile: false, reads: vi.fn(), writes: vi.fn(), resolve: vi.fn(), toast: vi.fn(), onDragEnd: null as null | ((result: unknown) => void) }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'test', email: 'test@example.com' },
  can: (role: string) => fake.role === 'admin' || role === 'manager' && fake.role === 'manager',
}) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: fake.toast }) }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => fake.mobile }))
vi.mock('@/lib/supabase', () => ({ supabase: { from(table: string) {
  const request: Request = { table, filters: [], orders: [], single: false }
  const query: Record<string, unknown> = {}
  query.select = (columns = '*') => { request.selected = columns; return query }
  for (const method of ['eq', 'gte', 'is']) {
    query[method] = (column: string, value: unknown) => {
      request.filters.push({ method, column, value })
      return query
    }
  }
  query.order = (column: string, options?: unknown) => { request.orders.push({ column, options }); return query }
  query.range = (from: number, to: number) => { request.range = [from, to]; return query }
  query.maybeSingle = () => { request.single = true; return query }
  for (const method of ['update', 'insert', 'upsert', 'delete']) {
    query[method] = (payload: Record<string, unknown>) => { request.mutation = { method, payload }; return query }
  }
  query.then = (resolve: (value: Result) => unknown, reject: (error: unknown) => unknown) => {
    if (request.mutation) fake.writes(request)
    else fake.reads(request)
    return Promise.resolve().then(() => fake.resolve(request)).then(resolve, reject)
  }
  return query
} } }))

// A lib de gestos é substituída; os testes disparam seu resultado no handler real da página.
type DndProvided = {
  innerRef: () => void
  droppableProps?: Record<string, string>
  draggableProps?: Record<string, string>
  dragHandleProps?: Record<string, string>
  placeholder?: null
}
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: (result: unknown) => void }) => {
    fake.onDragEnd = onDragEnd
    return <div>{children}</div>
  },
  Droppable: ({ children, droppableId }: {
    children: (provided: DndProvided, snapshot: { isDraggingOver: boolean }) => ReactNode
    droppableId: string
  }) => children({ innerRef: () => {}, droppableProps: { 'data-testid': `stage-${droppableId}` }, placeholder: null }, { isDraggingOver: false }),
  Draggable: ({ children, draggableId }: {
    children: (provided: DndProvided) => ReactNode
    draggableId: string
  }) => children({ innerRef: () => {}, draggableProps: { 'data-testid': `piece-${draggableId}` }, dragHandleProps: {} }),
}))

import Organizador from '@/pages/content/Organizador'

const now = new Date('2026-09-11T15:00:00Z').getTime()
const day = 86400000
const piece = (id: string, patch: Partial<TestPiece> = {}): TestPiece => ({
  id, nome: `Demanda ${id}`, cli: 'Aurora', tipo: 'post', etapa: 'fazer', status: 'para ser feita',
  updated: now, due: now, assignees: ['José'], dono: 'Fila do design', url: `https://app.clickup.com/t/${id}`,
  thumb: null, lista_id: '901521539717', resp: null, resp_por: null, resp_quando: null,
  anexos_lista: null, nota: null, oculto: false, prioridade: false, postado_em: null,
  descricao: null, etapa_manual: null, etapa_manual_status: null, ...patch,
})
let rows: TestPiece[]
let stages: { id: string; nome: string; base: string }[] | null
let expectedWrites: number

function defaultResult(request: Request): Result {
  if (request.table === 'postagens_config') return { data: { valor: stages }, error: null }
  if (request.table === 'postagens_acoes') return { data: [{ id: 'acao-ficticia' }], error: null }
  let result = [...rows]
  for (const filter of request.filters) {
    if (filter.column === 'updated' && filter.method === 'gte') result = result.filter(row => row.updated >= Number(filter.value))
    if (filter.method === 'eq' || filter.method === 'is') result = result.filter(row => row[filter.column as keyof TestPiece] === filter.value)
  }
  if (request.mutation) {
    result = result.map(row => ({ ...row, ...request.mutation!.payload }))
    rows = rows.map(row => result.find(saved => saved.id === row.id) || row)
  }
  if (request.single) return { data: result[0] || null, error: null }
  result.sort((a, b) => b.updated - a.updated || a.id.localeCompare(b.id))
  if (request.range) result = result.slice(request.range[0], request.range[1] + 1)
  return { data: result, error: null }
}

function CurrentLocation() {
  const { search } = useLocation()
  return <output data-testid="location">{search}</output>
}
function renderPage(search = '') {
  return render(<MemoryRouter initialEntries={['/content/organizador' + search]}>
    <Organizador /><CurrentLocation />
  </MemoryRouter>)
}
const searchParams = () => new URLSearchParams(screen.getByTestId('location').textContent || '')
const historyRequests = () => fake.reads.mock.calls.map(([request]) => request as Request)
  .filter(request => request.table === 'postagens_organizador' && !request.single)
const writeRequests = () => fake.writes.mock.calls.map(([request]) => request as Request)
const queueRequests = () => writeRequests().filter(request => request.table === 'postagens_acoes')
const cardOrder = (stage = 'fazer') => within(screen.getByTestId(`stage-${stage}`)).queryAllByTestId(/^piece-/)
  .map(card => card.getAttribute('data-testid')?.replace('piece-', ''))
const dragPiece = (id: string, source: string, target: string) => {
  expect(fake.onDragEnd).toBeTypeOf('function')
  act(() => fake.onDragEnd!({ draggableId: id, source: { droppableId: source, index: 0 }, destination: { droppableId: target, index: 0 } }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  fake.role = 'admin'
  fake.mobile = false
  expectedWrites = 0
  fake.onDragEnd = null
  rows = [piece('recente')]
  stages = null
  fake.resolve.mockImplementation(defaultResult)
})
afterEach(() => {
  cleanup()
  // Navegação não grava; cada ação de escrita deve produzir apenas as operações esperadas.
  expect(fake.writes).toHaveBeenCalledTimes(expectedWrites)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Consulta do histórico do Organizador', () => {
  it('lê mais de 500 peças com ordenação estável em todas as páginas', async () => {
    rows = Array.from({ length: 501 }, (_, i) => piece(String(i).padStart(3, '0')))
    renderPage('?periodo=all')

    expect(await screen.findByText(/501 de 501 peças no recorte/)).toBeInTheDocument()
    expect(screen.getAllByTestId(/^piece-/)).toHaveLength(501)
    expect(screen.getByTestId('piece-500')).toHaveTextContent('Demanda 500')
    expect(historyRequests().map(request => request.range)).toEqual([[0, 499], [500, 999]])
    for (const request of historyRequests()) {
      expect(request.orders).toEqual([{ column: 'updated', options: { ascending: false } }, { column: 'id', options: undefined }])
      expect(request.filters).toEqual([])
    }
  })

  it('aplica 21 e 90 dias por updated, inclui o limite e expande para todo histórico', async () => {
    rows = [
      piece('limite', { updated: now - 21 * day }),
      piece('mais-antiga', { updated: now - 21 * day - 1 }),
      piece('arquivo', { updated: now - 100 * day }),
    ]
    renderPage()
    expect(await screen.findByText(/1 de 1 peças no recorte/)).toBeInTheDocument()
    expect(screen.getByTestId('piece-limite')).toBeInTheDocument()
    expect(screen.queryByTestId('piece-mais-antiga')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Período do histórico' }), { target: { value: '90' } })
    expect(await screen.findByText(/2 de 2 peças no recorte/)).toBeInTheDocument()
    expect(searchParams().get('periodo')).toBe('90')
    fireEvent.change(screen.getByRole('combobox', { name: 'Período do histórico' }), { target: { value: 'all' } })
    expect(await screen.findByTestId('piece-arquivo')).toBeInTheDocument()
    expect(screen.getByText(/3 de 3 peças no recorte/)).toBeInTheDocument()
    expect(historyRequests().map(request => request.filters)).toEqual([
      [{ method: 'gte', column: 'updated', value: now - 21 * day }],
      [{ method: 'gte', column: 'updated', value: now - 90 * day }],
      [],
    ])
  })

  it('não exibe a primeira página como total se a segunda falhar e permite repetir a consulta inteira', async () => {
    rows = Array.from({ length: 501 }, (_, i) => piece(`registro-${i}`))
    let fail = true
    fake.resolve.mockImplementation((request: Request) => fail && request.range?.[0] === 500
      ? { data: null, error: { message: 'Falha na segunda página' } } : defaultResult(request))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados')
    expect(screen.queryByText(/peças no recorte/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-fazer')).not.toBeInTheDocument()
    expect(screen.queryByText('nada com esse filtro')).not.toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText(/501 de 501 peças no recorte/)).toBeInTheDocument()
    expect(historyRequests().map(request => request.range)).toEqual([[0, 499], [500, 999], [0, 499], [500, 999]])
  })

  it('preserva a última escolha ao resolver consultas 21 → 90 → todas fora de ordem', async () => {
    const pending = new Map<string, (result: Result) => void>()
    fake.resolve.mockImplementation((request: Request) => {
      if (request.table === 'postagens_config') return defaultResult(request)
      const lower = request.filters.find(filter => filter.method === 'gte')?.value
      const period = lower === undefined ? 'all' : String((now - Number(lower)) / day)
      return new Promise<Result>(resolve => { pending.set(period, resolve) })
    })
    renderPage()
    await waitFor(() => expect(pending.has('21')).toBe(true))
    fireEvent.change(screen.getByRole('combobox', { name: 'Período do histórico' }), { target: { value: '90' } })
    await waitFor(() => expect(pending.has('90')).toBe(true))
    fireEvent.change(screen.getByRole('combobox', { name: 'Período do histórico' }), { target: { value: 'all' } })
    await waitFor(() => expect(pending.has('all')).toBe(true))

    await act(async () => pending.get('all')!({ data: [piece('histórico-completo')], error: null }))
    expect(await screen.findByTestId('piece-histórico-completo')).toBeInTheDocument()
    await act(async () => pending.get('90')!({ data: Array.from({ length: 500 }, (_, i) => piece(`resposta-antiga-${i}`)), error: null }))
    await act(async () => pending.get('21')!({ data: null, error: { message: 'Falha de consulta já substituída' } }))

    expect(screen.getByTestId('piece-histórico-completo')).toBeInTheDocument()
    expect(screen.queryByTestId('piece-resposta-antiga-0')).not.toBeInTheDocument()
    // A consulta substituída não deve continuar a paginação em segundo plano.
    expect(historyRequests().map(request => request.range)).toEqual([[0, 499], [0, 499], [0, 499]])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Período do histórico' })).toHaveValue('all')
    expect(searchParams().get('periodo')).toBe('all')
  })
})

describe('Links diretos e disponibilidade das etapas', () => {
  it('abre peça antiga, oculta e concluída fora do filtro sem adicioná-la à contagem', async () => {
    rows = [piece('recente', { tipo: 'video' }), piece('antiga', {
      updated: now - 200 * day, oculto: true, etapa: 'feito', postado_em: '2026-01-01T12:00:00Z',
    })]
    renderPage('?periodo=21&tipo=video&peca=antiga')

    expect(await screen.findByRole('heading', { name: 'Demanda antiga' })).toBeInTheDocument()
    expect(await screen.findByText(/1 de 1 peças no recorte/)).toBeInTheDocument()
    expect(screen.queryByTestId('piece-antiga')).not.toBeInTheDocument()
    const direct = fake.reads.mock.calls.map(([request]) => request as Request)
      .find(request => request.table === 'postagens_organizador' && request.single)
    expect(direct?.filters).toEqual([{ method: 'eq', column: 'id', value: 'antiga' }])
    expect(direct?.range).toBeUndefined()
    expect(within(screen.getByRole('dialog')).getByText('Postagem registrada em:')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(searchParams().has('peca')).toBe(false)
    expect(searchParams().get('periodo')).toBe('21')
    expect(searchParams().get('tipo')).toBe('video')
    expect(screen.getByText(/1 de 1 peças no recorte/)).toBeInTheDocument()
  })

  it('informa falha da configuração e impede edição mesmo com a demanda direta disponível', async () => {
    fake.resolve.mockImplementation((request: Request) => request.table === 'postagens_config'
      ? { data: null, error: { message: 'Configuração indisponível' } } : defaultResult(request))
    renderPage('?peca=recente')

    expect(await screen.findByRole('heading', { name: 'Demanda recente' })).toBeInTheDocument()
    expect(await screen.findByText('Não foi possível carregar os dados')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-fazer')).not.toBeInTheDocument()
    expect(screen.queryByText(/peças no recorte/)).not.toBeInTheDocument()
    expect(screen.queryByText('nada aqui')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Carregue o histórico e as etapas para editar esta demanda.')
    const stage = screen.getByRole('combobox', { name: 'Etapa da demanda' })
    expect(stage).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Priorizar' })).toBeDisabled()
    expect(screen.getByPlaceholderText('Anota aqui o que o time precisa saber sobre essa peça…')).toBeDisabled()
    // A guarda também deve impedir gravação se um evento for disparado diretamente.
    fireEvent.change(stage, { target: { value: 'feito' } })
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it('distingue demanda ausente de erro de consulta e repete a busca do ID exato', async () => {
    let fail = false
    fake.resolve.mockImplementation((request: Request) => request.single && request.table === 'postagens_organizador' && fail
      ? { data: null, error: { message: 'Rede indisponível' } } : defaultResult(request))
    renderPage('?peca=ausente')
    expect(await screen.findByRole('alert')).toHaveTextContent('Peça não encontrada ou sem acesso para este usuário.')
    fail = true
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar esta demanda. Tente novamente.')
    fail = false
    rows.push(piece('ausente'))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'Demanda ausente' })).toBeInTheDocument()
    expect(fake.reads.mock.calls.map(([request]) => request as Request)
      .filter(request => request.table === 'postagens_organizador' && request.single)).toHaveLength(3)
  })
})

describe('Filtros e contagens compartilhadas entre vistas', () => {
  it.each(['admin', 'manager', 'executor'])('mantém o organizador para %s e respeita o acesso ao link de carga', async role => {
    fake.role = role
    renderPage('?tipo=invalido')
    expect(await screen.findByText(/1 de 1 peças no recorte/)).toBeInTheDocument()
    expect(screen.getByTestId('piece-recente')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Tipo de conteúdo' })).toHaveValue('')
    if (role === 'executor') {
      expect(screen.queryByRole('link', { name: /Carga de demandas/ })).not.toBeInTheDocument()
    } else {
      expect(screen.getByRole('link', { name: /Carga de demandas/ })).toHaveAttribute('href', '/operacional/carga')
    }
  })

  it('filtra por qualquer responsável atribuído e mantém os mesmos concluídos em Etapas e Por cliente', async () => {
    stages = [{ id: 'publicado', nome: 'Publicado no canal', base: 'feito' }]
    rows = [
      piece('compartilhada', { assignees: ['José', ' Laís '] }),
      piece('sem-pessoa', { dono: 'Laís', assignees: [] }),
      piece('concluída', { assignees: ['Laís'], etapa_manual: 'publicado', etapa_manual_status: 'para ser feita' }),
    ]
    renderPage()
    expect(await screen.findByText(/2 de 3 peças no recorte/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Responsável na demanda' }), { target: { value: 'Laís' } })
    expect(screen.getByTestId('piece-compartilhada')).toBeInTheDocument()
    expect(screen.queryByTestId('piece-sem-pessoa')).not.toBeInTheDocument()
    expect(screen.queryByTestId('piece-concluída')).not.toBeInTheDocument()
    expect(screen.getByText(/1 de 3 peças no recorte/)).toBeInTheDocument()
    expect(searchParams().get('pessoa')).toBe('Laís')

    fireEvent.click(screen.getByRole('button', { name: 'Por cliente' }))
    expect(screen.getByText('1 peças · 1 a fazer')).toBeInTheDocument()
    expect(screen.queryByText('Demanda concluída')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'mostrar concluídos' }))
    expect(screen.getByText(/2 de 3 peças no recorte/)).toBeInTheDocument()
    expect(screen.getByText('2 peças · 1 publicado no canal · 1 a fazer')).toBeInTheDocument()
    expect(screen.getByText('Demanda concluída')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Etapas' })[1])
    expect(screen.getByTestId('piece-concluída')).toBeInTheDocument()
    expect(within(screen.getByTestId('stage-publicado')).getByTestId('piece-concluída')).toBeInTheDocument()
    expect(screen.getByText(/2 de 3 peças no recorte/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Pendências' }), { target: { value: 'week' } })
    expect(screen.queryByTestId('piece-concluída')).not.toBeInTheDocument()
    expect(screen.getByText(/1 de 3 peças no recorte/)).toBeInTheDocument()
  })

  it('limpa filtros combinados preservando período e vista e permite abrir uma demanda pelo cartão', async () => {
    rows = [piece('recente', { tipo: 'video', assignees: ['Laís'], descricao: 'Campanha setembro' }), piece('outra', { cli: 'Boreal' })]
    renderPage('?periodo=all&vista=clientes&cliente=Aurora&tipo=video&busca=setembro&pessoa=La%C3%ADs&filtro=week&concluidos=1&ocultos=1')
    expect(await screen.findByText(/1 de 2 peças no recorte/)).toBeInTheDocument()
    expect(screen.queryByText('Demanda outra')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect([...searchParams().entries()]).toEqual([['periodo', 'all'], ['vista', 'clientes']])
    expect(screen.getByText(/2 de 2 peças no recorte/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Responsável na demanda' })).toHaveValue('')
    expect(screen.getByPlaceholderText('buscar…')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'mostrar concluídos' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'mostrar ocultos' })).not.toBeChecked()

    fireEvent.click(screen.getByText('Demanda recente'))
    expect(await screen.findByRole('heading', { name: 'Demanda recente' })).toBeInTheDocument()
    expect(searchParams().get('peca')).toBe('recente')
    expect(searchParams().get('periodo')).toBe('all')
    expect(searchParams().get('vista')).toBe('clientes')
  })
})

describe('Filtros recolhidos no celular', () => {
  it('mantém os filtros da URL aplicados e indicados enquanto os controles extras estão recolhidos', async () => {
    fake.mobile = true
    rows = [
      piece('selecionada', { cli: 'Aurora', tipo: 'video', assignees: ['José'] }),
      piece('outro-cliente', { cli: 'Boreal', tipo: 'video', assignees: ['José'] }),
      piece('outro-tipo', { cli: 'Aurora', tipo: 'post', assignees: ['José'] }),
      piece('outra-pessoa', { cli: 'Aurora', tipo: 'video', assignees: ['Laís'] }),
    ]
    renderPage('?cliente=Aurora&tipo=video&pessoa=Jos%C3%A9')
    await screen.findByTestId('piece-selecionada')
    const summary = screen.getByText(/^Filtros/).closest('summary')!
    const extras = summary.closest('details')!
    expect(extras).not.toHaveAttribute('open')
    expect(summary).toHaveTextContent('3')
    expect(screen.getByText(/1 de 4 peças no recorte/)).toBeInTheDocument()
    expect(screen.queryAllByTestId(/^piece-/)).toHaveLength(1)
    expect(screen.getByLabelText('Cliente')).not.toBeVisible()
    expect(screen.getByLabelText('Responsável na demanda')).not.toBeVisible()
    expect(screen.getAllByLabelText('Cliente')).toHaveLength(1)
    expect(screen.getAllByLabelText('Período do histórico')).toHaveLength(1)
    expect(screen.getAllByLabelText('Tipo de conteúdo')).toHaveLength(1)
    expect(screen.getByRole('combobox', { name: 'Prioridade' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Ordenação' })).toBeVisible()
    expect(screen.getByPlaceholderText('buscar…')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Por cliente' })).toBeVisible()
  })

  it('abre os filtros extras, muda o cliente e limpa as escolhas preservando histórico e vista', async () => {
    fake.mobile = true
    rows = [piece('aurora', { cli: 'Aurora', prioridade: true }), piece('boreal', { cli: 'Boreal', prioridade: true })]
    renderPage('?periodo=90&vista=clientes&cliente=Aurora&prioridade=yes&ordem=due')
    await screen.findByText(/1 de 2 peças no recorte/)
    const summary = screen.getByText(/^Filtros/).closest('summary')!
    fireEvent.click(summary)
    expect(summary.closest('details')).toHaveAttribute('open')
    const client = screen.getByRole('combobox', { name: 'Cliente' })
    expect(client).toBeVisible()
    fireEvent.change(client, { target: { value: 'Boreal' } })
    expect(screen.getByText('Demanda boreal')).toBeInTheDocument()
    expect(screen.queryByText('Demanda aurora')).not.toBeInTheDocument()
    expect(searchParams().get('cliente')).toBe('Boreal')

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect([...searchParams().entries()]).toEqual([['periodo', '90'], ['vista', 'clientes']])
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Prioridade' })).toHaveValue('all')
    expect(screen.getByRole('combobox', { name: 'Ordenação' })).toHaveValue('priority')
    expect(screen.getByText(/2 de 2 peças no recorte/)).toBeInTheDocument()
    expect(historyRequests()).toHaveLength(1)
  })
})

describe('Prioridade e ordenação do organizador', () => {
  it('ordena por prioridade e prazo e troca a ordenação mantendo a escolha na URL', async () => {
    rows = [
      piece('prioridade-distante', { cli: 'Zebra', prioridade: true, due: now + 4 * day, updated: now - day }),
      piece('prioridade-proxima', { cli: 'Boreal', prioridade: true, due: now + day, updated: now - 2 * day }),
      piece('urgente', { cli: 'Aurora', due: now - day, updated: now }),
      piece('sem-prazo', { cli: 'Aurora', due: null, updated: now + day }),
    ]
    renderPage('?periodo=all')
    await screen.findByTestId('piece-urgente')
    expect(screen.getByRole('combobox', { name: 'Ordenação' })).toHaveValue('priority')
    expect(cardOrder()).toEqual(['prioridade-proxima', 'prioridade-distante', 'urgente', 'sem-prazo'])

    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenação' }), { target: { value: 'due' } })
    expect(cardOrder()).toEqual(['urgente', 'prioridade-proxima', 'prioridade-distante', 'sem-prazo'])
    expect(searchParams().get('ordem')).toBe('due')
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenação' }), { target: { value: 'updated' } })
    expect(cardOrder()).toEqual(['sem-prazo', 'urgente', 'prioridade-distante', 'prioridade-proxima'])
    expect(searchParams().get('ordem')).toBe('updated')
    expect(searchParams().get('periodo')).toBe('all')
    expect(historyRequests()).toHaveLength(1)
  })

  it('restaura prioridade e ordenação da URL, combina filtros e limpa as escolhas', async () => {
    rows = [piece('prioritaria', { prioridade: true }), piece('normal')]
    renderPage('?periodo=all&prioridade=yes&ordem=due')
    await screen.findByTestId('piece-prioritaria')
    expect(screen.getByRole('combobox', { name: 'Prioridade' })).toHaveValue('yes')
    expect(screen.getByRole('combobox', { name: 'Ordenação' })).toHaveValue('due')
    expect(screen.queryByTestId('piece-normal')).not.toBeInTheDocument()
    expect(screen.getByText(/1 de 2 peças no recorte/)).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridade' }), { target: { value: 'no' } })
    expect(screen.queryByTestId('piece-prioritaria')).not.toBeInTheDocument()
    expect(screen.getByTestId('piece-normal')).toBeInTheDocument()
    expect(searchParams().get('prioridade')).toBe('no')
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByRole('combobox', { name: 'Prioridade' })).toHaveValue('all')
    expect(screen.getByRole('combobox', { name: 'Ordenação' })).toHaveValue('priority')
    expect(screen.getByText(/2 de 2 peças no recorte/)).toBeInTheDocument()
    expect(searchParams().get('periodo')).toBe('all')
    expect(searchParams().has('prioridade')).toBe(false)
    expect(searchParams().has('ordem')).toBe(false)
  })

  it('usa padrões seguros para prioridade e ordem inválidas na URL', async () => {
    renderPage('?ordem=invalida&prioridade=invalida')
    await screen.findByTestId('piece-recente')
    expect(screen.getByRole('combobox', { name: 'Prioridade' })).toHaveValue('all')
    expect(screen.getByRole('combobox', { name: 'Ordenação' })).toHaveValue('priority')
    expect(screen.getByRole('option', { name: 'Prioridade e prazo' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Prazo mais próximo' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Atualização recente' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Postagem recente' })).toBeInTheDocument()
  })

  it('ordena Postado pela data de postagem, sem usar prioridade ou atualização como data substituta', async () => {
    rows = [
      piece('publicada-antiga', { prioridade: true, updated: now, postado_em: '2026-09-08T12:00:00Z' }),
      piece('publicada-recente', { prioridade: false, updated: now - day, postado_em: '2026-09-10T12:00:00Z' }),
      piece('data-invalida', { prioridade: true, updated: now + day, postado_em: 'data-legada-invalida' }),
    ]
    renderPage('?ordem=posted')
    await screen.findByTestId('piece-publicada-recente')
    expect(cardOrder('postado')).toEqual(['publicada-recente', 'publicada-antiga', 'data-invalida'])
    expect(screen.getByRole('combobox', { name: 'Ordenação' })).toHaveValue('posted')
  })
})

describe('Postado separado de conclusão da demanda', () => {
  it('mantém Postado visível e usa apenas o registro explícito, com Concluído separado', async () => {
    rows = [
      piece('publicada', { etapa: 'feito', status: 'complete', postado_em: '2026-09-10T12:00:00Z' }),
      piece('concluida-sem-postagem', { etapa: 'feito', status: 'complete' }),
      piece('aprovada-sem-postagem', { etapa: 'aprovado', status: 'complete', lista_id: '901523996247' }),
    ]
    renderPage()
    await screen.findByTestId('stage-postado')
    expect(cardOrder('postado')).toEqual(['publicada'])
    expect(screen.queryByTestId('stage-feito')).not.toBeInTheDocument()
    expect(screen.queryByTestId('piece-concluida-sem-postagem')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('stage-aprovado')).getByTestId('piece-aprovada-sem-postagem')).toBeInTheDocument()
    expect(screen.getByText(/2 de 3 peças no recorte/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'mostrar concluídos' }))
    expect(within(screen.getByTestId('stage-feito')).getByTestId('piece-concluida-sem-postagem')).toBeInTheDocument()
    expect(cardOrder('postado')).toEqual(['publicada'])
    expect(within(screen.getByTestId('stage-feito')).queryByTestId('piece-publicada')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Pendências' }), { target: { value: 'week' } })
    expect(screen.getByTestId('stage-postado')).toBeInTheDocument()
    expect(cardOrder('postado')).toEqual([])
    expect(screen.queryByTestId('piece-concluida-sem-postagem')).not.toBeInTheDocument()
  })

  it('exibe a coluna Postado mesmo quando nenhuma peça tem registro de postagem', async () => {
    renderPage()
    await screen.findByTestId('piece-recente')
    expect(screen.getByTestId('stage-postado')).toBeInTheDocument()
    expect(cardOrder('postado')).toEqual([])
  })

  it('marca postagem somente depois da confirmação e preserva status, etapa e fila do ClickUp', async () => {
    expectedWrites = 1
    rows = [piece('publicar', { etapa: 'aprovado', status: 'complete', lista_id: '901523996247' })]
    let confirm!: () => void
    fake.resolve.mockImplementation((request: Request) => request.mutation
      ? new Promise<Result>(resolve => { confirm = () => resolve(defaultResult(request)) }) : defaultResult(request))
    renderPage('?peca=publicar')
    const post = await screen.findByRole('button', { name: 'Marcar como postado' })
    await screen.findByText(/1 de 1 peças no recorte/)
    act(() => { fireEvent.click(post); fireEvent.click(post) })
    await waitFor(() => expect(writeRequests()).toHaveLength(1))
    expect(cardOrder('postado')).toEqual([])
    expect(screen.queryByRole('button', { name: 'Desmarcar postado' })).not.toBeInTheDocument()
    expect(queueRequests()).toEqual([])
    expect(fake.toast).not.toHaveBeenCalled()
    expect(writeRequests()[0]).toMatchObject({ table: 'postagens_organizador', selected: '*', single: true, mutation: { method: 'update', payload: { postado_em: new Date(now).toISOString() } } })
    expect(writeRequests()[0].mutation?.payload).toEqual({ postado_em: new Date(now).toISOString() })

    await act(async () => confirm())
    expect(await screen.findByRole('button', { name: 'Desmarcar postado' })).toBeInTheDocument()
    expect(cardOrder('postado')).toEqual(['publicar'])
    expect(rows[0]).toMatchObject({ etapa: 'aprovado', status: 'complete', lista_id: '901523996247', postado_em: new Date(now).toISOString() })
    expect(queueRequests()).toEqual([])
  })

  it.each(['empty', 'error', 'throw'])('não altera postagem nem anuncia sucesso quando salvar retorna %s', async mode => {
    expectedWrites = 1
    fake.resolve.mockImplementation((request: Request) => {
      if (!request.mutation) return defaultResult(request)
      if (mode === 'throw') throw new Error('Conexão indisponível')
      return { data: null, error: mode === 'error' ? { message: 'Gravação negada' } : null }
    })
    renderPage('?peca=recente')
    const post = await screen.findByRole('button', { name: 'Marcar como postado' })
    await screen.findByText(/1 de 1 peças no recorte/)
    fireEvent.click(post)
    await waitFor(() => expect(fake.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(rows[0].postado_em).toBeNull()
    expect(cardOrder('postado')).toEqual([])
    expect(within(screen.getByTestId('stage-fazer')).getByTestId('piece-recente')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desmarcar postado' })).not.toBeInTheDocument()
    expect(fake.toast.mock.calls.every(([message]) => message.variant === 'destructive')).toBe(true)
    expect(queueRequests()).toEqual([])
  })

  it('desmarca postagem sem alterar a etapa ou o status de origem', async () => {
    expectedWrites = 1
    rows = [piece('publicada', { etapa: 'aprovado', status: 'complete', lista_id: '901523996247', postado_em: '2026-09-10T12:00:00Z' })]
    renderPage('?peca=publicada')
    const unpost = await screen.findByRole('button', { name: 'Desmarcar postado' })
    await screen.findByText(/1 de 1 peças no recorte/)
    fireEvent.click(unpost)
    expect(await screen.findByRole('button', { name: 'Marcar como postado' })).toBeInTheDocument()
    expect(writeRequests()[0].mutation?.payload).toEqual({ postado_em: null })
    expect(cardOrder('aprovado')).toEqual(['publicada'])
    expect(cardOrder('postado')).toEqual([])
    expect(rows[0]).toMatchObject({ etapa: 'aprovado', status: 'complete', lista_id: '901523996247', postado_em: null })
    expect(queueRequests()).toEqual([])
  })

  it.each([null, '2026-09-09T12:00:00Z'])('não sobrescreve uma postagem alterada depois da leitura (valor anterior %j)', async originalPosting => {
    expectedWrites = 1
    rows = [piece('concorrente', { postado_em: originalPosting })]
    renderPage('?peca=concorrente')
    const button = await screen.findByRole('button', { name: originalPosting ? 'Desmarcar postado' : 'Marcar como postado' })
    await screen.findByText(/1 de 1 peças no recorte/)
    const externalPosting = '2026-09-11T14:30:00Z'
    rows[0] = { ...rows[0], postado_em: externalPosting }
    fireEvent.click(button)
    await waitFor(() => expect(fake.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(writeRequests()[0].filters).toContainEqual({ method: originalPosting ? 'eq' : 'is', column: 'postado_em', value: originalPosting })
    expect(rows[0].postado_em).toBe(externalPosting)
    expect(queueRequests()).toEqual([])
    expect(fake.toast.mock.calls.every(([message]) => message.variant === 'destructive')).toBe(true)
  })

  it('arrasta para Postado com apenas o timestamp e volta à etapa original removendo-o em uma única gravação', async () => {
    expectedWrites = 2
    renderPage()
    await screen.findByTestId('piece-recente')
    dragPiece('recente', 'fazer', 'postado')
    await waitFor(() => expect(cardOrder('postado')).toEqual(['recente']))
    expect(writeRequests()[0].mutation?.payload).toEqual({ postado_em: new Date(now).toISOString() })
    expect(queueRequests()).toEqual([])
    dragPiece('recente', 'postado', 'fazer')
    await waitFor(() => expect(cardOrder('fazer')).toEqual(['recente']))
    expect(cardOrder('postado')).toEqual([])
    expect(writeRequests()[1].mutation?.payload).toMatchObject({ etapa: 'fazer', postado_em: null })
    expect(rows[0]).toMatchObject({ etapa: 'fazer', status: 'para ser feita', postado_em: null })
    expect(queueRequests()).toEqual([])
  })

  it('só envia a mudança real de etapa ao ClickUp depois de confirmar a remoção de Postado', async () => {
    expectedWrites = 2
    rows = [piece('mover', { postado_em: '2026-09-10T12:00:00Z' })]
    let confirm!: () => void
    fake.resolve.mockImplementation((request: Request) => request.table === 'postagens_organizador' && request.mutation
      ? new Promise<Result>(resolve => { confirm = () => resolve(defaultResult(request)) }) : defaultResult(request))
    renderPage()
    await screen.findByTestId('piece-mover')
    dragPiece('mover', 'postado', 'producao')
    await waitFor(() => expect(writeRequests()).toHaveLength(1))
    expect(cardOrder('postado')).toEqual(['mover'])
    expect(queueRequests()).toEqual([])
    expect(writeRequests()[0].mutation?.payload).toMatchObject({ postado_em: null, etapa: 'producao', status: 'irei enviar ainda' })
    await act(async () => confirm())
    await waitFor(() => expect(queueRequests()).toHaveLength(1))
    expect(cardOrder('producao')).toEqual(['mover'])
    expect(queueRequests()[0].mutation?.payload).toMatchObject({ task_id: 'mover', acao: 'mover', payload: { etapa: 'producao', lista_id: '901521539717' } })
  })

  it('mantém a peça em Postado e não envia ação ao ClickUp se a mudança de etapa não foi confirmada', async () => {
    expectedWrites = 1
    rows = [piece('mover', { postado_em: '2026-09-10T12:00:00Z' })]
    fake.resolve.mockImplementation((request: Request) => request.mutation ? { data: null, error: null } : defaultResult(request))
    renderPage()
    await screen.findByTestId('piece-mover')
    dragPiece('mover', 'postado', 'producao')
    await waitFor(() => expect(fake.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(cardOrder('postado')).toEqual(['mover'])
    expect(cardOrder('producao')).toEqual([])
    expect(queueRequests()).toEqual([])
    expect(rows[0]).toMatchObject({ etapa: 'fazer', status: 'para ser feita', postado_em: '2026-09-10T12:00:00Z' })
    expect(fake.toast.mock.calls.every(([message]) => message.variant === 'destructive')).toBe(true)
  })
})
