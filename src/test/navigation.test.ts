import { describe, expect, it } from 'vitest'
import type { UserRole } from '@/contexts/AuthContext'
import { ADMIN_AREA, NAV_AREAS, findActiveNavigation, getNavigationBreadcrumb, getVisibleNavigation, navigationBadgeCount } from '@/lib/navigation'

const hierarchy: Partial<Record<UserRole, number>> = { admin: 4, manager: 3, seller: 2, executor: 1 }
const canFor = (role: UserRole) => (required: UserRole) => (hierarchy[role] || 0) >= (hierarchy[required] || 100)
const urlsFor = (role: UserRole) => {
  const navigation = getVisibleNavigation({ can: canFor(role), isTraffic: role === 'traffic', isClient: role === 'client' })
  return [...navigation.main, ...navigation.footer].flatMap(area => area.items.map(item => item.url))
}

describe('Áreas de navegação', () => {
  it('organiza os destinos do administrador em sete áreas e administração no rodapé', () => {
    const navigation = getVisibleNavigation({ can: canFor('admin') })
    expect(navigation.main.map(area => area.title)).toEqual(['Início', 'Clientes', 'Operação', 'Comercial', 'Financeiro', 'Resultados', 'Recursos'])
    expect(navigation.footer.map(area => area.title)).toEqual(['Administração'])
  })

  it('mantém os destinos anteriores e torna acessíveis as páginas existentes previstas', () => {
    const urls = urlsFor('admin')
    const previous = ['/dashboard', '/acessos', '/tarefas', '/senhas', '/processos', '/catalogo', '/trackeamento', '/diretoria', '/inteligencia', '/documentos', '/content/aprovacoes', '/content/posts', '/content/pautas', '/content/datas', '/content/organizador', '/content/producao', 'https://postagens.svicompany.com.br', '/scripts', '/operacional/carga', '/clients', '/financial', '/reports/anuncios', '/reports/google', '/team']
    expect(urls).toEqual(expect.arrayContaining([...previous, '/pipeline', '/onboarding', '/admin/approvals', '/financial/previsao', '/financial/conferencia']))
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('não mostra páginas financeiras nem equipe ao gestor, mantendo solicitações e onboarding', () => {
    const urls = urlsFor('manager')
    expect(urls).toContain('/admin/approvals')
    expect(urls).toContain('/onboarding')
    expect(urls).not.toContain('/team')
    expect(urls.some(url => url.startsWith('/financial'))).toBe(false)
    expect(getVisibleNavigation({ can: canFor('manager') }).footer[0].items).toHaveLength(1)
  })

  it('separa o acesso comercial do vendedor e do executor sem grupos vazios', () => {
    expect(urlsFor('seller')).toContain('/pipeline')
    const executor = urlsFor('executor')
    expect(executor).toEqual(expect.arrayContaining(['/scripts', '/tarefas', '/content/organizador', '/clients']))
    for (const forbidden of ['/pipeline', '/catalogo', '/onboarding', '/dashboard', '/operacional/carga', '/team', '/admin/approvals']) expect(executor).not.toContain(forbidden)
    const navigation = getVisibleNavigation({ can: canFor('executor') })
    expect(navigation.footer).toEqual([])
    expect(navigation.main.every(area => area.items.length > 0)).toBe(true)
  })

  it('preserva o menu exclusivo de tráfego e não entrega navegação staff a clientes ou usuários sem permissão', () => {
    expect(urlsFor('traffic')).toEqual(['/operacional/trafego', '/operacional/trafego/analises'])
    expect(getVisibleNavigation({ can: () => true, isClient: true })).toEqual({ main: [], footer: [] })
    expect(getVisibleNavigation({ can: canFor('user') })).toEqual({ main: [], footer: [] })
  })

  it('destaca um único destino, escolhendo o prefixo mais específico e respeitando o segmento', () => {
    const areas = [...NAV_AREAS, ADMIN_AREA]
    expect(findActiveNavigation('/financial/previsao?periodo=30', areas)?.item.url).toBe('/financial/previsao')
    expect(findActiveNavigation('/financial/conferencia/', areas)?.item.url).toBe('/financial/conferencia')
    expect(findActiveNavigation('/clients/cliente-123', areas)?.item.url).toBe('/clients')
    expect(findActiveNavigation('/inteligencia/referencia-123', areas)?.area.id).toBe('recursos')
    expect(findActiveNavigation('/financial-antigo', areas)).toBeNull()
    const traffic = getVisibleNavigation({ can: () => false, isTraffic: true })
    expect(findActiveNavigation('/operacional/trafego/analises/conta', traffic.main)?.item.url).toBe('/operacional/trafego/analises')
  })

  it('soma apenas os contadores dos destinos permitidos e não inclui entregas sem destino', () => {
    const badges = { approvals: 3, team: 11, clients: 2, invoices: 5, deliveries: 90 }
    const manager = getVisibleNavigation({ can: canFor('manager') })
    expect(navigationBadgeCount(manager.footer[0], badges)).toBe(3)
    expect(navigationBadgeCount(manager.main.find(area => area.id === 'operacao')!, badges)).toBe(0)
    expect(navigationBadgeCount(manager.main.find(area => area.id === 'clientes')!, badges)).toBe(2)
    expect(navigationBadgeCount(getVisibleNavigation({ can: canFor('admin') }).footer[0], badges)).toBe(14)
  })

  it('usa as áreas da navegação nos caminhos e identifica páginas de detalhe', () => {
    expect(getNavigationBreadcrumb('/content/aprovacoes')).toEqual(['Operação', 'Aprovações'])
    expect(getNavigationBreadcrumb('/financial/previsao')).toEqual(['Financeiro', 'Previsão financeira'])
    expect(getNavigationBreadcrumb('/clients/cliente-123')).toEqual(['Clientes', 'Gestão do cliente'])
    expect(getNavigationBreadcrumb('/inteligencia/referencia')).toEqual(['Recursos', 'Inteligência', 'Referência'])
    expect(getNavigationBreadcrumb('/operacional/trafego/analises/conta', true)).toEqual(['Tráfego', 'Análises'])
    expect(getNavigationBreadcrumb('/desconhecida')).toEqual(['Central SVI'])
  })
})
