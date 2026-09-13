import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'

const fake = vi.hoisted(() => ({ role: 'admin' }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({
  profile: { name: 'Pessoa de teste' }, role: fake.role, signOut: vi.fn(), isTraffic: fake.role === 'traffic', isClient: fake.role === 'client',
  can: (required: string) => {
    const hierarchy: Record<string, number> = { admin: 4, manager: 3, seller: 2, executor: 1 }
    return (hierarchy[fake.role] || 0) >= (hierarchy[required] || 100)
  },
}) }))
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }) }))
vi.mock('@/hooks/useNavBadges', () => ({ useNavBadges: () => ({ approvals: 3, team: 11, clients: 2, invoices: 5, deliveries: 90 }) }))

function renderSidebar(path = '/dashboard', collapsed = false) {
  return render(<MemoryRouter initialEntries={[path]}><SidebarProvider defaultOpen={!collapsed}>
    <AppSidebar /><Link to="/financial/previsao" data-testid="change-route">Ir para previsão</Link>
  </SidebarProvider></MemoryRouter>)
}

beforeEach(() => { fake.role = 'admin' })
afterEach(cleanup)

describe('Sidebar compacto', () => {
  it('apresenta sete escolhas principais e administração em uma navegação separada', () => {
    renderSidebar()
    const main = within(screen.getByRole('navigation', { name: 'Navegação principal' }))
    expect(main.getByRole('link', { name: 'Início' })).toBeInTheDocument()
    expect(main.getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(['Clientes', 'Operação', 'Comercial', 'Financeiro', 'Resultados', 'Recursos'])
    expect(main.queryByRole('button', { name: 'Administração' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Administração' })).getByRole('button', { name: 'Administração' })).toBeInTheDocument()
  })

  it('mantém somente uma área aberta e acompanha a navegação para a rota mais específica', () => {
    renderSidebar('/tarefas')
    expect(screen.getByRole('button', { name: 'Operação' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }))
    expect(screen.getByRole('button', { name: 'Clientes' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Operação' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByTestId('change-route'))
    expect(screen.getByRole('button', { name: 'Clientes' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Financeiro' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Previsão financeira' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Contas a pagar e receber/ })).not.toHaveAttribute('aria-current')
  })

  it('expande o menu ao clicar no ícone de uma área recolhida e deixa os destinos utilizáveis', () => {
    renderSidebar('/dashboard', true)
    expect(screen.queryByRole('link', { name: 'Tarefas' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Operação' }))
    expect(screen.getByRole('button', { name: 'Operação' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Tarefas' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Tarefas' })).toHaveAttribute('href', '/tarefas')
  })

  it('respeita permissões do executor e mantém o destino comercial permitido a ele', () => {
    fake.role = 'executor'
    renderSidebar('/scripts')
    expect(screen.queryByRole('button', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Administração' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Scripts' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Pipeline comercial' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Operação' }))
    expect(screen.getByRole('link', { name: 'Aprovações' })).toHaveAttribute('href', '/content/aprovacoes')
    expect(screen.queryByRole('link', { name: 'Carga de demandas' })).not.toBeInTheDocument()
  })

  it('mostra ao gestor apenas a aprovação de acessos no rodapé e seu contador correspondente', () => {
    fake.role = 'manager'
    renderSidebar('/admin/approvals')
    const admin = within(screen.getByRole('navigation', { name: 'Administração' }))
    expect(admin.getByRole('link', { name: /Solicitações de acesso/ })).toHaveAttribute('href', '/admin/approvals')
    expect(admin.queryByRole('link', { name: /Equipe/ })).not.toBeInTheDocument()
    expect(admin.getAllByLabelText('3 pendências')).toHaveLength(2)
    expect(admin.queryByLabelText('14 pendências')).not.toBeInTheDocument()
  })

  it('preserva as duas entradas de tráfego e destaca apenas análises em uma conta', () => {
    fake.role = 'traffic'
    renderSidebar('/operacional/trafego/analises/conta-123')
    const main = within(screen.getByRole('navigation', { name: 'Navegação principal' }))
    expect(main.getAllByRole('link')).toHaveLength(2)
    expect(main.getByRole('link', { name: 'Análises' })).toHaveAttribute('aria-current', 'page')
    expect(main.getByRole('link', { name: 'Tráfego' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button', { name: 'Administração' })).not.toBeInTheDocument()
  })
})
