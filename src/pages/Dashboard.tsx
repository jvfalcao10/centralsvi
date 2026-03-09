import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  DollarSign, TrendingDown, Users, Target, AlertTriangle,
  TrendingUp, ArrowUp, ArrowDown, RefreshCw
} from 'lucide-react'
import { useUsdRateInfo, mrrBRL } from '@/hooks/useUsdRate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { formatCurrency } from '@/types'

const MRR_DATA = [
  { month: 'Jan', mrr: 18500 }, { month: 'Fev', mrr: 21000 },
  { month: 'Mar', mrr: 23500 }, { month: 'Abr', mrr: 25800 },
  { month: 'Mai', mrr: 27200 }, { month: 'Jun', mrr: 28700 },
]

interface KPICard {
  label: string; value: string; change: number; icon: React.ElementType; prefix?: string
}

export default function Dashboard() {
  const { rate: usdRate, updatedAt: usdUpdatedAt, isEstimate: usdIsEstimate } = useUsdRateInfo()
  const [clients, setClients] = useState<{ status: string; mrr: number; currency: string }[]>([])
  const [leads, setLeads] = useState<{ stage: string }[]>([])
  const [expenses, setExpenses] = useState<{ valor: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<{ msg: string; level: 'green' | 'yellow' | 'red' }[]>([])

  useEffect(() => {
    async function load() {
      const [
        { data: clientsData },
        { data: leadsData },
        { data: deliveries },
        { data: invoices },
        { data: expensesData },
      ] = await Promise.all([
        supabase.from('clients').select('status, mrr, currency'),
        supabase.from('leads').select('stage'),
        supabase.from('deliveries').select('status, prazo'),
        supabase.from('invoices').select('status, vencimento'),
        supabase.from('expenses').select('valor'),
      ])

      if (clientsData) setClients(clientsData)
      if (leadsData) setLeads(leadsData)
      if (expensesData) setExpenses(expensesData)

      const newAlerts: { msg: string; level: 'green' | 'yellow' | 'red' }[] = []
      if (clientsData) {
        const atRisk = clientsData.filter(c => c.status === 'risco').length
        const defaulters = clientsData.filter(c => c.status === 'inadimplente').length
        if (atRisk > 0) newAlerts.push({ msg: `${atRisk} cliente(s) em risco de churn`, level: 'yellow' })
        if (defaulters > 0) newAlerts.push({ msg: `${defaulters} cliente(s) inadimplente(s)`, level: 'red' })
      }
      if (invoices) {
        const today = new Date().toISOString().split('T')[0]
        const overdueInvoices = invoices.filter(i => i.status === 'atrasado' || (i.status === 'pendente' && i.vencimento < today)).length
        if (overdueInvoices > 0) newAlerts.push({ msg: `${overdueInvoices} fatura(s) vencida(s)`, level: 'red' })
      }
      if (deliveries) {
        const today = new Date().toISOString().split('T')[0]
        const late = deliveries.filter(d => d.status !== 'entregue' && d.prazo < today).length
        if (late > 0) newAlerts.push({ msg: `${late} entrega(s) atrasada(s)`, level: 'yellow' })
      }
      if (newAlerts.length === 0) newAlerts.push({ msg: 'Tudo certo! Nenhum alerta no momento.', level: 'green' })
      setAlerts(newAlerts)
      setLoading(false)
    }
    load()
  }, [])

  const activeClients = clients.filter(c => c.status === 'ativo').length
  const totalMRR = clients.reduce((sum, c) => sum + mrrBRL(c.mrr, c.currency, usdRate), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.valor, 0)
  const riskClients = clients.filter(c => c.status === 'risco' || c.status === 'inadimplente').length
  const churnRate = clients.length > 0 ? ((riskClients / clients.length) * 100).toFixed(1) : '0.0'

  // Real conversion rate: fechado leads / total non-perdido leads
  const totalLeads = leads.filter(l => l.stage !== 'perdido').length
  const closedLeads = leads.filter(l => l.stage === 'fechado').length
  const conversionRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : '0.0'

  // Revenue data using real MRR
  const revenueData = [
    { name: 'Receita', valor: totalMRR },
    { name: 'Despesas', valor: totalExpenses },
  ]

  // Update last month in MRR_DATA with real value
  const mrrChartData = MRR_DATA.map((d, i) => i === MRR_DATA.length - 1 && totalMRR > 0 ? { ...d, mrr: totalMRR } : d)

  const kpis: KPICard[] = [
    { label: 'MRR Atual', value: formatCurrency(totalMRR), change: 5.4, icon: DollarSign },
    { label: 'Churn Mensal', value: `${churnRate}%`, change: -1.2, icon: TrendingDown },
    { label: 'Clientes Ativos', value: String(activeClients), change: 2.1, icon: Users },
    { label: 'Taxa de Conversão', value: `${conversionRate}%`, change: totalLeads > 0 ? 3.8 : 0, icon: Target },
  ]

  const alertBadgeClass = {
    green: 'bg-success/20 text-success border-success/30',
    yellow: 'bg-warning/20 text-warning border-warning/30',
    red: 'bg-danger/20 text-danger border-danger/30',
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-lg">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((entry: any) => (
            <p key={entry.name} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  const usdFormatted = usdRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const usdTime = usdUpdatedAt
    ? usdUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          const isPositive = kpi.change > 0
          const isGoodPositive = kpi.label !== 'Churn Mensal' ? isPositive : !isPositive
          return (
            <Card key={kpi.label} className="border-border bg-card hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm mb-1">{kpi.label}</p>
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                {kpi.change !== 0 && (
                  <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${isGoodPositive ? 'text-success' : 'text-danger'}`}>
                    {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    <span>{Math.abs(kpi.change)}% vs mês anterior</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* USD Rate Card */}
        <Card className="border-border bg-card hover:border-primary/30 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-muted-foreground text-sm mb-1">Cotação USD</p>
                <p className="text-2xl font-bold text-foreground">
                  {usdIsEstimate && !usdTime ? 'Carregando...' : `R$ ${usdFormatted}`}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-info/15 flex items-center justify-center">
                <span className="text-lg leading-none">🇺🇸</span>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
              {usdIsEstimate ? (
                <Badge variant="outline" className="text-xs py-0 px-1.5 border-warning/30 text-warning bg-warning/10">Estimado</Badge>
              ) : usdTime ? (
                <>
                  <RefreshCw className="h-3 w-3" />
                  <span>Atualizado às {usdTime}</span>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Evolução MRR (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mrrChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="mrr" name="MRR" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-info" />
              Receita vs Despesas (mês atual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="valor" name="Valor" radius={[6, 6, 0, 0]} fill="url(#barGradient)" />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-success inline-block" /> Receita</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-danger inline-block" /> Despesas</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Alertas do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.level === 'red' ? 'text-danger' : alert.level === 'yellow' ? 'text-warning' : 'text-success'}`} />
                <p className="text-sm flex-1">{alert.msg}</p>
                <Badge variant="outline" className={alertBadgeClass[alert.level]}>
                  {alert.level === 'red' ? 'Crítico' : alert.level === 'yellow' ? 'Atenção' : 'OK'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
