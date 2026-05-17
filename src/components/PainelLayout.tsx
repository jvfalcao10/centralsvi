import { useMemo } from 'react'
import { Outlet, NavLink as RouterNavLink, useParams, Navigate, useLocation, Link, useOutletContext } from 'react-router-dom'
import { LayoutDashboard, Users, Megaphone, Sparkles, MessagesSquare, Settings, ArrowLeftRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePainelOrg } from '@/hooks/usePainelOrg'
import { useTheme } from '@/contexts/ThemeContext'
import { initials } from '@/lib/painel/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: 'leads', label: 'CRM · Leads', icon: Users },
  { to: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { to: 'insights', label: 'Insights IA', icon: Sparkles },
  { to: 'chat', label: 'Agente IA', icon: MessagesSquare },
  { to: 'settings', label: 'Configurações', icon: Settings },
]

export default function PainelLayout() {
  const { slug } = useParams<{ slug: string }>()
  const { user, isStaff, signOut } = useAuth()
  const { client, hasAccess, isLoading } = usePainelOrg(slug)
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel não encontrado</h1>
          <p className="text-muted-foreground mt-2">Verifique a URL ou peça acesso à equipe SVI.</p>
          <Link to="/login" className="text-primary underline mt-4 inline-block">Voltar pro login</Link>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sem acesso</h1>
          <p className="text-muted-foreground mt-2">Você não está vinculado ao painel de {client.name}.</p>
          <div className="mt-4 flex gap-2 justify-center">
            <Link to="/dashboard"><Button variant="outline">Voltar</Button></Link>
            <Button variant="ghost" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-64 shrink-0 bg-background border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center text-xs font-semibold text-white shrink-0"
            style={{ backgroundColor: client.brand_color || '#0A0A0A' }}
          >
            {initials(client.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{client.name}</div>
            <div className="text-xs text-muted-foreground">Painel cliente</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <RouterNavLink
                key={item.to}
                to={`/cliente/${slug}${item.to ? `/${item.to}` : ''}`}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </RouterNavLink>
            )
          })}
        </nav>

        {isStaff && (
          <div className="p-3 border-t border-border">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Voltar pra Central SVI
            </Link>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-end px-6">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials(user.email || '')}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
          <Outlet context={{ client, slug }} />
        </main>
      </div>
    </div>
  )
}

export type PainelContext = {
  client: { id: string; name: string; slug: string; brand_color: string }
  slug: string
}

export function usePainelContext() {
  return useOutletContext<PainelContext>()
}
