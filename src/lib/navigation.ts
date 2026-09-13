import type { UserRole } from '@/contexts/AuthContext'

export type NavigationBadge = 'approvals' | 'team' | 'invoices' | 'clients'
export type NavigationIcon = 'home' | 'clients' | 'operations' | 'commercial' | 'financial' | 'results' | 'resources' | 'admin' | 'traffic'

export interface NavigationItem {
  title: string
  url: string
  minRole: UserRole
  section?: string
  badgeKey?: NavigationBadge
}

export interface NavigationArea {
  id: string
  title: string
  icon: NavigationIcon
  items: NavigationItem[]
  direct?: boolean
}

export const NAV_AREAS: NavigationArea[] = [
  { id: 'inicio', title: 'Início', icon: 'home', direct: true, items: [
    { title: 'Início', url: '/dashboard', minRole: 'manager' },
  ] },
  { id: 'clientes', title: 'Clientes', icon: 'clients', items: [
    { title: 'Carteira de clientes', url: '/clients', minRole: 'executor', badgeKey: 'clients' },
    { title: 'Onboarding', url: '/onboarding', minRole: 'manager' },
    { title: 'Documentos', url: '/documentos', minRole: 'executor' },
  ] },
  { id: 'operacao', title: 'Operação', icon: 'operations', items: [
    { title: 'Tarefas', url: '/tarefas', minRole: 'executor', section: 'Demandas' },
    { title: 'Carga de demandas', url: '/operacional/carga', minRole: 'manager', section: 'Demandas' },
    { title: 'Organizador de postagens', url: '/content/organizador', minRole: 'executor', section: 'Conteúdo' },
    { title: 'Aprovações', url: '/content/aprovacoes', minRole: 'executor', section: 'Conteúdo' },
    { title: 'Pipeline de conteúdo', url: '/content/posts', minRole: 'executor', section: 'Conteúdo' },
    { title: 'Banco de pautas', url: '/content/pautas', minRole: 'executor', section: 'Conteúdo' },
    { title: 'Reels em alta', url: '/content/reels', minRole: 'executor', section: 'Conteúdo' },
    { title: 'Datas estratégicas', url: '/content/datas', minRole: 'executor', section: 'Conteúdo' },
    { title: 'Referência de produção', url: '/content/producao', minRole: 'executor', section: 'Conteúdo' },
    { title: 'Central de postagens ↗', url: 'https://postagens.svicompany.com.br', minRole: 'executor', section: 'Conteúdo' },
  ] },
  { id: 'comercial', title: 'Comercial', icon: 'commercial', items: [
    { title: 'Pipeline comercial', url: '/pipeline', minRole: 'seller' },
    { title: 'Scripts', url: '/scripts', minRole: 'executor' },
    { title: 'Catálogo', url: '/catalogo', minRole: 'manager' },
  ] },
  { id: 'financeiro', title: 'Financeiro', icon: 'financial', items: [
    { title: 'Contas a pagar e receber', url: '/financial', minRole: 'admin', badgeKey: 'invoices' },
    { title: 'Previsão financeira', url: '/financial/previsao', minRole: 'admin' },
    { title: 'Conferência financeira', url: '/financial/conferencia', minRole: 'admin' },
  ] },
  { id: 'resultados', title: 'Resultados', icon: 'results', items: [
    { title: 'Visão da diretoria', url: '/diretoria', minRole: 'manager' },
    { title: 'Anúncios', url: '/reports/anuncios', minRole: 'executor' },
    { title: 'Google', url: '/reports/google', minRole: 'executor' },
    { title: 'Trackeamento', url: '/trackeamento', minRole: 'manager' },
  ] },
  { id: 'recursos', title: 'Recursos', icon: 'resources', items: [
    { title: 'Acessos e ferramentas', url: '/acessos', minRole: 'executor' },
    { title: 'Senhas', url: '/senhas', minRole: 'executor' },
    { title: 'Processos', url: '/processos', minRole: 'executor' },
    { title: 'Inteligência', url: '/inteligencia', minRole: 'executor' },
  ] },
]

export const ADMIN_AREA: NavigationArea = {
  id: 'administracao', title: 'Administração', icon: 'admin', items: [
    { title: 'Equipe', url: '/team', minRole: 'admin', badgeKey: 'team' },
    { title: 'Solicitações de acesso', url: '/admin/approvals', minRole: 'manager', badgeKey: 'approvals' },
  ],
}

