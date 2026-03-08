import { useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, GitBranch, Users, CheckSquare, DollarSign, Sun, Moon, LogOut, ChevronRight } from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import logoBranca from '@/assets/logo-branca.png'
import logoSvi from '@/assets/logo-svi.png'

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Pipeline', url: '/pipeline', icon: GitBranch },
  { title: 'Clientes', url: '/clients', icon: Users },
  { title: 'Entregas', url: '/deliveries', icon: CheckSquare },
  { title: 'Financeiro', url: '/financial', icon: DollarSign },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const isActive = (url: string) => location.pathname === url

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
          {navItems.map((item) => (
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
              <p className="text-xs text-muted-foreground truncate capitalize">{profile?.role || 'user'}</p>
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
