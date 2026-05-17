import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Sparkles, AlertTriangle, Users, GitBranch } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber, formatDelta, dateWindow, delta } from '@/lib/painel/format'
import { usePainelContext } from '@/components/PainelLayout'
import { OnboardingChecklist } from '@/components/painel/OnboardingChecklist'
import { cn } from '@/lib/utils'

function Stat({
  label, value, delta: d, hint, loading, sparkline,
}: {
  label: string; value: string; delta?: number; hint?: string; loading?: boolean
  sparkline?: { date: string; value: number }[]
}) {
  const positive = typeof d === 'number' && d >= 0
  if (loading) return (
    <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-28" /></CardContent></Card>
  )
  const sparkId = `grad-${label.replace(/\s/g, '')}`
  return (
    <Card>
      <CardContent className="p-6 relative overflow-hidden">
        <div className="text-sm text-muted-foreground font-medium">{label}</div>
        <div className="text-3xl font-semibold tracking-tighter tabular-nums mt-2">{value}</div>
        <div className="flex items-center gap-2 mt-3 text-xs">
          {typeof d === 'number' && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatDelta(d)}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
        {sparkline && sparkline.length > 1 && (
          <div className="absolute bottom-0 right-0 w-1/2 h-12 opacity-50 pointer-events-none text-primary">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <defs>
                  <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="currentColor" strokeWidth={1.5} fill={`url(#${sparkId})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const FUNNEL_ORDER: { key: string; label: string }[] = [
  { key: 'new', label: 'Novos' },
  { key: 'contacted', label: 'Contatado' },
  { key: 'qualified', label: 'Qualificado' },
  { key: 'meeting', label: 'Reunião' },
  { key: 'proposal', label: 'Proposta' },
  { key: 'won', label: 'Ganhou' },
]

const SOURCE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function PainelDashboard() {
  const { client, slug } = usePainelContext()
  const curr = dateWindow(30, 0)
  const prev = dateWindow(30, 30)

  const { data, isLoading } = useQuery({
    queryKey: ['painel-dashboard-v2', client.id],
    queryFn: async () => {
      const [
        { count: leadsCurr },
        { count: leadsPrev },
        { data: leadsLast30 },
        { data: metricsCurr },
        { data: metricsPrev },
        { data: insights },
        { data: alerts },
      ] = await Promise.all([
        supabase.from('painel_leads').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).gte('created_at', curr.start).lt('created_at', curr.end),
        supabase.from('painel_leads').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).gte('created_at', prev.start).lt('created_at', prev.end),
        supabase.from('painel_leads').select('id, status, source, created_at')
          .eq('client_id', client.id).gte('created_at', curr.start),
        supabase.from('painel_campaign_metrics_daily').select('spend_brl, leads, date')
          .eq('client_id', client.id).gte('date', curr.start.slice(0, 10)).lt('date', curr.end.slice(0, 10)),
        supabase.from('painel_campaign_metrics_daily').select('spend_brl, leads')
          .eq('client_id', client.id).gte('date', prev.start.slice(0, 10)).lt('date', prev.end.slice(0, 10)),
        supabase.from('painel_insights').select('id, title, body, severity, created_at')
          .eq('client_id', client.id).eq('status', 'unread').order('created_at', { ascending: false }).limit(5),
        supabase.from('painel_alerts').select('id, title, body, severity, created_at')
          .eq('client_id', client.id).is('resolved_at', null).order('created_at', { ascending: false }).limit(5),
      ])

      const spendCurr = (metricsCurr || []).reduce((s, r: any) => s + Number(r.spend_brl || 0), 0)
      const leadsAdsCurr = (metricsCurr || []).reduce((s, r: any) => s + Number(r.leads || 0), 0)
      const spendPrev = (metricsPrev || []).reduce((s, r: any) => s + Number(r.spend_brl || 0), 0)
      const leadsAdsPrev = (metricsPrev || []).reduce((s, r: any) => s + Number(r.leads || 0), 0)
      const cplCurr = leadsAdsCurr > 0 ? spendCurr / leadsAdsCurr : 0
      const cplPrev = leadsAdsPrev > 0 ? spendPrev / leadsAdsPrev : 0

      // Sparkline leads 30d
      const days: Record<string, number> = {}
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        days[d.toISOString().slice(0, 10)] = 0
      }
      ;(leadsLast30 || []).forEach((l: any) => {
        const k = (l.created_at as string).slice(0, 10)
        if (k in days) days[k]++
      })
      const leadsSparkline = Object.entries(days).map(([date, value]) => ({ date, value }))

      // Sparkline spend 30d
      const spendDays: Record<string, number> = { ...Object.fromEntries(Object.keys(days).map(k => [k, 0])) }
      ;(metricsCurr || []).forEach((m: any) => {
        const k = (m.date as string).slice(0, 10)
        if (k in spendDays) spendDays[k] += Number(m.spend_brl || 0)
      })
      const spendSparkline = Object.entries(spendDays).map(([date, value]) => ({ date, value }))

      const funnel = FUNNEL_ORDER.map(s => ({
        ...s,
        count: (leadsLast30 || []).filter((l: any) => l.status === s.key).length,
      }))

      const sourceMap = new Map<string, number>()
      ;(leadsLast30 || []).forEach((l: any) => {
        const k = l.source || 'direto'
        sourceMap.set(k, (sourceMap.get(k) || 0) + 1)
      })
      const sources = [...sourceMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)

      return {
        leadsCurr: leadsCurr || 0, leadsPrev: leadsPrev || 0,
        spendCurr, spendPrev, cplCurr, cplPrev,
        leadsAdsCurr, leadsAdsPrev,
        leadsSparkline, spendSparkline,
        funnel, sources,
        insights: insights || [], alerts: alerts || [],
      }
    },
  })

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Visão geral · últimos 30 dias</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Olá, bem-vindo de volta.</h1>
        <p className="text-muted-foreground mt-1">Como sua operação está performando agora.</p>
      </div>

      <OnboardingChecklist clientId={client.id} slug={slug} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Leads" value={formatNumber(data?.leadsCurr || 0)}
              delta={data ? delta(data.leadsCurr, data.leadsPrev) : undefined}
              hint="vs 30d" loading={isLoading} sparkline={data?.leadsSparkline} />
        <Stat label="Investido" value={formatCurrency(data?.spendCurr || 0)}
              delta={data ? delta(data.spendCurr, data.spendPrev) : undefined}
              hint="Meta + Google" loading={isLoading} sparkline={data?.spendSparkline} />
        <Stat label="Custo por Lead" value={data && data.cplCurr > 0 ? formatCurrency(data.cplCurr) : '—'}
              delta={data && data.cplPrev > 0 ? delta(data.cplCurr, data.cplPrev) : undefined}
              hint="média período" loading={isLoading} />
        <Stat label="Leads de campanha" value={formatNumber(data?.leadsAdsCurr || 0)}
              delta={data ? delta(data.leadsAdsCurr, data.leadsAdsPrev) : undefined}
              hint="ads pagos" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><GitBranch className="w-4 h-4" />Funil de leads</CardTitle>
            <CardDescription>Cada etapa, últimos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-7 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {(data?.funnel || []).map((stage) => {
                  const max = Math.max(...(data?.funnel || []).map(s => s.count), 1)
                  const width = (stage.count / max) * 100
                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground shrink-0">{stage.label}</div>
                      <div className="flex-1 h-7 bg-muted rounded-md relative overflow-hidden">
                        <div className="h-full bg-primary/30 transition-all" style={{ width: `${width}%` }} />
                        <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{stage.count}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Origens de leads</CardTitle>
            <CardDescription>De onde vieram seus leads.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.sources || []).length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Sem dados ainda.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={data!.sources} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {data!.sources.map((_, idx) => (
                        <Cell key={idx} fill={SOURCE_COLORS[idx % SOURCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-1.5 text-xs">
                  {data!.sources.map((s, idx) => (
                    <li key={s.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: SOURCE_COLORS[idx % SOURCE_COLORS.length] }} />
                      <span className="truncate flex-1">{s.name}</span>
                      <span className="tabular-nums text-muted-foreground">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" />Insights da IA</CardTitle>
                <CardDescription>Análises automáticas do que está funcionando.</CardDescription>
              </div>
              <Badge variant="secondary">{data?.insights.length || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(!isLoading && (data?.insights || []).length === 0) && (
              <p className="text-sm text-muted-foreground">Sem insights novos. A IA analisa sua operação diariamente.</p>
            )}
            {data?.insights.map((i: any) => (
              <div key={i.id} className="py-2 border-b last:border-0">
                <div className="text-sm font-medium">{i.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{i.body}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Alertas</CardTitle>
                <CardDescription>O que precisa da sua atenção agora.</CardDescription>
              </div>
              <Badge variant={(data?.alerts.length || 0) > 0 ? 'destructive' : 'secondary'}>{data?.alerts.length || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(!isLoading && (data?.alerts || []).length === 0) && (
              <p className="text-sm text-muted-foreground">Sem alertas. Tudo no controle.</p>
            )}
            {data?.alerts.map((a: any) => (
              <div key={a.id} className="py-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant={a.severity === 'critical' || a.severity === 'high' ? 'destructive' : 'secondary'}>{a.severity}</Badge>
                  <div className="text-sm font-medium">{a.title}</div>
                </div>
                {a.body && <div className="text-xs text-muted-foreground mt-1 ml-1">{a.body}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
