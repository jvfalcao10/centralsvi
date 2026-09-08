import { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Bell, ChevronRight, AlertTriangle, CheckCircle2, ArrowRight, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const PAGE_TITLES: Record<string, { title: string; breadcrumb: string[] }> = {
  '/dashboard': { title: 'Dashboard', breadcrumb: ['Home', 'Dashboard'] },
  '/tarefas': { title: 'Tarefas', breadcrumb: ['Home', 'Tarefas'] },
  '/pipeline': { title: 'Pipeline CRM', breadcrumb: ['Home', 'Pipeline'] },
  '/clients': { title: 'Clientes', breadcrumb: ['Home', 'Clientes'] },
  '/financial': { title: 'Financeiro', breadcrumb: ['Home', 'Financeiro'] },
}

interface Alert {
  msg: string
  level: 'red' | 'yellow'
  /** Pra onde o alerta leva. Alerta que não é clicável só informa e não resolve. */
  to: string
}

export function AppHeader() {
  const location = useLocation()
  const { profile } = useAuth()
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'SVI', breadcrumb: ['Home'] }
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [openNotif, setOpenNotif] = useState(false)
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [senha1, setSenha1] = useState('')
  const [senha2, setSenha2] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  // Troca a PROPRIA senha, logado, sem passar por e-mail.
  async function alterarSenha() {
    if (senha1.length < 8) return toast.error('Senha precisa de pelo menos 8 caracteres')
    if (senha1 !== senha2) return toast.error('As duas senhas não batem')
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: senha1 })
    setSalvandoSenha(false)
    if (error) return toast.error(`Não trocou: ${error.message}`)
    toast.success('Senha alterada. Já vale no próximo login.')
    setTrocandoSenha(false); setSenha1(''); setSenha2('')
  }

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'SV'

  useEffect(() => {
    async function loadAlerts() {
      const today = new Date().toISOString().split('T')[0]
      // Aprovacoes admin e Lista de Espera sairam do menu em 04/09 (paginas
      // passivas, quase sempre vazias). O sino e o unico caminho ate elas,
      // entao aqui NAO pode falhar silencioso.
      const [{ data: clients }, { data: invoices }, { data: signups }, { data: waitlist }, { data: tarefas }] = await Promise.all([
        supabase.from('clients').select('name, status, health_score'),
        supabase.from('invoices').select('status, vencimento, clients(name)').select('id, status, vencimento'),
        supabase.from('client_signup_requests').select('id, status'),
        supabase.from('agencia_waitlist').select('id'),
        supabase.from('tarefas').select('id, status, prazo'),
      ])

      const newAlerts: Alert[] = []

      if (clients) {
        const atRisk = clients.filter(c => c.status === 'risco').length
        const defaulters = clients.filter(c => c.status === 'inadimplente').length
        const lowHealth = clients.filter(c => c.health_score < 50 && c.status === 'ativo').length
        if (defaulters > 0) newAlerts.push({ msg: `${defaulters} cliente(s) inadimplente(s)`, level: 'red', to: '/clients' })
        if (atRisk > 0) newAlerts.push({ msg: `${atRisk} cliente(s) em risco de churn`, level: 'yellow', to: '/clients' })
        if (lowHealth > 0) newAlerts.push({ msg: `${lowHealth} cliente(s) com health score crítico`, level: 'yellow', to: '/clients' })
      }
      if (invoices) {
        const overdue = invoices.filter(i => i.status === 'atrasado' || (i.status === 'pendente' && i.vencimento < today)).length
        if (overdue > 0) newAlerts.push({ msg: `${overdue} fatura(s) vencida(s)`, level: 'red', to: '/financial' })
      }
      const pendentes = (signups || []).filter((r: any) => r.status === 'pending' || r.status === 'pendente').length
      if (pendentes > 0) newAlerts.push({ msg: `${pendentes} pedido(s) de acesso aguardando aprovação`, level: 'yellow', to: '/admin/approvals' })
      if ((waitlist || []).length > 0) newAlerts.push({ msg: `${(waitlist || []).length} agência(s) na lista de espera`, level: 'yellow', to: '/lista-espera' })
      const hoje = new Date().toISOString().split('T')[0]
      const tarefasTarde = (tarefas || []).filter((t: any) => t.status !== 'feita' && t.prazo && t.prazo < hoje).length
      if (tarefasTarde > 0) newAlerts.push({ msg: `${tarefasTarde} tarefa(s) atrasada(s)`, level: 'red', to: '/tarefas' })
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
                <Link
                  key={i}
                  to={alert.to}
                  onClick={() => setOpenNotif(false)}
                  className={`group flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors ${alert.level === 'red' ? 'bg-danger/5 hover:bg-danger/10' : 'bg-warning/5 hover:bg-warning/10'}`}
                >
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${alert.level === 'red' ? 'text-danger' : 'text-warning'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{alert.msg}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver e resolver <ArrowRight className="h-3 w-3" />
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${alert.level === 'red' ? 'bg-danger/20 text-danger border-danger/30' : 'bg-warning/20 text-warning border-warning/30'}`}>
                    {alert.level === 'red' ? 'Crítico' : 'Atenção'}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2">
          <p className="px-2 py-1.5 text-sm font-medium">{profile?.name || 'Você'}</p>
          <button
            onClick={() => setTrocandoSenha(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground">
            <KeyRound className="h-4 w-4" /> Alterar minha senha
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={trocandoSenha} onOpenChange={o => { setTrocandoSenha(o); if (!o) { setSenha1(''); setSenha2('') } }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Alterar minha senha</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="ns-1">Nova senha</Label>
              <Input id="ns-1" type="password" value={senha1} onChange={e => setSenha1(e.target.value)}
                placeholder="mínimo 8 caracteres" autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-2">Repete a nova senha</Label>
              <Input id="ns-2" type="password" value={senha2} onChange={e => setSenha2(e.target.value)}
                autoComplete="new-password" onKeyDown={e => e.key === 'Enter' && alterarSenha()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrocandoSenha(false)}>Cancelar</Button>
            <Button onClick={alterarSenha} disabled={salvandoSenha}>{salvandoSenha ? 'Salvando…' : 'Alterar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
