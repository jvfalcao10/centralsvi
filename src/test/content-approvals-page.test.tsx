import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

type Approval = {
  id: string; tipo: string; cliente: string; chatid: string | null; mes: string | null; ano: number | null
  titulo: string; texto: string; status: 'pendente' | 'aprovado' | 'enviado' | 'reprovado'
  motivo: string | null; criado_em: string; atualizado_em: string | null | undefined; enviado_em: string | null; aprovado_por: string | null
}
type Request = {
  table: string
  payload: Record<string, unknown> | null
  filters: { method: string; column: string; value: unknown }[]
  orders: { column: string; options: unknown }[]
  range?: [number, number]
  single: boolean
  head: boolean
  selected: string | null
}
type Result = { data: unknown; error: { message: string } | null; count?: number }
const fake = vi.hoisted(() => ({ userId: '', reads: vi.fn(), writes: vi.fn(), resolve: vi.fn(), getUser: vi.fn(), toast: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: fake.toast }) }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: fake.userId, email: 'qa@example.test' }, can: () => true }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {
  auth: { getUser: fake.getUser },
  from(table: string) {
    const request: Request = { table, payload: null, filters: [], orders: [], single: false, head: false, selected: null }
    const query: Record<string, unknown> = {}
    query.select = (columns = '*', options?: { head?: boolean }) => {
      request.selected = columns
      request.head = options?.head || false
      return query
    }
    query.update = (payload: Record<string, unknown>) => { request.payload = payload; return query }
    for (const method of ['eq', 'is', 'in', 'gte', 'ilike']) {
      query[method] = (column: string, value: unknown) => { request.filters.push({ method, column, value }); return query }
    }
    query.order = (column: string, options?: unknown) => { request.orders.push({ column, options }); return query }
    query.range = (from: number, to: number) => { request.range = [from, to]; return query }
    query.maybeSingle = () => { request.single = true; return query }
    query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => {
      if (request.payload) fake.writes(request)
      else fake.reads(request)
      return Promise.resolve().then(() => fake.resolve(request)).then(resolve, reject)
    }
    return query
  },
} }))

import Aprovacoes from '@/pages/content/Aprovacoes'

const approval = (id: string, patch: Partial<Approval> = {}): Approval => ({
  id, tipo: 'plano_mensal', cliente: 'Cliente Aurora', chatid: 'ficticio@g.us', mes: 'setembro', ano: 2026,
  titulo: `Plano ${id}`, texto: '# Plano de setembro\n\n**Campanha Aurora**\n\n- Produzir um vídeo\n- Publicar duas peças',
  status: 'pendente', motivo: null, criado_em: '2026-09-11T12:00:00Z', atualizado_em: '2026-09-11T12:00:00Z',
  enviado_em: null, aprovado_por: null, ...patch,
})
let rows: Approval[]
let userSequence = 0

function defaultResult(request: Request): Result {
  const filtered = rows.filter(row => request.filters.every(filter => {
    const value = row[filter.column as keyof Approval]
    if (filter.method === 'in') return (filter.value as unknown[]).includes(value)
    if (filter.method === 'gte') return String(value) >= String(filter.value)
    if (filter.method === 'ilike') return String(value).toLowerCase().includes(String(filter.value).replace(/%/g, '').toLowerCase())
    return value === filter.value
  }))
  if (request.payload) {
    const saved = filtered.map(row => ({ ...row, ...request.payload, atualizado_em: '2026-09-11T12:01:00Z' }))
    rows = rows.map(row => saved.find(result => result.id === row.id) || row)
    return { data: request.single ? saved[0] || null : saved, error: null }
  }
  if (request.head) return { data: null, count: filtered.length, error: null }
  const ordered = [...filtered].sort((a, b) => b.criado_em.localeCompare(a.criado_em) || b.id.localeCompare(a.id))
  const page = request.range ? ordered.slice(request.range[0], request.range[1] + 1) : ordered
  return { data: request.single ? page[0] || null : page, error: null, count: filtered.length }
}

