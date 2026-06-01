import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

const REFRESH_WEBHOOK_URL = 'https://n8n-n8n-start.wrqknp.easypanel.host/webhook/traffic-refresh'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle, Battery, BatteryLow, CheckCircle2, Loader2,
  RefreshCw, Search, TrendingDown,
} from 'lucide-react'

type Severity = 'CRITICO' | 'ZERADA_ATIVA' | 'MEDIO' | 'OK'

interface AccountRow {
  account_id: string
  account_name: string | null
  account_status: number
  disable_reason: number
  balance_cents: number
  amount_spent_cents: number
  spend_cap_cents: number | null
  currency: string
  severity: Severity
  bm_label: string | null
  snapshot_at: string
}

const STATUS_LABEL: Record<number, string> = {
  1: 'ATIVA',
  2: 'DESABILITADA',
  3: 'INADIMPLENTE',
  7: 'REVISÃO RISCO',
  8: 'AGUARDA PAGTO',
  9: 'PERÍODO GRAÇA',
  100: 'EM FECHAMENTO',
  101: 'FECHADA',
}

const DISABLE_LABEL: Record<number, string> = {
  0: '',
  1: 'Política Ads',
  2: 'IP Review',
  3: 'Risco Pagamento',
  4: 'Revisão Admin',
  5: 'Conta Comprometida',
  6: 'Umbrella',
  7: 'Conta Falsa',
}

const SEVERITY_RANK: Record<Severity, number> = {
  CRITICO: 0,
  ZERADA_ATIVA: 1,
  MEDIO: 2,
  OK: 3,
}

function brl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min atrás`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.round(hrs / 24)}d atrás`
}

