import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckSquare, Receipt, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/data-access'
import { clientInvoicesPath, clientTaskSummary, clientTasksPath, type ClientTask } from '@/lib/client-management'
import { isOperatingClient, isOpenInvoice, isOverdueInvoice, localDateISO, receivedInMonth } from '@/lib/management-metrics'
import { monthKeyOfDate, monthLabel } from '@/lib/months'
import { Client, Delivery, Interaction, Invoice, STATUS_CONFIG, DELIVERY_STATUS_CONFIG, emPermutaNoMes, formatCurrency, formatDate, formatTimestamp } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DataLoadError from '@/components/DataLoadError'

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-xl border border-border bg-card overflow-hidden min-w-0"><div className="flex items-center justify-between gap-3 border-b border-border p-4"><h2 className="font-semibold">{title}</h2>{action}</div><div className="p-4">{children}</div></section>
}

function Loading() { return <p role="status" className="py-4 text-sm text-muted-foreground">Carregando registros...</p> }

export default function ClientManagement() {
  const { clientId = '' } = useParams()
  const { user, can } = useAuth()
  const financeAllowed = can('admin')
  const client = useQuery({
    queryKey: ['client-management', user?.id, clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle()
      if (error) throw error
      return data as Client | null
    },
    enabled: !!clientId,
  })
  const enabled = !!client.data
  const tasks = useQuery({
    queryKey: ['client-management-tasks', user?.id, clientId], enabled,
    queryFn: () => fetchAllRows<ClientTask>((from, to) => supabase.from('tarefas').select('id, cliente_id, titulo, status, prazo, dono_id, dono_nome, prioridade').eq('cliente_id', clientId).order('prazo').order('id').range(from, to)),
  })
  const deliveries = useQuery({
    queryKey: ['client-management-deliveries', user?.id, clientId], enabled,
    queryFn: () => fetchAllRows<Delivery>((from, to) => supabase.from('deliveries').select('*').eq('client_id', clientId).order('prazo', { ascending: false }).order('id').range(from, to)),
  })
  const history = useQuery({
    queryKey: ['client-management-history', user?.id, clientId], enabled,
    queryFn: () => fetchAllRows<Interaction>((from, to) => supabase.from('interactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).order('id').range(from, to)),
  })
  const invoices = useQuery({
    queryKey: ['client-management-invoices', user?.id, clientId], enabled: enabled && financeAllowed,
    queryFn: () => fetchAllRows<Invoice>((from, to) => supabase.from('invoices').select('*').eq('client_id', clientId).order('vencimento', { ascending: false }).order('id').range(from, to)),
  })
  const refresh = () => {
    void client.refetch()
    if (enabled) {
      void tasks.refetch(); void deliveries.refetch(); void history.refetch()
      if (financeAllowed) void invoices.refetch()
    }
  }
  if (client.isLoading) return <Loading />
  if (client.isError) return <DataLoadError onRetry={() => { void client.refetch() }} />
  const c = client.data
  if (!c) return <div className="space-y-4"><p>Cliente não encontrado ou indisponível para este acesso.</p><Button asChild variant="outline"><Link to="/clients">Voltar para clientes</Link></Button></div>

  const today = localDateISO()
  const month = monthKeyOfDate(new Date())
  const summary = clientTaskSummary(tasks.data || [], today)
  const invoiceRows = invoices.data || []
  const openInvoices = invoiceRows.filter(isOpenInvoice)
  const overdue = invoiceRows.filter(i => isOverdueInvoice(i, today))
  const status = STATUS_CONFIG[c.status]
  const barter = emPermutaNoMes(c, month)
  const pendingDates = invoiceRows.filter(i => i.status === 'pago' && !i.data_pagamento).length
  const contractValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c.currency === 'USD' ? 'USD' : 'BRL' }).format(Number(c.mrr))

  return <div className="space-y-5 min-w-0 animate-fade-in">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Carteira de clientes</Link><Button variant="outline" size="sm" onClick={refresh} disabled={client.isFetching || tasks.isFetching || deliveries.isFetching || history.isFetching || invoices.isFetching}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button></div>
    <header className="rounded-xl border border-border bg-card p-5 sm:p-7 border-l-4 border-l-primary">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Gestão do cliente</p>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl sm:text-3xl font-semibold break-words">{c.name}</h1><Badge variant="outline" className={status?.className}>{status?.label || c.status}</Badge>{barter && <Badge variant="outline">Permuta em {monthLabel(month)}</Badge>}</div>
      <p className="text-muted-foreground text-sm mt-2">{[c.company, c.segment].filter(Boolean).join(' · ')}</p>
      <div className="flex flex-wrap gap-2 mt-5"><Button asChild size="sm"><Link to={clientTasksPath(c.id)}><CheckSquare className="h-4 w-4 mr-2" /> Demandas do cliente</Link></Button>{financeAllowed && <Button asChild variant="outline" size="sm"><Link to={clientInvoicesPath(c.id)}><Receipt className="h-4 w-4 mr-2" /> Abrir faturas</Link></Button>}</div>
    </header>

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        <Section title="Próximas demandas" action={<Link to={clientTasksPath(c.id)} className="text-sm text-primary inline-flex items-center gap-1">Ver todas <ArrowUpRight className="h-4 w-4" /></Link>}>
          {tasks.isError ? <DataLoadError onRetry={() => { void tasks.refetch() }} /> : tasks.isLoading ? <Loading /> : <>
            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-border mb-2">{[[summary.open.length, 'Em aberto'], [summary.overdue.length, 'Atrasadas'], [summary.incomplete.length, 'Sem dono ou prazo']].map(([value, label]) => <div key={label} className="min-w-0"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
            {summary.queue.length === 0 ? <p className="text-sm text-muted-foreground py-3">Nenhuma demanda em aberto vinculada a este cliente.</p> : <ul className="divide-y divide-border">{summary.queue.slice(0, 8).map(task => <li key={task.id}><Link to={clientTasksPath(c.id, task.id)} className="flex justify-between gap-3 py-3 hover:text-primary"><div className="min-w-0"><p className="font-medium text-sm break-words">{task.titulo}</p><p className="text-xs text-muted-foreground mt-1">{task.dono_nome || 'Responsável não informado'} · {task.status === 'fazendo' ? 'Em execução' : 'Em aberto'}</p></div><span className={`text-xs shrink-0 ${task.prazo && task.prazo < today ? 'text-danger' : 'text-muted-foreground'}`}>{task.prazo ? formatDate(task.prazo) : 'Sem prazo'}</span></Link></li>)}</ul>}
            <p className="mt-3">{can('manager') && <Link className="text-sm text-primary" to={`/operacional/carga?client=${encodeURIComponent(c.id)}`}>Ver carga da equipe neste cliente</Link>}</p>
            <p className="text-xs text-muted-foreground mt-3">Demandas vinculadas no cadastro da Central. Conteúdos do Organizador seguem na sua própria fila.</p>
          </>}
        </Section>

        {financeAllowed && <Section title="Cobranças e recebimentos" action={<Link className="text-sm text-primary" to={`/financial/conferencia?client=${encodeURIComponent(c.id)}`}>Conferir registros</Link>}>
          {invoices.isError ? <DataLoadError onRetry={() => { void invoices.refetch() }} /> : invoices.isLoading ? <Loading /> : <>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">{[[formatCurrency(openInvoices.reduce((sum, i) => sum + Number(i.valor), 0)), 'Em aberto · todos os meses'], [formatCurrency(overdue.reduce((sum, i) => sum + Number(i.valor), 0)), 'Vencido e em aberto'], [formatCurrency(receivedInMonth(invoiceRows, month)), `Recebido em ${monthLabel(month)}`]].map(([value, label]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold text-xl tabular-nums mt-1">{value}</p></div>)}</div>
            {pendingDates > 0 && <p role="alert" className="text-sm text-warning mb-3">{pendingDates} recebimento(s) sem data, fora dos totais mensais. Abra a conferência para completar.</p>}
            {invoiceRows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma fatura vinculada. Isso não comprova quitação do contrato.</p> : <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm [&_th]:pr-4 [&_td]:pr-4"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-2 font-medium">Vencimento</th><th className="font-medium">Valor</th><th className="font-medium">Situação</th><th className="font-medium">Recebimento</th></tr></thead><tbody>{invoiceRows.slice(0, 12).map(i => <tr key={i.id} className="border-b border-border/50"><td className="py-3 whitespace-nowrap">{formatDate(i.vencimento)}</td><td className="whitespace-nowrap pr-3 tabular-nums">{formatCurrency(i.valor)}</td><td className="pr-3 capitalize">{i.status}</td><td className="whitespace-nowrap">{i.data_pagamento ? formatDate(i.data_pagamento) : 'Não registrado'}</td></tr>)}</tbody></table></div>}
            <ul className="sm:hidden divide-y divide-border">{invoiceRows.slice(0, 12).map(i => <li key={i.id} className="py-3 space-y-2"><div className="flex justify-between gap-3"><span className="font-semibold tabular-nums">{formatCurrency(i.valor)}</span><Badge variant="outline" className="capitalize">{i.status}</Badge></div><p className="text-xs text-muted-foreground">Vencimento: {formatDate(i.vencimento)}</p><p className="text-xs text-muted-foreground">Recebimento: {i.data_pagamento ? formatDate(i.data_pagamento) : 'Não registrado'}</p></li>)}</ul>
            <p className="text-xs text-muted-foreground mt-3">{invoiceRows.length > 12 ? `Exibindo 12 de ${invoiceRows.length} faturas. ` : ''}Valores dos lançamentos em reais. Recebimentos por data registrada, ainda sujeitos à conciliação.</p>
          </>}
        </Section>}

        <Section title="Entregas registradas">
          {deliveries.isError ? <DataLoadError onRetry={() => { void deliveries.refetch() }} /> : deliveries.isLoading ? <Loading /> : !deliveries.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma entrega vinculada neste módulo.</p> : <ul className="divide-y divide-border">{deliveries.data.slice(0, 8).map(d => <li key={d.id} className="py-3 flex flex-wrap justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium break-words">{d.titulo}</p><p className="text-xs text-muted-foreground mt-1">Prazo: {d.prazo ? formatDate(d.prazo) : 'Não informado'}{d.data_entrega ? ` · Entregue em ${formatDate(d.data_entrega)}` : ''}</p></div><Badge variant="outline" className="h-fit">{DELIVERY_STATUS_CONFIG[d.status]?.label || d.status}</Badge></li>)}</ul>}
          {!!deliveries.data && deliveries.data.length > 8 && <p className="text-xs text-muted-foreground mt-3">8 de {deliveries.data.length} entregas, ordenadas pelo prazo mais recente.</p>}
        </Section>
      </div>
      <aside className="space-y-5 min-w-0">
        <Section title="Contrato e cadastro">
          <p className="text-3xl font-semibold tabular-nums">{contractValue}<span className="text-sm font-normal text-muted-foreground"> / mês</span></p><p className="text-xs text-muted-foreground mt-2">{isOperatingClient(c) ? 'Valor mensal cadastrado' : 'Valor do contrato encerrado, fora do MRR atual'}</p>
          <dl className="text-sm divide-y divide-border mt-4">{[['Plano', c.plano || 'Não informado'], ['Início', c.inicio_contrato ? formatDate(c.inicio_contrato) : 'Não informado'], ['Vencimento', c.dia_vencimento ? `Dia ${c.dia_vencimento}` : 'Não informado'], ['Primeira cobrança', c.cobranca_inicio ? formatDate(c.cobranca_inicio) : 'Conforme início e vencimento'], ['Telefone', c.phone || 'Não informado'], ['Email', c.email || 'Não informado']].map(([label, value]) => <div key={label} className="py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl>
          {c.notes && <div className="pt-3 border-t border-border"><h3 className="text-xs text-muted-foreground mb-2">Anotações do cadastro</h3><p className="text-sm whitespace-pre-wrap break-words">{c.notes}</p></div>}
        </Section>
        <Section title="Histórico de relacionamento">
          {history.isError ? <DataLoadError onRetry={() => { void history.refetch() }} /> : history.isLoading ? <Loading /> : !history.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma interação registrada para este cliente.</p> : <ol className="space-y-4">{history.data.slice(0, 8).map(h => <li key={h.id} className="border-l-2 border-primary/30 pl-3"><p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatTimestamp(h.created_at)} · {h.tipo}</p><p className="text-sm mt-1 whitespace-pre-wrap break-words">{h.descricao}</p></li>)}</ol>}
          {!!history.data && history.data.length > 8 && <p className="text-xs text-muted-foreground mt-3">8 de {history.data.length} interações, das mais recentes para as antigas.</p>}
        </Section>
      </aside>
    </div>
  </div>
}
