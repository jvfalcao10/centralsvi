import { useEffect, useState, useCallback } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Percent, Plus, CheckCircle, Send, AlertCircle, Clock, Calendar, CalendarCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Invoice, Expense, formatCurrency, formatDate } from '@/types'
import { useUsdRate, mrrBRL } from '@/hooks/useUsdRate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

type InvoiceWithClient = Invoice & { clients?: { name: string } }

type ActiveClient = {
  id: string
  name: string
  company: string
  mrr: number
  currency: string
  status: string
  dia_vencimento: number | null
  instagram: string | null
}

const CASH_PROJECTION = [
  { day: 'Hoje', saldo: 45000 }, { day: '+15d', saldo: 52000 },
  { day: '+30d', saldo: 38000 }, { day: '+45d', saldo: 61000 },
  { day: '+60d', saldo: 55000 }, { day: '+90d', saldo: 72000 },
]

const MONTHLY_DRE = [
  { month: 'Mar', receita: 26800, despesas: 14200, lucro: 12600 },
  { month: 'Abr', receita: 27500, despesas: 14800, lucro: 12700 },
  { month: 'Mai', receita: 27200, despesas: 15100, lucro: 12100 },
  { month: 'Jun', receita: 28700, despesas: 15896, lucro: 12804 },
]

const invoiceStatusClass: Record<string, string> = {
  pendente: 'bg-warning/20 text-warning border-warning/30',
  pago: 'bg-success/20 text-success border-success/30',
  atrasado: 'bg-danger/20 text-danger border-danger/30',
}

const expenseStatusClass: Record<string, string> = {
  pendente: 'bg-warning/20 text-warning border-warning/30',
  pago: 'bg-success/20 text-success border-success/30',
}

const expenseCatClass: Record<string, string> = {
  pessoal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ferramentas: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  infraestrutura: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  marketing: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  operacional: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

function getDueDate(dia: number): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), dia)
}

