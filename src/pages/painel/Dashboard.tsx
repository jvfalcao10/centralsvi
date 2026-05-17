import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Sparkles, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber, formatDelta, dateWindow, delta } from '@/lib/painel/format'
import { usePainelContext } from '@/components/PainelLayout'
import { cn } from '@/lib/utils'

function Stat({ label, value, delta: d, hint, loading }: { label: string; value: string; delta?: number; hint?: string; loading?: boolean }) {
  const positive = typeof d === 'number' && d >= 0
  if (loading) return (
    <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-28" /></CardContent></Card>
  )
  return (
    <Card>
      <CardContent className="p-6">
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
      </CardContent>
    </Card>
  )
}

export default function PainelDashboard() {
  const { client } = usePainelContext()
  const curr = dateWindow(30, 0)
  const prev = dateWindow(30, 30)

  const { data, isLoading } = useQuery({
    queryKey: ['painel-dashboard', client.id],
    queryFn: async () => {
      const [{ count: leadsCurr }, { count: leadsPrev }, { data: metricsCurr }, { data: metricsPrev }, { data: insights }, { data: alerts }] = await Promise.all([
        supabase.from('painel_leads').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('created_at', curr.start).lt('created_at', curr.end),
        supabase.from('painel_leads').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('created_at', prev.start).lt('created_at', prev.end),
        supabase.from('painel_campaign_metrics_daily').select('spend_brl, leads').eq('client_id', client.id).gte('date', curr.start.slice(0, 10)).lt('date', curr.end.slice(0, 10)),
        supabase.from('painel_campaign_metrics_daily').select('spend_brl, leads').eq('client_id', client.id).gte('date', prev.start.slice(0, 10)).lt('date', prev.end.slice(0, 10)),
        supabase.from('painel_insights').select('id, title, body, severity, created_at').eq('client_id', client.id).eq('status', 'unread').order('created_at', { ascending: false }).limit(5),
        supabase.from('painel_alerts').select('id, title, body, severity, created_at').eq('client_id', client.id).is('resolved_at', null).order('created_at', { ascending: false }).limit(5),
      ])
      const spendCurr = (metricsCurr ?? []).reduce((s, r: any) => s + Number(r.spend_brl ?? 0), 0)
      const leadsAdsCurr = (metricsCurr ?? []).reduce((s, r: any) => s + Number(r.leads ?? 0), 0)
      const spendPrev = (metricsPrev ?? []).reduce((s, r: any) => s + Number(r.spend_brl ?? 0), 0)
      const leadsAdsPrev = (metricsPrev ?? []).reduce((s, r: any) => s + Number(r.leads ?? 0), 0)
      const cplCurr = leadsAdsCurr > 0 ? spendCurr / leadsAdsCurr : 0
      const cplPrev = leadsAdsPrev > 0 ? spendPrev / leadsAdsPrev : 0
      return { leadsCurr: leadsCurr ?? 0, leadsPrev: leadsPrev ?? 0, spendCurr, spendPrev, cplCurr, cplPrev, leadsAdsCurr, leadsAdsPrev, insights: insights ?? [], alerts: alerts ?? [] }
    },
  })

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Visão geral · últimos 30 dias</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Olá, bem-vindo de volta.</h1>
        <p className="text-muted-foreground mt-1">Como sua operação está performando agora.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Leads" value={formatNumber(data?.leadsCurr ?? 0)} delta={data ? delta(data.leadsCurr, data.leadsPrev) : undefined} hint="vs 30d anteriores" loading={isLoading} />
        <Stat label="Investido" value={formatCurrency(data?.spendCurr ?? 0)} delta={data ? delta(data.spendCurr, data.spendPrev) : undefined} hint="Meta + Google" loading={isLoading} />
        <Stat label="Custo por Lead" value={data && data.cplCurr > 0 ? formatCurrency(data.cplCurr) : '—'} delta={data && data.cplPrev > 0 ? delta(data.cplCurr, data.cplPrev) : undefined} hint="média do período" loading={isLoading} />
        <Stat label="Leads de campanha" value={formatNumber(data?.leadsAdsCurr ?? 0)} delta={data ? delta(data.leadsAdsCurr, data.leadsAdsPrev) : undefined} hint="ads pagos" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" />Insights da IA</CardTitle>
                <CardDescription>Análises automáticas do que está funcionando.</CardDescription>
              </div>
              <Badge variant="secondary">{data?.insights.length ?? 0}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(!isLoading && (data?.insights ?? []).length === 0) && (
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
              <Badge variant={(data?.alerts.length ?? 0) > 0 ? 'destructive' : 'secondary'}>{data?.alerts.length ?? 0}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(!isLoading && (data?.alerts ?? []).length === 0) && (
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
