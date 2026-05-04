import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign, Users, TrendingDown, AlertTriangle, CheckCircle2,
  GitBranch, FileText, ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUsdRate, mrrBRL } from '@/hooks/useUsdRate'
import { formatCurrency } from '@/types'

interface Client {
  id: string
  name: string
  status: string
  mrr: number
  currency: string
  health_score: number | null
  data_inicio_servico: string | null
}

interface Lead {
  id: string
  stage: string
  ticket_estimado: number | null
}

interface Delivery {
  id: string
  status: string
  prazo: string | null
}

interface Invoice {
  id: string
  status: string
  valor: number
  vencimento: string
}

const STATUS_LABEL: Record<string, string> = {
  ativo: 'Ativo',
  risco: 'Em risco',
  inadimplente: 'Inadimplente',
  pausado: 'Pausado',
  cancelado: 'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  ativo: 'bg-success/20 text-success border-success/30',
  risco: 'bg-warning/20 text-warning border-warning/30',
  inadimplente: 'bg-danger/20 text-danger border-danger/30',
  pausado: 'bg-muted text-muted-foreground border-border',
  cancelado: 'bg-muted text-muted-foreground border-border',
}

export default function ReportsOverview() {
  const usdRate = useUsdRate()
  const [clients, setClients] = useState<Client[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [c, l, d, i] = await Promise.all([
        supabase.from('clients').select('id, name, status, mrr, currency, health_score, data_inicio_servico'),
        supabase.from('leads').select('id, stage, ticket_estimado'),
        supabase.from('deliveries').select('id, status, prazo'),
        supabase.from('invoices').select('id, status, valor, vencimento'),
      ])
      setClients(c.data || [])
      setLeads(l.data || [])
      setDeliveries(d.data || [])
      setInvoices(i.data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  // === MRR ===
  const activeClients = clients.filter(c => c.status === 'ativo' || c.status === 'risco')
  const mrrTotal = activeClients.reduce((sum, c) => sum + mrrBRL(c.mrr, c.currency, usdRate), 0)
  const mrrAtRisk = clients
    .filter(c => c.status === 'risco' || c.status === 'inadimplente')
    .reduce((sum, c) => sum + mrrBRL(c.mrr, c.currency, usdRate), 0)

  // === Carteira por status ===
  const byStatus = clients.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // === Pipeline ===
  const pipelineByStage = leads.reduce((acc, l) => {
    acc[l.stage] = (acc[l.stage] || 0) + (l.ticket_estimado || 0)
    return acc
  }, {} as Record<string, number>)
  const pipelineActiveValue = Object.entries(pipelineByStage)
    .filter(([stage]) => stage !== 'perdido' && stage !== 'fechado')
    .reduce((sum, [, v]) => sum + v, 0)
  const pipelineCount = leads.filter(l => l.stage !== 'perdido' && l.stage !== 'fechado').length

  // === Entregas ===
  const lateDeliveries = deliveries.filter(d => d.status !== 'entregue' && d.prazo && d.prazo < today).length
  const inProgressDeliveries = deliveries.filter(d => d.status !== 'entregue' && (!d.prazo || d.prazo >= today)).length
  const completedThisMonth = deliveries.filter(d => {
    if (d.status !== 'entregue' || !d.prazo) return false
    const month = new Date(d.prazo).getMonth()
    const currentMonth = new Date().getMonth()
    return month === currentMonth
  }).length

  // === Financeiro ===
  const overdueInvoices = invoices.filter(i =>
    i.status === 'atrasado' || (i.status === 'pendente' && i.vencimento < today)
  )
  const overdueValue = overdueInvoices.reduce((sum, i) => sum + (i.valor || 0), 0)

  // === Health score ===
  const healthScores = clients
    .filter(c => c.status === 'ativo' && c.health_score !== null)
    .map(c => c.health_score!)
  const avgHealth = healthScores.length > 0
    ? Math.round(healthScores.reduce((s, h) => s + h, 0) / healthScores.length)
    : null
  const lowHealthClients = clients.filter(c => c.status === 'ativo' && c.health_score !== null && c.health_score < 50)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Performance Geral</h1>
        <p className="text-sm text-muted-foreground">Snapshot consolidado da carteira e operação</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">MRR Ativo</span>
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(mrrTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{activeClients.length} clientes</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">MRR em risco</span>
              <TrendingDown className="h-4 w-4 text-danger" />
            </div>
            <p className="text-2xl font-bold text-danger">{formatCurrency(mrrAtRisk)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {((byStatus.risco || 0) + (byStatus.inadimplente || 0))} cliente(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Pipeline ativo</span>
              <GitBranch className="h-4 w-4 text-info" />
            </div>
            <p className="text-2xl font-bold text-info">{formatCurrency(pipelineActiveValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{pipelineCount} deal(s)</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Health médio</span>
              <CheckCircle2 className={`h-4 w-4 ${avgHealth === null ? 'text-muted-foreground' : avgHealth >= 70 ? 'text-success' : avgHealth >= 50 ? 'text-warning' : 'text-danger'}`} />
            </div>
            <p className={`text-2xl font-bold ${avgHealth === null ? 'text-muted-foreground' : avgHealth >= 70 ? 'text-success' : avgHealth >= 50 ? 'text-warning' : 'text-danger'}`}>
              {avgHealth === null ? '—' : `${avgHealth}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {lowHealthClients.length > 0 ? `${lowHealthClients.length} crítico(s)` : 'sem crítico'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Carteira por status */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Carteira por status</h2>
            </div>
            <Link to="/clients" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['ativo', 'risco', 'inadimplente', 'pausado', 'cancelado'] as const).map(s => (
              <div key={s} className="text-center p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-2xl font-bold">{byStatus[s] || 0}</p>
                <Badge variant="outline" className={`text-xs mt-1 ${STATUS_CLASS[s]}`}>
                  {STATUS_LABEL[s]}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operacional + Financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Entregas</h2>
              </div>
              <Link to="/deliveries" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ver detalhes <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                  Atrasadas
                </span>
                <span className={`font-bold ${lateDeliveries > 0 ? 'text-danger' : ''}`}>{lateDeliveries}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-info" />
                  Em andamento
                </span>
                <span className="font-bold">{inProgressDeliveries}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Concluídas no mês
                </span>
                <span className="font-bold text-success">{completedThisMonth}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Financeiro</h2>
              </div>
              <Link to="/financial" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ver detalhes <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                  Faturas vencidas
                </span>
                <span className={`font-bold ${overdueInvoices.length > 0 ? 'text-danger' : ''}`}>
                  {overdueInvoices.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valor a receber (vencido)</span>
                <span className="font-bold text-danger">{formatCurrency(overdueValue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Faturas pagas este mês</span>
                <span className="font-bold text-success">
                  {invoices.filter(i => i.status === 'pago').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health crítico */}
      {lowHealthClients.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h2 className="text-sm font-semibold">Atenção: clientes com health crítico</h2>
            </div>
            <div className="space-y-1.5">
              {lowHealthClients.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/30">
                  <span>{c.name}</span>
                  <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                    Health {c.health_score}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
