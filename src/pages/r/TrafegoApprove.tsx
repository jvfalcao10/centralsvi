import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Eye, ExternalLink } from 'lucide-react'
import logoSvi from '@/assets/logo-svi.png'

const APPROVAL_WEBHOOK_URL = 'https://n8n-n8n-start.wrqknp.easypanel.host/webhook/aprovar-relatorio-trafego'

interface ReportRow {
  slug: string
  approval_token: string
  account_id: string
  account_name: string
  cliente_label: string
  group_chatid: string
  period_start: string
  period_end: string
  spend_cents: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  currency: string
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'failed'
  approved_by_name: string | null
  approved_at: string | null
  rejected_at: string | null
  rejected_reason: string | null
  sent_at: string | null
  generated_at: string
}

function brl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function nf(n: number) {
  return n.toLocaleString('pt-BR')
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function TrafegoApprove() {
  const { slug } = useParams<{ slug: string }>()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [aprovador, setAprovador] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState<null | 'approve' | 'reject'>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<'approved' | 'rejected' | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['trafego-report-approval', slug, token],
    enabled: !!slug && !!token,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_traffic_reports' as never)
        .select('*')
        .eq('slug', slug as string)
        .eq('approval_token', token)
        .maybeSingle()
      if (error) throw error
      return data as unknown as ReportRow | null
    },
  })

  async function submit(action: 'approve' | 'reject') {
    if (!aprovador.trim()) {
      setSubmitError('Identifique-se antes de aprovar ou reprovar.')
      return
    }
    setSubmitting(action)
    setSubmitError(null)
    try {
      const resp = await fetch(APPROVAL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          token,
          action,
          approved_by_name: aprovador.trim(),
          rejected_reason: action === 'reject' ? rejectReason.trim() || null : null,
        }),
      })
      if (!resp.ok) throw new Error(`Webhook respondeu ${resp.status}`)
      setSubmitSuccess(action === 'approve' ? 'approved' : 'rejected')
      // n8n leva uns segundos pra processar; refetch após pausa pra mostrar estado novo
      setTimeout(() => refetch(), 2500)
    } catch (e) {
      setSubmitError('Falha ao registrar: ' + (e as Error).message)
    } finally {
      setSubmitting(null)
    }
  }

  if (!token) {
    return (
      <Wrapper>
        <h1 className="text-xl font-semibold mb-2">Link incompleto</h1>
        <p className="text-sm text-muted-foreground">Falta o token de aprovação na URL.</p>
      </Wrapper>
    )
  }
  if (isLoading) {
    return <Wrapper><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Wrapper>
  }
  if (error || !data) {
    return (
      <Wrapper>
        <h1 className="text-xl font-semibold mb-2">Relatório não encontrado</h1>
        <p className="text-sm text-muted-foreground">Verifique o link recebido no ClickUp.</p>
      </Wrapper>
    )
  }

  const ctrPct = (data.ctr * 100).toFixed(2).replace('.', ',')
  const previewUrl = `${window.location.origin}/r/trafego/${data.slug}`
  const alreadyDecided = data.status !== 'pending'

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-5 py-8 md:py-12 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <img src={logoSvi} alt="SVI" className="h-8 object-contain" />
          <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground">
            Aprovação interna
          </span>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Relatório semanal de tráfego</p>
          <h1 className="text-2xl md:text-3xl font-bold">{data.cliente_label}</h1>
          <p className="text-xs text-muted-foreground">
            Período: <span className="font-medium">{fmtDate(data.period_start)} a {fmtDate(data.period_end)}</span>
            {' '}· <span className="font-mono">{data.account_name}</span>
          </p>
        </div>

        {/* Status pill quando já decidido */}
        {alreadyDecided && (
          <StatusBanner data={data} />
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Investimento" value={brl(data.spend_cents)} highlight />
          <Stat label="Impressões" value={nf(data.impressions)} />
          <Stat label="Alcance" value={nf(data.reach)} />
          <Stat label="Cliques" value={nf(data.clicks)} />
          <Stat label="CTR" value={`${ctrPct}%`} />
        </div>

        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors w-fit"
        >
          <Eye className="h-3.5 w-3.5" />
          Visualizar como cliente vai ver
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>

        {/* Bloco de decisão (só se ainda pending) */}
        {!alreadyDecided && !submitSuccess && (
          <div className="space-y-4 border-t border-border pt-6">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                Seu nome (registrado como aprovador)
              </label>
              <input
                type="text"
                placeholder="Ex: João Falcão"
                value={aprovador}
                onChange={(e) => setAprovador(e.target.value)}
                disabled={!!submitting}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                Motivo da reprovação (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Só usado se você reprovar"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={!!submitting}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-2 text-sm text-rose-500">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={() => submit('approve')}
                disabled={!!submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {submitting === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aprovar
              </button>
              <button
                onClick={() => submit('reject')}
                disabled={!!submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-rose-500 text-rose-500 font-medium hover:bg-rose-500/10 transition-colors disabled:opacity-50"
              >
                {submitting === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Reprovar
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Aprovar libera o link público do relatório. O envio pro WhatsApp do cliente é feito manualmente pela equipe SVI.
            </p>
          </div>
        )}

        {submitSuccess && !alreadyDecided && (
          <div className={`p-4 rounded-lg border ${submitSuccess === 'approved' ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-500' : 'border-rose-500/40 bg-rose-500/5 text-rose-500'}`}>
            <p className="font-medium text-sm">
              {submitSuccess === 'approved' ? 'Aprovado. Link público liberado. Equipe envia manual pro WhatsApp do cliente.' : 'Reprovado. Cliente não receberá esta versão.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">{children}</div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${highlight ? 'bg-primary/10 border-primary/30' : 'bg-card'}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}

function StatusBanner({ data }: { data: ReportRow }) {
  if (data.status === 'sent' || data.status === 'approved') {
    return (
      <div className="p-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 text-sm">
        <p className="font-medium text-emerald-500 mb-0.5">
          {data.status === 'sent' ? 'Enviado pro cliente' : 'Aprovado'}
        </p>
        <p className="text-xs text-muted-foreground">
          Aprovado por <span className="font-medium">{data.approved_by_name || '—'}</span>
          {data.approved_at && ' em ' + new Date(data.approved_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
          {data.sent_at && ' · enviado em ' + new Date(data.sent_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </p>
      </div>
    )
  }
  if (data.status === 'rejected') {
    return (
      <div className="p-4 rounded-lg border border-rose-500/40 bg-rose-500/5 text-sm">
        <p className="font-medium text-rose-500 mb-0.5">Reprovado</p>
        <p className="text-xs text-muted-foreground">
          {data.rejected_at && new Date(data.rejected_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
          {data.rejected_reason && ' · ' + data.rejected_reason}
        </p>
      </div>
    )
  }
  if (data.status === 'failed') {
    return (
      <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/5 text-sm">
        <p className="font-medium text-amber-500 mb-0.5">Falha no envio</p>
        <p className="text-xs text-muted-foreground">Verifique no n8n.</p>
      </div>
    )
  }
  return null
}
