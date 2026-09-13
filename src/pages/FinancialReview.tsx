import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, ClipboardCheck, RefreshCw, SearchCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { confirmSaved, errorMessage, fetchAllRows } from '@/lib/data-access'
import { financialReview, paymentDateError, type ReviewIssue } from '@/lib/financial-review'
import { localDateISO } from '@/lib/management-metrics'
import { clientPath } from '@/lib/client-management'
import type { Expense, Invoice } from '@/types'
import { formatCurrency, formatDate } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import DataLoadError from '@/components/DataLoadError'

export default function FinancialReview() {
  const { can, user } = useAuth()
  const allowed = can('admin')
  const { toast } = useToast()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const selectedClient = params.get('client') || 'all'
  const [kind, setKind] = useState<ReviewIssue['kind'] | 'all'>('all')
  const [limit, setLimit] = useState(30)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [paymentDate, setPaymentDate] = useState('')
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const data = useQuery({
    queryKey: ['financial-review', user?.id], enabled: allowed,
    queryFn: async () => {
      const [invoices, expenses, clients] = await Promise.all([
        fetchAllRows<Invoice>((from, to) => supabase.from('invoices').select('*').order('vencimento').order('id').range(from, to)),
        fetchAllRows<Expense>((from, to) => supabase.from('expenses').select('*').order('vencimento').order('id').range(from, to)),
        fetchAllRows<{ id: string; name: string }>((from, to) => supabase.from('clients').select('id, name').order('name').order('id').range(from, to)),
      ])
      return { invoices, expenses, clients }
    },
  })

  async function saveDate() {
    if (!editing || inFlight.current || !allowed) return
    const error = paymentDateError(paymentDate, localDateISO())
    if (error) { toast({ title: 'Confira a data', description: error, variant: 'destructive' }); return }
    inFlight.current = true
    setSaving(true)
    try {
      await confirmSaved(supabase.from('invoices').update({ data_pagamento: paymentDate }).eq('id', editing.id).eq('status', 'pago').is('data_pagamento', null).select('id'))
      toast({ title: 'Data do recebimento registrada' })
      setEditing(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['financial-review'] }),
        qc.invalidateQueries({ queryKey: ['client-management-invoices'] }),
      ])
    } catch (error) {
      toast({ title: 'Alteração não confirmada', description: errorMessage(error), variant: 'destructive' })
    } finally { inFlight.current = false; setSaving(false) }
  }

  if (!allowed) return <p>Esta conferência está disponível para administradores.</p>
  if (data.isLoading) return <p role="status" className="text-sm text-muted-foreground py-8">Preparando conferência dos registros...</p>
  if (data.isError || !data.data) return <DataLoadError onRetry={() => { void data.refetch() }} />
  const { invoices, expenses, clients } = data.data
  const names = new Map(clients.map(c => [c.id, c.name]))
  const allIssues = financialReview(invoices, expenses, names)
  const scoped = allIssues.filter(issue => selectedClient === 'all' || issue.clientId === selectedClient)
  const issues = scoped.filter(issue => kind === 'all' || kind === issue.kind)
  const kinds = [
    { value: 'payment_date' as const, label: 'Recebimentos sem data', icon: CalendarDays },
    { value: 'invoice_group' as const, label: 'Grupos de faturas a conferir', icon: ClipboardCheck },
    { value: 'expense_group' as const, label: 'Grupos de despesas semelhantes', icon: SearchCheck },
  ]

  return <div className="space-y-5 min-w-0 animate-fade-in">
    <div className="flex items-center justify-between gap-3"><Link to="/financial" className="text-sm text-muted-foreground inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Financeiro</Link><Button variant="outline" size="sm" onClick={() => { void data.refetch() }} disabled={data.isFetching || saving}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button></div>
    <header className="space-y-2"><p className="text-xs tracking-[0.18em] uppercase text-primary">Qualidade dos registros</p><h1 className="text-2xl sm:text-3xl font-semibold">Conferência financeira</h1><p className="text-sm text-muted-foreground max-w-3xl">Revise os apontamentos antes de fechar o mês. Uma semelhança entre lançamentos pede conferência do documento de origem. Esta fila não substitui a conciliação bancária.</p></header>
    <div className="grid sm:grid-cols-3 gap-3">{kinds.map(({ value, label, icon: Icon }) => <button key={value} onClick={() => { setKind(kind === value ? 'all' : value); setLimit(30) }} aria-pressed={kind === value} className={`rounded-xl border p-4 text-left transition-colors ${kind === value ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}><div className="flex justify-between items-center"><span className="text-3xl font-semibold tabular-nums">{scoped.filter(issue => issue.kind === value).length}</span><Icon className="h-5 w-5 text-muted-foreground" /></div><p className="text-sm text-muted-foreground mt-3">{label}</p></button>)}</div>
    <div className="flex flex-wrap items-center gap-3"><Select value={selectedClient} onValueChange={value => { setParams(previous => { const next = new URLSearchParams(previous); if (value === 'all') next.delete('client'); else next.set('client', value); return next }); setLimit(30) }}><SelectTrigger aria-label="Cliente da conferência" className="w-full sm:w-72"><SelectValue placeholder="Cliente" /></SelectTrigger><SelectContent><SelectItem value="all">Toda a carteira e despesas gerais</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>{kind !== 'all' && <Button variant="ghost" size="sm" onClick={() => setKind('all')}>Mostrar todos os apontamentos</Button>}<span className="text-xs text-muted-foreground sm:ml-auto">{issues.length} apontamento(s) · todos os meses</span></div>
    {selectedClient !== 'all' && <p className="text-xs text-muted-foreground">Despesas gerais aparecem na opção de toda a carteira. <Link to={clientPath(selectedClient)} className="text-primary underline underline-offset-4">Abrir gestão do cliente</Link></p>}
    {issues.length === 0 ? <div className="rounded-xl border border-border bg-card p-8"><h2 className="font-semibold">Nenhum apontamento neste filtro</h2><p className="text-sm text-muted-foreground mt-2">As regras desta conferência não localizaram esses problemas nos registros consultados. Isso não comprova que o saldo bancário esteja conciliado.</p></div> : <div className="space-y-4">{issues.slice(0, limit).map(issue => <article key={issue.id} className="rounded-xl border border-border bg-card overflow-hidden"><div className="p-4 sm:p-5 border-b border-border flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{issue.title}</h2><p className="text-sm text-muted-foreground mt-1 max-w-3xl">{issue.reason}</p></div><Badge variant="outline" className="h-fit">{issue.records.length} registro(s)</Badge></div><div className="divide-y divide-border">{issue.records.map(record => <div key={record.id} className="p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium break-words">{record.label}</p><p className="text-xs text-muted-foreground mt-1">Vencimento {formatDate(record.due)} · <span className="capitalize">{record.status}</span> · Ref. {record.id.slice(0, 8)}</p></div><div className="flex items-center gap-3 flex-wrap"><span className="font-semibold tabular-nums">{formatCurrency(record.amount)}</span>{issue.kind === 'payment_date' ? <Button size="sm" variant="outline" onClick={() => { setEditing(invoices.find(i => i.id === record.id) || null); setPaymentDate('') }}>Informar data</Button> : <Button asChild size="sm" variant="outline"><Link to={`/financial?${new URLSearchParams(issue.kind === 'expense_group' ? { tab: 'payable', expense: record.id, month: 'all' } : { tab: 'receivable', invoice: record.id, month: 'all', client: issue.clientId || '' })}`}>Abrir lançamento</Link></Button>}</div></div>)}</div></article>)}</div>}
    {issues.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 30)}>Mostrar mais apontamentos</Button>}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !saving) setEditing(null) }}><DialogContent><DialogHeader><DialogTitle>Completar data do recebimento</DialogTitle><DialogDescription>Informe a data em que o dinheiro foi recebido, conforme o comprovante. A fatura já está marcada como paga.</DialogDescription></DialogHeader><form onSubmit={e => { e.preventDefault(); void saveDate() }} className="space-y-4"><p className="text-sm">{editing && names.get(editing.client_id)} · {editing && formatCurrency(editing.valor)}</p><div className="space-y-2"><Label htmlFor="payment-date">Data real do recebimento</Label><Input id="payment-date" type="date" value={paymentDate} max={localDateISO()} required disabled={saving} onChange={e => setPaymentDate(e.target.value)} /></div><DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={saving || !paymentDate}>{saving ? 'Confirmando...' : 'Salvar data'}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>
}
