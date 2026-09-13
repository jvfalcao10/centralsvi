import { Link, useSearchParams } from 'react-router-dom'
import { clientPath } from '@/lib/client-management'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Plus, CheckCircle, Send, AlertCircle, Clock, Calendar, CalendarCheck, Pencil, Trash2, Undo2, ExternalLink, Repeat, Layers, Handshake } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows, confirmSaved, errorMessage } from '@/lib/data-access'
import { formatAxisCurrency, contractTotals, expensesDueInMonth, receivedInMonth, isOpenInvoice, isOverdueInvoice, isBillableInMonth, localDateISO, monthlyInvoiceId } from '@/lib/management-metrics'
import DataLoadError from '@/components/DataLoadError'
import { useToast } from '@/hooks/use-toast'
import { Invoice, Expense, formatCurrency, formatDate, emPermutaNoMes, isClienteMedico } from '@/types'
import { monthKeyOf, monthKeyOfDate, monthLabel, buildMonthOptions, addMonths, getDueDate, lastDayOfMonth } from '@/lib/months'
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
      <TableCell className={`text-sm font-medium ${isClienteMedico(client) ? 'text-info' : ''}`}>{client.name}</TableCell>
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
  const [params, setParams] = useSearchParams()
  const setParam = (key: string, value: string | null) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (value === null || value === 'all' && key === 'client') next.delete(key)
    else next.set(key, value)
    return next
  }, { replace: true })
  const queryMonth = (key: string) => {
    const value = params.get(key) || params.get('month') || ''
    return value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : monthKeyOfDate(new Date())
  }
  const invoiceClientFilter = params.get('client') || 'all'
  const invoiceReference = params.get('invoice')
  const expenseReference = params.get('expense')
  const usdRate = useUsdRate()
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [cobrancasManuais, setCobrancasManuais] = useState<CobrancaManual[]>([])
  const [activeClients, setActiveClients] = useState<ActiveClient[]>([])
  const [loading, setLoading] = useState(true)
  const activeTab = ['overview', 'cobranca', 'manuais', 'receivable', 'payable', 'dre'].includes(params.get('tab') || '') ? params.get('tab')! : 'overview'
  const setActiveTab = (value: string) => setParam('tab', value)
  const [loadError, setLoadError] = useState(false)
  const [mutating, setMutating] = useState(false)
  const mutationInFlight = useRef(false)
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all')
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all')
  const [expenseCatFilter, setExpenseCatFilter] = useState('all')
  // Filtros de mês: começam no mês corrente, com opção "Todos os meses".
  const invoiceMonthFilter = queryMonth('invoiceMonth')
  const setInvoiceMonthFilter = (value: string) => setParam('invoiceMonth', value)
  const expenseMonthFilter = queryMonth('expenseMonth')
  const setExpenseMonthFilter = (value: string) => setParam('expenseMonth', value)
  const [cobrancaMonth, setCobrancaMonth] = useState(() => monthKeyOfDate(new Date()))
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({ categoria: 'operacional', descricao: '', valor: '', vencimento: '', recorrente: false, parcelado: false, parcelas: '2' })
  const [registeringPayment, setRegisteringPayment] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editForm, setEditForm] = useState({ categoria: 'operacional', descricao: '', valor: '', vencimento: '', status: 'pendente', recorrente: false })
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setLoadError(false)
    try {
      const [inv, exp, clientsData, cobrancasData] = await Promise.all([
        fetchAllRows((from, to) => supabase.from('invoices').select('*, clients(name)').order('vencimento').order('id').range(from, to)),
        fetchAllRows((from, to) => supabase.from('expenses').select('*').order('vencimento').order('id').range(from, to)),
        fetchAllRows((from, to) => supabase.from('clients').select('id, name, company, mrr, currency, status, dia_vencimento, instagram, inicio_contrato, permuta, permuta_ate, cobranca_inicio, segment').order('id').range(from, to)),
        fetchAllRows((from, to) => supabase.from('cobrancas_manuais').select('*').eq('ativo', true).order('proximo_vencimento', { ascending: true, nullsFirst: false }).order('id').range(from, to)),
      ])
      setInvoices(inv as InvoiceWithClient[])
      setExpenses(exp as Expense[])
      setCobrancasManuais(cobrancasData as CobrancaManual[])
      setActiveClients(clientsData as ActiveClient[])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const performChange = async (action: () => Promise<unknown>, success: string, afterSave?: () => void) => {
    if (mutationInFlight.current) return
    mutationInFlight.current = true
    setMutating(true)
    try {
      await action()
      toast({ title: success })
      afterSave?.()
      // Atualiza os valores sem desmontar a aba, seus filtros e a lista em uso.
      await fetchData(false)
    } catch (error) {
      toast({ title: 'Alteração não confirmada', description: errorMessage(error), variant: 'destructive' })
    } finally {
      mutationInFlight.current = false
      setMutating(false)
    }
  }

  const markCobrancaPaga = (c: CobrancaManual) => performChange(async () => {
    if (c.recorrencia === 'avulso') {
      await confirmSaved(supabase.from('cobrancas_manuais').update({ ativo: false, status: 'pago' }).eq('id', c.id).eq('ativo', true).select('id'))
    } else {
      const currentDue = c.proximo_vencimento || localDateISO()
      let next: string
      if (c.recorrencia === 'mensal' && c.dia_mes) {
        next = localDateISO(getDueDate(c.dia_mes, monthKeyOf(addMonths(currentDue, 1))))
      } else if (c.recorrencia === 'semanal') {
        const date = new Date(`${currentDue}T12:00:00`)
        date.setDate(date.getDate() + 7)
        next = localDateISO(date)
      } else {
        throw new Error('Confira a recorrência e o dia de vencimento desta cobrança.')
      }
      let update = supabase.from('cobrancas_manuais').update({ proximo_vencimento: next, status: 'ativo' }).eq('id', c.id)
      update = c.proximo_vencimento ? update.eq('proximo_vencimento', c.proximo_vencimento) : update.is('proximo_vencimento', null)
      await confirmSaved(update.select('id'))
    }
  }, c.recorrencia === 'avulso' ? `Cobrança de ${c.cliente_nome} resolvida` : `Próximo vencimento de ${c.cliente_nome} atualizado`)

  const deleteCobranca = async (c: CobrancaManual) => {
    if (!window.confirm(`Apagar a cobrança de ${c.cliente_nome}? Esta ação não pode ser desfeita.`)) return
    await performChange(() => confirmSaved(supabase.from('cobrancas_manuais').delete().eq('id', c.id).select('id')), `${c.cliente_nome} removida das cobranças`)
  }

  useEffect(() => { void fetchData() }, [fetchData])

  const markInvoicePaid = (id: string) => performChange(
    () => confirmSaved(supabase.from('invoices').update({ status: 'pago', data_pagamento: localDateISO() }).eq('id', id).in('status', ['pendente', 'atrasado']).select('id')),
    'Pagamento da fatura confirmado',
  )
  const markExpensePaid = (id: string) => performChange(
    () => confirmSaved(supabase.from('expenses').update({ status: 'pago' }).eq('id', id).neq('status', 'pago').select('id')),
    'Despesa marcada como paga',
  )
  const markExpensePending = (id: string) => performChange(
    () => confirmSaved(supabase.from('expenses').update({ status: 'pendente' }).eq('id', id).eq('status', 'pago').select('id')),
    'Despesa marcada como pendente',
  )

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp)
    setEditForm({ categoria: exp.categoria, descricao: exp.descricao, valor: String(exp.valor), vencimento: exp.vencimento, status: exp.status, recorrente: exp.recorrente })
  }

  const saveEdit = async () => {
    if (!editingExpense) return
    const valor = Number(editForm.valor)
    if (!editForm.descricao.trim() || !editForm.vencimento || !Number.isFinite(valor) || valor <= 0) {
      toast({ title: 'Confira a despesa', description: 'Informe descrição, vencimento e um valor maior que zero.', variant: 'destructive' })
      return
    }
    await performChange(() => confirmSaved(supabase.from('expenses').update({
      categoria: editForm.categoria, descricao: editForm.descricao.trim(), valor,
      vencimento: editForm.vencimento, status: editForm.status, recorrente: editForm.recorrente,
    }).eq('id', editingExpense.id).select('id')), 'Despesa atualizada', () => setEditingExpense(null))
  }

  const deleteExpense = async () => {
    if (!deleteTarget) return
    await performChange(() => confirmSaved(supabase.from('expenses').delete().eq('id', deleteTarget.id).select('id')), 'Despesa removida', () => setDeleteTarget(null))
  }

  const resetNewExpense = () =>
    setNewExpense({ categoria: 'operacional', descricao: '', valor: '', vencimento: '', recorrente: false, parcelado: false, parcelas: '2' })

  const addExpense = async () => {
    const valor = Number(newExpense.valor)
    if (!newExpense.descricao.trim() || !newExpense.vencimento || !Number.isFinite(valor) || valor <= 0) {
      toast({ title: 'Confira a despesa', description: 'Informe descrição, vencimento e um valor maior que zero.', variant: 'destructive' })
      return
    }
    const qtd = newExpense.parcelado ? Math.max(2, Math.min(120, parseInt(newExpense.parcelas, 10) || 2)) : 1
    const rows = Array.from({ length: qtd }, (_, i) => ({
      categoria: newExpense.categoria, descricao: newExpense.descricao.trim(), valor,
      vencimento: addMonths(newExpense.vencimento, i), status: 'pendente',
      recorrente: qtd > 1 ? false : newExpense.recorrente,
      parcela_atual: qtd > 1 ? i + 1 : null, parcelas_total: qtd > 1 ? qtd : null,
    }))
    await performChange(() => confirmSaved(supabase.from('expenses').insert(rows).select('id'), qtd),
      qtd > 1 ? `${qtd} parcelas criadas` : 'Despesa adicionada',
      () => { setShowNewExpense(false); resetNewExpense() })
  }

  const registerPayment = async (client: ActiveClient, monthKey: string) => {
    if (!client.dia_vencimento || mutationInFlight.current) return
    setRegisteringPayment(client.id)
    try {
      await performChange(async () => {
        const { data: existing, error } = await supabase.from('invoices').select('id, status')
          .eq('client_id', client.id).in('status', ['pendente', 'atrasado', 'pago'])
          .gte('vencimento', `${monthKey}-01`).lte('vencimento', lastDayOfMonth(monthKey))
        if (error) throw new Error(error.message)
        if (!existing) throw new Error('Não foi possível consultar a fatura deste mês.')
        if (existing.length > 1) throw new Error('Há mais de uma fatura neste mês. Confira e dê baixa na fatura correta em Contas a Receber.')
        if (existing[0]?.status === 'pago') throw new Error('Este mês já tem pagamento registrado. Atualize a tela para conferir.')
        if (existing[0]) {
          await confirmSaved(supabase.from('invoices').update({ status: 'pago', data_pagamento: localDateISO() })
            .eq('id', existing[0].id).in('status', ['pendente', 'atrasado']).select('id'))
        } else {
          // O mesmo cliente/mês usa o mesmo ID nas tentativas de criação manual.
          await confirmSaved(supabase.from('invoices').upsert({
            id: await monthlyInvoiceId(client.id, monthKey),
            client_id: client.id,
            valor: mrrBRL(client.mrr, client.currency, usdRate),
            status: 'pago',
            vencimento: localDateISO(getDueDate(client.dia_vencimento!, monthKey)),
            data_pagamento: localDateISO(),
          }, { onConflict: 'id', ignoreDuplicates: true }).select('id'))
        }
      }, `Pagamento de ${client.name} confirmado`)
    } finally {
      setRegisteringPayment(null)
    }
  }

  const today = new Date()
  const todayStr = localDateISO(today)
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const in7DaysStr = localDateISO(in7Days)

  const currentMonth = monthKeyOfDate(today)

  // Use USD-converted MRR sum for financial calculations
  const contracts = contractTotals(activeClients, currentMonth, usdRate)
  const operatingClients = activeClients.filter(c => contracts.active.includes(c))
  const mrr = contracts.total

  // Permuta não vira dinheiro. Fica no MRR contratado (é contrato ativo), mas sai
  // da Receita do mês, senão o lucro e a margem contam caixa que nunca entrou.
  const clientesEmPermuta = operatingClients.filter(c => emPermutaNoMes(c, currentMonth))
  const mrrEmPermuta = clientesEmPermuta.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)
  const overdueInvoices = invoices.filter(i => isOverdueInvoice(i, todayStr))

  // Estimativa contratada do mês. Recebimentos são calculados separadamente pela data de pagamento.
  const totalRevenue = mrr - mrrEmPermuta
  const currentExpenses = expensesDueInMonth(expenses, currentMonth)
  const totalExpensesVal = currentExpenses.reduce((s, e) => s + Number(e.valor), 0)
  const receivedCurrentMonth = receivedInMonth(invoices, currentMonth)
  const paymentsWithoutDate = invoices.filter(i => i.status === 'pago' && !i.data_pagamento).length
  const netProfit = totalRevenue - totalExpensesVal

  const expenseMonthOptions = buildMonthOptions(expenses.map(e => e.vencimento), currentMonth)
  const invoiceMonthOptions = buildMonthOptions(invoices.map(i => i.vencimento), currentMonth)

  const clientInvoices = invoices.filter(i => invoiceClientFilter === 'all' || i.client_id === invoiceClientFilter)
  const filteredInvoices = clientInvoices.filter(i => {
    if (invoiceReference && i.id !== invoiceReference) return false
    if (invoiceStatusFilter !== 'all' && i.status !== invoiceStatusFilter) return false
    if (invoiceMonthFilter !== 'all' && monthKeyOf(i.vencimento) !== invoiceMonthFilter) return false
    return true
  })
  const filteredExpenses = expenses.filter(e => {
    if (expenseReference && e.id !== expenseReference) return false
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

  // Faturas e despesas agrupadas por vencimento, sem inferir recebimento.
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
  const clientesForaDaGeracao = operatingClients.filter(c => c.currency !== 'BRL' && c.dia_vencimento !== null)

  const costosDirectos = currentExpenses.filter(e => e.categoria === 'pessoal').reduce((s, e) => s + e.valor, 0)
  const fixedExpenses = currentExpenses.filter(e => e.categoria !== 'pessoal').reduce((s, e) => s + e.valor, 0)
  const grossMargin = totalRevenue - costosDirectos
  const netProfitDRE = grossMargin - fixedExpenses

  // --- Billing module grouping ---
  // Quem está em permuta não é cobrado, então sai das seções por vencimento e
  // aparece na própria seção. Sem isso ele viraria "vence hoje" e depois "vencido".
  const todayDay = today.getDate()
  const clientsWithDue = operatingClients.filter(c => isBillableInMonth(c, currentMonth) && !invoices.some(i =>
    i.client_id === c.id && i.status === 'pago' && monthKeyOf(i.vencimento) === currentMonth))
  const clientsNoDue = operatingClients.filter(c => c.dia_vencimento === null && !emPermutaNoMes(c, currentMonth))

  const clientsToday = clientsWithDue.filter(c => c.dia_vencimento === todayDay)
  const clientsThisWeek = clientsWithDue.filter(c => {
    if (!c.dia_vencimento) return false
    const d = getDueDate(c.dia_vencimento)
    const dStr = localDateISO(d)
    return dStr > todayStr && dStr <= in7DaysStr
  })
  const clientsThisMonth = clientsWithDue.filter(c => {
    if (!c.dia_vencimento) return false
    const d = getDueDate(c.dia_vencimento)
    const dStr = localDateISO(d)
    return dStr > in7DaysStr
  })
  const clientsOverdue = clientsWithDue.filter(c => {
    if (!c.dia_vencimento) return false
    const d = getDueDate(c.dia_vencimento)
    const dStr = localDateISO(d)
    return dStr < todayStr
  })

  const billingKpis = [
    { label: 'Vence hoje', value: clientsToday.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0), count: clientsToday.length, color: 'text-danger' },
    { label: 'Esta semana', value: clientsThisWeek.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0), count: clientsThisWeek.length, color: 'text-warning' },
    { label: 'Este mês', value: clientsThisMonth.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0), count: clientsThisMonth.length, color: 'text-primary' },
    { label: 'Faturas vencidas em aberto', value: overdueInvoices.reduce((s, i) => s + Number(i.valor), 0), count: overdueInvoices.length, color: 'text-danger' },
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
  const clientesPermutaNoMes = operatingClients.filter(c =>
    c.dia_vencimento !== null && emPermutaNoMes(c, cobrancaMonth)
  )
  const clientsInMonth = operatingClients.filter(c => isBillableInMonth(c, cobrancaMonth))
  const hasPaidInMonth = (clientId: string) => invoices.some(inv =>
    inv.client_id === clientId && inv.status === 'pago' && inv.vencimento.startsWith(cobrancaMonth)
  )
  const monthClientsPaid = clientsInMonth.filter(c => hasPaidInMonth(c.id))
  const monthClientsUnpaid = clientsInMonth.filter(c => !hasPaidInMonth(c.id))

  const monthReceived = receivedInMonth(invoices, cobrancaMonth)
  const monthMissing = monthClientsUnpaid.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)

  const billingRowDeps = {
    invoices, monthKey: cobrancaMonth, usdRate, getDueDate, registeringPayment, registerPayment,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  if (loadError) return <DataLoadError onRetry={() => { void fetchData() }} />

  return (
    <div className="space-y-4 animate-fade-in" aria-busy={mutating}>
      {mutating && <p role="status" className="text-sm text-muted-foreground">Confirmando alteração...</p>}
      {paymentsWithoutDate > 0 && <p role="alert" className="text-sm text-warning">{paymentsWithoutDate} fatura(s) paga(s) sem data de recebimento. Complete os registros para conferir os totais de caixa.</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button asChild variant="outline" size="sm"><Link to="/financial/previsao">Previsão de entradas e saídas</Link></Button><Button asChild variant="outline" size="sm"><Link to="/financial/conferencia">Conferência financeira</Link></Button></div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted max-w-full h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
          <TabsTrigger value="manuais">Cobranças Manuais</TabsTrigger>
          <TabsTrigger value="receivable">Contas a Receber</TabsTrigger>
          <TabsTrigger value="payable">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="dre">Resultado previsto</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              {
                label: 'MRR contratado', value: formatCurrency(mrr), icon: DollarSign, color: 'text-primary',
                // Explica a diferença entre este card e a Receita. Sem isso, dois
                // números diferentes lado a lado parecem erro.
                hint: mrrEmPermuta > 0 ? `Inclui ${formatCurrency(mrrEmPermuta)} em permuta` : null,
              },
              {
                label: 'Recorrência sem permuta', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-success',
                hint: mrrEmPermuta > 0 ? `Sem ${formatCurrency(mrrEmPermuta)} de permuta` : null,
              },
              { label: 'Despesas do mês', value: formatCurrency(totalExpensesVal), icon: TrendingDown, color: 'text-danger', hint: `Vencimento em ${monthLabel(currentMonth)}` },
              { label: 'Saldo previsto do mês', value: formatCurrency(netProfit), icon: DollarSign, color: netProfit > 0 ? 'text-success' : 'text-danger', hint: 'Recorrência sem permuta menos despesas do mês' },
              { label: 'Recebido no mês', value: formatCurrency(receivedCurrentMonth), icon: CheckCircle, color: 'text-info', hint: 'Pela data de pagamento registrada' },
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
              <CardTitle className="text-sm">Projeção parcial de 6 meses</CardTitle>
              <p className="text-xs text-muted-foreground">Recorrência contratada sem permuta e despesas já registradas. Confira os custos recorrentes futuros antes de usar a sobra para decidir novos gastos.</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={projecao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatAxisCurrency} />
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
                              title={c.recorrencia === 'avulso' ? 'Marcar como resolvido' : 'Avançar para o próximo vencimento'}
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> {c.recorrencia === 'avulso' ? 'Resolvido' : 'Avançar vencimento'}
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
          <div className="flex flex-wrap items-center gap-3"><Select value={invoiceClientFilter} onValueChange={value => { setParams(previous => { const next = new URLSearchParams(previous); if (value === 'all') next.delete('client'); else next.set('client', value); next.delete('invoice'); return next }, { replace: true }) }}><SelectTrigger aria-label="Cliente das faturas" className="w-full sm:w-72"><SelectValue placeholder="Cliente" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{activeClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>{invoiceClientFilter !== 'all' && <Link className="text-sm text-primary" to={clientPath(invoiceClientFilter)}>Abrir gestão do cliente</Link>}</div>
          {invoiceReference && <p className="text-sm text-muted-foreground">Fatura selecionada na conferência. <Button variant="link" size="sm" onClick={() => setParam('invoice', null)}>Mostrar todas</Button></p>}
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
              <p className="text-lg font-bold text-success">{formatCurrency(clientInvoices.filter(isOpenInvoice).reduce((sum, i) => sum + Number(i.valor), 0))}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Vencidas</p>
              <p className="text-lg font-bold text-danger">{formatCurrency(clientInvoices.filter(i => isOverdueInvoice(i, todayStr)).reduce((s, i) => s + Number(i.valor), 0))}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Vencendo em 7 dias</p>
              <p className="text-lg font-bold text-warning">{formatCurrency(clientInvoices.filter(i => i.status === 'pendente' && i.vencimento >= todayStr && i.vencimento <= in7DaysStr).reduce((s, i) => s + Number(i.valor), 0))}</p>
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
                    <TableCell className="text-sm font-medium"><Link className="hover:text-primary underline-offset-4 hover:underline" to={clientPath(inv.client_id)}>{inv.clients?.name || 'Cliente'}</Link></TableCell>
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
          {expenseReference && <p className="text-sm text-muted-foreground">Despesa selecionada na conferência. <Button variant="link" size="sm" onClick={() => setParam('expense', null)}>Mostrar todas</Button></p>}
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
              <CardHeader><CardTitle className="text-sm">Resultado previsto: {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Recorrência contratada sem permuta', value: totalRevenue, bold: false, type: 'income' },
                    { label: '(-) Custos Diretos (Pessoal)', value: -costosDirectos, bold: false, type: 'expense' },
                    { label: '(=) Margem Bruta', value: grossMargin, bold: true, type: grossMargin > 0 ? 'income' : 'expense' },
                    { label: '(-) Outras despesas do mês', value: -fixedExpenses, bold: false, type: 'expense' },
                    { label: '(=) Saldo previsto', value: netProfitDRE, bold: true, type: netProfitDRE > 0 ? 'income' : 'expense' },
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
                      <span className={netProfitDRE / totalRevenue > 0 ? 'text-success' : 'text-danger'}>
                        {totalRevenue > 0 ? (netProfitDRE / totalRevenue * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="text-sm">Faturas e despesas por vencimento</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs">Mês</TableHead>
                      <TableHead className="text-xs">Faturado</TableHead>
                      <TableHead className="text-xs">Despesas</TableHead>
                      <TableHead className="text-xs">Saldo previsto</TableHead>
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