function SeverityPill({ severity }: { severity: Severity }) {
  const config: Record<Severity, { label: string; cls: string; Icon: typeof AlertTriangle }> = {
    CRITICO:     { label: 'Crítico',      cls: 'bg-red-500/15 text-red-500 border-red-500/30',           Icon: AlertTriangle },
    ZERADA_ATIVA:{ label: 'Zerada',       cls: 'bg-orange-500/15 text-orange-500 border-orange-500/30',  Icon: BatteryLow },
    MEDIO:       { label: 'Saldo baixo',  cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30',     Icon: TrendingDown },
    OK:          { label: 'OK',           cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', Icon: CheckCircle2 },
  }
  const { label, cls, Icon } = config[severity]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function SummaryCard({
  title, value, hint, Icon, accent,
}: {
  title: string
  value: number | string
  hint?: string
  Icon: typeof AlertTriangle
  accent: 'red' | 'orange' | 'amber' | 'emerald' | 'primary'
}) {
  const accentCls: Record<typeof accent, string> = {
    red: 'text-red-500 bg-red-500/10',
    orange: 'text-orange-500 bg-orange-500/10',
    amber: 'text-amber-500 bg-amber-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    primary: 'text-primary bg-primary/10',
  } as const
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${accentCls[accent]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

export default function Trafego() {
  const [severityFilter, setSeverityFilter] = useState<'TODOS' | Severity>('TODOS')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ATIVA' | 'PROBLEMA'>('TODOS')
  const [search, setSearch] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['meta-ad-accounts-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_ad_accounts_latest' as never)
        .select('*')
      if (error) throw error
      return (data || []) as unknown as AccountRow[]
    },
    refetchInterval: 60_000,
  })

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const resp = await fetch(REFRESH_WEBHOOK_URL, { method: 'POST' })
      if (!resp.ok) throw new Error(`Webhook respondeu ${resp.status}`)
      toast.success('Sincronizando com a Meta...')
      // n8n leva ~3-5s pra rodar o sweep e gravar no Supabase
      await new Promise((r) => setTimeout(r, 4500))
      await refetch()
      toast.success('Dados atualizados')
    } catch (e) {
      toast.error('Falha ao sincronizar: ' + (e as Error).message)
    } finally {
      setIsRefreshing(false)
    }
  }

  const rows = data ?? []

  const summary = useMemo(() => {
    const totals = { total: rows.length, criticos: 0, zeradas: 0, baixos: 0, ok: 0, spendTotal: 0 }
    for (const r of rows) {
      if (r.severity === 'CRITICO') totals.criticos++
      else if (r.severity === 'ZERADA_ATIVA') totals.zeradas++
      else if (r.severity === 'MEDIO') totals.baixos++
      else totals.ok++
      totals.spendTotal += r.amount_spent_cents
    }
    return totals
  }, [rows])

  const lastUpdate = useMemo(() => {
    if (!rows.length) return null
    return rows.reduce((acc, r) => (r.snapshot_at > acc ? r.snapshot_at : acc), rows[0].snapshot_at)
  }, [rows])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return rows
      .filter((r) => severityFilter === 'TODOS' || r.severity === severityFilter)
      .filter((r) => {
        if (statusFilter === 'TODOS') return true
        if (statusFilter === 'ATIVA') return r.account_status === 1
        return r.account_status !== 1
      })
      .filter((r) => {
        if (!s) return true
        return (
          (r.account_name || '').toLowerCase().includes(s) ||
          r.account_id.toLowerCase().includes(s)
        )
      })
      .sort((a, b) => {
        const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        if (rank !== 0) return rank
        return b.amount_spent_cents - a.amount_spent_cents
      })
  }, [rows, severityFilter, statusFilter, search])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tráfego</h1>
          <p className="text-sm text-muted-foreground">
            Saldo e status das contas Meta Ads monitoradas pelo workflow{' '}
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">SVI Traffic - Saldo Watcher</span>.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isFetching}
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
        >
          {(isRefreshing || isFetching) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {isRefreshing ? 'Sincronizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard title="Total" value={summary.total} Icon={Battery} accent="primary" />
        <SummaryCard title="Crítico" value={summary.criticos} hint="Status inativo" Icon={AlertTriangle} accent="red" />
        <SummaryCard title="Zerada Ativa" value={summary.zeradas} hint="Saldo R$ 0,00" Icon={BatteryLow} accent="orange" />
        <SummaryCard title="Saldo Baixo" value={summary.baixos} hint="< R$ 50,00" Icon={TrendingDown} accent="amber" />
        <SummaryCard title="OK" value={summary.ok} Icon={CheckCircle2} accent="emerald" />
      </div>

      {lastUpdate && (
        <p className="text-xs text-muted-foreground">
          Último snapshot: <span className="font-medium">{timeAgo(lastUpdate)}</span> · gasto histórico total{' '}
          <span className="font-medium">{brl(summary.spendTotal)}</span>
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou ID da conta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas severidades</SelectItem>
            <SelectItem value="CRITICO">Crítico</SelectItem>
            <SelectItem value="ZERADA_ATIVA">Zerada ativa</SelectItem>
            <SelectItem value="MEDIO">Saldo baixo</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos status</SelectItem>
            <SelectItem value="ATIVA">Apenas ativas</SelectItem>
            <SelectItem value="PROBLEMA">Apenas com problema</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando contas...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">
            Erro ao carregar: {(error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <h3 className="font-medium">Nenhum snapshot disponível ainda</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ative o workflow{' '}
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">SVI Traffic - Saldo Watcher</span>{' '}
              no n8n. Ele roda 2x/dia (9h e 17h) e popula esta tabela automaticamente.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma conta corresponde aos filtros.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Gasto histórico</TableHead>
                <TableHead className="text-right">BM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const disabledLabel = r.disable_reason ? DISABLE_LABEL[r.disable_reason] : ''
                return (
                  <TableRow key={r.account_id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium leading-tight">{r.account_name || '(sem nome)'}</span>
                        <span className="text-xs text-muted-foreground font-mono">{r.account_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{STATUS_LABEL[r.account_status] || r.account_status}</span>
                        {disabledLabel && (
                          <span className="text-[10px] uppercase tracking-wider text-red-500">{disabledLabel}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <SeverityPill severity={r.severity} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={r.balance_cents < 5000 ? 'text-amber-500 font-medium' : ''}>
                        {brl(r.balance_cents)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {brl(r.amount_spent_cents)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {r.bm_label || '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
