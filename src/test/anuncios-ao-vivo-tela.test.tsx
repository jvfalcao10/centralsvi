import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AnunciosAoVivo from '@/pages/reports/AnunciosAoVivo'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'sessao-teste' } } }) } },
}))

const n = (gasto: number, conversas: number, segunda = 0, leads = 0) =>
  ({ gasto, conversas, segunda, leads, impressoes: 1000, cliques: 50 })

const conta = (id: string, nome: string, semana: ReturnType<typeof n>, antes: ReturnType<typeof n>, extra: Record<string, unknown> = {}) => ({
  id, nome, status: 1, saldo: null, cartao: 'VISA *0000', diasDeSaldo: null,
  periodos: { hoje: n(10, 1), ontem: n(20, 2), '7d': semana, '7d_ant': antes, '30d': semana, '30d_ant': antes },
  ...extra,
})

// Números da carteira em 22/10/2026 (Brenno, Fórmula, Essenc, GM Gás).
const CARTEIRA = {
  atualizadoEm: '2026-10-22T22:50:00.000Z',
  falhas: [],
  intervalos: {
    hoje: { since: '2026-10-22', until: '2026-10-22' }, ontem: { since: '2026-10-21', until: '2026-10-21' },
    '7d': { since: '2026-10-15', until: '2026-10-21' }, '7d_ant': { since: '2026-10-08', until: '2026-10-14' },
    '30d': { since: '2026-09-22', until: '2026-10-21' }, '30d_ant': { since: '2026-08-23', until: '2026-09-21' },
  },
  contas: [
    conta('4083355788544090', 'Brenno Cangussu', n(254.93, 18, 11), n(219.61, 26, 15), { saldo: 151.92, cartao: null, diasDeSaldo: 4.2 }),
    conta('1501288611025209', 'A Fórmula', n(399.82, 45, 27), n(393.33, 26, 14), { saldo: 1084.29, cartao: null, diasDeSaldo: 19 }),
    conta('1', 'Clínica Essenc', n(79.97, 4, 1), n(45.96, 6, 2), { saldo: 0, cartao: null, diasDeSaldo: 0 }),
    conta('2', 'Norte Capital', n(68.59, 0), n(72.35, 0)),
  ],
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><AnunciosAoVivo /></QueryClientProvider>)
}

describe('tela de anúncios ao vivo', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(CARTEIRA), { status: 200 })))
  })

  it('soma a carteira da semana e mostra cada conta', async () => {
    montar()
    expect(await screen.findByText('Brenno Cangussu')).toBeTruthy()
    expect(screen.getByText('A Fórmula')).toBeTruthy()
    // 254,93 + 399,82 + 79,97 + 68,59
    expect(screen.getByText(/803,31/)).toBeTruthy()
    // 18 + 45 + 4 conversas
    expect(screen.getByText('67')).toBeTruthy()
  })

  it('avisa conta sem saldo, saldo curto e custo que subiu', async () => {
    montar()
    await screen.findByText('Precisa de atenção')
    expect(screen.getByText(/sem saldo, anúncios parados/)).toBeTruthy()
    expect(screen.getByText(/dá para uns 4,2 dias/)).toBeTruthy()
    // Brenno: R$ 8,45 para R$ 14,16 = +68%
    expect(screen.getByText(/custo por conversa subiu 68%/)).toBeTruthy()
  })

  it('conta sem conversa mostra clique em vez de custo por conversa', async () => {
    montar()
    await screen.findByText('Norte Capital')
    expect(screen.getAllByText('Custo por clique').length).toBe(1)
  })

  it('pede a leitura com a sessão de quem está logado', async () => {
    montar()
    await screen.findByText('Brenno Cangussu')
    const [url, init] = (fetch as any).mock.calls[0]
    expect(url).toContain('__rota=anuncios-ao-vivo')
    expect(init.headers.Authorization).toBe('Bearer sessao-teste')
    fireEvent.click(screen.getByText('Saldo acabando'))
    const nomes = screen.getAllByText(/Brenno Cangussu|A Fórmula|Clínica Essenc/).map(e => e.textContent)
    expect(nomes.indexOf('Clínica Essenc')).toBeLessThan(nomes.indexOf('Brenno Cangussu'))
  })
})
