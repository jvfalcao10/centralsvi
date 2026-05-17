import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/painel/format'
import { usePainelContext } from '@/components/PainelLayout'

export default function PainelCampaigns() {
  const { client, slug } = usePainelContext()

  const { data, isLoading } = useQuery({
    queryKey: ['painel-campaigns', client.id],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30)
      const [{ data: campaigns }, { data: metrics }] = await Promise.all([
        supabase.from('painel_campaigns')
          .select('id, name, provider, status, objective, budget_daily_brl, started_at')
          .eq('client_id', client.id).order('started_at', { ascending: false }).limit(50),
        supabase.from('painel_campaign_metrics_daily')
          .select('campaign_id, impressions, clicks, spend_brl, leads')
          .eq('client_id', client.id).gte('date', since.toISOString().slice(0, 10)),
      ])
      const agg = new Map<string, { imp: number; clk: number; spend: number; leads: number }>()
      metrics?.forEach((m: any) => {
        const cur = agg.get(m.campaign_id) || { imp: 0, clk: 0, spend: 0, leads: 0 }
        cur.imp += Number(m.impressions ?? 0); cur.clk += Number(m.clicks ?? 0)
        cur.spend += Number(m.spend_brl ?? 0); cur.leads += Number(m.leads ?? 0)
        agg.set(m.campaign_id, cur)
      })
      return { campaigns: campaigns ?? [], agg }
    },
  })

  const isEmpty = !isLoading && (data?.campaigns ?? []).length === 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Aquisição</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Campanhas</h1>
        <p className="text-muted-foreground mt-1">Performance integrada de Meta, Google e outras fontes.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
              <Megaphone className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Sem campanhas conectadas</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Conecte sua conta Meta Ads ou Google Ads pra trazer suas campanhas, gastos, leads e métricas pra cá automaticamente.
            </p>
            <div className="mt-6">
              <Link to={`/cliente/${slug}/settings`}><Button>Conectar fonte de tráfego</Button></Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.campaigns.map((c: any) => {
            const m = data.agg.get(c.id) || { imp: 0, clk: 0, spend: 0, leads: 0 }
            const ctr = m.imp > 0 ? (m.clk / m.imp) * 100 : 0
            const cpl = m.leads > 0 ? m.spend / m.leads : 0
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{c.provider === 'meta_ads' ? 'Meta' : c.provider === 'google_ads' ? 'Google' : c.provider}</Badge>
                      {c.status && <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>}
                    </div>
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.objective || '—'}</div>
                  </div>
                  <div className="flex items-center gap-8 shrink-0">
                    <Metric label="Investido" value={formatCurrency(m.spend)} />
                    <Metric label="Leads" value={formatNumber(m.leads)} />
                    <Metric label="CPL" value={cpl > 0 ? formatCurrency(cpl) : '—'} />
                    <Metric label="CTR" value={formatPercent(ctr, 2)} />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  )
}
