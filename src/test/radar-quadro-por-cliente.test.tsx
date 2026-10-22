import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// João, 22/10/2026: "quero no radar ver o que o Arthur já fez, números mesmo,
// igual Trello cada etapa ser a do cliente e organizar por tags".
const fake = vi.hoisted(() => ({ tabelas: {} as Record<string, unknown[]>, updates: vi.fn(), toast: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: fake.toast }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {
  from(tabela: string) {
    const query: Record<string, unknown> = {}
    let escrita: Record<string, unknown> | null = null
    query.select = () => query
    query.order = () => query
    query.update = (payload: Record<string, unknown>) => { escrita = payload; return query }
    query.eq = (_coluna: string, valor: unknown) => {
      if (escrita) fake.updates({ tabela, id: valor, payload: escrita })
      return query
    }
    query.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve().then(() => resolve(
        escrita ? { error: null } : { data: fake.tabelas[tabela] || [], error: null },
      ))
    return query
  },
} }))

const { default: QuadroPorCliente } = await import('@/components/radar/QuadroPorCliente')

const post = (extra: Record<string, unknown> = {}) => ({
  url: 'https://instagram.com/reel/abc', caption: 'gancho da peça', views: 120000, likes: 4300,
  comments: 210, thumb_url: 'https://cdn/thumb.jpg', published_at: '2026-10-20T12:00:00Z',
  times_median: 2.4, is_highlight: true, profile_id: 'perfil-1', ...extra,
})

function montarBanco() {
  fake.tabelas = {
    radar_saves: [
      { id: 's1', client_id: 'c1', post_id: 'p1', status: 'salvo', note: null, tags: ['dor'],
        created_at: new Date().toISOString(), saved_by: 'u-arthur', radar_posts: post() },
      { id: 's2', client_id: 'c1', post_id: 'p2', status: 'salvo', note: null, tags: [],
        created_at: new Date().toISOString(), saved_by: 'u-arthur', radar_posts: post({ views: 9000, is_highlight: false, times_median: null }) },
      { id: 's3', client_id: 'c2', post_id: 'p3', status: 'salvo', note: null, tags: ['dor', 'prova'],
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(), saved_by: null, radar_posts: post() },
    ],
    clientes_operacional: [{ id: 'c1', name: 'Dr. Brenno' }, { id: 'c2', name: 'Exatta Solar' }, { id: 'c3', name: 'Números' }],
    radar_watchlist: [
      { client_id: 'c1', profile_id: 'perfil-1' }, { client_id: 'c1', profile_id: 'perfil-2' },
      { client_id: 'c2', profile_id: 'perfil-1' }, { client_id: 'c3', profile_id: 'perfil-3' },
    ],
    radar_profiles: [{ id: 'perfil-1', handle: 'drmaurochoi' }, { id: 'perfil-2', handle: 'fisiophfontenele' }],
    profiles: [{ user_id: 'u-arthur', name: 'Arthur SVI' }],
  }
}

describe('Quadro do radar por cliente', () => {
  afterEach(() => { cleanup(); fake.updates.mockReset() })

  it('mostra os números do garimpo e quem garimpou', async () => {
    montarBanco()
    render(<QuadroPorCliente />)
    await waitFor(() => expect(screen.getByText('referências salvas')).toBeInTheDocument())
    // 3 salvas no total, 2 dentro dos últimos 7 dias, 3 perfis distintos, 3 clientes com radar.
    expect(screen.getByText('referências salvas').previousElementSibling).toHaveTextContent('3')
    expect(screen.getByText('salvas nos últimos 7 dias').previousElementSibling).toHaveTextContent('2')
    expect(screen.getByText('perfis vigiados').previousElementSibling).toHaveTextContent('3')
    expect(screen.getByText('clientes com radar montado').previousElementSibling).toHaveTextContent('3')
    expect(screen.getByText(/Arthur SVI \(2\)/)).toBeInTheDocument()
  })

  it('faz uma coluna por cliente, inclusive quem tem perfil e nada salvo', async () => {
    montarBanco()
    render(<QuadroPorCliente />)
    await waitFor(() => expect(screen.getByText('Dr. Brenno')).toBeInTheDocument())
    const brenno = screen.getByText('Dr. Brenno').closest('div')!.parentElement!
    expect(within(brenno).getByText('2 perfis no radar')).toBeInTheDocument()
    expect(screen.getByText('Números')).toBeInTheDocument()
    expect(screen.getByText('nada salvo ainda')).toBeInTheDocument()
  })

  it('mostra preview, número do post e a leitura contra a mediana', async () => {
    montarBanco()
    render(<QuadroPorCliente />)
    await waitFor(() => expect(screen.getAllByText('120 mil views').length).toBeGreaterThan(0))
    expect(screen.getAllByText('4 mil curt.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2,4x a mediana').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('img').some(img => img.getAttribute('src') === 'https://cdn/thumb.jpg')).toBe(true)
  })

  it('filtra por tag e some com quem não tem a tag', async () => {
    montarBanco()
    render(<QuadroPorCliente />)
    await waitFor(() => expect(screen.getByText('Números')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^prova/ }))
    await waitFor(() => expect(screen.queryByText('Dr. Brenno')).not.toBeInTheDocument())
    expect(screen.getByText('Exatta Solar')).toBeInTheDocument()
    expect(screen.queryByText('Números')).not.toBeInTheDocument()
  })

  it('grava a tag nova sem duplicar a que já existe', async () => {
    montarBanco()
    render(<QuadroPorCliente />)
    await waitFor(() => expect(screen.getByText('Dr. Brenno')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /tag/ })[0])
    const campo = await screen.findByPlaceholderText('tag')
    fireEvent.change(campo, { target: { value: 'DOR' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    await waitFor(() => expect(fake.updates).toHaveBeenCalled())
    expect(fake.updates.mock.calls[0][0]).toMatchObject({ tabela: 'radar_saves', id: 's1', payload: { tags: ['dor'] } })
  })
})
