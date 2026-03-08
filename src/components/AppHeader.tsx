import { useLocation } from 'react-router-dom'
import { Bell, ChevronRight } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'

const PAGE_TITLES: Record<string, { title: string; breadcrumb: string[] }> = {
  '/dashboard': { title: 'Dashboard', breadcrumb: ['Home', 'Dashboard'] },
  '/pipeline': { title: 'Pipeline CRM', breadcrumb: ['Home', 'Pipeline'] },
  '/clients': { title: 'Clientes', breadcrumb: ['Home', 'Clientes'] },
  '/deliveries': { title: 'Entregas', breadcrumb: ['Home', 'Entregas'] },
  '/financial': { title: 'Financeiro', breadcrumb: ['Home', 'Financeiro'] },
}

export function AppHeader() {
  const location = useLocation()
  const { profile } = useAuth()
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'SVI', breadcrumb: ['Home'] }

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'SV'

  return (
    <header className="h-14 flex items-center gap-4 px-4 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        {pageInfo.breadcrumb.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            <span className={i === pageInfo.breadcrumb.length - 1 ? 'text-foreground font-medium' : ''}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Actions */}
      <button className="relative text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-accent">
        <Bell className="h-4 w-4" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      <Avatar className="h-8 w-8 cursor-pointer">
        <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
    </header>
  )
}
