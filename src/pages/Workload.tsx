import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, RefreshCw, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/data-access'
import { localDateISO } from '@/lib/management-metrics'
import { filterWork, groupWork, shiftDay, taskOverdue, taskUndated, workTaskPath, WORK_FILTERS, type WorkFilter, type WorkTask } from '@/lib/operations-planning'
import { formatDate } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DataLoadError from '@/components/DataLoadError'

const selectClass = 'w-full sm:w-auto rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0'

export default function Workload() {
  const { user, can } = useAuth()
  const allowed = can('manager')
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(30)
  const filter: WorkFilter = WORK_FILTERS.find(f => f.value === params.get('filter'))?.value || 'all'
  const client = params.get('client') || ''
  const person = params.get('person') || ''
  const today = localDateISO()
  const tasks = useQuery({
    queryKey: ['workload', user?.id], enabled: allowed,
    queryFn: () => fetchAllRows<WorkTask>((from, to) => supabase.from('tarefas').select('id, titulo, cliente_id, cliente_nome, dono_id, dono_nome, prazo, status, prioridade').in('status', ['aberta', 'fazendo']).order('id').range(from, to)),
  })
  const people = useQuery({
    queryKey: ['workload-people', user?.id], enabled: allowed,
    queryFn: () => fetchAllRows<{ user_id: string; name: string }>((from, to) => supabase.from('profiles').select('user_id, name').order('user_id').range(from, to)),
  })
  const change = (key: string, value: string) => {
    setLimit(30)
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); if (key !== 'person') next.delete('person'); return next })
  }
  if (!allowed) return <p>Esta visão está disponível para gestores e administradores.</p>
  if (tasks.isError) return <DataLoadError onRetry={() => { void tasks.refetch() }} />
  if (tasks.isLoading) return <p role="status">Carregando demandas...</p>

  const all = tasks.data || []
  const names = new Map((people.data || []).map(p => [p.user_id, p.name]))
  const clientNames = new Map(all.filter(t => t.cliente_id).map(t => [t.cliente_id!, t.cliente_nome || 'Cliente sem nome']))
  const scoped = filterWork(all, today, filter, client)
  const groups = groupWork(scoped, today, names)
  const queue = person ? scoped.filter(t => (t.dono_id || 'unassigned') === person) : scoped
  const counts = WORK_FILTERS.map(f => ({ ...f, count: filterWork(all, today, f.value, client).length }))
  const max = Math.max(1, ...groups.map(g => g.tasks.length))

  return <div className="space-y-5 min-w-0 animate-fade-in">
    <header className="flex flex-wrap justify-between gap-4 items-start"><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Planejamento operacional</p><h1 className="text-2xl sm:text-3xl font-semibold">Carga de demandas</h1><p className="text-sm text-muted-foreground mt-2 max-w-2xl">Veja a fila por responsável e abra cada demanda para ajustar dono, prazo ou prioridade.</p></div><Button variant="outline" size="sm" disabled={tasks.isFetching || people.isFetching} onClick={() => { void tasks.refetch(); void people.refetch() }}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button></header>
    <div className="flex flex-wrap items-end gap-3"><label className="flex flex-col gap-1.5 text-xs text-muted-foreground w-full sm:w-auto">Cliente<select aria-label="Cliente" className={selectClass} value={client} onChange={e => change('client', e.target.value)}><option value="">Todos os clientes</option><option value="unlinked">Sem cliente vinculado</option>{[...clientNames].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>{params.toString() && <Button variant="ghost" size="sm" onClick={() => { setParams({}); setLimit(30) }}>Limpar filtros</Button>}<Link to="/content/organizador?periodo=all&filtro=overdue" className="text-sm text-primary sm:ml-auto py-2 inline-flex items-center gap-1">Ver atrasos do Organizador <ArrowUpRight className="h-4 w-4" /></Link></div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">{counts.map(f => <button key={f.value} aria-pressed={filter === f.value} onClick={() => change('filter', f.value)} className={`text-left rounded-xl border p-4 transition-colors ${filter === f.value ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'}`}><span className={`block text-3xl font-semibold tabular-nums ${f.value === 'overdue' && f.count ? 'text-danger' : ''}`}>{f.count}</span><span className="text-xs text-muted-foreground block mt-2">{f.label}</span></button>)}</div>
    <p className="text-xs text-muted-foreground">Próximos 7 dias: {formatDate(today)} a {formatDate(shiftDay(today, 6))}</p>
    <div className="grid xl:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)] gap-5 items-start">
      <section className="border border-border rounded-xl bg-card overflow-hidden"><div className="p-4 border-b border-border flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="font-semibold">Por responsável</h2></div><div className="p-4 space-y-3">
        {people.isError && <p role="alert" className="text-xs text-warning">Não foi possível atualizar os nomes da equipe. Exibindo os nomes registrados nas demandas.</p>}
        <button className={`w-full text-left text-sm py-2 ${!person ? 'text-primary font-medium' : 'text-muted-foreground'}`} onClick={() => change('person', '')}>Todos neste recorte · {scoped.length}</button>
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma demanda neste recorte.</p>}
        {groups.map(g => <button key={g.id} aria-pressed={person === g.id} onClick={() => change('person', g.id)} className={`w-full text-left rounded-lg p-3 border transition-colors ${person === g.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}`}><div className="flex justify-between gap-3"><span className="font-medium text-sm break-words">{g.name}</span><span className="tabular-nums font-semibold">{g.tasks.length}</span></div><div className="h-1.5 rounded-full bg-muted mt-3 overflow-hidden" aria-hidden="true"><div className="h-full bg-primary rounded-full" style={{ width: `${g.tasks.length / max * 100}%` }} /></div><p className="text-xs text-muted-foreground mt-2">{g.overdue} atrasada(s) · {g.doing} em execução · {g.undated} sem prazo</p></button>)}
      </div></section>
      <section className="border border-border rounded-xl bg-card overflow-hidden min-w-0"><div className="p-4 border-b border-border"><h2 className="font-semibold">Fila para organizar <span className="text-muted-foreground font-normal">· {queue.length}</span></h2><p className="text-xs text-muted-foreground mt-1">Atrasadas primeiro, depois prazo e prioridade.</p></div><div className="px-4">
        {queue.length === 0 ? <p className="text-sm text-muted-foreground py-6">Nenhuma demanda nos filtros selecionados.</p> : <ul className="divide-y divide-border">{queue.slice(0, limit).map(t => <li key={t.id}><Link to={workTaskPath(t)} className="flex flex-wrap sm:flex-nowrap justify-between gap-3 py-4 hover:text-primary"><div className="min-w-0"><p className="font-medium text-sm break-words">{t.titulo}</p><p className="text-xs text-muted-foreground mt-1 break-words">{t.cliente_nome || (t.cliente_id ? 'Cliente sem nome' : 'Sem cliente vinculado')} · {t.dono_id ? names.get(t.dono_id) || t.dono_nome || 'Responsável sem nome' : 'Sem responsável'}</p></div><div className="flex sm:flex-col gap-2 sm:items-end shrink-0"><span className={`text-xs ${taskOverdue(t, today) ? 'text-danger font-medium' : 'text-muted-foreground'}`}>{taskUndated(t) ? 'Sem prazo válido' : formatDate(t.prazo!)}</span><Badge variant="outline" className="text-[10px]">{t.status === 'fazendo' ? 'Em execução' : t.prioridade === 'alta' ? 'Prioridade alta' : 'Em aberto'}</Badge></div></Link></li>)}</ul>}
        {queue.length > limit && <Button variant="outline" size="sm" className="my-4" onClick={() => setLimit(l => l + 30)}>Mostrar mais ({queue.length - limit})</Button>}
      </div></section>
    </div>
    <p className="text-xs text-muted-foreground border-t border-border pt-4">Contagem das demandas abertas e em execução na Central. Quantidade não mede horas disponíveis nem produtividade. Conteúdos do Organizador e tarefas ainda exclusivas do ClickUp não estão somados aqui.</p>
  </div>
}