export default function Financial() {
  const { toast } = useToast()
  const usdRate = useUsdRate()
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [activeClientsMrr, setActiveClientsMrr] = useState<number | null>(null)
  const [activeClients, setActiveClients] = useState<ActiveClient[]>([])
  const [loading, setLoading] = useState(true)
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all')
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all')
  const [expenseCatFilter, setExpenseCatFilter] = useState('all')
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({ categoria: 'operacional', descricao: '', valor: '', vencimento: '' })
  const [registeringPayment, setRegisteringPayment] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [{ data: inv }, { data: exp }, { data: clientsData }] = await Promise.all([
      supabase.from('invoices').select('*, clients(name)').order('vencimento'),
      supabase.from('expenses').select('*').order('vencimento'),
      supabase.from('clients').select('id, name, company, mrr, currency, status, dia_vencimento, instagram'),
    ])
    setInvoices(inv || [])
    setExpenses(exp || [])
    if (clientsData) {
      const active = clientsData.filter(c => c.status === 'ativo')
      setActiveClients(active as ActiveClient[])
      setActiveClientsMrr(active.reduce((s, c) => s + c.mrr, 0))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const markInvoicePaid = async (id: string) => {
    await supabase.from('invoices').update({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] }).eq('id', id)
    toast({ title: 'Fatura marcada como paga!' })
    fetchData()
  }

  const markExpensePaid = async (id: string) => {
    await supabase.from('expenses').update({ status: 'pago' }).eq('id', id)
    toast({ title: 'Despesa marcada como paga!' })
    fetchData()
  }

  const addExpense = async () => {
    if (!newExpense.descricao || !newExpense.valor || !newExpense.vencimento) return
    await supabase.from('expenses').insert({
      ...newExpense,
      valor: parseFloat(newExpense.valor),
      status: 'pendente'
    })
    toast({ title: 'Despesa adicionada!' })
    setShowNewExpense(false)
    setNewExpense({ categoria: 'operacional', descricao: '', valor: '', vencimento: '' })
    fetchData()
  }

  const registerPayment = async (client: ActiveClient) => {
    if (!client.dia_vencimento) return
    setRegisteringPayment(client.id)
    const today = new Date().toISOString().split('T')[0]
    const dueDate = getDueDate(client.dia_vencimento).toISOString().split('T')[0]
    await supabase.from('invoices').insert({
      client_id: client.id,
      valor: mrrBRL(client.mrr, client.currency, usdRate),
      status: 'pago',
      vencimento: dueDate,
      data_pagamento: today,
    })
    toast({ title: `Pagamento de ${client.name} registrado!` })
    setRegisteringPayment(null)
    fetchData()
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const in7DaysStr = in7Days.toISOString().split('T')[0]

  // Use USD-converted MRR sum for financial calculations
  const mrr = activeClients.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)
  const totalReceivable = invoices.filter(i => i.status !== 'pago').reduce((s, i) => s + i.valor, 0)
  const overdueInvoices = invoices.filter(i => i.status === 'atrasado' || (i.status === 'pendente' && i.vencimento < todayStr))
  const dueSoonInvoices = invoices.filter(i => i.status === 'pendente' && i.vencimento >= todayStr && i.vencimento <= in7DaysStr)

  const paidInvoicesTotal = invoices.filter(i => i.status === 'pago').reduce((s, i) => s + i.valor, 0)
  const totalRevenue = paidInvoicesTotal + mrr
  const totalExpensesVal = expenses.reduce((s, e) => s + e.valor, 0)
  const netProfit = totalRevenue - totalExpensesVal
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : '0.0'

  const filteredInvoices = invoices.filter(i => invoiceStatusFilter === 'all' || i.status === invoiceStatusFilter)
  const filteredExpenses = expenses.filter(e => {
    if (expenseStatusFilter !== 'all' && e.status !== expenseStatusFilter) return false
    if (expenseCatFilter !== 'all' && e.categoria !== expenseCatFilter) return false
    return true
  })

  const costosDirectos = expenses.filter(e => e.categoria === 'pessoal').reduce((s, e) => s + e.valor, 0)
  const fixedExpenses = expenses.filter(e => e.categoria !== 'pessoal').reduce((s, e) => s + e.valor, 0)
  const grossMargin = mrr - costosDirectos
  const netProfitDRE = grossMargin - fixedExpenses

  // --- Billing module grouping ---
  const todayDay = today.getDate()
  const clientsWithDue = activeClients.filter(c => c.dia_vencimento !== null)
  const clientsNoDue = activeClients.filter(c => c.dia_vencimento === null)

  const clientsToday = clientsWithDue.filter(c => c.dia_vencimento === todayDay)
  const clientsThisWeek = clientsWithDue.filter(c => {
    if (!c.dia_vencimento) return false
    const d = getDueDate(c.dia_vencimento)
    const dStr = d.toISOString().split('T')[0]
    return dStr > todayStr && dStr <= in7DaysStr
  })
  const clientsThisMonth = clientsWithDue.filter(c => {
    if (!c.dia_vencimento) return false
    const d = getDueDate(c.dia_vencimento)
    const dStr = d.toISOString().split('T')[0]
    return dStr > in7DaysStr
  })
  const clientsOverdue = clientsWithDue.filter(c => {
    if (!c.dia_vencimento) return false
    const d = getDueDate(c.dia_vencimento)
    const dStr = d.toISOString().split('T')[0]
    return dStr < todayStr
  })

  const billingKpis = [
    { label: 'Vence hoje', value: clientsToday.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0), count: clientsToday.length, color: 'text-danger' },
    { label: 'Esta semana', value: clientsThisWeek.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0), count: clientsThisWeek.length, color: 'text-warning' },
    { label: 'Este mês', value: clientsThisMonth.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0), count: clientsThisMonth.length, color: 'text-primary' },
    { label: 'Já vencidos', value: clientsOverdue.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0), count: clientsOverdue.length, color: 'text-muted-foreground' },
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-lg">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((entry: any) => (
            <p key={entry.name} style={{ color: entry.color }}>{entry.name}: {formatCurrency(entry.value)}</p>
          ))}
        </div>
      )
    }
    return null
  }

  const ClientBillingRow = ({ client, highlight }: { client: ActiveClient; highlight: 'danger' | 'warning' | 'primary' | 'muted' }) => {
    const colorMap = {
      danger: 'text-danger',
      warning: 'text-warning',
      primary: 'text-primary',
      muted: 'text-muted-foreground',
    }
    const dueDate = client.dia_vencimento ? getDueDate(client.dia_vencimento) : null
    const dueDateStr = dueDate ? dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

    // Check if payment already registered this month
    const alreadyPaid = invoices.some(inv =>
      inv.client_id === client.id &&
      inv.status === 'pago' &&
      inv.vencimento.startsWith(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
    )

    return (
      <TableRow className="border-border hover:bg-muted/20">
        <TableCell className="text-sm font-medium">{client.name}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{client.company || '—'}</TableCell>
        <TableCell className="text-sm font-bold text-success">{formatCurrency(client.mrr)}</TableCell>
        <TableCell>
          <span className={`text-sm font-medium ${colorMap[highlight]}`}>Dia {client.dia_vencimento} · {dueDateStr}</span>
        </TableCell>
        <TableCell className="text-right">
          {alreadyPaid ? (
            <Badge variant="outline" className="text-xs bg-success/20 text-success border-success/30">
              <CheckCircle className="h-3 w-3 mr-1" /> Pago
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-success hover:text-success"
              disabled={registeringPayment === client.id}
              onClick={() => registerPayment(client)}
            >
              <CheckCircle className="h-3 w-3" /> Registrar pag.
            </Button>
          )}
        </TableCell>
      </TableRow>
    )
  }

  const BillingSection = ({
    title,
    clients,
    icon: Icon,
    highlight,
    borderColor,
  }: {
    title: string
    clients: ActiveClient[]
    icon: any
    highlight: 'danger' | 'warning' | 'primary' | 'muted'
    borderColor: string
  }) => {
    if (clients.length === 0) return null
    return (
      <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
        <div className="px-4 py-2.5 flex items-center gap-2 bg-muted/30 border-b border-border">
          <Icon className={`h-4 w-4 ${highlight === 'danger' ? 'text-danger' : highlight === 'warning' ? 'text-warning' : highlight === 'primary' ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="outline" className="ml-auto text-xs">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Cliente</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map(c => (
              <ClientBillingRow key={c.id} client={c} highlight={highlight} />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <Tabs defaultValue="overview">
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
          <TabsTrigger value="receivable">Contas a Receber</TabsTrigger>
          <TabsTrigger value="payable">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { label: 'MRR (Clientes Ativos)', value: formatCurrency(mrr), icon: DollarSign, color: 'text-primary' },
              { label: 'Receita Mês', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-success' },
              { label: 'Despesas Mês', value: formatCurrency(totalExpensesVal), icon: TrendingDown, color: 'text-danger' },
              { label: 'Lucro Líquido', value: formatCurrency(netProfit), icon: DollarSign, color: netProfit > 0 ? 'text-success' : 'text-danger' },
              { label: 'Margem', value: `${margin}%`, icon: Percent, color: 'text-info' },
            ].map(kpi => {
              const Icon = kpi.icon
              return (
                <Card key={kpi.label} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${kpi.color}`} />
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </div>
                    <p className="text-lg font-bold">{kpi.value}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Projeção de Caixa (90 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={CASH_PROJECTION}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COBRANÇA */}
        <TabsContent value="cobranca" className="space-y-4 mt-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {billingKpis.map(kpi => (
              <Card key={kpi.label} className="border-border bg-card">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>{formatCurrency(kpi.value)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.count} cliente{kpi.count !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sections */}
          <BillingSection
            title="Vence Hoje"
            clients={clientsToday}
            icon={AlertCircle}
            highlight="danger"
            borderColor="border-danger/30"
          />
          <BillingSection
            title="Vence Esta Semana (próximos 7 dias)"
            clients={clientsThisWeek}
            icon={Clock}
            highlight="warning"
            borderColor="border-warning/30"
          />
          <BillingSection
            title="Vence Este Mês"
            clients={clientsThisMonth}
            icon={Calendar}
            highlight="primary"
            borderColor="border-border"
          />
          <BillingSection
            title="Já Vencidos Este Mês"
            clients={clientsOverdue}
            icon={CalendarCheck}
            highlight="muted"
            borderColor="border-border"
          />

          {clientsWithDue.length === 0 && clientsNoDue.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum cliente ativo encontrado.
            </div>
          )}

          {/* Clients without due date */}
          {clientsNoDue.length > 0 && (
            <Card className="border-border bg-muted/20">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{clientsNoDue.length} cliente{clientsNoDue.length !== 1 ? 's' : ''}</span> sem dia de vencimento cadastrado:{' '}
                  {clientsNoDue.map(c => c.name).join(', ')}.{' '}
                  <a href="/clients" className="text-primary underline underline-offset-2 hover:opacity-80">
                    Cadastrar agora →
                  </a>
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* RECEIVABLE */}
        <TabsContent value="receivable" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total a Receber</p>
              <p className="text-lg font-bold text-success">{formatCurrency(totalReceivable)}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Vencidas</p>
              <p className="text-lg font-bold text-danger">{formatCurrency(overdueInvoices.reduce((s, i) => s + i.valor, 0))}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Vencendo em 7 dias</p>
              <p className="text-lg font-bold text-warning">{formatCurrency(dueSoonInvoices.reduce((s, i) => s + i.valor, 0))}</p>
            </CardContent></Card>
          </div>

          <div className="flex gap-3">
            <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(inv => (
                  <TableRow key={inv.id} className="border-border hover:bg-muted/20">
                    <TableCell className="text-sm font-medium">{inv.clients?.name || '—'}</TableCell>
                    <TableCell className="font-bold text-success text-sm">{formatCurrency(inv.valor)}</TableCell>
                    <TableCell className={`text-sm ${inv.status === 'atrasado' ? 'text-danger font-medium' : 'text-muted-foreground'}`}>{formatDate(inv.vencimento)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${invoiceStatusClass[inv.status]}`}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {inv.status !== 'pago' && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Send className="h-3 w-3" />Cobrar</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-success hover:text-success" onClick={() => markInvoicePaid(inv.id)}><CheckCircle className="h-3 w-3" />Pago</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PAYABLE */}
        <TabsContent value="payable" className="space-y-4 mt-4">
          <div className="flex gap-3 items-center">
            <Select value={expenseCatFilter} onValueChange={setExpenseCatFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                <SelectItem value="pessoal">Pessoal</SelectItem>
                <SelectItem value="ferramentas">Ferramentas</SelectItem>
                <SelectItem value="infraestrutura">Infraestrutura</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="operacional">Operacional</SelectItem>
              </SelectContent>
            </Select>
            <Select value={expenseStatusFilter} onValueChange={setExpenseStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button size="sm" className="gap-2" onClick={() => setShowNewExpense(true)}>
              <Plus className="h-4 w-4" /> Nova Despesa
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map(exp => (
                  <TableRow key={exp.id} className="border-border hover:bg-muted/20">
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${expenseCatClass[exp.categoria] || ''}`}>{exp.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{exp.descricao}</TableCell>
                    <TableCell className="font-bold text-danger text-sm">{formatCurrency(exp.valor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(exp.vencimento)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${expenseStatusClass[exp.status]}`}>{exp.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {exp.status !== 'pago' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-success hover:text-success" onClick={() => markExpensePaid(exp.id)}>
                          <CheckCircle className="h-3 w-3" /> Pago
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* DRE */}
        <TabsContent value="dre" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="text-sm">DRE — {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Receita Total (MRR)', value: mrr, bold: false, type: 'income' },
                    { label: '(-) Custos Diretos (Pessoal)', value: -costosDirectos, bold: false, type: 'expense' },
                    { label: '(=) Margem Bruta', value: grossMargin, bold: true, type: grossMargin > 0 ? 'income' : 'expense' },
                    { label: '(-) Despesas Fixas', value: -fixedExpenses, bold: false, type: 'expense' },
                    { label: '(=) Lucro Líquido', value: netProfitDRE, bold: true, type: netProfitDRE > 0 ? 'income' : 'expense' },
                  ].map((row, i) => (
                    <div key={i}>
                      {(i === 2 || i === 4) && <div className="border-t border-border my-2" />}
                      <div className={`flex justify-between items-center py-1 ${row.bold ? 'font-bold' : ''}`}>
                        <span className={row.bold ? 'text-foreground' : 'text-muted-foreground'}>{row.label}</span>
                        <span className={row.type === 'income' ? 'text-success' : 'text-danger'}>
                          {formatCurrency(Math.abs(row.value))}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between font-bold">
                      <span>Margem %</span>
                      <span className={netProfitDRE / mrr > 0 ? 'text-success' : 'text-danger'}>
                        {mrr > 0 ? (netProfitDRE / mrr * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="text-sm">Comparativo Mensal</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs">Mês</TableHead>
                      <TableHead className="text-xs">Receita</TableHead>
                      <TableHead className="text-xs">Despesas</TableHead>
                      <TableHead className="text-xs">Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTHLY_DRE.map(row => (
                      <TableRow key={row.month} className="border-border">
                        <TableCell className="text-sm font-medium">{row.month}</TableCell>
                        <TableCell className="text-success text-sm">{formatCurrency(row.receita)}</TableCell>
                        <TableCell className="text-danger text-sm">{formatCurrency(row.despesas)}</TableCell>
                        <TableCell className="text-sm font-bold text-success">{formatCurrency(row.lucro)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Expense Dialog */}
      <Dialog open={showNewExpense} onOpenChange={setShowNewExpense}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={newExpense.categoria} onValueChange={v => setNewExpense(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                  <SelectItem value="ferramentas">Ferramentas</SelectItem>
                  <SelectItem value="infraestrutura">Infraestrutura</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={newExpense.descricao} onChange={e => setNewExpense(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Assinatura Adobe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" value={newExpense.valor} onChange={e => setNewExpense(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input type="date" value={newExpense.vencimento} onChange={e => setNewExpense(p => ({ ...p, vencimento: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewExpense(false)}>Cancelar</Button>
            <Button onClick={addExpense}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
