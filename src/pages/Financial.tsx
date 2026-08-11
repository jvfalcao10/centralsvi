import { useEffect, useState, useCallback, useMemo } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Percent, Plus, CheckCircle, Send, AlertCircle, Clock, Calendar, CalendarCheck, Pencil, Trash2, Undo2, ExternalLink, Repeat, Layers, Handshake } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Invoice, Expense, formatCurrency, formatDate, emPermutaNoMes } from '@/types'
import { monthKeyOf, monthKeyOfDate, monthLabel, buildMonthOptions, addMonths, getDueDate, firstBillingMonth, lastDayOfMonth } from '@/lib/months'
import { useUsdRate, mrrBRL } from '@/hooks/useUsdRate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RotateCw } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

type InvoiceWithClient = Invoice & { clients?: { name: string } }

type CobrancaManual = {
  id: string
  cliente_nome: string
  descricao: string
  metodo: string
  recorrencia: string
  dia_mes: number | null
  valor: number | null
  contato: string | null
  observacoes: string | null
  status: string
  proximo_vencimento: string | null
  clickup_task_id: string | null
  ativo: boolean
}

type ActiveClient = {
  id: string
  name: string
  company: string
  mrr: number
  currency: string
  status: string
  dia_vencimento: number | null
  instagram: string | null
  inicio_contrato: string | null
  permuta: boolean
  permuta_ate: string | null
  cobranca_inicio: string | null
}


function CustomTooltip({ active, payload, label }: any) {
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

const HIGHLIGHT_COLOR_MAP: Record<'danger' | 'warning' | 'primary' | 'muted', string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  primary: 'text-primary',
  muted: 'text-muted-foreground',
}

interface BillingRowDeps {
  invoices: InvoiceWithClient[]
  monthKey: string
  usdRate: number
  getDueDate: (dia: number, monthKey?: string) => Date
  registeringPayment: string | null
  registerPayment: (c: ActiveClient, monthKey: string) => void
}

interface ClientBillingRowProps extends BillingRowDeps {
  client: ActiveClient
  highlight: 'danger' | 'warning' | 'primary' | 'muted'
}

