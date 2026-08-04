import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  Loader2, CheckCircle2, XCircle, Clock, Eye, ExternalLink,
  TrendingUp, MessageSquare, Wallet, RefreshCw, Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface Report {
  id: number
  slug: string
  approval_token: string
  cliente_label: string
  account_id: string
  period_start: string
  period_end: string
  spend_cents: number
  reach: number
  conv_count: number
  link_clicks: number
  cpmsg_cents: number | null
  ig_followers_gained_7d: number | null
  ig_followers: number | null
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'failed'
  approved_by_name: string | null
  rejected_reason: string | null
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  pending:  { label: 'Pendente',  cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30',       icon: Clock },
  approved: { label: 'Aprovado',  cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
  sent:     { label: 'Enviado',   cls: 'bg-sky-500/15 text-sky-600 border-sky-500/30',             icon: CheckCircle2 },
  rejected: { label: 'Reprovado', cls: 'bg-rose-500/15 text-rose-600 border-rose-500/30',          icon: XCircle },
  failed:   { label: 'Falhou',    cls: 'bg-rose-500/15 text-rose-600 border-rose-500/30',          icon: XCircle },
}

const brl = (cents: number | null | undefined) =>
  ((cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) => {
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}`
}

export default function AnunciosPerformance() {
  const [semana, setSemana] = useState<string>('')
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['weekly-traffic-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_traffic_reports')
        .select('id,slug,approval_token,cliente_label,account_id,period_start,period_end,spend_cents,reach,conv_count,link_clicks,cpmsg_cents,status,approved_by_name,rejected_reason,ig_followers_gained_7d,ig_followers')
        .order('period_end', { ascending: false })
        .limit(1000)
      if (error) throw error
      return (data || []) as Report[]
    },
  })

  const semanas = useMemo(() => {
    const s = Array.from(new Set((data || []).map(r => r.period_end)))
    return s.sort().reverse()
  }, [data])

  const semanaAtiva = semana || semanas[0] || ''

  const doPeriodo = useMemo(
    () => (data || []).filter(r => r.period_end === semanaAtiva),
    [data, semanaAtiva],
  )

  const filtrados = useMemo(() => {
    if (statusFiltro === 'todos') return doPeriodo
    return doPeriodo.filter(r => r.status === statusFiltro)
  }, [doPeriodo, statusFiltro])

  const kpis = useMemo(() => {
    const investido = doPeriodo.reduce((s, r) => s + (r.spend_cents || 0), 0)
    const conversas = doPeriodo.reduce((s, r) => s + (r.conv_count || 0), 0)
    return {
      investido,
      conversas,
      custoConversa: conversas > 0 ? investido / conversas : null,
      seguidores: doPeriodo.reduce((s, r) => s + (r.ig_followers_gained_7d || 0), 0),
      pendentes: doPeriodo.filter(r => r.status === 'pending').length,
    }
  }, [doPeriodo])

  const contagem = (st: string) =>
    st === 'todos' ? doPeriodo.length : doPeriodo.filter(r => r.status === st).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Performance de Anúncios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os relatórios semanais de tráfego. Revise e aprove aqui — o aprovado a Sofia manda pro grupo do cliente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={semanaAtiva} onValueChange={setSemana}>
            <SelectTrigger className="w-[210px]">
              <SelectValue placeholder="Semana" />
            </SelectTrigger>
            <SelectContent>
              {semanas.map(s => {
                const r = (data || []).find(x => x.period_end === s)
                return (
                  <SelectItem key={s} value={s}>
                    {r ? `${fmtDate(r.period_start)} a ${fmtDate(s)}` : s}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* KPIs da semana */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={Wallet} label="Investido na semana" value={brl(kpis.investido)} />
        <Kpi icon={MessageSquare} label="Conversas" value={String(kpis.conversas)} />
        <Kpi icon={Users} label="Seguidores ganhos" value={`+${kpis.seguidores}`} />
        <Kpi icon={TrendingUp} label="Custo por conversa" value={kpis.custoConversa ? brl(kpis.custoConversa) : '—'} />
        <Kpi icon={Clock} label="Aguardando aprovação" value={String(kpis.pendentes)} highlight={kpis.pendentes > 0} />
      </div>

      <Tabs value={statusFiltro} onValueChange={setStatusFiltro}>
        <TabsList className="flex-wrap h-auto">
          {['todos', 'pending', 'approved', 'sent', 'rejected'].map(st => (
            <TabsTrigger key={st} value={st} className="gap-1.5">
              {st === 'todos' ? 'Todos' : STATUS_CFG[st]?.label || st}
              <span className="text-xs opacity-70">({contagem(st)})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtrados.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          Nenhum relatório nesse filtro.
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(r => {
            const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending
            const Icon = cfg.icon
            return (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{r.cliente_label}</p>
                      <Badge variant="outline" className={cn('shrink-0 gap-1', cfg.cls)}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmtDate(r.period_start)} a {fmtDate(r.period_end)}
                      {r.approved_by_name ? ` · por ${r.approved_by_name}` : ''}
                      {r.rejected_reason ? ` · ${r.rejected_reason}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 text-sm shrink-0">
                    <Metric label="investido" value={brl(r.spend_cents)} />
                    <Metric label="conversas" value={String(r.conv_count || 0)} />
                    <Metric label="custo/conv" value={r.cpmsg_cents ? brl(r.cpmsg_cents) : '—'} />
                    <Metric label="seguidores" value={r.ig_followers_gained_7d ? `+${r.ig_followers_gained_7d}` : '—'} />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/r/trafego/${r.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </a>
                    {r.status === 'pending' && (
                      <a
                        href={`/aprovar/trafego/${r.slug}?token=${r.approval_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        Aprovar <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={cn('border-border', highlight && 'border-amber-500/40 bg-amber-500/5')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
          </div>
          <Icon className={cn('h-4 w-4', highlight ? 'text-amber-500' : 'text-muted-foreground')} />
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-sm">{value}</p>
    </div>
  )
}
