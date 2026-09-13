import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/data-access'
import { localDateISO } from '@/lib/management-metrics'
import { cashPlan, type CashEntry, type PlannedInvoice, type PlannedExpense } from '@/lib/cash-planning'
import { formatCurrency, formatDate } from '@/types'
import { Button } from '@/components/ui/button'
import DataLoadError from '@/components/DataLoadError'

const money = (cents: number) => formatCurrency(cents / 100)

function Entries({ rows }: { rows: CashEntry[] }) {
  return <ul className="divide-y divide-border">{rows.map(e => <li key={`${e.kind}:${e.id}`}><Link to={e.href} className="flex items-start justify-between gap-3 py-4 hover:text-primary"><div className="min-w-0"><p className="font-medium text-sm break-words">{e.label}</p><p className="text-xs text-muted-foreground mt-1">Vencimento: {formatDate(e.due)} · {e.kind === 'in' ? 'A receber' : 'A pagar'}</p></div><span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${e.kind === 'in' ? 'text-success' : 'text-danger'}`}>{e.kind === 'in' ? '+' : '−'} {money(e.cents)}</span></Link></li>)}</ul>
}

export default function CashPlanning() {
  const { user, can } = useAuth()
  const allowed = can('admin')
  const [params, setParams] = useSearchParams()
  const horizon = params.get('days')
  const days = horizon === '7' ? 7 : horizon === '60' ? 60 : 30
  const overdueView = params.get('view') === 'overdue'
  const [limit, setLimit] = useState(30)
  const today = localDateISO()
  const source = useQuery({
    queryKey: ['cash-planning', user?.id], enabled: allowed,
    queryFn: async () => {
      const [invoices, expenses, clients] = await Promise.all([
        fetchAllRows<PlannedInvoice>((from, to) => supabase.from('invoices').select('id, client_id, valor, vencimento, status').in('status', ['pendente', 'atrasado']).order('id').range(from, to)),
        fetchAllRows<PlannedExpense>((from, to) => supabase.from('expenses').select('id, descricao, valor, vencimento, status').in('status', ['pendente', 'atrasado']).order('id').range(from, to)),
        fetchAllRows<{ id: string; name: string }>((from, to) => supabase.from('clients').select('id, name').order('id').range(from, to)),
      ])
      return { invoices, expenses, names: new Map(clients.map(c => [c.id, c.name])) }
    },
  })
  const change = (key: string, value: string) => {
    setLimit(30)
    setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); return next })
  }
  if (!allowed) return <p>Esta previsão está disponível para administradores.</p>
  if (source.isError) return <DataLoadError onRetry={() => { void source.refetch() }} />
  if (source.isLoading || !source.data) return <p role="status">Carregando lançamentos...</p>
  const plan = cashPlan(source.data.invoices, source.data.expenses, source.data.names, today, days)
  const rows = overdueView ? plan.overdue : plan.upcoming
  const peak = Math.max(1, ...plan.weeks.flatMap(w => [w.incoming, w.outgoing]))

  return <div className="space-y-5 min-w-0 animate-fade-in">
    <div className="flex flex-wrap justify-between items-center gap-3"><Link to="/financial" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Financeiro</Link><Button variant="outline" size="sm" onClick={() => { void source.refetch() }} disabled={source.isFetching}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button></div>
    <header className="flex flex-wrap justify-between items-end gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Planejamento financeiro</p><h1 className="text-2xl sm:text-3xl font-semibold">Previsão de entradas e saídas</h1><p className="text-sm text-muted-foreground mt-2">Valores em aberto com vencimento entre {formatDate(today)} e {formatDate(plan.end)}.</p></div><label className="text-xs text-muted-foreground flex flex-col gap-1.5">Período<select aria-label="Período" value={days} onChange={e => change('days', e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option><option value="60">Próximos 60 dias</option></select></label></header>
    <div className="grid sm:grid-cols-3 gap-3">{[
      { label: 'Entradas previstas', value: plan.totals.incoming, cls: 'text-success', hint: `${plan.upcoming.filter(e => e.kind === 'in').length} fatura(s) em aberto` },
      { label: 'Saídas previstas', value: plan.totals.outgoing, cls: 'text-danger', hint: `${plan.upcoming.filter(e => e.kind === 'out').length} despesa(s) em aberto` },
      { label: 'Diferença no período', value: plan.totals.net, cls: plan.totals.net < 0 ? 'text-danger' : 'text-foreground', hint: 'Entradas menos saídas previstas' },
    ].map(c => <div key={c.label} className="rounded-xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-2xl sm:text-3xl font-semibold tabular-nums mt-3 ${c.cls}`}>{money(c.value)}</p><p className="text-xs text-muted-foreground mt-3">{c.hint}</p></div>)}</div>
    <p className="text-xs text-muted-foreground">Previsão baseada em faturas e despesas já lançadas. Não inclui saldo bancário, valores pagos, contratos sem fatura ou recorrências ainda não geradas. Recebimento no vencimento depende do pagamento do cliente.</p>
    {plan.invalid.length > 0 && <div role="alert" className="rounded-xl border border-warning/40 bg-warning/5 p-4"><p className="text-sm font-medium">{plan.invalid.length} lançamento(s) com data ou valor inválido, fora da previsão.</p><ul className="mt-2 space-y-1">{plan.invalid.map(e => <li key={e.id}><Link className="text-sm text-primary underline" to={e.href}>Conferir {e.label}</Link></li>)}</ul></div>}
    {plan.overdue.length > 0 && <section className="rounded-xl border border-warning/40 bg-warning/5 p-4 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold text-sm">Vencidos antes de {formatDate(today)}</h2><p className="text-sm mt-2">A receber: <strong className="tabular-nums">{money(plan.lateTotals.incoming)}</strong> · A pagar: <strong className="tabular-nums">{money(plan.lateTotals.outgoing)}</strong></p><p className="text-xs text-muted-foreground mt-2">Exibidos à parte até ter uma nova data combinada.</p></div><Button variant="outline" size="sm" onClick={() => change('view', 'overdue')}>Revisar vencidos ({plan.overdue.length})</Button></section>}
    <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-5 items-start">
      <section className="rounded-xl border border-border bg-card overflow-hidden"><div className="p-4 border-b border-border"><h2 className="font-semibold">Vencimentos por semana</h2><p className="text-xs text-muted-foreground mt-1">Entradas <span className="text-success">●</span> · Saídas <span className="text-danger">●</span></p></div><div className="p-4 space-y-5">{plan.weeks.map(w => <div key={w.from}><div className="flex flex-wrap justify-between gap-2 text-xs mb-2"><span>{formatDate(w.from)} a {formatDate(w.to)}</span><span className={w.net < 0 ? 'text-danger' : 'text-muted-foreground'}>Diferença: {money(w.net)}</span></div><div className="space-y-2"><div className="flex items-center gap-3"><ArrowDownLeft className="h-3.5 w-3.5 text-success shrink-0" aria-hidden="true" /><div className="h-2 flex-1 bg-muted rounded-full overflow-hidden" aria-hidden="true"><div className="h-full bg-success rounded-full" style={{ width: `${w.incoming / peak * 100}%` }} /></div><span className="text-xs tabular-nums whitespace-nowrap"><span className="sr-only">Entradas: </span>{money(w.incoming)}</span></div><div className="flex items-center gap-3"><ArrowUpRight className="h-3.5 w-3.5 text-danger shrink-0" aria-hidden="true" /><div className="h-2 flex-1 bg-muted rounded-full overflow-hidden" aria-hidden="true"><div className="h-full bg-danger rounded-full" style={{ width: `${w.outgoing / peak * 100}%` }} /></div><span className="text-xs tabular-nums whitespace-nowrap"><span className="sr-only">Saídas: </span>{money(w.outgoing)}</span></div></div></div>)}</div></section>
      <section className="rounded-xl border border-border bg-card overflow-hidden min-w-0"><div className="p-4 border-b border-border"><h2 className="font-semibold">Lançamentos para conferir</h2><div className="flex flex-wrap gap-2 mt-3"><Button variant={overdueView ? 'outline' : 'default'} size="sm" aria-pressed={!overdueView} onClick={() => change('view', 'upcoming')}>No período ({plan.upcoming.length})</Button><Button variant={overdueView ? 'default' : 'outline'} size="sm" aria-pressed={overdueView} onClick={() => change('view', 'overdue')}>Vencidos ({plan.overdue.length})</Button></div></div><div className="px-4">{rows.length === 0 ? <p className="text-sm text-muted-foreground py-6">Nenhum lançamento em aberto neste recorte.</p> : <Entries rows={rows.slice(0, limit)} />}{rows.length > limit && <Button variant="outline" size="sm" className="my-4" onClick={() => setLimit(l => l + 30)}>Mostrar mais ({rows.length - limit})</Button>}</div></section>
    </div>
    <footer className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><p>{plan.later.length} lançamento(s) com vencimento após {formatDate(plan.end)}, fora do período.</p><Link to="/financial/conferencia" className="text-primary">Abrir conferência financeira</Link></footer>
  </div>
}
