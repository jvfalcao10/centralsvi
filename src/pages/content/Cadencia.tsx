import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * Cadência do mês por cliente.
 *
 * Regra do João, 11/10/2026: cada cliente recebe 4 a 6 posts de feed e 4
 * vídeos por mês, somente. Veio da auditoria que achou contas de 2 a 25 posts
 * sem critério, e provou que volume não traz resultado: a Dra. Ênia postou o
 * dobro e a mediana de engajamento caiu de 82 para 19.
 *
 * Isso vivia em cadencia.svicompany.com.br, um painel à parte. João, 19/10:
 * "a cadência deve estar dentro da Central SVI, porque quero que a social
 * media tenha acesso". Quem monta a pauta precisa ver o ritmo antes de montar.
 */
type Linha = {
  client: string; username: string; feed: number; video: number
  ultimo: string | null; ultimoLink: string | null
  status: 'em dia' | 'atrasado' | 'parado' | 'acima' | 'sem acesso'
}
type Dados = { geradoEm: string; dia: number; diasNoMes: number; meta: { feedMin: number; feedMax: number; video: number }; clientes: Linha[] }

const CORES: Record<Linha['status'], string> = {
  'em dia': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  atrasado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  parado: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  acima: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  'sem acesso': 'bg-muted text-muted-foreground border-border',
}
/** Ordem de quem precisa de atenção primeiro. */
const PESO: Record<Linha['status'], number> = { parado: 0, atrasado: 1, acima: 2, 'em dia': 3, 'sem acesso': 4 }

const diasAtras = (iso: string | null) => {
  if (!iso) return null
  return Math.floor((Date.now() - Date.parse(iso)) / 86400000)
}

/** Barrinha do quanto já saiu contra a meta. */
function Barra({ feito, meta, cor }: { feito: number; meta: number; cor: string }) {
  const pct = Math.min(100, Math.round((feito / Math.max(1, meta)) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-sm">{feito}<span className="text-muted-foreground">/{meta}</span></span>
    </div>
  )
}

export default function Cadencia() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true); setErro('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Entre na Central novamente.')
      const r = await fetch('/api/r?__rota=cadencia', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Não consegui carregar a cadência.')
      setDados(d)
    } catch (e) { setErro((e as Error).message) } finally { setCarregando(false) }
  }
  useEffect(() => { void carregar() }, [])

  const linhas = useMemo(() => {
    if (!dados) return []
    return [...dados.clientes].sort((a, b) => PESO[a.status] - PESO[b.status] || a.client.localeCompare(b.client, 'pt-BR'))
  }, [dados])
  const contagem = useMemo(() => {
    const c: Partial<Record<Linha['status'], number>> = {}
    for (const l of linhas) c[l.status] = (c[l.status] || 0) + 1
    return c
  }, [linhas])

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
            <Activity className="h-6 w-6 shrink-0 text-primary" /> Cadência do mês
          </h1>
          {dados && (
            <p className="mt-1 text-sm text-muted-foreground">
              Dia {dados.dia} de {dados.diasNoMes}. A régua da casa é {dados.meta.feedMin} a {dados.meta.feedMax} posts de feed e {dados.meta.video} vídeos por mês, por cliente. Story não entra na conta.
            </p>
          )}
          <Link to="/content/social" className="mt-2 inline-flex text-sm text-primary underline underline-offset-4">Ir para o quadro de postagens →</Link>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={carregando}
          className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition hover:bg-muted disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </header>

      {erro && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
      {carregando && !dados && <p className="py-10 text-center text-sm text-muted-foreground">Lendo o Instagram de cada conta…</p>}

      {dados && (
        <>
          <div className="flex flex-wrap gap-2">
            {(['parado', 'atrasado', 'acima', 'em dia', 'sem acesso'] as const).map(s => contagem[s] ? (
              <span key={s} className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${CORES[s]}`}>
                {contagem[s]} {s}
              </span>
            ) : null)}
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Feed</th>
                  <th className="px-4 py-3 font-medium">Vídeos</th>
                  <th className="px-4 py-3 font-medium">Último post</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map(l => {
                  const dias = diasAtras(l.ultimo)
                  return (
                    <tr key={l.client} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium leading-snug">{l.client}</p>
                        <a href={`https://instagram.com/${l.username}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          @{l.username} <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3"><Barra feito={l.feed} meta={dados.meta.feedMin} cor={l.feed > dados.meta.feedMax ? 'bg-sky-500' : 'bg-primary'} /></td>
                      <td className="px-4 py-3"><Barra feito={l.video} meta={dados.meta.video} cor="bg-primary" /></td>
                      <td className="px-4 py-3">
                        {dias === null ? <span className="text-muted-foreground">nunca</span> : (
                          <a href={l.ultimoLink || '#'} target="_blank" rel="noreferrer"
                            className={dias >= 7 ? 'text-rose-400 hover:underline' : 'hover:underline'}>
                            {dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${CORES[l.status]}`}>
                          {(l.status === 'parado' || l.status === 'atrasado') && <AlertTriangle className="h-3 w-3" />}
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Lido direto do Instagram de cada conta, com cache de 30 minutos. "Atrasado" compara com o ritmo esperado para o dia do mês, não com a meta cheia.
          </p>
        </>
      )}
    </div>
  )
}
