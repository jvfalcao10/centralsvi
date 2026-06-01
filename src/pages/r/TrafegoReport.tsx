import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, TrendingUp, Eye, Users, MousePointerClick, Percent } from 'lucide-react'
import logoSvi from '@/assets/logo-svi.png'

interface ReportRow {
  slug: string
  account_id: string
  account_name: string
  cliente_label: string
  period_start: string
  period_end: string
  spend_cents: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  currency: string
  status: string
  generated_at: string
}

function brl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function nf(n: number) {
  return n.toLocaleString('pt-BR')
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function MetricCard({
  label, value, Icon, accent = 'primary',
}: {
  label: string
  value: string
  Icon: typeof TrendingUp
  accent?: 'primary' | 'emerald' | 'sky' | 'amber' | 'rose'
}) {
  const accentCls: Record<typeof accent, string> = {
    primary: 'from-primary/15 to-primary/5 text-primary',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-500',
    sky: 'from-sky-500/15 to-sky-500/5 text-sky-500',
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-500',
    rose: 'from-rose-500/15 to-rose-500/5 text-rose-500',
  } as const

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${accentCls[accent]} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs uppercase tracking-wider font-medium opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export default function TrafegoReport() {
  const { slug } = useParams<{ slug: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['weekly-traffic-report', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_traffic_reports' as never)
        .select('*')
        .eq('slug', slug as string)
        .maybeSingle()
      if (error) throw error
      return data as unknown as ReportRow | null
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold mb-2">Relatório não encontrado</h1>
          <p className="text-sm text-muted-foreground">
            O link expirou ou está incorreto. Solicite um novo relatório com a equipe SVI.
          </p>
        </div>
      </div>
    )
  }

  // Relatório só aparece pro cliente final quando já passou pela aprovação
  if (data.status === 'pending' || data.status === 'approved') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-3">
          <h1 className="text-xl font-semibold">Relatório em finalização</h1>
          <p className="text-sm text-muted-foreground">
            Estamos finalizando este relatório. Em breve estará disponível.
          </p>
        </div>
      </div>
    )
  }
  if (data.status === 'rejected' || data.status === 'failed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold mb-2">Relatório indisponível</h1>
          <p className="text-sm text-muted-foreground">
            Entre em contato com a equipe SVI para mais detalhes.
          </p>
        </div>
      </div>
    )
  }

  const ctrPct = (data.ctr * 100).toFixed(2).replace('.', ',')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-5 py-8 md:py-12 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <img src={logoSvi} alt="SVI Company" className="h-8 object-contain" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Relatório semanal</p>
            <p className="text-xs font-medium">
              {fmtDate(data.period_start)} a {fmtDate(data.period_end)}
            </p>
          </div>
        </div>

        {/* Cliente */}
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</p>
          <h1 className="text-3xl md:text-4xl font-bold">{data.cliente_label}</h1>
          <p className="text-xs text-muted-foreground font-mono">{data.account_name}</p>
        </div>

        {/* Métricas — Gasto destacado */}
        <div>
          <MetricCard
            label="Investimento no período"
            value={brl(data.spend_cents)}
            Icon={TrendingUp}
            accent="primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Impressões" value={nf(data.impressions)} Icon={Eye} accent="sky" />
          <MetricCard label="Alcance" value={nf(data.reach)} Icon={Users} accent="emerald" />
          <MetricCard label="Cliques" value={nf(data.clicks)} Icon={MousePointerClick} accent="amber" />
          <MetricCard label="CTR" value={`${ctrPct}%`} Icon={Percent} accent="rose" />
        </div>

        {/* Insights interpretativos simples */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resumo</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Pessoas únicas alcançadas:</span>{' '}
              <span className="font-medium">{nf(data.reach)}</span>
              {data.impressions > 0 && (
                <span className="text-muted-foreground">
                  {' '}(frequência média {(data.impressions / Math.max(data.reach, 1)).toFixed(1)}x)
                </span>
              )}
            </li>
            <li>
              <span className="text-muted-foreground">Custo médio por mil impressões (CPM):</span>{' '}
              <span className="font-medium">
                {brl(data.impressions > 0 ? Math.round((data.spend_cents / data.impressions) * 1000) : 0)}
              </span>
            </li>
            {data.clicks > 0 && (
              <li>
                <span className="text-muted-foreground">Custo por clique (CPC):</span>{' '}
                <span className="font-medium">
                  {brl(Math.round(data.spend_cents / data.clicks))}
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-border/50 text-xs text-muted-foreground space-y-1">
          <p>Relatório gerado automaticamente pela SVI Company.</p>
          <p>
            Período coberto: {fmtDate(data.period_start)} a {fmtDate(data.period_end)} · gerado em{' '}
            {new Date(data.generated_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
          </p>
        </div>
      </div>
    </div>
  )
}
