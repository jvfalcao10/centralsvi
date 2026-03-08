import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import {
  DollarSign, TrendingDown, Users, Target, AlertTriangle,
  TrendingUp, ArrowUp, ArrowDown
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { formatCurrency } from '@/types'

const MRR_DATA = [
  { month: 'Jan', mrr: 18500 }, { month: 'Fev', mrr: 21000 },
  { month: 'Mar', mrr: 23500 }, { month: 'Abr', mrr: 25800 },
  { month: 'Mai', mrr: 27200 }, { month: 'Jun', mrr: 28700 },
]

const REVENUE_DATA = [
  { name: 'Receita', valor: 28700 },
  { name: 'Despesas', valor: 15896 },
]

interface KPICard {
  label: string; value: string; change: number; icon: React.ElementType; prefix?: string
}

export default function Dashboard() {
  const { toast } = useToast()
  const [clients, setClients] = useState<{ status: string; mrr: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<{ msg: string; level: 'green' | 'yellow' | 'red' }[]>([])

  useEffect(() => {
    async function load() {
      const { data: clientsData } = await supabase.from('clients').select('status, mrr')
      const { data: deliveries } = await supabase.from('deliveries').select('status, prazo')
      const { data: invoices } = await supabase.from('invoices').select('status, vencimento')

      if (clientsData) setClients(clientsData)

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
      setAlerts(newAlerts)
      setLoading(false)
    }
    load()
  }, [])

  const activeClients = clients.filter(c => c.status === 'ativo').length
  const totalMRR = clients.reduce((sum, c) => sum + c.mrr, 0)
  const riskClients = clients.filter(c => c.status === 'risco' || c.status === 'inadimplente').length
  const churnRate = clients.length > 0 ? ((riskClients / clients.length) * 100).toFixed(1) : '0.0'
  const conversionRate = '23.5'

  const kpis: KPICard[] = [
    { label: 'MRR Atual', value: formatCurrency(totalMRR), change: 5.4, icon: DollarSign },
    { label: 'Churn Mensal', value: `${churnRate}%`, change: -1.2, icon: TrendingDown },
    { label: 'Clientes Ativos', value: String(activeClients), change: 2.1, icon: Users },
    { label: 'Taxa de Conversão', value: `${conversionRate}%`, change: 3.8, icon: Target },
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
                <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${isGoodPositive ? 'text-success' : 'text-danger'}`}>
                  {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  <span>{Math.abs(kpi.change)}% vs mês anterior</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* MRR Evolution */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Evolução MRR (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={MRR_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="mrr" name="MRR" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue vs Expenses */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-info" />
              Receita vs Despesas (mês atual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={REVENUE_DATA} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="valor" name="Valor" radius={[6, 6, 0, 0]}
                  fill="url(#barGradient)"
                  label={false}
                />
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
          {alerts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">✅ Nenhum alerta no momento. Tudo certo!</p>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
