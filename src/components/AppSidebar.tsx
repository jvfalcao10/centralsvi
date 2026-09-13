import { Fragment, useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardCheck, Briefcase, DollarSign, PieChart,
  Compass, ShieldCheck, Activity, Sun, Moon, LogOut, ChevronDown, ExternalLink,
} from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useNavBadges } from '@/hooks/useNavBadges'
import {
  findActiveNavigation, getVisibleNavigation, navigationBadgeCount,
  type NavigationArea, type NavigationIcon,
} from '@/lib/navigation'
import logoBranca from '@/assets/logo-branca.png'
import logoSvi from '@/assets/logo-svi.png'

const ICONS: Record<NavigationIcon, typeof LayoutDashboard> = {
  home: LayoutDashboard, clients: Users, operations: ClipboardCheck, commercial: Briefcase,
  financial: DollarSign, results: PieChart, resources: Compass, admin: ShieldCheck, traffic: Activity,
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return <span aria-label={`${count} pendências`} className="ml-auto min-w-5 h-5 flex items-center justify-center text-[10px] font-semibold tabular-nums rounded-full px-1.5 bg-primary/15 text-primary">
    {count > 99 ? '99+' : count}
  </span>
}

export function AppSidebar() {
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  const location = useLocation()
  const { profile, role, signOut, can, isTraffic, isClient } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const badges = useNavBadges()
  const navigation = getVisibleNavigation({ can, isTraffic, isClient })
  const active = findActiveNavigation(location.pathname, [...navigation.main, ...navigation.footer])
  const activeAreaId = active && !active.area.direct ? active.area.id : null
  const [openAreaId, setOpenAreaId] = useState<string | null>(activeAreaId)

  useEffect(() => { setOpenAreaId(activeAreaId) }, [location.pathname, activeAreaId])

  const toggleArea = (id: string) => {
    if (collapsed) {
      setOpen(true)
      setOpenAreaId(id)
    } else setOpenAreaId(previous => previous === id ? null : id)
  }
  const closeMobileMenu = () => { if (isMobile) setOpenMobile(false) }

  const renderArea = (area: NavigationArea) => {
    const Icon = ICONS[area.icon]
    const areaActive = active?.area.id === area.id
    const count = navigationBadgeCount(area, badges)
    if (area.direct) {
      const item = area.items[0]
      return <SidebarMenuItem key={area.id}>
        <SidebarMenuButton asChild tooltip={area.title} isActive={areaActive}
          className={`h-9 transition-colors ${areaActive ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
          <Link to={item.url} aria-label={area.title} aria-current={areaActive ? 'page' : undefined} onClick={closeMobileMenu}>
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <><span>{area.title}</span><Badge count={count} /></>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    }

    const open = !collapsed && openAreaId === area.id
    return <SidebarMenuItem key={area.id}>
      <Collapsible open={open} onOpenChange={() => toggleArea(area.id)}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton aria-label={area.title} tooltip={area.title} isActive={areaActive}
            className={`h-9 transition-colors ${areaActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <>
              <span>{area.title}</span><Badge count={count} />
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${count ? '' : 'ml-auto'} ${open ? '' : '-rotate-90'}`} />
            </>}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {!collapsed && <CollapsibleContent>
          <SidebarMenuSub className="my-1 gap-0.5">
            {area.items.map((item, index) => {
              const itemActive = active?.item.url === item.url
              const itemCount = item.badgeKey ? badges[item.badgeKey] : 0
              const external = item.url.startsWith('http')
              const label = <><span className="min-w-0 flex-1 truncate">{item.title}</span>{external ? <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" /> : <Badge count={itemCount} />}</>
              return <Fragment key={item.url}>
                {item.section && area.items[index - 1]?.section !== item.section && <li className="px-2 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">{item.section}</li>}
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild size="sm" isActive={itemActive} title={item.title}
                    className={`h-8 ${itemActive ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                    {external
                      ? <a href={item.url} target="_blank" rel="noreferrer" onClick={closeMobileMenu}>{label}</a>
                      : <Link to={item.url} aria-current={itemActive ? 'page' : undefined} onClick={closeMobileMenu}>{label}</Link>}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </Fragment>
            })}
          </SidebarMenuSub>
        </CollapsibleContent>}
      </Collapsible>
    </SidebarMenuItem>
  }

  const initials = profile?.name ? profile.name.split(' ').map(name => name[0]).slice(0, 2).join('').toUpperCase() : 'SV'

  return <Sidebar collapsible="icon" className="border-r border-sidebar-border">
    <SidebarHeader className="px-4 pb-5 pt-5">
      <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
        {collapsed
          ? <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center"><span className="text-primary font-bold text-xs">S</span></div>
          : <img src={theme === 'dark' ? logoBranca : logoSvi} alt="SVI" className="h-8 object-contain" />}
      </div>
      {!collapsed && <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mt-1 pl-1">Central da operação</p>}
    </SidebarHeader>

    <SidebarContent className="px-2">
      <nav aria-label="Navegação principal"><SidebarMenu className="gap-1">{navigation.main.map(renderArea)}</SidebarMenu></nav>
    </SidebarContent>

    <SidebarFooter className="p-2.5 space-y-1 border-t border-sidebar-border">
      {navigation.footer.length > 0 && <nav aria-label="Administração"><SidebarMenu>{navigation.footer.map(renderArea)}</SidebarMenu></nav>}
      <button onClick={toggleTheme} aria-label="Alternar tema" title="Alternar tema"
        className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent text-xs ${collapsed ? 'justify-center' : ''}`}>
        {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
        {!collapsed && <span>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>}
      </button>
      <div className={`flex items-center gap-2 px-2 py-2 rounded-lg bg-accent/40 ${collapsed ? 'justify-center' : ''}`}>
        <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">{initials}</AvatarFallback></Avatar>
        {!collapsed && <>
          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{profile?.name || 'Usuário'}</p><p className="text-[10px] text-muted-foreground capitalize">{role || 'usuário'}</p></div>
          <button onClick={signOut} title="Sair" aria-label="Sair" className="text-muted-foreground hover:text-destructive"><LogOut className="h-4 w-4" /></button>
        </>}
      </div>
    </SidebarFooter>
  </Sidebar>
}
