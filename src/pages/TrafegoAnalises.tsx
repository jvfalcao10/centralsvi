import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle, ArrowRight, FileText, Loader2,
  Search, TrendingDown, TrendingUp, Zap,
} from 'lucide-react'

interface AuditRow {
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
  short_summary: string | null
  severity: string | null
  top_strength: string | null
  top_vazamento: string | null
  created_at: string
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  alto: 1,
  medio: 2,
  ok: 3,
}

function brl(cents: number | null) {
  if (cents === null || cents === undefined) return '—'
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
  })
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
  return (
    <Badge variant="outline" className={`${m.cls} font-medium text-[10px]`}>
      {m.label}
    </Badge>
  )
}

export default function TrafegoAnalises() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState<string>('all')
  const [orderBy, setOrderBy] = useState<string>('severity')

  const { data: audits, isLoading } = useQuery({
    queryKey: ['traffic-audits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('traffic_account_audits' as never)
        .select('id,account_id,cliente_label,account_name,vertical,audit_date,analyst_name,spend_lifetime_cents,spend_90d_cents,spend_30d_cents,spend_7d_cents,conv_90d,conv_30d,conv_7d,cpmsg_30d_cents,freq_30d,reach_30d,active_ads_count,active_campaigns_count,account_balance_cents,spend_cap_cents,cap_runway_days,account_status_label,short_summary,severity,top_strength,top_vazamento,created_at')
        .order('audit_date', { ascending: false })
      if (error) throw error
      const list = (data || []) as unknown as AuditRow[]
      const seen = new Set<string>()
      return list.filter(a => {
        if (seen.has(a.account_id)) return false
        seen.add(a.account_id)
        return true
      })
    },
  })

  const filtered = useMemo(() => {
    if (!audits) return []
    let list = audits.slice()
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.cliente_label.toLowerCase().includes(q) ||
        (a.vertical || '').toLowerCase().includes(q) ||
        (a.short_summary || '').toLowerCase().includes(q)
      )
    }
    if (sevFilter !== 'all') {
      list = list.filter(a => a.severity === sevFilter)
    }
    if (orderBy === 'severity') {
      list.sort((a, b) => (SEVERITY_RANK[a.severity || 'ok'] ?? 3) - (SEVERITY_RANK[b.severity || 'ok'] ?? 3))
    } else if (orderBy === 'cpmsg') {
      list.sort((a, b) => (b.cpmsg_30d_cents || 0) - (a.cpmsg_30d_cents || 0))
    } else if (orderBy === 'conv') {
      list.sort((a, b) => (b.conv_30d || 0) - (a.conv_30d || 0))
    } else if (orderBy === 'spend') {
      list.sort((a, b) => (b.spend_30d_cents || 0) - (a.spend_30d_cents || 0))
    } else if (orderBy === 'runway') {
      list.sort((a, b) => (a.cap_runway_days || 999) - (b.cap_runway_days || 999))
    }
    return list
  }, [audits, search, sevFilter, orderBy])

  const counts = useMemo(() => {
    const c = { total: 0, critical: 0, alto: 0, medio: 0, ok: 0 }
    audits?.forEach(a => {
      c.total++
      if (a.severity === 'critical') c.critical++
      else if (a.severity === 'alto') c.alto++
      else if (a.severity === 'medio') c.medio++
      else if (a.severity === 'ok') c.ok++
    })
    return c
  }, [audits])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Análises de Tráfego</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria forense por conta. Estrutura + criativos + funil + plano 30 dias.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total auditadas" value={counts.total} icon={FileText} tone="default" />
        <SummaryCard label="Críticas" value={counts.critical} icon={AlertTriangle} tone="rose" />
        <SummaryCard label="Alto risco" value={counts.alto} icon={TrendingDown} tone="amber" />
        <SummaryCard label="Médio" value={counts.medio} icon={Zap} tone="yellow" />
        <SummaryCard label="OK" value={counts.ok} icon={TrendingUp} tone="emerald" />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, vertical, achado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas severidades</SelectItem>
            <SelectItem value="critical">Críticas</SelectItem>
            <SelectItem value="alto">Alto</SelectItem>
            <SelectItem value="medio">Médio</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={orderBy} onValueChange={setOrderBy}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="severity">Severidade</SelectItem>
            <SelectItem value="runway">Runway (dias)</SelectItem>
            <SelectItem value="cpmsg">CPmsg maior primeiro</SelectItem>
            <SelectItem value="conv">Mais conversas</SelectItem>
            <SelectItem value="spend">Maior gasto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Nenhuma auditoria encontrada.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="w-24">Severidade</TableHead>
                <TableHead className="text-right w-24">Conv 30d</TableHead>
                <TableHead className="text-right w-24">CPmsg</TableHead>
                <TableHead className="text-right w-28">Spend 30d</TableHead>
                <TableHead className="text-right w-24">Freq 30d</TableHead>
                <TableHead className="text-right w-20">Runway</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => navigate(`/operacional/trafego/analises/${a.account_id}`)}
                >
                  <TableCell className="py-3">
                    <div className="font-medium">{a.cliente_label}</div>
                    {a.vertical && (
                      <div className="text-xs text-muted-foreground mt-0.5">{a.vertical}</div>
                    )}
                  </TableCell>
                  <TableCell><SeverityBadge sev={a.severity} /></TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {nf(a.conv_30d)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(a.cpmsg_30d_cents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(a.spend_30d_cents)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {a.freq_30d ? `${a.freq_30d.toFixed(2)}x` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.cap_runway_days !== null && a.cap_runway_days !== undefined ? (
                      <span className={a.cap_runway_days < 7 ? 'text-rose-500 font-medium' : 'text-muted-foreground'}>
                        {a.cap_runway_days}d
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Quick takeaways grid (3 frases summary de cada) */}
      {filtered.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Achados em uma frase
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(a => (
              <div
                key={a.id}
                onClick={() => navigate(`/operacional/trafego/analises/${a.account_id}`)}
                className="border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors bg-card"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-medium text-sm">{a.cliente_label}</div>
                  <SeverityBadge sev={a.severity} />
                </div>
                {a.short_summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {a.short_summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label, value, icon: Icon, tone,
}: { label: string; value: number; icon: any; tone: 'default' | 'rose' | 'amber' | 'yellow' | 'emerald' }) {
  const toneCls: Record<string, string> = {
    default: 'border-border',
    rose: 'border-rose-500/30 bg-rose-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    yellow: 'border-yellow-500/30 bg-yellow-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
  }
  const iconCls: Record<string, string> = {
    default: 'text-muted-foreground',
    rose: 'text-rose-500',
    amber: 'text-amber-500',
    yellow: 'text-yellow-600',
    emerald: 'text-emerald-500',
  }
  return (
    <div className={`rounded-xl border ${toneCls[tone]} p-4`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${iconCls[tone]}`} />
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
