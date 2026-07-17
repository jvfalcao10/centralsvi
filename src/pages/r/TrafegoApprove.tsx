import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Eye, ExternalLink } from 'lucide-react'
import logoSvi from '@/assets/logo-svi.png'

const APPROVAL_WEBHOOK_URL = 'https://n8n-n8n-start.wrqknp.easypanel.host/webhook/aprovar-relatorio-trafego'

interface CampaignRow {
  name: string
  objective: string
  spend: number
  freq: number
  ctr: number
  // legado (v1 do WF)
  conv?: number
  leads?: number
  purchases?: number
  cpmsg?: number | null
  cpl?: number | null
  // v2 do WF (por objetivo)
  group?: 'traffic' | 'message' | 'sales' | 'leads' | 'awareness' | 'video' | 'app' | 'other'
  reach?: number
  cpc?: number
  cpm?: number
  linkClicks?: number
  videoViews?: number
  postEngagement?: number
  postSave?: number
  postNetLike?: number
  msgs?: number
  firstReply?: number
  d2?: number
  d3?: number
  d5?: number
  cpa?: number | null
  cpLinkClick?: number | null
}

type Group = 'traffic' | 'message' | 'sales' | 'leads' | 'awareness' | 'video' | 'app' | 'other'

const OBJ_GROUP: Record<string, Group> = {
  OUTCOME_TRAFFIC: 'traffic', LINK_CLICKS: 'traffic',
  OUTCOME_ENGAGEMENT: 'message', MESSAGES: 'message', CONVERSATIONS: 'message',
  OUTCOME_SALES: 'sales',
  OUTCOME_LEADS: 'leads', LEAD_GENERATION: 'leads',
  OUTCOME_AWARENESS: 'awareness', REACH: 'awareness', BRAND_AWARENESS: 'awareness',
  VIDEO_VIEWS: 'video', OUTCOME_APP_PROMOTION: 'app',
}

function classifyGroup(objective: string): Group {
  return OBJ_GROUP[objective] || 'other'
}