function ClientBillingRow({
  client, highlight, invoices, monthKey, usdRate, getDueDate, registeringPayment, registerPayment,
}: ClientBillingRowProps) {
  const dueDate = client.dia_vencimento ? getDueDate(client.dia_vencimento, monthKey) : null
  const dueDateStr = dueDate ? dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

  const alreadyPaid = invoices.some(inv =>
    inv.client_id === client.id &&
    inv.status === 'pago' &&
    inv.vencimento.startsWith(monthKey)
  )

  return (
    <TableRow className="border-border hover:bg-muted/20">
      <TableCell className="text-sm font-medium">{client.name}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{client.company || '—'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 flex-wrap">
          {emPermutaNoMes(client, monthKey) && client.mrr === 0 ? (
            // Permuta sem valor definido. Mostrar "R$ 0,00" faria parecer que a
            // troca não vale nada; o certo é dizer que ninguém precificou ainda.
            <span className="text-sm text-muted-foreground italic">valor a definir</span>
          ) : (
            <span className="text-sm font-bold text-success">{formatCurrency(mrrBRL(client.mrr, client.currency, usdRate))}</span>
          )}
          {client.currency === 'USD' && (
            <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/30">🇺🇸 USD</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className={`text-sm font-medium ${HIGHLIGHT_COLOR_MAP[highlight]}`}>Dia {client.dia_vencimento} · {dueDateStr}</span>
      </TableCell>
      <TableCell className="text-right">
        {emPermutaNoMes(client, monthKey) ? (
          <Badge variant="outline" className="text-xs gap-1 bg-info/10 text-info border-info/30">
            <Handshake className="h-3 w-3" />
            {client.permuta_ate
              ? `Permuta até ${client.permuta_ate.slice(0, 10).split('-').reverse().join('/')}`
              : 'Permuta'}
          </Badge>
        ) : alreadyPaid ? (
          <Badge variant="outline" className="text-xs bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" /> Pago
          </Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-success hover:text-success"
            disabled={registeringPayment === client.id}
            onClick={() => registerPayment(client, monthKey)}
          >
            <CheckCircle className="h-3 w-3" /> Registrar pag.
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

interface BillingSectionProps extends BillingRowDeps {
  title: string
  clients: ActiveClient[]
  icon: any
  highlight: 'danger' | 'warning' | 'primary' | 'muted'
  borderColor: string
}

function BillingSection({
  title, clients, icon: Icon, highlight, borderColor, ...deps
}: BillingSectionProps) {
  if (clients.length === 0) return null
  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      <div className="px-4 py-2.5 flex items-center gap-2 bg-muted/30 border-b border-border">
        <Icon className={`h-4 w-4 ${HIGHLIGHT_COLOR_MAP[highlight]}`} />
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
            <ClientBillingRow key={c.id} client={c} highlight={highlight} {...deps} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}


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


export default function Financial() {
  const { toast } = useToast()
  const usdRate = useUsdRate()
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [cobrancasManuais, setCobrancasManuais] = useState<CobrancaManual[]>([])
  const [activeClientsMrr, setActiveClientsMrr] = useState<number | null>(null)
  const [activeClients, setActiveClients] = useState<ActiveClient[]>([])
  const [loading, setLoading] = useState(true)
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all')
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all')
  const [expenseCatFilter, setExpenseCatFilter] = useState('all')
  // Filtros de mês: começam no mês corrente, com opção "Todos os meses".
  const [invoiceMonthFilter, setInvoiceMonthFilter] = useState(() => monthKeyOfDate(new Date()))
  const [expenseMonthFilter, setExpenseMonthFilter] = useState(() => monthKeyOfDate(new Date()))
  const [cobrancaMonth, setCobrancaMonth] = useState(() => monthKeyOfDate(new Date()))
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({ categoria: 'operacional', descricao: '', valor: '', vencimento: '', recorrente: false, parcelado: false, parcelas: '2' })
  const [registeringPayment, setRegisteringPayment] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editForm, setEditForm] = useState({ categoria: 'operacional', descricao: '', valor: '', vencimento: '', status: 'pendente', recorrente: false })
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)

  const fetchData = useCallback(async () => {
    const [{ data: inv }, { data: exp }, { data: clientsData }, { data: cobrancasData }] = await Promise.all([
      supabase.from('invoices').select('*, clients(name)').order('vencimento'),
      supabase.from('expenses').select('*').order('vencimento'),
      supabase.from('clients').select('id, name, company, mrr, currency, status, dia_vencimento, instagram, inicio_contrato, permuta, permuta_ate, cobranca_inicio'),
      supabase.from('cobrancas_manuais').select('*').eq('ativo', true).order('proximo_vencimento', { ascending: true, nullsFirst: false }),
    ])
    setInvoices(inv || [])
    setExpenses(exp || [])
    setCobrancasManuais((cobrancasData as CobrancaManual[]) || [])
    if (clientsData) {
      const active = clientsData.filter(c => c.status === 'ativo')
      setActiveClients(active as ActiveClient[])
      setActiveClientsMrr(active.reduce((s, c) => s + c.mrr, 0))
    }
    setLoading(false)
  }, [])

  const markCobrancaPaga = async (c: CobrancaManual) => {
    if (c.recorrencia === 'avulso') {
      // Avulso: marca como inativo (some da lista)
      await supabase.from('cobrancas_manuais').update({ ativo: false, status: 'pago' }).eq('id', c.id)
    } else {
      // Recorrente: avança o proximo_vencimento pro próximo ciclo
      let next: Date | null = null
      if (c.recorrencia === 'mensal' && c.dia_mes) {
        const d = new Date(c.proximo_vencimento || new Date())
        d.setMonth(d.getMonth() + 1)
        next = d
      } else if (c.recorrencia === 'semanal') {
        const d = new Date(c.proximo_vencimento || new Date())
        d.setDate(d.getDate() + 7)
        next = d
      }
      await supabase.from('cobrancas_manuais').update({
        proximo_vencimento: next ? next.toISOString().split('T')[0] : c.proximo_vencimento,
        status: 'ativo',
      }).eq('id', c.id)
    }
    toast({ title: `${c.cliente_nome} marcada como recebida` })
    fetchData()
  }

  const deleteCobranca = async (c: CobrancaManual) => {
    if (!window.confirm(`Apagar a cobrança de ${c.cliente_nome}? Esta ação não pode ser desfeita.`)) return
    await supabase.from('cobrancas_manuais').delete().eq('id', c.id)
    toast({ title: `${c.cliente_nome} removida das cobranças` })
    fetchData()
  }

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

  const markExpensePending = async (id: string) => {
    await supabase.from('expenses').update({ status: 'pendente' }).eq('id', id)
    toast({ title: 'Despesa marcada como pendente' })
    fetchData()
  }

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp)
    setEditForm({
      categoria: exp.categoria,
      descricao: exp.descricao,
      valor: String(exp.valor),
      vencimento: exp.vencimento,
      status: exp.status,
      recorrente: exp.recorrente,
    })
  }

  const saveEdit = async () => {
    if (!editingExpense) return
    await supabase.from('expenses').update({
      categoria: editForm.categoria,
      descricao: editForm.descricao,
      valor: parseFloat(editForm.valor),
      vencimento: editForm.vencimento,
      status: editForm.status,
      recorrente: editForm.recorrente,
    }).eq('id', editingExpense.id)
    toast({ title: 'Despesa atualizada' })
    setEditingExpense(null)
    fetchData()
  }

  const deleteExpense = async () => {
    if (!deleteTarget) return
    await supabase.from('expenses').delete().eq('id', deleteTarget.id)
    toast({ title: 'Despesa removida' })
    setDeleteTarget(null)
    fetchData()
  }

  const resetNewExpense = () =>
    setNewExpense({ categoria: 'operacional', descricao: '', valor: '', vencimento: '', recorrente: false, parcelado: false, parcelas: '2' })

  const addExpense = async () => {
    if (!newExpense.descricao || !newExpense.valor || !newExpense.vencimento) return
    const valor = parseFloat(newExpense.valor)
    const qtd = newExpense.parcelado
      ? Math.max(2, Math.min(120, parseInt(newExpense.parcelas, 10) || 2))
      : 1

    if (qtd > 1) {
      // Parcelada: cria as N linhas de uma vez, uma por mês. Nunca recorrente.
      const rows = Array.from({ length: qtd }, (_, i) => ({
        categoria: newExpense.categoria,
        descricao: newExpense.descricao,
        valor,
        vencimento: addMonths(newExpense.vencimento, i),
        status: 'pendente',
        recorrente: false,
        parcela_atual: i + 1,
        parcelas_total: qtd,
      }))
      const { error } = await supabase.from('expenses').insert(rows)
      if (error) {
        toast({ title: 'Erro ao criar as parcelas', description: error.message, variant: 'destructive' })
        return
      }
      toast({
        title: `${qtd} parcelas criadas`,
        description: `${formatCurrency(valor)} por mês, de ${formatDate(rows[0].vencimento)} até ${formatDate(rows[qtd - 1].vencimento)}.`,
      })
    } else {
      const { error } = await supabase.from('expenses').insert({
        categoria: newExpense.categoria,
        descricao: newExpense.descricao,
        valor,
        vencimento: newExpense.vencimento,
        status: 'pendente',
        recorrente: newExpense.recorrente,
      })
      if (error) {
        toast({ title: 'Erro ao adicionar despesa', description: error.message, variant: 'destructive' })
        return
      }
      toast({ title: 'Despesa adicionada!' })
    }

    setShowNewExpense(false)
    resetNewExpense()
    fetchData()
  }

  const registerPayment = async (client: ActiveClient, monthKey: string) => {
    if (!client.dia_vencimento) return
    setRegisteringPayment(client.id)
    const today = new Date().toISOString().split('T')[0]
    const dueDate = getDueDate(client.dia_vencimento, monthKey).toISOString().split('T')[0]

    // Desde a geracao automatica (todo dia 1), a fatura do mes ja existe como
    // `pendente`. Registrar pagamento e dar BAIXA nela, nao criar outra, senao o
    // mes fica com duas linhas e o total a receber conta dobrado.
    const { data: emAberto } = await supabase
      .from('invoices')
      .select('id')
      .eq('client_id', client.id)
      .neq('status', 'pago')
      .gte('vencimento', `${monthKey}-01`)
      .lte('vencimento', lastDayOfMonth(monthKey))
      .limit(1)

    if (emAberto && emAberto.length > 0) {
      await supabase.from('invoices')
        .update({ status: 'pago', data_pagamento: today })
        .eq('id', emAberto[0].id)
    } else {
      await supabase.from('invoices').insert({
        client_id: client.id,
        valor: mrrBRL(client.mrr, client.currency, usdRate),
        status: 'pago',
        vencimento: dueDate,
        data_pagamento: today,
      })
    }
    toast({ title: `Pagamento de ${client.name} registrado em ${monthLabel(monthKey)}!` })
    setRegisteringPayment(null)
    fetchData()
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const in7DaysStr = in7Days.toISOString().split('T')[0]

  const currentMonth = monthKeyOfDate(today)

  // Use USD-converted MRR sum for financial calculations
  const mrr = activeClients.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)

  // Permuta não vira dinheiro. Fica no MRR contratado (é contrato ativo), mas sai
  // da Receita do mês, senão o lucro e a margem contam caixa que nunca entrou.
  const clientesEmPermuta = activeClients.filter(c => emPermutaNoMes(c, currentMonth))
  const mrrEmPermuta = clientesEmPermuta.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)
  const totalReceivable = invoices.filter(i => i.status !== 'pago').reduce((s, i) => s + i.valor, 0)
  const overdueInvoices = invoices.filter(i => i.status === 'atrasado' || (i.status === 'pendente' && i.vencimento < todayStr))
  const dueSoonInvoices = invoices.filter(i => i.status === 'pendente' && i.vencimento >= todayStr && i.vencimento <= in7DaysStr)

  // Receita Mês = MRR recorrente do mês (base do P&L). NÃO somar faturas pagas: cada fatura JÁ é a mensalidade realizada do cliente — somar MRR + faturas conta a recorrência 2x, e as faturas incluem meses anteriores.
  const totalRevenue = mrr - mrrEmPermuta
  const totalExpensesVal = expenses.reduce((s, e) => s + e.valor, 0)
  const netProfit = totalRevenue - totalExpensesVal
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : '0.0'

  const expenseMonthOptions = buildMonthOptions(expenses.map(e => e.vencimento), currentMonth)
  const invoiceMonthOptions = buildMonthOptions(invoices.map(i => i.vencimento), currentMonth)

  const filteredInvoices = invoices.filter(i => {
    if (invoiceStatusFilter !== 'all' && i.status !== invoiceStatusFilter) return false
    if (invoiceMonthFilter !== 'all' && monthKeyOf(i.vencimento) !== invoiceMonthFilter) return false
    return true
  })
  const filteredExpenses = expenses.filter(e => {
    if (expenseStatusFilter !== 'all' && e.status !== expenseStatusFilter) return false
    if (expenseCatFilter !== 'all' && e.categoria !== expenseCatFilter) return false
    if (expenseMonthFilter !== 'all' && monthKeyOf(e.vencimento) !== expenseMonthFilter) return false
    return true
  })

  // Totais do mês escolhido no contas a pagar. Ignora o filtro de status de propósito:
  // ela precisa ver o total do mês, o que já saiu e o que ainda falta sair.
  const monthExpenses = expenses.filter(e => {
    if (expenseCatFilter !== 'all' && e.categoria !== expenseCatFilter) return false
    if (expenseMonthFilter !== 'all' && monthKeyOf(e.vencimento) !== expenseMonthFilter) return false
    return true
  })
  const monthExpensesTotal = monthExpenses.reduce((s, e) => s + e.valor, 0)
  const monthExpensesPaid = monthExpenses.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
  const monthExpensesOpen = monthExpensesTotal - monthExpensesPaid

  // ---- DRE real, mês a mês ----
  // Antes isto era um array fixo no código com números inventados. Com dado real
  // no banco, número inventado é pior que número nenhum: a pessoa acredita.
  const dreMensal = useMemo(() => {
    const meses = new Set<string>()
    invoices.forEach(i => meses.add(monthKeyOf(i.vencimento)))
    expenses.forEach(e => meses.add(monthKeyOf(e.vencimento)))
    return Array.from(meses).sort().slice(-8).map(m => {
      const receita = invoices.filter(i => monthKeyOf(i.vencimento) === m).reduce((s, i) => s + i.valor, 0)
      const custo = expenses.filter(e => monthKeyOf(e.vencimento) === m).reduce((s, e) => s + e.valor, 0)
      const temFolha = expenses.some(e => monthKeyOf(e.vencimento) === m && e.categoria === 'pessoal')
      return {
        mes: m,
        label: monthLabel(m).split('/')[0].slice(0, 3),
        receita, custo,
        lucro: receita - custo,
        margem: receita > 0 ? ((receita - custo) / receita) * 100 : 0,
        // Sem folha lançada o lucro do mês é ficção. Melhor avisar que esconder.
        incompleto: !temFolha,
      }
    })
  }, [invoices, expenses])

  // ---- Projeção: o que já está comprometido daqui pra frente ----
  // Receita = MRR contratado menos permuta (é o que entra se ninguém sair).
  // Custo = despesa já lançada no mês, incluindo parcela de cartão que continua correndo.
  const projecao = useMemo(() => {
    const base = mrr - mrrEmPermuta
    return Array.from({ length: 6 }, (_, k) => {
      const m = monthKeyOf(addMonths(`${currentMonth}-01`, k))
      const custo = expenses.filter(e => monthKeyOf(e.vencimento) === m).reduce((s, e) => s + e.valor, 0)
      return { mes: monthLabel(m).split('/')[0].slice(0, 3), receita: base, custo, saldo: base - custo }
    })
  }, [expenses, mrr, mrrEmPermuta, currentMonth])

  // Total do mês escolhido no contas a receber.
  const monthInvoicesTotal = filteredInvoices.reduce((s, i) => s + i.valor, 0)

  // Clientes fora da geração automática de fatura: a conversão de moeda depende
  // da cotação do dia, que só o app tem. Esses continuam sendo registrados a mão.
  const clientesForaDaGeracao = activeClients.filter(c => c.currency !== 'BRL' && c.dia_vencimento !== null)

  const costosDirectos = expenses.filter(e => e.categoria === 'pessoal').reduce((s, e) => s + e.valor, 0)
  const fixedExpenses = expenses.filter(e => e.categoria !== 'pessoal').reduce((s, e) => s + e.valor, 0)
  const grossMargin = mrr - costosDirectos
  const netProfitDRE = grossMargin - fixedExpenses

  // --- Billing module grouping ---
  // Quem está em permuta não é cobrado, então sai das seções por vencimento e
  // aparece na própria seção. Sem isso ele viraria "vence hoje" e depois "vencido".
  const todayDay = today.getDate()
  const clientsWithDue = activeClients.filter(c => c.dia_vencimento !== null && !emPermutaNoMes(c, currentMonth))
  const clientsNoDue = activeClients.filter(c => c.dia_vencimento === null && !emPermutaNoMes(c, currentMonth))

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

  // --- Cobrança por mês ---
  // O mês corrente mantém a visão por vencimento (hoje / semana / mês / vencidos).
  // Mês passado vira a pergunta que importa: quem pagou e quem não pagou.
  const isCurrentMonth = cobrancaMonth === currentMonth

  const cobrancaMonthOptions = buildMonthOptions(
    [
      ...invoices.map(i => i.vencimento),
      ...Array.from({ length: 12 }, (_, i) => monthKeyOfDate(new Date(today.getFullYear(), today.getMonth() - i, 1))),
    ],
    currentMonth,
  )

  // Cliente só entra na conta de um mês se a primeira mensalidade dele já tinha caído.
  // Sem isso, quem fechou em agosto apareceria como "não pagou" em julho, e quem
  // fechou no próprio dia do vencimento apareceria devendo o mês em que entrou.
  // Permuta no mês consultado sai da conta de cobrança e vai pra lista própria.
  // Isso é por MÊS: a Carlotinha é permuta em agosto e cobrável em setembro.
  const clientesPermutaNoMes = activeClients.filter(c =>
    c.dia_vencimento !== null && emPermutaNoMes(c, cobrancaMonth)
  )
  const clientsInMonth = activeClients.filter(c =>
    c.dia_vencimento !== null &&
    !emPermutaNoMes(c, cobrancaMonth) &&
    // Data explicita de inicio de cobranca manda sobre a regra deduzida.
    (c.cobranca_inicio
      ? monthKeyOf(c.cobranca_inicio) <= cobrancaMonth
      : (!c.inicio_contrato || firstBillingMonth(c.inicio_contrato, c.dia_vencimento) <= cobrancaMonth))
  )
  const hasPaidInMonth = (clientId: string) => invoices.some(inv =>
    inv.client_id === clientId && inv.status === 'pago' && inv.vencimento.startsWith(cobrancaMonth)
  )
  const monthClientsPaid = clientsInMonth.filter(c => hasPaidInMonth(c.id))
  const monthClientsUnpaid = clientsInMonth.filter(c => !hasPaidInMonth(c.id))

  const monthReceived = invoices
    .filter(i => i.status === 'pago' && i.vencimento.startsWith(cobrancaMonth))
    .reduce((s, i) => s + i.valor, 0)
  const monthMissing = monthClientsUnpaid.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)

  const billingRowDeps = {
    invoices, monthKey: cobrancaMonth, usdRate, getDueDate, registeringPayment, registerPayment,
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
          <TabsTrigger value="manuais">Cobranças Manuais</TabsTrigger>
          <TabsTrigger value="receivable">Contas a Receber</TabsTrigger>
          <TabsTrigger value="payable">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              {
                label: 'MRR (Clientes Ativos)', value: formatCurrency(mrr), icon: DollarSign, color: 'text-primary',
                // Explica a diferença entre este card e a Receita. Sem isso, dois
                // números diferentes lado a lado parecem erro.
                hint: mrrEmPermuta > 0 ? `Inclui ${formatCurrency(mrrEmPermuta)} em permuta` : null,
              },
              {
                label: 'Receita Mês', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-success',
                hint: mrrEmPermuta > 0 ? `Sem ${formatCurrency(mrrEmPermuta)} de permuta` : null,
              },
              { label: 'Despesas Mês', value: formatCurrency(totalExpensesVal), icon: TrendingDown, color: 'text-danger', hint: null },
              { label: 'Lucro Líquido', value: formatCurrency(netProfit), icon: DollarSign, color: netProfit > 0 ? 'text-success' : 'text-danger', hint: null },
              { label: 'Margem', value: `${margin}%`, icon: Percent, color: 'text-info', hint: null },
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
                    {kpi.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.hint}</p>}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Projeção de 6 meses</CardTitle>
              <p className="text-xs text-muted-foreground">MRR contratado (sem permuta) contra a despesa já lançada em cada mês, incluindo parcela de cartão que continua correndo.</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={projecao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="receita" name="Receita" stroke="#4ABE7C" strokeWidth={2} dot={{ fill: '#4ABE7C', r: 3 }} />
                  <Line type="monotone" dataKey="custo" name="Custo" stroke="#E0726A" strokeWidth={2} dot={{ fill: '#E0726A', r: 3 }} />
                  <Line type="monotone" dataKey="saldo" name="Sobra" stroke="#D0B870" strokeWidth={2.5} dot={{ fill: '#D0B870', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COBRANÇA */}
        <TabsContent value="cobranca" className="space-y-4 mt-4">
          {/* Seletor de mês */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={cobrancaMonth} onValueChange={setCobrancaMonth}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cobrancaMonthOptions.map(m => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}{m === currentMonth ? ' (mês atual)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isCurrentMonth && (
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                Fechamento de {monthLabel(cobrancaMonth)}
              </Badge>
            )}
          </div>

          {/* KPIs */}
          {isCurrentMonth ? (
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
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border bg-card"><CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Recebido em {monthLabel(cobrancaMonth)}</p>
                <p className="text-lg font-bold text-success">{formatCurrency(monthReceived)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{monthClientsPaid.length} cliente{monthClientsPaid.length !== 1 ? 's' : ''} pagaram</p>
              </CardContent></Card>
              <Card className="border-danger/30 bg-card"><CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Sem pagamento registrado</p>
                <p className="text-lg font-bold text-danger">{formatCurrency(monthMissing)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{monthClientsUnpaid.length} cliente{monthClientsUnpaid.length !== 1 ? 's' : ''} em aberto</p>
              </CardContent></Card>
            </div>
          )}

          {/* Mês passado: quem não pagou primeiro, depois quem pagou */}
          {!isCurrentMonth && (
            <>
              <BillingSection
                title={`Não pagaram em ${monthLabel(cobrancaMonth)}`}
                clients={monthClientsUnpaid}
                icon={AlertCircle}
                highlight="danger"
                borderColor="border-danger/30"
                {...billingRowDeps}
              />
              <BillingSection
                title={`Pagaram em ${monthLabel(cobrancaMonth)}`}
                clients={monthClientsPaid}
                icon={CheckCircle}
                highlight="muted"
                borderColor="border-border"
                {...billingRowDeps}
              />
              <p className="text-xs text-muted-foreground px-1">
                Considera só clientes ativos hoje com dia de vencimento definido, e apenas quem já tinha primeira mensalidade
                vencida em {monthLabel(cobrancaMonth)} (quem fechou contrato no próprio dia do vencimento só passa a contar no mês seguinte).
                Quem saiu da carteira depois não aparece aqui. Dá pra registrar um pagamento atrasado direto na linha: ele entra com vencimento no mês escolhido.
              </p>
            </>
          )}

          {/* Em permuta: aparece nos dois modos, mês corrente e fechamento */}
          <BillingSection
            title={`Em permuta em ${monthLabel(cobrancaMonth)}`}
            clients={clientesPermutaNoMes}
            icon={Handshake}
            highlight="primary"
            borderColor="border-info/30"
            {...billingRowDeps}
          />

          {/* Sections */}
          {isCurrentMonth && <>
          <BillingSection
            title="Vence Hoje"
            clients={clientsToday}
            icon={AlertCircle}
            highlight="danger"
            borderColor="border-danger/30"
            {...billingRowDeps}
          />
          <BillingSection
            title="Vence Esta Semana (próximos 7 dias)"
            clients={clientsThisWeek}
            icon={Clock}
            highlight="warning"
            borderColor="border-warning/30"
            {...billingRowDeps}
          />
          <BillingSection
            title="Vence Este Mês"
            clients={clientsThisMonth}
            icon={Calendar}
            highlight="primary"
            borderColor="border-border"
            {...billingRowDeps}
          />
          <BillingSection
            title="Já Vencidos Este Mês"
            clients={clientsOverdue}
            icon={CalendarCheck}
            highlight="muted"
            borderColor="border-border"
            {...billingRowDeps}
          />
          </>}

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

        {/* COBRANÇAS MANUAIS (pix/boleto não-MRR + recorrência semanal + avulsos) */}
        <TabsContent value="manuais" className="space-y-4 mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" /> Cobranças Manuais (Pix / Boleto)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Cobranças que não são MRR automático — pix mensal, boletos manuais, pendências avulsas. Cada linha tem espelho no ClickUp (lista 💰 Cobranças Recorrentes SVI).
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Recorrência</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Próximo Venc.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cobrancasManuais.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">
                        Nenhuma cobrança manual ativa. Migration ainda não rodou?
                      </TableCell>
                    </TableRow>
                  )}
                  {cobrancasManuais.map(c => {
                    const venc = c.proximo_vencimento ? new Date(c.proximo_vencimento) : null
                    const vencStr = venc ? venc.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
                    const isOverdue = venc && venc < new Date()
                    return (
                      <TableRow key={c.id} className="border-border hover:bg-muted/20">
                        <TableCell className="text-sm font-medium">{c.cliente_nome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[280px] truncate" title={c.descricao}>
                          {c.descricao}
                          {c.observacoes && (
                            <div className="text-[10px] text-warning mt-0.5">⚠ {c.observacoes}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">{c.metodo}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] capitalize ${c.recorrencia === 'avulso' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-primary/10 text-primary border-primary/30'}`}>
                            {c.recorrencia} {c.dia_mes ? `(dia ${c.dia_mes})` : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.contato || '—'}</TableCell>
                        <TableCell className={`text-sm ${isOverdue ? 'text-danger font-bold' : 'text-foreground'}`}>{vencStr}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {c.clickup_task_id && (
                              <a
                                href={`https://app.clickup.com/t/${c.clickup_task_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir no ClickUp"
                              >
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-success hover:text-success"
                              onClick={() => markCobrancaPaga(c)}
                              title={c.recorrencia === 'avulso' ? 'Marcar como resolvido' : 'Recebido — avança próximo vencimento'}
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> {c.recorrencia === 'avulso' ? 'Resolvido' : 'Recebido'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-danger hover:text-danger"
                              onClick={() => deleteCobranca(c)}
                              title="Apagar cobrança"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECEIVABLE */}
        <TabsContent value="receivable" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-primary/30 bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {invoiceMonthFilter === 'all' ? 'Todos os meses' : monthLabel(invoiceMonthFilter)}
              </p>
              <p className="text-lg font-bold text-primary">{formatCurrency(monthInvoicesTotal)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{filteredInvoices.length} fatura{filteredInvoices.length !== 1 ? 's' : ''}</p>
            </CardContent></Card>
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

          <div className="flex gap-3 flex-wrap">
            <Select value={invoiceMonthFilter} onValueChange={setInvoiceMonthFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {invoiceMonthOptions.map(m => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}{m === currentMonth ? ' (mês atual)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {clientesForaDaGeracao.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {clientesForaDaGeracao.map(c => `${c.name} (${c.currency})`).join(', ')}
                </span>
                {' '}não {clientesForaDaGeracao.length > 1 ? 'entram' : 'entra'} na geração automática de fatura do dia 1,
                porque a conversão de moeda depende da cotação do dia. Registrar o pagamento pela aba Cobrança,
                que converte na hora.
              </p>
            </div>
          )}

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
                {filteredInvoices.length === 0 && (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                      Nenhuma fatura {invoiceMonthFilter === 'all' ? 'com esse filtro' : `em ${monthLabel(invoiceMonthFilter)}`}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PAYABLE */}
        <TabsContent value="payable" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-border bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Total {expenseMonthFilter === 'all' ? '(todos os meses)' : monthLabel(expenseMonthFilter)}
              </p>
              <p className="text-lg font-bold">{formatCurrency(monthExpensesTotal)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{monthExpenses.length} despesa{monthExpenses.length !== 1 ? 's' : ''}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Já pago</p>
              <p className="text-lg font-bold text-success">{formatCurrency(monthExpensesPaid)}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Falta pagar</p>
              <p className="text-lg font-bold text-danger">{formatCurrency(monthExpensesOpen)}</p>
            </CardContent></Card>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <Select value={expenseMonthFilter} onValueChange={setExpenseMonthFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {expenseMonthOptions.map(m => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}{m === currentMonth ? ' (mês atual)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <span>{exp.descricao}</span>
                        {exp.parcelas_total ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-info/10 text-info border-info/30">
                            <Layers className="h-2.5 w-2.5" /> Parcela {exp.parcela_atual}/{exp.parcelas_total}
                          </Badge>
                        ) : null}
                        {exp.recorrente && (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30">
                            <RotateCw className="h-2.5 w-2.5" /> Recorrente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-danger text-sm">{formatCurrency(exp.valor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(exp.vencimento)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${expenseStatusClass[exp.status]}`}>{exp.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {exp.status !== 'pago' ? (
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-success hover:text-success" onClick={() => markExpensePaid(exp.id)} title="Marcar como pago">
                            <CheckCircle className="h-3.5 w-3.5" /> Pago
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => markExpensePending(exp.id)} title="Voltar para pendente">
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exp)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(exp)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredExpenses.length === 0 && (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                      Nenhuma despesa {expenseMonthFilter === 'all' ? 'com esse filtro' : `em ${monthLabel(expenseMonthFilter)}`}.
                    </TableCell>
                  </TableRow>
                )}
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
                      <TableHead className="text-xs text-right">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dreMensal.map(row => (
                      <TableRow key={row.mes} className="border-border">
                        <TableCell className="text-sm font-medium">
                          {row.label}
                          {row.incompleto && (
                            <Badge variant="outline" className="ml-2 text-[10px] bg-warning/15 text-warning border-warning/30">
                              sem folha
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-success text-sm">{formatCurrency(row.receita)}</TableCell>
                        <TableCell className="text-danger text-sm">{formatCurrency(row.custo)}</TableCell>
                        <TableCell className={`text-sm font-bold ${row.lucro >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatCurrency(row.lucro)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {row.receita > 0 ? `${row.margem.toFixed(1)}%` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {dreMensal.some(r => r.incompleto) && (
                      <TableRow className="border-border hover:bg-transparent">
                        <TableCell colSpan={5} className="text-xs text-muted-foreground py-3">
                          Mês marcado com <span className="text-warning">sem folha</span> não tem custo de time lançado,
                          então o lucro dele está inflado. Não é resultado, é dado faltando.
                        </TableCell>
                      </TableRow>
                    )}
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
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Despesa recorrente mensal</Label>
                <p className="text-xs text-muted-foreground">
                  {newExpense.parcelado
                    ? 'Indisponível: uma despesa parcelada já nasce com todas as parcelas criadas.'
                    : 'Repete sozinha todo dia 1, sem precisar marcar nada. Cadastre uma vez só.'}
                </p>
              </div>
              <Switch
                checked={newExpense.recorrente}
                disabled={newExpense.parcelado}
                onCheckedChange={v => setNewExpense(p => ({ ...p, recorrente: v }))}
              />
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Compra parcelada</Label>
                  <p className="text-xs text-muted-foreground">Cria uma despesa por mês, cada uma marcada com a parcela.</p>
                </div>
                <Switch
                  checked={newExpense.parcelado}
                  onCheckedChange={v => setNewExpense(p => ({ ...p, parcelado: v, recorrente: v ? false : p.recorrente }))}
                />
              </div>

              {newExpense.parcelado && (
                <div className="flex items-end gap-3 pt-1">
                  <div className="space-y-2">
                    <Label className="text-xs">Número de parcelas</Label>
                    <Input
                      type="number"
                      min={2}
                      max={120}
                      className="w-28"
                      value={newExpense.parcelas}
                      onChange={e => setNewExpense(p => ({ ...p, parcelas: e.target.value }))}
                    />
                  </div>
                  {newExpense.valor && newExpense.vencimento && (
                    <p className="text-xs text-muted-foreground pb-2.5">
                      {Math.max(2, Math.min(120, parseInt(newExpense.parcelas, 10) || 2))}x de{' '}
                      <span className="font-medium text-foreground">{formatCurrency(parseFloat(newExpense.valor) || 0)}</span>
                      {' '}· 1ª em {formatDate(newExpense.vencimento)}, última em{' '}
                      {formatDate(addMonths(newExpense.vencimento, Math.max(2, Math.min(120, parseInt(newExpense.parcelas, 10) || 2)) - 1))}
                      {' '}· total {formatCurrency((parseFloat(newExpense.valor) || 0) * Math.max(2, Math.min(120, parseInt(newExpense.parcelas, 10) || 2)))}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewExpense(false); resetNewExpense() }}>Cancelar</Button>
            <Button onClick={addExpense}>{newExpense.parcelado ? 'Criar parcelas' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Despesa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {editingExpense?.parcelas_total ? (
              <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-3">
                <Layers className="h-4 w-4 text-info shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Parcela <span className="font-medium text-foreground">{editingExpense.parcela_atual} de {editingExpense.parcelas_total}</span>.
                  A edição vale só para esta parcela, as outras seguem como estão.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={editForm.descricao} onChange={e => setEditForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={editForm.categoria} onValueChange={v => setEditForm(p => ({ ...p, categoria: v }))}>
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
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" value={editForm.valor} onChange={e => setEditForm(p => ({ ...p, valor: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input type="date" value={editForm.vencimento} onChange={e => setEditForm(p => ({ ...p, vencimento: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Despesa recorrente mensal</Label>
                <p className="text-xs text-muted-foreground">Repete sozinha todo dia 1. Editar aqui muda só esta, o valor das próximas vem do último lançamento.</p>
              </div>
              <Switch
                checked={editForm.recorrente}
                onCheckedChange={v => setEditForm(p => ({ ...p, recorrente: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingExpense(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `"${deleteTarget.descricao}" (${formatCurrency(deleteTarget.valor)}) será removida permanentemente. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteExpense} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
