import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  DollarSign, TrendingDown, Users, Target, AlertTriangle,
  TrendingUp, RefreshCw
} from 'lucide-react'
import { useUsdRateInfo } from '@/hooks/useUsdRate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { formatCurrency } from '@/types'
import { formatAxisCurrency, contractTotals, expensesDueInMonth, localDateISO, isOverdueInvoice, type InvoiceMetric } from '@/lib/management-metrics'
import { monthKeyOfDate } from '@/lib/months'
import { fetchAllRows } from '@/lib/data-access'
import DataLoadError from '@/components/DataLoadError'


interface KPICard {
  label: string; value: string; description: string; icon: React.ElementType; prefix?: string
}

function CustomTooltip({ active, payload, label }: any) {
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

export default function Dashboard() {
  const { rate: usdRate, updatedAt: usdUpdatedAt, isEstimate: usdIsEstimate } = useUsdRateInfo()
  const [clients, setClients] = useState<{ status: string; mrr: number; currency: string; permuta: boolean; permuta_ate: string | null }[]>([])
  const [leads, setLeads] = useState<{ stage: string }[]>([])
  const [expenses, setExpenses] = useState<{ valor: number; vencimento: string }[]>([])
  const [faturas, setFaturas] = useState<InvoiceMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [alerts, setAlerts] = useState<{ msg: string; level: 'green' | 'yellow' | 'red' }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [clientsData, leadsData, deliveries, invoices, expensesData] = await Promise.all([
        fetchAllRows((from, to) => supabase.from('clients').select('id, status, mrr, currency, permuta, permuta_ate').order('id').range(from, to)),
        fetchAllRows((from, to) => supabase.from('leads').select('id, stage').order('id').range(from, to)),
        fetchAllRows((from, to) => supabase.from('deliveries').select('id, status, prazo').order('id').range(from, to)),
        fetchAllRows((from, to) => supabase.from('invoices').select('id, status, vencimento, valor, data_pagamento').order('id').range(from, to)),
        fetchAllRows((from, to) => supabase.from('expenses').select('id, valor, vencimento').order('id').range(from, to)),
      ])
      setClients(clientsData)
      setLeads(leadsData)
      setExpenses(expensesData)
      setFaturas(invoices)
      const newAlerts: { msg: string; level: 'green' | 'yellow' | 'red' }[] = []
      const atRisk = clientsData.filter(c => c.status === 'risco').length
      const defaulters = clientsData.filter(c => c.status === 'inadimplente').length
      if (atRisk > 0) newAlerts.push({ msg: `${atRisk} cliente(s) em risco de saída`, level: 'yellow' })
      if (defaulters > 0) newAlerts.push({ msg: `${defaulters} cliente(s) inadimplente(s)`, level: 'red' })
      const today = localDateISO()
      const overdue = invoices.filter(i => isOverdueInvoice(i, today)).length
      if (overdue > 0) newAlerts.push({ msg: `${overdue} fatura(s) vencida(s)`, level: 'red' })
      const missingPaymentDates = invoices.filter(i => i.status === 'pago' && !i.data_pagamento).length
      if (missingPaymentDates > 0) newAlerts.push({ msg: `${missingPaymentDates} fatura(s) paga(s) sem data de recebimento. Confira os registros para completar o histórico de caixa.`, level: 'yellow' })
      const late = deliveries.filter(d => !['entregue', 'cancelado', 'cancelada'].includes(d.status) && d.prazo && d.prazo < today).length
      if (late > 0) newAlerts.push({ msg: `${late} entrega(s) atrasada(s)`, level: 'yellow' })
      if (newAlerts.length === 0) newAlerts.push({ msg: 'Nenhum alerta nos dados consultados.', level: 'green' })
      setAlerts(newAlerts)
    } catch {
      setLoadError(true)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const currentMonth = monthKeyOfDate(new Date())
  const contracts = contractTotals(clients, currentMonth, usdRate)
  const activeClients = contracts.active.length
  const totalMRR = contracts.total
  const totalExpenses = expensesDueInMonth(expenses, currentMonth).reduce((sum, e) => sum + Number(e.valor), 0)
  const riskClients = contracts.active.filter(c => c.status === 'risco' || c.status === 'inadimplente').length
  const riskRate = activeClients > 0 ? ((riskClients / activeClients) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0,0'
  const closedLeads = leads.filter(l => l.stage === 'fechado').length
  const lostLeads = leads.filter(l => l.stage === 'perdido').length
  const decidedLeads = closedLeads + lostLeads
  const conversionRate = decidedLeads > 0 ? `${((closedLeads / decidedLeads) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : 'Sem dados'
  const revenueData = [
    { name: 'Contratado', valor: contracts.monetary },
    { name: 'Despesas', valor: totalExpenses },
  ]

  const mrrChartData = (() => {
    const porMes = new Map<string, number>()
    for (const invoice of faturas) {
      if (invoice.status !== 'pago' || !invoice.data_pagamento) continue
      const month = invoice.data_pagamento.slice(0, 7)
      porMes.set(month, (porMes.get(month) || 0) + Number(invoice.valor))
    }
    return Array.from(porMes.entries()).sort().slice(-6)
      .map(([month, value]) => ({ month: `${month.slice(5, 7)}/${month.slice(2, 4)}`, mrr: value }))
  })()

  const kpis: KPICard[] = [
    { label: 'MRR contratado', value: formatCurrency(totalMRR), description: 'Contratos em operação, incluindo permuta', icon: DollarSign },
    { label: 'Clientes em risco', value: `${riskRate}%`, description: `${riskClients} em risco ou inadimplentes entre ${activeClients} em operação`, icon: TrendingDown },
    { label: 'Clientes em operação', value: String(activeClients), description: 'Ativos, em risco e inadimplentes', icon: Users },
    { label: 'Taxa de fechamento', value: conversionRate, description: 'Ganhos ÷ (ganhos + perdidos), todo o histórico', icon: Target },
  ]

  const alertBadgeClass = {
    green: 'bg-success/20 text-success border-success/30',
    yellow: 'bg-warning/20 text-warning border-warning/30',
    red: 'bg-danger/20 text-danger border-danger/30',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  if (loadError) return <DataLoadError onRetry={load} />

  const safeUsdRate = Number.isFinite(usdRate) && usdRate > 0 ? usdRate : 5.0
  const usdFormatted = safeUsdRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const usdTime = usdUpdatedAt
    ? usdUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/50 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-3 flex items-start justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary transition-colors duration-300 group-hover:bg-primary/10">
                    <Icon className="h-4 w-4 text-muted-foreground transition-colors duration-300 group-hover:text-primary" />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">{kpi.value}</span>

                </div>
                <p className="mt-2 text-xs text-muted-foreground">{kpi.description}</p>
              </div>
            </div>
          )
        })}

        {/* USD Rate Card */}
        <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/50">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-info/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <div className="relative">
            <div className="mb-3 flex items-start justify-between">
              <span className="text-sm font-medium text-muted-foreground">Cotação USD</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-lg leading-none">🇺🇸</div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
                {usdIsEstimate && !usdTime ? 'Carregando...' : `R$ ${usdFormatted}`}
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {usdIsEstimate ? (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 px-1.5 py-0 text-xs text-warning">Estimado</Badge>
              ) : usdTime ? (
                <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Atualizado às {usdTime}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Recebimentos por mês (últimos 6 com registro)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mrrChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatAxisCurrency} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="mrr" name="Recebido" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-info" />
              Contratado sem permuta vs despesas do mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatAxisCurrency} />
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
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-success inline-block" /> Contratado</span>
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
