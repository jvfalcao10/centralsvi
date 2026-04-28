import { useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, GitBranch, Users, CheckSquare, DollarSign, Crosshair, FileText, ClipboardCheck, Clock, UserCog, UserCheck, Kanban, Sparkles, Stethoscope, BarChart3, Sun, Moon, LogOut, ChevronRight } from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth, UserRole } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import logoBranca from '@/assets/logo-branca.png'
import logoSvi from '@/assets/logo-svi.png'

interface NavItem {
  title: string
  url: string
  icon: any
  minRole: UserRole
}

const navItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, minRole: 'manager' },
  { title: 'Pipeline', url: '/pipeline', icon: GitBranch, minRole: 'seller' },
  { title: 'Comercial', url: '/comercial', icon: BarChart3, minRole: 'seller' },
  { title: 'Prospecção', url: '/prospecting', icon: Crosshair, minRole: 'seller' },
  { title: 'Scripts', url: '/scripts', icon: FileText, minRole: 'executor' },
  { title: 'Clientes', url: '/clients', icon: Users, minRole: 'executor' },
  { title: 'Aprovações', url: '/admin/approvals', icon: UserCheck, minRole: 'manager' },
  { title: 'Conteúdo', url: '/content/posts', icon: Kanban, minRole: 'executor' },
  { title: 'SVI Company', url: '/content/svi-company', icon: Sparkles, minRole: 'executor' },
  { title: 'SVI Doctor', url: '/content/svi-doctor', icon: Stethoscope, minRole: 'executor' },
  { title: 'Onboarding', url: '/onboarding', icon: ClipboardCheck, minRole: 'manager' },
  { title: 'Entregas', url: '/deliveries', icon: CheckSquare, minRole: 'executor' },
  { title: 'Financeiro', url: '/financial', icon: DollarSign, minRole: 'manager' },
  { title: 'Atividades', url: '/activity', icon: Clock, minRole: 'executor' },
  { title: 'Equipe', url: '/team', icon: UserCog, minRole: 'admin' },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const location = useLocation()
  const { profile, role, signOut, can } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const isActive = (url: string) => location.pathname === url
  const visibleNavItems = navItems.filter(item => can(item.minRole))

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
            <div className="flex items-center gap-2">
              <img
                src={theme === 'dark' ? logoBranca : logoSvi}
                alt="SVI"
                className="h-8 object-contain"
              />
            </div>
          )}
        </div>
        {!collapsed && (
          <p className="text-xs text-muted-foreground mt-1 pl-1">Command Center</p>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {visibleNavItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className={`transition-all duration-150 ${isActive(item.url)
                  ? 'bg-primary/15 text-primary font-medium border border-primary/20'
                  : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                  {!collapsed && isActive(item.url) && (
                    <ChevronRight className="h-3 w-3 ml-auto text-primary" />
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
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
