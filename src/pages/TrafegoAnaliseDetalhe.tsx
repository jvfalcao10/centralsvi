import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, ExternalLink, Calendar, User } from 'lucide-react'

interface AuditDetail {
  id: number
  account_id: string
  cliente_label: string
  account_name: string | null
  vertical: string | null
  audit_date: string
  analyst_name: string | null
  spend_lifetime_cents: number | null
  spend_90d_cents: number | null
  spend_30d_cents: number | null
  spend_7d_cents: number | null
  conv_90d: number | null
  conv_30d: number | null
  conv_7d: number | null
  cpmsg_30d_cents: number | null
  freq_30d: number | null
  reach_30d: number | null
  active_ads_count: number | null
  active_campaigns_count: number | null
  account_balance_cents: number | null
  spend_cap_cents: number | null
  cap_runway_days: number | null
  account_status_label: string | null
  markdown_report: string
  short_summary: string | null
  severity: string | null
}

function brl(cents: number | null) {
  if (cents === null || cents === undefined) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function nf(n: number | null) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('pt-BR')
}

function SeverityBadge({ sev }: { sev: string | null }) {
  if (!sev) return null
  const map: Record<string, { label: string; cls: string }> = {
    critical: { label: 'CRÍTICO', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
    alto: { label: 'ALTO', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
    medio: { label: 'MÉDIO', cls: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
    ok: { label: 'OK', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  }
  const m = map[sev] || { label: sev.toUpperCase(), cls: 'bg-muted text-muted-foreground border-border' }
  return <Badge variant="outline" className={`${m.cls} font-medium text-[10px]`}>{m.label}</Badge>
}

export default function TrafegoAnaliseDetalhe() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['traffic-audit', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('traffic_account_audits' as never)
        .select('*')
        .eq('account_id', accountId as string)
        .order('audit_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as unknown as AuditDetail | null
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/operacional/trafego/analises')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="border border-border rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">Auditoria não encontrada para esta conta.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/operacional/trafego/analises')}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para listagem
      </button>

      {/* Header */}
      <div className="border border-border rounded-xl p-6 bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{data.cliente_label}</h1>
              <SeverityBadge sev={data.severity} />
            </div>
            {data.vertical && (
              <p className="text-sm text-muted-foreground">{data.vertical}</p>
            )}
            {data.account_name && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {data.account_name} · {data.account_id}
              </p>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-end gap-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(data.audit_date).toLocaleDateString('pt-BR')}</span>
            </div>
            {data.analyst_name && (
              <div className="flex items-center justify-end gap-2">
                <User className="h-3.5 w-3.5" />
                <span>{data.analyst_name}</span>
              </div>
            )}
          </div>
        </div>

        {data.short_summary && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm leading-relaxed">
            {data.short_summary}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Kpi label="Conv 30d" value={nf(data.conv_30d)} />
          <Kpi label="CPmsg 30d" value={brl(data.cpmsg_30d_cents)} />
          <Kpi label="Spend 30d" value={brl(data.spend_30d_cents)} />
          <Kpi label="Freq 30d" value={data.freq_30d ? `${data.freq_30d.toFixed(2)}x` : '—'} />
          <Kpi label="Spend 90d" value={brl(data.spend_90d_cents)} />
          <Kpi label="Conv 90d" value={nf(data.conv_90d)} />
          <Kpi
            label="Runway cap"
            value={data.cap_runway_days !== null ? `${data.cap_runway_days}d` : '—'}
            tone={data.cap_runway_days !== null && data.cap_runway_days < 7 ? 'critical' : 'default'}
          />
          <Kpi label="Status" value={data.account_status_label || '—'} />
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${data.account_id.replace('act_', '')}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors"
        >
          Abrir no Gerenciador de Anúncios <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      </div>

      {/* Markdown report */}
      <div className="border border-border rounded-xl p-6 md:p-8 bg-card prose prose-sm md:prose-base max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-table:text-xs prose-th:bg-muted/30 prose-th:text-foreground prose-td:py-2 prose-strong:text-foreground prose-code:text-rose-500 prose-code:bg-rose-500/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.markdown_report}</ReactMarkdown>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'critical' }) {
  const cls = tone === 'critical' ? 'border-rose-500/30 bg-rose-500/5' : 'border-border'
  const valCls = tone === 'critical' ? 'text-rose-500' : ''
  return (
    <div className={`rounded-lg border ${cls} p-3`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-base font-bold tabular-nums ${valCls}`}>{value}</p>
    </div>
  )
}
