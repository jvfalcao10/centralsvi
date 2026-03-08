import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const PAGE_TITLES: Record<string, { title: string; breadcrumb: string[] }> = {
  '/dashboard': { title: 'Dashboard', breadcrumb: ['Home', 'Dashboard'] },
  '/pipeline': { title: 'Pipeline CRM', breadcrumb: ['Home', 'Pipeline'] },
  '/clients': { title: 'Clientes', breadcrumb: ['Home', 'Clientes'] },
  '/deliveries': { title: 'Entregas', breadcrumb: ['Home', 'Entregas'] },
  '/financial': { title: 'Financeiro', breadcrumb: ['Home', 'Financeiro'] },
}

interface Alert {
  msg: string
  level: 'red' | 'yellow'
  type: string
}

export function AppHeader() {
  const location = useLocation()
  const { profile } = useAuth()
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'SVI', breadcrumb: ['Home'] }
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [openNotif, setOpenNotif] = useState(false)

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'SV'

  useEffect(() => {
    async function loadAlerts() {
      const today = new Date().toISOString().split('T')[0]
      const [{ data: clients }, { data: invoices }, { data: deliveries }] = await Promise.all([
        supabase.from('clients').select('name, status, health_score'),
        supabase.from('invoices').select('status, vencimento, clients(name)').select('id, status, vencimento'),
        supabase.from('deliveries').select('id, status, prazo, titulo'),
      ])

      const newAlerts: Alert[] = []

      if (clients) {
        const atRisk = clients.filter(c => c.status === 'risco').length
        const defaulters = clients.filter(c => c.status === 'inadimplente').length
        const lowHealth = clients.filter(c => c.health_score < 50 && c.status === 'ativo').length
        if (defaulters > 0) newAlerts.push({ msg: `${defaulters} cliente(s) inadimplente(s)`, level: 'red', type: 'client' })
        if (atRisk > 0) newAlerts.push({ msg: `${atRisk} cliente(s) em risco de churn`, level: 'yellow', type: 'client' })
        if (lowHealth > 0) newAlerts.push({ msg: `${lowHealth} cliente(s) com health score crítico`, level: 'yellow', type: 'client' })
      }
      if (invoices) {
        const overdue = invoices.filter(i => i.status === 'atrasado' || (i.status === 'pendente' && i.vencimento < today)).length
        if (overdue > 0) newAlerts.push({ msg: `${overdue} fatura(s) vencida(s)`, level: 'red', type: 'invoice' })
      }
      if (deliveries) {
        const late = deliveries.filter(d => d.status !== 'entregue' && d.prazo < today).length
        if (late > 0) newAlerts.push({ msg: `${late} entrega(s) atrasada(s)`, level: 'yellow', type: 'delivery' })
      }
      setAlerts(newAlerts)
    }
    loadAlerts()
  }, [location.pathname])

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

      {/* Notifications */}
      <Popover open={openNotif} onOpenChange={setOpenNotif}>
        <PopoverTrigger asChild>
          <button className="relative text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-accent">
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-danger text-danger-foreground text-[10px] font-bold rounded-full px-0.5">
                {alerts.length}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 bg-card border-border" align="end" sideOffset={8}>
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Alertas</p>
            <p className="text-xs text-muted-foreground">{alerts.length > 0 ? `${alerts.length} item(s) requer(em) atenção` : 'Tudo em ordem'}</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-5 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <p className="text-sm">Nenhum alerta no momento</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 ${alert.level === 'red' ? 'bg-danger/5' : 'bg-warning/5'}`}>
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${alert.level === 'red' ? 'text-danger' : 'text-warning'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{alert.msg}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${alert.level === 'red' ? 'bg-danger/20 text-danger border-danger/30' : 'bg-warning/20 text-warning border-warning/30'}`}>
                    {alert.level === 'red' ? 'Crítico' : 'Atenção'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Avatar className="h-8 w-8 cursor-pointer">
        <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
    </header>
  )
}