const GROUP_INFO: Record<Group, { label: string; emoji: string; color: string }> = {
  traffic:   { label: 'Tráfego · visitas',        emoji: '📢', color: 'text-amber-500 border-amber-500/30 bg-amber-500/5' },
  message:   { label: 'Mensagem · WhatsApp',       emoji: '💬', color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' },
  sales:     { label: 'Vendas',                    emoji: '🛒', color: 'text-violet-500 border-violet-500/30 bg-violet-500/5' },
  leads:     { label: 'Leads · form',              emoji: '📋', color: 'text-blue-500 border-blue-500/30 bg-blue-500/5' },
  awareness: { label: 'Alcance · awareness',       emoji: '📡', color: 'text-rose-500 border-rose-500/30 bg-rose-500/5' },
  video:     { label: 'Vídeo',                     emoji: '🎬', color: 'text-rose-500 border-rose-500/30 bg-rose-500/5' },
  app:       { label: 'App',                       emoji: '📱', color: 'text-cyan-500 border-cyan-500/30 bg-cyan-500/5' },
  other:     { label: 'Outros',                    emoji: '📦', color: 'text-muted-foreground border-border bg-muted/20' },
}

interface GroupAgg {
  group: Group
  spend: number
  campaigns: CampaignRow[]
  reach: number
  linkClicks: number
  videoViews: number
  msgs: number
  firstReply: number
  d2: number
  d3: number
  d5: number
  leads: number
  purchases: number
  cpmsg: number | null
  cpc: number | null
  cpa: number | null
  cpl: number | null
  cpVideoView: number | null
}

function aggregateByGroup(campaigns: CampaignRow[]): GroupAgg[] {
  const map = new Map<Group, GroupAgg>()
  for (const c of campaigns) {
    const g = c.group || classifyGroup(c.objective)
    if (!map.has(g)) {
      map.set(g, { group: g, spend: 0, campaigns: [], reach: 0, linkClicks: 0, videoViews: 0, msgs: 0, firstReply: 0, d2: 0, d3: 0, d5: 0, leads: 0, purchases: 0, cpmsg: null, cpc: null, cpa: null, cpl: null, cpVideoView: null })
    }
    const agg = map.get(g)!
    agg.spend += c.spend
    agg.reach += c.reach || 0
    agg.linkClicks += c.linkClicks || 0
    agg.videoViews += c.videoViews || 0
    agg.msgs += (c.msgs ?? c.conv) || 0
    agg.firstReply += c.firstReply || 0
    agg.d2 += c.d2 || 0
    agg.d3 += c.d3 || 0
    agg.d5 += c.d5 || 0
    agg.leads += c.leads || 0
    agg.purchases += c.purchases || 0
    agg.campaigns.push(c)
  }
  for (const agg of map.values()) {
    if (agg.msgs > 0) agg.cpmsg = agg.spend / agg.msgs
    if (agg.linkClicks > 0) agg.cpc = agg.spend / agg.linkClicks
    if (agg.videoViews > 0) agg.cpVideoView = agg.spend / agg.videoViews
    if (agg.purchases > 0) agg.cpa = agg.spend / agg.purchases
    if (agg.leads > 0) agg.cpl = agg.spend / agg.leads
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
}

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
  frequency: number | null
  conv_count: number | null
  first_reply_count: number | null
  d2_count: number | null
  d3_count: number | null
  leads_count: number | null
  purchase_count: number | null
  link_clicks: number | null
  video_views: number | null
  cpmsg_cents: number | null
  cpl_cents: number | null
  campaigns_json: CampaignRow[] | string | null
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
function brlF(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function nf(n: number) {
  return n.toLocaleString('pt-BR')
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function parseCampaigns(raw: CampaignRow[] | string | null | undefined): CampaignRow[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
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

  const campaigns = parseCampaigns(data.campaigns_json)
  const groups = aggregateByGroup(campaigns)
  const totalSpend = data.spend_cents / 100
  const dryCampaigns = campaigns.filter(
    (c) => ((c.msgs ?? c.conv) || 0) === 0 && (c.leads || 0) === 0 && (c.purchases || 0) === 0 && c.spend > 30
  )

  const freq = data.frequency ?? 0

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

        {/* Resumo da semana */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Resumo da semana</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Investimento total" value={brl(data.spend_cents)} highlight />
            <Stat label="Alcance" value={nf(data.reach)} />
            <Stat label="Frequência média" value={`${freq.toFixed(2)}x`} />
            <Stat label="CTR médio" value={`${ctrPct}%`} />
          </div>
        </div>

        {/* Blocos por objetivo */}
        {groups.map((g) => (
          <ObjectiveBlock key={g.group} agg={g} totalSpend={totalSpend} />
        ))}

        {/* Campanhas zero conversão */}
        {dryCampaigns.length > 0 && (
          <div className="border border-rose-500/30 rounded-xl bg-rose-500/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-500 mb-2">
              Campanhas com ZERO conversão (gasto &gt; R$ 30)
            </p>
            <ul className="space-y-1.5">
              {dryCampaigns.slice(0, 8).map((c, i) => (
                <li key={i} className="text-xs flex items-center gap-2 flex-wrap">
                  <ObjBadge obj={c.objective} />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">— {brlF(c.spend)} · freq {c.freq.toFixed(1)}x</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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

function Stat({ label, value, highlight, sublabel }: { label: string; value: string; highlight?: boolean; sublabel?: string }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${highlight ? 'bg-primary/10 border-primary/30' : 'bg-card'}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
    </div>
  )
}

function ObjectiveBlock({ agg, totalSpend }: { agg: GroupAgg; totalSpend: number }) {
  const info = GROUP_INFO[agg.group]
  const pct = totalSpend > 0 ? (agg.spend / totalSpend) * 100 : 0

  return (
    <div className={`border rounded-xl overflow-hidden ${info.color}`}>
      <div className="px-4 py-3 border-b border-current/20 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
          <span className="text-base leading-none">{info.emoji}</span>
          {info.label}
        </p>
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span className="font-mono opacity-70">{pct.toFixed(0)}% do investimento</span>
          <span className="font-bold text-sm">{brlF(agg.spend)}</span>
        </div>
      </div>

      <div className="p-4 bg-background/50 space-y-4">
        {/* métricas por tipo */}
        {agg.group === 'traffic' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {agg.linkClicks > 0 && (
              <Stat label="Visitas" value={nf(agg.linkClicks)} sublabel={agg.cpc !== null ? `CPC ${brlF(agg.cpc)}` : undefined} highlight />
            )}
            {agg.videoViews > 0 && (
              <Stat label="Video views" value={nf(agg.videoViews)} sublabel={agg.cpVideoView !== null ? `${brlF(agg.cpVideoView)}/view` : undefined} />
            )}
            {agg.reach > 0 && <Stat label="Alcance" value={nf(agg.reach)} />}
            {agg.msgs > 0 && <Stat label="Msgs bônus" value={nf(agg.msgs)} sublabel="não é objetivo" />}
          </div>
        )}

        {agg.group === 'message' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Mensagens" value={nf(agg.msgs)} sublabel={agg.cpmsg !== null ? `CPmsg ${brlF(agg.cpmsg)}` : undefined} highlight />
            {agg.firstReply > 0 && (
              <Stat label="1ª resposta" value={nf(agg.firstReply)} sublabel={agg.msgs > 0 ? `${Math.round(agg.firstReply / agg.msgs * 100)}% respondeu` : undefined} />
            )}
            {agg.d2 > 0 && <Stat label="D2 (voltou 2x)" value={nf(agg.d2)} />}
            {agg.d3 > 0 && <Stat label="D3 (voltou 3x)" value={nf(agg.d3)} />}
            {agg.d5 > 0 && <Stat label="D5 ⭐ quente" value={nf(agg.d5)} sublabel="conversa evoluiu 5x" />}
            {agg.reach > 0 && <Stat label="Alcance" value={nf(agg.reach)} />}
          </div>
        )}

        {agg.group === 'sales' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Compras" value={nf(agg.purchases)} sublabel={agg.cpa !== null ? `CPA ${brlF(agg.cpa)}` : undefined} highlight />
            {agg.msgs > 0 && <Stat label="Msgs" value={nf(agg.msgs)} sublabel="funil pré-venda" />}
            {agg.leads > 0 && <Stat label="Leads" value={nf(agg.leads)} />}
          </div>
        )}

        {agg.group === 'leads' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Leads" value={nf(agg.leads)} sublabel={agg.cpl !== null ? `CPL ${brlF(agg.cpl)}` : undefined} highlight />
            {agg.msgs > 0 && <Stat label="Msgs" value={nf(agg.msgs)} />}
          </div>
        )}

        {agg.group === 'awareness' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Alcance único" value={nf(agg.reach)} highlight />
            {agg.videoViews > 0 && <Stat label="Video views" value={nf(agg.videoViews)} />}
          </div>
        )}

        {agg.group === 'video' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Video views" value={nf(agg.videoViews)} highlight />
            {agg.reach > 0 && <Stat label="Alcance" value={nf(agg.reach)} />}
          </div>
        )}

        {/* Campanhas do grupo */}
        {agg.campaigns.length > 0 && (
          <div className="border-t border-current/10 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Campanhas ({agg.campaigns.length})
            </p>
            <ul className="space-y-2">
              {agg.campaigns.map((c, i) => {
                const cpmsg = c.cpmsg ?? null
                const cpc = c.cpc ?? null
                const cMsgs = c.msgs ?? c.conv ?? 0
                const cLinks = c.linkClicks ?? 0
                return (
                  <li key={i} className="text-xs flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium truncate max-w-[260px]" title={c.name}>{c.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      — {brlF(c.spend)}
                      {agg.group === 'message' && cMsgs > 0 && ` · ${cMsgs} msgs @ ${cpmsg !== null ? brlF(cpmsg) : '—'}`}
                      {agg.group === 'traffic' && cLinks > 0 && ` · ${nf(cLinks)} visitas${cpc !== null ? ` @ ${brlF(cpc)}` : ''}`}
                      {c.freq > 0 && ` · freq ${c.freq.toFixed(1)}x`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function ObjBadge({ obj }: { obj: string }) {
  const map: Record<string, string> = {
    MSG: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    LEADS: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
    SALES: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
    TRAFEGO: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    CLICKS: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    ALCANCE: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
    VIDEO: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
    ENGAJ: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    LEAD_FORM: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
    CONV: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  }
  const cls = map[obj] || 'bg-muted text-muted-foreground border-border'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {obj}
    </span>
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
