import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ExternalLink, Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/**
 * Datas Estratégicas — fonte ÚNICA da casa.
 * Lê /datas.json (servido pela própria Central). A mesma fonte que a Sofia
 * consome no n8n pra lembrar o time todo dia 8h. Pra mudar/adicionar data:
 * editar public/datas.json e dar push (Vercel + Sofia acompanham sozinhos).
 */

type Evento = {
  dm: string // "dd/mm"
  mes: string
  cat: 'med' | 'sau' | 'com' | 'fem' | 'fer' | 'pop'
  nome: string
  ty: string
  cli: string[]
  note?: string
}
type Datas = {
  atualizado: string
  faixas: Record<string, string[]>
  eventos: Evento[]
}

const MONTH_ORDER = ['Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro']

const CAT: Record<Evento['cat'], { label: string; cls: string }> = {
  med: { label: 'Médico', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  sau: { label: 'Saúde', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  com: { label: 'Comercial', cls: 'bg-primary/20 text-primary border-primary/30' },
  fem: { label: 'Beleza', cls: 'bg-pink-500/15 text-pink-300 border-pink-500/30' },
  fer: { label: 'Feriado', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  pop: { label: 'Pop', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
}

function parseDM(dm: string): Date {
  const [d, m] = dm.split('/').map(Number)
  return new Date(2026, (m || 1) - 1, d || 1)
}
function daysUntil(dm: string): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const evt = parseDM(dm)
  return Math.round((evt.getTime() - today.getTime()) / 86400000)
}

export default function Datas() {
  const [data, setData] = useState<Datas | null>(null)
  const [err, setErr] = useState(false)
  const [cat, setCat] = useState<string>('all')

  useEffect(() => {
    fetch('/datas.json?v=' + Date.now())
      .then(r => r.json())
      .then(setData)
      .catch(() => setErr(true))
  }, [])

  const proximos = useMemo(() => {
    if (!data) return []
    return data.eventos
      .map(e => ({ e, d: daysUntil(e.dm) }))
      .filter(x => x.d >= 0 && x.d <= 7)
      .sort((a, b) => a.d - b.d)
  }, [data])

  const porMes = useMemo(() => {
    if (!data) return []
    const filt = cat === 'all' ? data.eventos : data.eventos.filter(e => e.cat === cat)
    return MONTH_ORDER.map(mes => ({
      mes,
      faixa: data.faixas[mes] || [],
      eventos: filt
        .filter(e => e.mes === mes)
        .sort((a, b) => parseDM(a.dm).getTime() - parseDM(b.dm).getTime()),
    })).filter(g => g.faixa.length || g.eventos.length)
  }, [data, cat])

  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Datas Estratégicas
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Fonte única da casa. Cada data já mapeada por cliente (oficiais + pop de engajamento),
            ago→dez 2026. A <b className="text-foreground">Sofia</b> lê este mesmo calendário e avisa o
            grupo SVI Geral todo dia às 8h.
          </p>
        </div>
        {data && (
          <div className="text-xs text-muted-foreground text-right">
            Atualizado {data.atualizado}
            <br />
            <span className="opacity-70">edite public/datas.json</span>
          </div>
        )}
      </div>

      {err && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Não consegui carregar o calendário (datas.json). Confere o deploy.
        </div>
      )}
      {!data && !err && (
        <div className="text-sm text-muted-foreground">Carregando calendário…</div>
      )}

      {/* PRÓXIMOS 7 DIAS */}
      {proximos.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3 text-primary font-semibold">
            <Bell className="h-4 w-4" /> Próximos 7 dias
          </div>
          <div className="space-y-2">
            {proximos.map(({ e, d }, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-primary w-16 shrink-0">
                  {d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d}d`}
                </span>
                <span className="text-muted-foreground w-12 shrink-0">{e.dm}</span>
                <span className="font-medium">{e.nome}</span>
                <Badge variant="outline" className={CAT[e.cat].cls}>{CAT[e.cat].label}</Badge>
                <span className="text-muted-foreground text-xs">→ {e.cli.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTRO CATEGORIA */}
      {data && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={cat === 'all'} onClick={() => setCat('all')} label="Tudo" />
          {(Object.keys(CAT) as Evento['cat'][]).map(k => (
            <FilterChip key={k} active={cat === k} onClick={() => setCat(k)} label={CAT[k].label} />
          ))}
        </div>
      )}

      {/* MESES */}
      {porMes.map(g => (
        <div key={g.mes} className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold text-primary mb-2">{g.mes}</h2>
          {g.faixa.map((f, i) => (
            <p
              key={i}
              className="text-sm text-muted-foreground mb-3 border-l-2 border-primary/40 pl-3"
              dangerouslySetInnerHTML={{ __html: f }}
            />
          ))}
          <div className="space-y-1.5">
            {g.eventos.map((e, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 text-sm py-1.5 border-b border-border/50 last:border-0"
              >
                <span className="font-bold w-12 shrink-0 text-foreground">{e.dm}</span>
                <span className="font-medium">{e.nome}</span>
                <Badge variant="outline" className={CAT[e.cat].cls}>{CAT[e.cat].label}</Badge>
                <span className="text-muted-foreground text-xs">{e.ty}</span>
                <span className="text-muted-foreground text-xs w-full sm:w-auto sm:ml-auto">
                  → {e.cli.join(', ')}
                  {e.note ? <span className="italic opacity-70"> · {e.note}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <footer className="text-xs text-muted-foreground pt-2 flex items-center gap-2">
        <ExternalLink className="h-3 w-3" />
        Calendário único · alimenta esta tela e a Sofia (n8n · lembrete 8h no grupo Geral).
      </footer>
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        'px-3 py-1 rounded-full text-xs font-semibold border transition-colors ' +
        (active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-transparent text-muted-foreground border-border hover:border-primary/50')
      }
    >
      {label}
    </button>
  )
}