/** O perfil de tráfego mantém sua navegação própria, fora da hierarquia staff. */
export const TRAFFIC_AREAS: NavigationArea[] = [
  { id: 'trafego', title: 'Tráfego', icon: 'traffic', direct: true, items: [
    { title: 'Tráfego', url: '/operacional/trafego', minRole: 'traffic' },
  ] },
  { id: 'analises', title: 'Análises', icon: 'results', direct: true, items: [
    { title: 'Análises', url: '/operacional/trafego/analises', minRole: 'traffic' },
  ] },
]

export function getVisibleNavigation({ can, isTraffic = false, isClient = false }: {
  can: (role: UserRole) => boolean
  isTraffic?: boolean
  isClient?: boolean
}): { main: NavigationArea[]; footer: NavigationArea[] } {
  if (isClient) return { main: [], footer: [] }
  if (isTraffic) return { main: TRAFFIC_AREAS, footer: [] }
  const visible = (areas: NavigationArea[]) => areas
    .map(area => ({ ...area, items: area.items.filter(item => can(item.minRole)) }))
    .filter(area => area.items.length > 0)
  return { main: visible(NAV_AREAS), footer: visible([ADMIN_AREA]) }
}

function matchesRoute(pathname: string, url: string) {
  return url.startsWith('/') && (pathname === url || pathname.startsWith(url + '/'))
}

/** Escolhe somente o destino mais específico, com limite de segmento. */
export function findActiveNavigation(pathname: string, areas: NavigationArea[]) {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  let active: { area: NavigationArea; item: NavigationItem } | null = null
  for (const area of areas) for (const item of area.items) {
    if (matchesRoute(path, item.url) && (!active || item.url.length > active.item.url.length)) active = { area, item }
  }
  return active
}

/** Recebe apenas a área já filtrada: cada contador aponta para um filho visível. */
export function navigationBadgeCount(area: NavigationArea, badges: Partial<Record<NavigationBadge, number>>) {
  const keys = new Set(area.items.map(item => item.badgeKey).filter((key): key is NavigationBadge => !!key))
  return [...keys].reduce((sum, key) => sum + (badges[key] || 0), 0)
}

const CONTEXTUAL_BREADCRUMBS: { path: string; breadcrumb: string[] }[] = [
  { path: '/operacional/trafego/analises', breadcrumb: ['Operação', 'Tráfego', 'Análises'] },
  { path: '/operacional/trafego/plano-semana', breadcrumb: ['Operação', 'Tráfego', 'Plano da semana'] },
  { path: '/operacional/trafego/brief', breadcrumb: ['Operação', 'Tráfego', 'Briefing'] },
  { path: '/operacional/trafego', breadcrumb: ['Operação', 'Tráfego'] },
  { path: '/operacional/feedback', breadcrumb: ['Operação', 'Feedback do dia'] },
  { path: '/reports/overview', breadcrumb: ['Resultados', 'Visão geral'] },
  { path: '/content/radar', breadcrumb: ['Operação', 'Radar'] },
  { path: '/content/reels', breadcrumb: ['Operação', 'Reels em alta'] },
  { path: '/activity', breadcrumb: ['Recursos', 'Histórico de atividades'] },
  { path: '/lista-espera', breadcrumb: ['Administração', 'Lista de espera'] },
  { path: '/admin/paineis', breadcrumb: ['Administração', 'Painéis de clientes'] },
]

export function getNavigationBreadcrumb(pathname: string, isTraffic = false): string[] {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  if (path.startsWith('/clients/')) return ['Clientes', 'Gestão do cliente']
  if (path.startsWith('/inteligencia/')) return ['Recursos', 'Inteligência', 'Referência']
  const context = CONTEXTUAL_BREADCRUMBS.find(entry => matchesRoute(path, entry.path))
  if (context) return isTraffic ? context.breadcrumb.filter(part => part !== 'Operação') : context.breadcrumb
  const active = findActiveNavigation(path, [...NAV_AREAS, ADMIN_AREA])
  if (!active) return ['Central SVI']
  return active.area.title === active.item.title ? [active.area.title] : [active.area.title, active.item.title]
}