function renderPage() {
  return render(<MemoryRouter><Aprovacoes /></MemoryRouter>)
}
const writeRequests = () => fake.writes.mock.calls.map(([request]) => request as Request)
const listRequests = () => fake.reads.mock.calls.map(([request]) => request as Request).filter(request => !request.head)
const successfulToasts = () => fake.toast.mock.calls.map(([message]) => message).filter(message => message.variant !== 'destructive')
async function editText(text: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Editar texto' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Texto do conteúdo' }), { target: { value: text } })
}

beforeEach(() => {
  vi.clearAllMocks()
  fake.userId = `qa-${++userSequence}`
  rows = [approval('aurora')]
  fake.resolve.mockImplementation(defaultResult)
  fake.getUser.mockResolvedValue({ data: { user: { id: fake.userId } }, error: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Destino e confirmação da aprovação', () => {
  it.each([null, undefined, '', '   '])('bloqueia gravação sem versão confiável do conteúdo (%j)', async atualizado_em => {
    rows = [approval('sem-versao', { atualizado_em })]
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar para envio' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/atualiz/i)
    expect(fake.writes).not.toHaveBeenCalled()
    expect(successfulToasts()).toEqual([])
  })

  it('usa versão do registro em vez de incluir textos longos nos filtros da gravação', async () => {
    rows = [approval('longo', { texto: '# Plano extenso\n\n' + 'Detalhes da campanha. '.repeat(2000) })]
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar para envio' }))
    await waitFor(() => expect(successfulToasts()).toHaveLength(1))
    expect(writeRequests()[0].filters.map(filter => filter.column)).toEqual(['id', 'status', 'atualizado_em'])
    expect(writeRequests()[0].payload?.texto).toBe(rows[0].texto)
  })

  it('aprova briefing interno sem prometer envio ao cliente ou gravar status enviado', async () => {
    rows = [approval('briefing', { tipo: 'briefing', chatid: null, titulo: 'Briefing interno Aurora' })]
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar briefing' }))
    await waitFor(() => expect(successfulToasts()).toHaveLength(1))

    expect(rows[0]).toMatchObject({ status: 'aprovado', aprovado_por: fake.userId, enviado_em: null })
    expect(JSON.stringify(successfulToasts())).toMatch(/intern|execução/i)
    expect(JSON.stringify(successfulToasts())).not.toMatch(/dia 28|vai pro cliente|enviado ao cliente/i)
    expect(writeRequests()[0].payload).not.toHaveProperty('enviado_em')
  })

  it('aprova o plano mensal para envio mantendo a distinção entre aprovação e envio registrado', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar para envio' }))
    await waitFor(() => expect(successfulToasts()).toHaveLength(1))
    expect(rows[0]).toMatchObject({ status: 'aprovado', aprovado_por: fake.userId, enviado_em: null })
    const request = writeRequests()[0]
    expect(request.table).toBe('content_aprovacoes')
    expect(request.single).toBe(true)
    expect(request.selected).toBe('*')
    expect(request.filters).toEqual(expect.arrayContaining([
      { method: 'eq', column: 'id', value: 'aurora' },
      { method: 'eq', column: 'status', value: 'pendente' },
      { method: 'eq', column: 'atualizado_em', value: approval('aurora').atualizado_em },
    ]))
    expect(JSON.stringify(successfulToasts())).not.toMatch(/enviado com sucesso/i)
  })

  it.each([null, '', '   '])('bloqueia aprovação externa sem grupo válido (%j)', async chatid => {
    rows = [approval('sem-grupo', { chatid })]
    renderPage()
    expect(await screen.findByRole('button', { name: 'Aprovar para envio' })).toBeDisabled()
    expect(screen.getAllByText(/sem grupo/i).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar para envio' }))
    expect(fake.getUser).not.toHaveBeenCalled()
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it.each(['empty', 'error', 'throw', 'version-conflict', 'wrong-id'])('não informa sucesso nem remove o conteúdo quando a gravação tem %s', async mode => {
    fake.resolve.mockImplementation((request: Request) => {
      if (!request.payload) return defaultResult(request)
      if (mode === 'throw') throw new Error('Conexão perdida')
      if (mode === 'error') return { data: null, error: { message: 'Gravação negada' } }
      if (mode === 'empty') return { data: null, error: null }
      if (mode === 'wrong-id') return { data: approval('registro-diferente', { status: 'aprovado' }), error: null }
      rows[0] = { ...rows[0], atualizado_em: '2026-09-11T12:00:30Z' }
      return defaultResult(request)
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar para envio' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(successfulToasts()).toEqual([])
    expect(rows[0].status).toBe('pendente')
    expect(screen.getByRole('button', { name: 'Aprovar para envio' })).toBeEnabled()
    expect(writeRequests()).toHaveLength(1)
  })

  it.each(['missing', 'error'])('não escreve se a confirmação do usuário autenticado falha (%s)', async mode => {
    fake.getUser.mockResolvedValue({ data: { user: null }, error: mode === 'error' ? { message: 'Sessão expirada' } : null })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar para envio' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(fake.writes).not.toHaveBeenCalled()
    expect(successfulToasts()).toEqual([])
    expect(rows[0].status).toBe('pendente')
  })

  it('ignora dois cliques na aprovação enquanto a primeira autenticação está em andamento', async () => {
    let finishAuth!: (result: { data: { user: { id: string } }; error: null }) => void
    fake.getUser.mockImplementation(() => new Promise(resolve => { finishAuth = resolve }))
    renderPage()
    const approve = await screen.findByRole('button', { name: 'Aprovar para envio' })
    act(() => { fireEvent.click(approve); fireEvent.click(approve) })
    expect(fake.getUser).toHaveBeenCalledTimes(1)
    expect(approve).toBeDisabled()
    await act(async () => finishAuth({ data: { user: { id: fake.userId } }, error: null }))
    await waitFor(() => expect(successfulToasts()).toHaveLength(1))
    expect(writeRequests()).toHaveLength(1)
  })
})

describe('Rascunhos, ajustes e navegação', () => {
  it('pede confirmação do navegador ao sair com apenas o motivo ainda não registrado', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar ajustes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo dos ajustes' }), { target: { value: 'Uma orientação ainda não registrada' } })
    const leaving = new Event('beforeunload', { cancelable: true })
    fireEvent(window, leaving)
    expect(leaving.defaultPrevented).toBe(true)
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it('recupera a edição ao voltar à página e mantém a versão original para impedir sobrescrita concorrente', async () => {
    const originalVersion = rows[0].atualizado_em
    const firstView = renderPage()
    await editText('Minha revisão ainda não salva')
    firstView.unmount()
    rows[0] = { ...rows[0], texto: 'Revisão mais recente feita por outra pessoa', atualizado_em: '2026-09-11T12:20:00Z' }
    renderPage()
    expect(await screen.findByRole('textbox', { name: 'Texto do conteúdo' })).toHaveValue('Minha revisão ainda não salva')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(writeRequests()[0].filters).toContainEqual({ method: 'eq', column: 'atualizado_em', value: originalVersion })
    expect(rows[0].texto).toBe('Revisão mais recente feita por outra pessoa')
    expect(successfulToasts()).toEqual([])
  })

  it('não restaura o rascunho de outro usuário ao abrir o mesmo conteúdo', async () => {
    const firstView = renderPage()
    await editText('Rascunho privado do primeiro usuário')
    firstView.unmount()
    fake.userId = 'outro-usuario'
    renderPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Plano de setembro' })).toBeInTheDocument())
    expect(screen.queryByText('Rascunho privado do primeiro usuário')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Texto do conteúdo' })).not.toBeInTheDocument()
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it('não associa o rascunho anterior ao novo usuário quando a sessão muda sem desmontar a página', async () => {
    const view = renderPage()
    await editText('Rascunho reservado da sessão anterior')
    fake.userId = 'nova-sessao-sem-remount'
    view.rerender(<MemoryRouter><Aprovacoes /></MemoryRouter>)
    await waitFor(() => expect(listRequests()).toHaveLength(2))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Plano de setembro' })).toBeInTheDocument())
    expect(screen.queryByDisplayValue('Rascunho reservado da sessão anterior')).not.toBeInTheDocument()
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it('protege motivo não registrado ao fechar o modal e descarta só o motivo quando confirmado', async () => {
    renderPage()
    await editText('Texto editado que deve continuar intacto')
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar ajustes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo dos ajustes' }), { target: { value: 'Rever a chamada principal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    let confirmation = await screen.findByRole('alertdialog')
    expect(within(confirmation).queryByRole('button', { name: 'Salvar e continuar' })).not.toBeInTheDocument()
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Continuar editando' }))
    expect(screen.getByRole('textbox', { name: 'Motivo dos ajustes' })).toHaveValue('Rever a chamada principal')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    confirmation = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Descartar alterações' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Texto do conteúdo' })).toHaveValue('Texto editado que deve continuar intacto')
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it('retorna um conteúdo para revisão sem apagar o motivo previamente registrado', async () => {
    rows = [approval('revisao', { status: 'reprovado', motivo: 'Motivo registrado anteriormente', aprovado_por: 'outra-pessoa' })]
    renderPage()
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Ajustes e recusas/ }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar para revisão' }))
    await waitFor(() => expect(successfulToasts()).toHaveLength(1))
    expect(rows[0]).toMatchObject({ status: 'pendente', motivo: 'Motivo registrado anteriormente', aprovado_por: null })
    expect(writeRequests()[0].payload).toEqual({ status: 'pendente', aprovado_por: null })
    expect(fake.getUser).toHaveBeenCalledTimes(1)
  })

  it('salva o texto editado como pendente e mantém o rascunho após atualizar a lista', async () => {
    renderPage()
    await editText('# Novo rascunho\n\nTexto revisado pela equipe.')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(fake.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rascunho salvo' })))
    expect(rows[0]).toMatchObject({ texto: '# Novo rascunho\n\nTexto revisado pela equipe.', status: 'pendente', aprovado_por: null })
    expect(writeRequests()[0].payload).toEqual({ texto: '# Novo rascunho\n\nTexto revisado pela equipe.' })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Novo rascunho' })).toBeInTheDocument())
    expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument()
  })

  it('exige motivo e persiste texto editado junto ao pedido de ajustes', async () => {
    renderPage()
    await editText('Versão comentada para revisão')
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar ajustes' }))
    const modal = screen.getByRole('dialog')
    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar ajustes' }))
    expect(within(modal).getByRole('alert')).toHaveTextContent('Informe o motivo dos ajustes.')
    expect(fake.writes).not.toHaveBeenCalled()
    fireEvent.change(within(modal).getByRole('textbox', { name: 'Motivo dos ajustes' }), { target: { value: '  Revisar o objetivo da campanha.  ' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar ajustes' }))
    await waitFor(() => expect(successfulToasts()).toHaveLength(1))
    expect(rows[0]).toMatchObject({ texto: 'Versão comentada para revisão', status: 'reprovado', motivo: 'Revisar o objetivo da campanha.', aprovado_por: null })
    expect(writeRequests()[0].payload).toEqual({ texto: 'Versão comentada para revisão', status: 'reprovado', motivo: 'Revisar o objetivo da campanha.', aprovado_por: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('preserva texto e motivo quando o registro dos ajustes não confirma uma linha', async () => {
    fake.resolve.mockImplementation((request: Request) => request.payload ? { data: null, error: null } : defaultResult(request))
    renderPage()
    await editText('Rascunho ainda não salvo')
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar ajustes' }))
    const modal = screen.getByRole('dialog')
    fireEvent.change(within(modal).getByRole('textbox', { name: 'Motivo dos ajustes' }), { target: { value: 'Rever prazo e oferta' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar ajustes' }))
    expect(await within(modal).findByRole('alert')).toBeInTheDocument()
    expect(within(modal).getByRole('textbox', { name: 'Motivo dos ajustes' })).toHaveValue('Rever prazo e oferta')
    expect(screen.getByLabelText('Texto do conteúdo')).toHaveValue('Rascunho ainda não salvo')
    expect(rows[0].status).toBe('pendente')
    expect(successfulToasts()).toEqual([])
  })

  it('mantém o filtro e a edição ao cancelar a saída, depois salva antes de trocar o filtro', async () => {
    rows = [approval('plano'), approval('brief', { tipo: 'briefing' })]
    renderPage()
    await editText('# Preservar esta revisão')
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de conteúdo' }), { target: { value: 'briefing' } })
    const confirmation = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Continuar editando' }))
    expect(screen.getByRole('combobox', { name: 'Tipo de conteúdo' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Texto do conteúdo' })).toHaveValue('# Preservar esta revisão')
    expect(fake.writes).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de conteúdo' }), { target: { value: 'briefing' } })
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Salvar e continuar' }))
    expect(await screen.findByRole('button', { name: 'Aprovar briefing' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Tipo de conteúdo' })).toHaveValue('briefing')
    expect(rows.find(row => row.id === 'plano')).toMatchObject({ texto: '# Preservar esta revisão', status: 'pendente' })
    expect(writeRequests()).toHaveLength(1)
  })

  it('não troca o filtro se Salvar e continuar falhar e deixa a edição recuperável', async () => {
    fake.resolve.mockImplementation((request: Request) => request.payload ? { data: null, error: null } : defaultResult(request))
    renderPage()
    await editText('Edição que precisa ser preservada')
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de conteúdo' }), { target: { value: 'briefing' } })
    const modal = await screen.findByRole('alertdialog')
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar e continuar' }))
    expect(await within(modal).findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo de conteúdo')).toHaveValue('')
    expect(successfulToasts()).toEqual([])
    fireEvent.click(within(modal).getByRole('button', { name: 'Continuar editando' }))
    expect(screen.getByRole('textbox', { name: 'Texto do conteúdo' })).toHaveValue('Edição que precisa ser preservada')
  })
})

describe('Leitura segura do conteúdo', () => {
  it('pagina com desempate por ID e recupera uma página adicional que falhou sem perder a lista existente', async () => {
    rows = Array.from({ length: 26 }, (_, i) => approval(String(i).padStart(2, '0')))
    let failMore = true
    fake.resolve.mockImplementation((request: Request) => !request.head && request.range?.[0] === 25 && failMore
      ? { data: null, error: { message: 'Falha na página adicional' } } : defaultResult(request))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Carregar mais itens' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na página adicional')
    expect(screen.getByText('25 carregados')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Conteúdo selecionado' })).toBeInTheDocument()
    failMore = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('26 carregados')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar mais itens' })).not.toBeInTheDocument()
    expect(listRequests().map(request => request.range)).toEqual([[0, 24], [25, 49], [25, 49]])
    for (const request of listRequests()) {
      expect(request.orders).toEqual([{ column: 'criado_em', options: { ascending: false } }, { column: 'id', options: { ascending: false } }])
    }
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it.each(['error', 'null'])('mostra falha explícita sem declarar a fila vazia quando a consulta retorna %s', async mode => {
    fake.resolve.mockImplementation((request: Request) => request.head ? defaultResult(request)
      : { data: null, error: mode === 'error' ? { message: 'Leitura indisponível' } : null })
    renderPage()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/Nada em|Nenhum conteúdo|Nenhum item/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar para envio' })).not.toBeInTheDocument()
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it('renderiza markdown legível sem executar HTML, carregar imagens ou ativar URLs perigosas', async () => {
    rows = [approval('markdown', { texto: '# Campanha legível\n\n**Mensagem principal**\n\n- Primeiro passo\n- Segundo passo\n\n[Referência segura](https://example.test/referencia)\n\n[Executar](javascript:alert(1))\n\n[Arquivo](data:text/html,erro)\n\n![Pixel externo](https://tracker.example.test/pixel.png)\n\n<script>window.approvalPwned=true</script>\n<img src="https://tracker.example.test/html.png" onerror="alert(1)">\n<iframe src="https://tracker.example.test/frame"></iframe>' })]
    const view = renderPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Campanha legível' })).toBeInTheDocument())
    expect(screen.getByText('Mensagem principal').tagName).toBe('STRONG')
    expect(screen.getByText('Primeiro passo').tagName).toBe('LI')
    expect(screen.getByRole('link', { name: 'Referência segura' })).toHaveAttribute('href', 'https://example.test/referencia')
    expect(view.container.querySelector('script, iframe, img')).toBeNull()
    expect(view.container.querySelector('a[href^="javascript:"], a[href^="data:"]')).toBeNull()
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it('ignora a leitura anterior que termina depois da troca de tipo de conteúdo', async () => {
    const pending = new Map<string, (result: Result) => void>()
    fake.resolve.mockImplementation((request: Request) => {
      if (request.head) return defaultResult(request)
      const type = String(request.filters.find(filter => filter.column === 'tipo')?.value || 'todos')
      return new Promise<Result>(resolve => { pending.set(type, resolve) })
    })
    renderPage()
    await waitFor(() => expect(pending.has('todos')).toBe(true))
    const type = screen.getByRole('combobox', { name: 'Tipo de conteúdo' })
    expect(type).toBeEnabled()
    fireEvent.change(type, { target: { value: 'briefing' } })
    await waitFor(() => expect(pending.has('briefing')).toBe(true))

    await act(async () => pending.get('briefing')!({ data: [approval('atual', { tipo: 'briefing', titulo: 'Briefing atual confirmado' })], error: null }))
    expect(await screen.findByRole('button', { name: 'Aprovar briefing' })).toBeInTheDocument()
    await act(async () => pending.get('todos')!({ data: [approval('antigo', { titulo: 'Plano de uma consulta antiga' })], error: null }))
    expect(screen.queryByText('Plano de uma consulta antiga')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Tipo de conteúdo' })).toHaveValue('briefing')
    expect(screen.getByRole('button', { name: 'Aprovar briefing' })).toBeInTheDocument()
    expect(listRequests()).toHaveLength(2)
    expect(fake.writes).not.toHaveBeenCalled()
  })

  it('usa a busca atual ao selecionar conteúdo que chega depois de o usuário digitar', async () => {
    let finishRead!: (result: Result) => void
    fake.resolve.mockImplementation((request: Request) => request.head ? defaultResult(request)
      : new Promise<Result>(resolve => { finishRead = resolve }))
    renderPage()
    await waitFor(() => expect(listRequests()).toHaveLength(1))
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar nos itens carregados' }), { target: { value: 'Boreal' } })
    await act(async () => finishRead({ data: [approval('aurora'), approval('boreal', { cliente: 'Boreal', titulo: 'Plano Boreal' })], error: null }))
    expect(within(await screen.findByRole('article', { name: 'Conteúdo selecionado' })).getByRole('heading', { name: 'Plano Boreal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cliente Aurora.*Plano aurora/ })).not.toBeInTheDocument()
    expect(fake.writes).not.toHaveBeenCalled()
  })
})
