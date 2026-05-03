import { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, GitBranch, Users, CheckSquare, DollarSign, Crosshair, FileText,
  ClipboardCheck, Clock, UserCog, UserCheck, Kanban, BarChart3, Sun, Moon, LogOut,
  ChevronRight, ChevronDown, Briefcase, Sparkles, ShieldCheck, Settings,
} from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth, UserRole } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useNavBadges } from '@/hooks/useNavBadges'
import logoBranca from '@/assets/logo-branca.png'
import logoSvi from '@/assets/logo-svi.png'

interface SubItem {
  title: string
  url: string
  minRole: UserRole
  badgeKey?: 'approvals' | 'team' | 'deliveries' | 'invoices' | 'clients'
}

interface NavGroup {
  type: 'group'
  title: string
  icon: any
  minRole: UserRole
  items: SubItem[]
  badgeKeys?: ('approvals' | 'team' | 'deliveries' | 'invoices' | 'clients')[]
}

interface NavSingle {
  type: 'item'
  title: string
  url: string
  icon: any
  minRole: UserRole
  badgeKey?: 'approvals' | 'team' | 'deliveries' | 'invoices' | 'clients'
}

type NavEntry = NavGroup | NavSingle

const NAV: NavEntry[] = [
  { type: 'item', title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, minRole: 'manager' },

  {
    type: 'group',
    title: 'Comercial',
    icon: Briefcase,
    minRole: 'seller',
    items: [
      { title: 'Pipeline', url: '/pipeline', minRole: 'seller' },
      { title: 'Metas SDR/IS', url: '/comercial', minRole: 'seller' },
      { title: 'Prospecção', url: '/prospecting', minRole: 'seller' },
      { title: 'Scripts', url: '/scripts', minRole: 'executor' },
    ],
  },

  {
    type: 'group',
    title: 'Conteúdo',
    icon: Kanban,
    minRole: 'executor',
    items: [
      { title: 'Posts', url: '/content/posts', minRole: 'executor' },
      { title: 'Pautas', url: '/content/pautas', minRole: 'executor' },
      { title: 'Calendário', url: '/content/calendar', minRole: 'executor' },
      { title: 'Radar', url: '/content/radar', minRole: 'executor' },
      { title: 'Monitor', url: '/content/monitor', minRole: 'executor' },
    ],
  },

  {
    type: 'group',
    title: 'Operacional',
    icon: ClipboardCheck,
    minRole: 'executor',
    badgeKeys: ['deliveries', 'clients'],
    items: [
      { title: 'Clientes', url: '/clients', minRole: 'executor', badgeKey: 'clients' },
      { title: 'Onboarding', url: '/onboarding', minRole: 'manager' },
      { title: 'Entregas', url: '/deliveries', minRole: 'executor', badgeKey: 'deliveries' },
    ],
  },

  { type: 'item', title: 'Financeiro', url: '/financial', icon: DollarSign, minRole: 'manager', badgeKey: 'invoices' },

  {
    type: 'group',
    title: 'Admin',
    icon: ShieldCheck,
    minRole: 'manager',
    badgeKeys: ['approvals', 'team'],
    items: [
      { title: 'Aprovações', url: '/admin/approvals', minRole: 'manager', badgeKey: 'approvals' },
      { title: 'Equipe', url: '/team', minRole: 'admin', badgeKey: 'team' },
      { title: 'Atividades', url: '/activity', minRole: 'executor' },
    ],
  },
]

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center text-[10px] font-bold rounded-full px-1.5 bg-primary/20 text-primary border border-primary/30">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const location = useLocation()
  const { profile, role, signOut, can } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const badges = useNavBadges()

  const isActive = (url: string) => location.pathname === url
  const isInGroup = (group: NavGroup) => group.items.some(i => isActive(i.url))

  // Auto-expand groups whose route is active
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const next: Record<string, boolean> = {}
    NAV.forEach(entry => {
      if (entry.type === 'group') {
        next[entry.title] = isInGroup(entry) || openGroups[entry.title] === true
      }
    })
    setOpenGroups(prev => ({ ...prev, ...next }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const toggleGroup = (title: string) =>
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }))

  const groupBadgeCount = (group: NavGroup): number =>
    (group.badgeKeys || []).reduce((sum, k) => sum + (badges[k] || 0), 0)

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'SV'

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-xs">S</span>
            </div>
          ) : (
            <img
              src={theme === 'dark' ? logoBranca : logoSvi}
              alt="SVI"
              className="h-8 object-contain"
            />
          )}
        </div>
        {!collapsed && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5 pl-1">
            Sistema de Vendas Inteligente
          </p>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {NAV.map(entry => {
            if (!can(entry.minRole)) return null

            if (entry.type === 'item') {
              const active = isActive(entry.url)
              const count = entry.badgeKey ? badges[entry.badgeKey] : 0
              return (
                <SidebarMenuItem key={entry.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={entry.title}
                    className={`transition-all duration-150 ${active
                      ? 'bg-primary/15 text-primary font-medium border border-primary/20'
                      : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Link to={entry.url} className="flex items-center gap-3">
                      <entry.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{entry.title}</span>}
                      {!collapsed && count > 0 && <Badge count={count} />}
                      {!collapsed && active && count === 0 && (
                        <ChevronRight className="h-3 w-3 ml-auto text-primary" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            // Group
            const groupActive = isInGroup(entry)
            const open = openGroups[entry.title] ?? groupActive
            const count = groupBadgeCount(entry)

            return (
              <SidebarMenuItem key={entry.title}>
                <Collapsible open={!collapsed && open} onOpenChange={() => toggleGroup(entry.title)}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={entry.title}
                      isActive={groupActive}
                      className={`transition-all duration-150 ${groupActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <entry.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span>{entry.title}</span>
                          {count > 0 ? (
                            <Badge count={count} />
                          ) : (
                            <ChevronDown
                              className={`h-3.5 w-3.5 ml-auto transition-transform shrink-0 ${open ? 'rotate-0' : '-rotate-90'}`}
                            />
                          )}
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {entry.items.filter(s => can(s.minRole)).map(sub => {
                          const subActive = isActive(sub.url)
                          const subCount = sub.badgeKey ? badges[sub.badgeKey] : 0
                          return (
                            <SidebarMenuSubItem key={sub.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={subActive}
                                className={subActive ? 'bg-primary/15 text-primary font-medium' : ''}
                              >
                                <Link to={sub.url} className="flex items-center gap-2">
                                  <span className="flex-1">{sub.title}</span>
                                  {subCount > 0 && <Badge count={subCount} />}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </Collapsible>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}
          title="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>}
        </button>

        {/* User info */}
        <div className={`flex items-center gap-2 px-2 py-2 rounded-lg bg-accent/50 ${collapsed ? 'justify-center' : ''}`}>
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{profile?.name || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{role || 'usuário'}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={signOut} title="Sair" className="text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
