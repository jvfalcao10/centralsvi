import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Loader2, RefreshCw, Wallet, MessageSquare, TrendingUp, Reply,
  AlertTriangle, ExternalLink, ChevronDown, ArrowDown, ArrowUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Leitura da Meta na hora, pela rota anuncios-ao-vivo. Ver api/_lib/anuncios-ao-vivo.ts.

type Numeros = { gasto: number; conversas: number; segunda: number; leads: number; impressoes: number; cliques: number }
type Periodo = 'hoje' | 'ontem' | '7d' | '7d_ant' | '30d' | '30d_ant'
type Conta = {
  id: string
  nome: string
  status: number
  saldo: number | null
  cartao: string | null
  diasDeSaldo: number | null
  periodos: Record<Periodo, Numeros>
}
type Carteira = { atualizadoEm: string; contas: Conta[]; falhas: string[]; intervalos: Record<Periodo, { since: string; until: string }> }
type Conjunto = Numeros & { id: string; campanha: string; conjunto: string; frequencia: number }

const ABAS: { id: Periodo; rotulo: string; anterior?: Periodo }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'ontem', rotulo: 'Ontem' },
  { id: '7d', rotulo: '7 dias', anterior: '7d_ant' },
  { id: '30d', rotulo: '30 dias', anterior: '30d_ant' },
]

const ORDENS = [
  { id: 'gasto', rotulo: 'Maior gasto' },
  { id: 'custo', rotulo: 'Custo mais alto' },
  { id: 'saldo', rotulo: 'Saldo acabando' },
] as const

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const custo = (n: Numeros) => (n.conversas > 0 ? n.gasto / n.conversas : null)
const variacao = (atual: number | null, antes: number | null) =>
  atual != null && antes != null && antes > 0 ? ((atual - antes) / antes) * 100 : null
const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
const soma = (contas: Conta[], p: Periodo): Numeros =>
  contas.reduce((t, c) => {
    const n = c.periodos[p]
    return {
      gasto: t.gasto + n.gasto, conversas: t.conversas + n.conversas, segunda: t.segunda + n.segunda,
      leads: t.leads + n.leads, impressoes: t.impressoes + n.impressoes, cliques: t.cliques + n.cliques,
    }
  }, { gasto: 0, conversas: 0, segunda: 0, leads: 0, impressoes: 0, cliques: 0 })

async function chamar(params: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(`/api/r?__rota=anuncios-ao-vivo${params}`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(corpo.error || `falhou (${r.status})`)
  return corpo
}

type Alerta = { conta: string; texto: string; grave: boolean; ordem: number }

/** O que precisa de gente olhando hoje. Só sinal com dado suficiente para não virar ruído. */
function alertas(contas: Conta[]): Alerta[] {
  const lista: Alerta[] = []
  const horaBrasilia = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  for (const c of contas) {
    const semana = c.periodos['7d']
    if (c.status !== 1) {
      lista.push({ conta: c.nome, texto: 'conta com restrição na Meta, abrir o Gerenciador', grave: true, ordem: 0 })
    }
    if (c.saldo != null && c.saldo <= 1 && semana.gasto > 0) {
      lista.push({ conta: c.nome, texto: 'sem saldo, anúncios parados', grave: true, ordem: 1 })
    } else if (c.diasDeSaldo != null && c.diasDeSaldo <= 5) {
      lista.push({ conta: c.nome, texto: `saldo de ${brl(c.saldo || 0)} dá para uns ${c.diasDeSaldo.toLocaleString('pt-BR')} dias`, grave: c.diasDeSaldo <= 2, ordem: 2 + c.diasDeSaldo })
    }
    const agora = custo(semana), antes = custo(c.periodos['7d_ant'])
    const v = variacao(agora, antes)
    // Base pequena vira ruído: 1 conversa na semana anterior não serve de régua.
    if (v != null && v >= 30 && semana.conversas >= 5 && c.periodos['7d_ant'].conversas >= 5) {
      lista.push({ conta: c.nome, texto: `custo por conversa subiu ${Math.round(v)}% na semana (${brl(antes!)} para ${brl(agora!)})`, grave: false, ordem: 20 })
    }
    if (horaBrasilia >= 12 && c.periodos.hoje.gasto === 0 && c.periodos.ontem.gasto > 0 && !(c.saldo != null && c.saldo <= 1)) {
      lista.push({ conta: c.nome, texto: 'não gastou nada hoje, gastou ontem', grave: false, ordem: 30 })
    }
  }
  return lista.sort((a, b) => a.ordem - b.ordem)
}

export default function AnunciosAoVivo() {
  const [periodo, setPeriodo] = useState<Periodo>('7d')
  const [ordem, setOrdem] = useState<typeof ORDENS[number]['id']>('gasto')
  const [aberta, setAberta] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, error, isFetching } = useQuery<Carteira>({
    queryKey: ['anuncios-ao-vivo'],
    queryFn: () => chamar(''),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
  })

  const atualizar = async () => {
    const novo = await chamar('&fresh=1').catch(() => null)
    if (novo) qc.setQueryData(['anuncios-ao-vivo'], novo)
    else qc.invalidateQueries({ queryKey: ['anuncios-ao-vivo'] })
  }

  const aba = ABAS.find(a => a.id === periodo)!
  const contas = data?.contas || []
  const ativas = useMemo(
    () => contas.filter(c => c.periodos[periodo].gasto > 0 || (aba.anterior && c.periodos[aba.anterior].gasto > 0)),
    [contas, periodo, aba.anterior],
  )
  const total = useMemo(() => soma(ativas, periodo), [ativas, periodo])
  const totalAntes = useMemo(() => (aba.anterior ? soma(ativas, aba.anterior) : null), [ativas, aba.anterior])
  const avisos = useMemo(() => alertas(contas), [contas])

  const ordenadas = useMemo(() => {
    const l = [...ativas]
    if (ordem === 'gasto') l.sort((a, b) => b.periodos[periodo].gasto - a.periodos[periodo].gasto)
    if (ordem === 'custo') l.sort((a, b) => (custo(b.periodos[periodo]) ?? -1) - (custo(a.periodos[periodo]) ?? -1))
    if (ordem === 'saldo') l.sort((a, b) => (a.diasDeSaldo ?? 999) - (b.diasDeSaldo ?? 999))
    return l
  }, [ativas, ordem, periodo])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Lendo as contas na Meta…
      </div>
    )
  }
  if (error) {
    return (
      <Card className="border-rose-500/40">
        <CardContent className="p-4 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p>{(error as Error).message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={atualizar}>Tentar de novo</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const faixa = data!.intervalos[periodo]
  const lidoAs = new Date(data!.atualizadoEm).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  const custoTotal = custo(total)
  const custoAntes = totalAntes ? custo(totalAntes) : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 overflow-x-auto flex-nowrap rounded-lg bg-muted p-1 max-w-full">
          {ABAS.map(a => (
            <button
              key={a.id}
              onClick={() => setPeriodo(a.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors',
                periodo === a.id ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Lido da Meta às {lidoAs}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={atualizar} disabled={isFetching} aria-label="Atualizar">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        {faixa.since === faixa.until ? dataCurta(faixa.since) : `${dataCurta(faixa.since)} a ${dataCurta(faixa.until)}`}
        {aba.anterior && data ? ` · comparado com ${dataCurta(data.intervalos[aba.anterior].since)} a ${dataCurta(data.intervalos[aba.anterior].until)}` : ''}
        {' · '}{ativas.length} contas
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Wallet} rotulo="Investido" valor={brl(total.gasto)} delta={variacao(total.gasto, totalAntes?.gasto ?? null)} neutro />
        <Kpi icon={MessageSquare} rotulo="Conversas" valor={total.conversas.toLocaleString('pt-BR')} delta={variacao(total.conversas, totalAntes?.conversas ?? null)} />
        <Kpi icon={TrendingUp} rotulo="Custo por conversa" valor={custoTotal ? brl(custoTotal) : '—'} delta={variacao(custoTotal, custoAntes)} menorMelhor />
        <Kpi
          icon={Reply}
          rotulo="Responderam a 1ª mensagem"
          valor={total.segunda.toLocaleString('pt-BR')}
          detalhe={total.conversas > 0 ? `${Math.round((total.segunda / total.conversas) * 100)}% das conversas` : undefined}
        />
      </div>

      {avisos.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Precisa de atenção
            </p>
            <ul className="space-y-1.5 text-sm">
              {avisos.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', a.grave ? 'bg-rose-500' : 'bg-amber-500')} />
                  <span className="min-w-0"><span className="font-medium">{a.conta}:</span> {a.texto}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-1 overflow-x-auto flex-nowrap">
        {ORDENS.map(o => (
          <button
            key={o.id}
            onClick={() => setOrdem(o.id)}
            className={cn(
              'px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-colors',
              ordem === o.id ? 'border-foreground/40 bg-accent font-medium' : 'border-border text-muted-foreground',
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {ordenadas.map(c => (
          <CartaoConta
            key={c.id}
            conta={c}
            periodo={periodo}
            anterior={aba.anterior}
            aberta={aberta === c.id}
            alternar={() => setAberta(aberta === c.id ? null : c.id)}
          />
        ))}
      </div>

      {data!.falhas.length > 0 && (
        <p className="text-xs text-muted-foreground">Não consegui ler: {data!.falhas.join(', ')}.</p>
      )}
    </div>
  )
}

function CartaoConta({ conta: c, periodo, anterior, aberta, alternar }: {
  conta: Conta; periodo: Periodo; anterior?: Periodo; aberta: boolean; alternar: () => void
}) {
  const n = c.periodos[periodo]
  const a = anterior ? c.periodos[anterior] : null
  const cpc = custo(n)
  const semConversa = n.conversas === 0 && n.leads === 0

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium min-w-0 truncate">{c.nome}</p>
          <SeloSaldo conta={c} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <Metrica rotulo="Investido" valor={brl(n.gasto)} />
          {semConversa ? (
            <>
              <Metrica rotulo="Cliques" valor={n.cliques.toLocaleString('pt-BR')} />
              <Metrica rotulo="Custo por clique" valor={n.cliques ? brl(n.gasto / n.cliques) : '—'} />
              <Metrica rotulo="Impressões" valor={n.impressoes.toLocaleString('pt-BR')} />
            </>
          ) : (
            <>
              <Metrica
                rotulo="Conversas"
                valor={n.conversas.toLocaleString('pt-BR')}
                delta={a ? variacao(n.conversas, a.conversas) : null}
              />
              <Metrica
                rotulo="Custo/conversa"
                valor={cpc ? brl(cpc) : '—'}
                delta={a ? variacao(cpc, custo(a)) : null}
                menorMelhor
                antes={a && custo(a) ? brl(custo(a)!) : undefined}
              />
              {n.leads > 0 ? (
                // Sem custo por lead: o gasto da conta mistura campanha de conversa e de formulário.
                <Metrica rotulo="Leads" valor={n.leads.toLocaleString('pt-BR')} />
              ) : (
                <Metrica
                  rotulo="Responderam"
                  valor={n.conversas ? `${n.segunda} · ${Math.round((n.segunda / n.conversas) * 100)}%` : '—'}
                />
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={alternar}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition-colors"
          >
            Conjuntos <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', aberta && 'rotate-180')} />
          </button>
          <a
            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${c.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition-colors"
          >
            Gerenciador <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        </div>

        {aberta && <Conjuntos conta={c.id} periodo={periodo} />}
      </CardContent>
    </Card>
  )
}

function Conjuntos({ conta, periodo }: { conta: string; periodo: Periodo }) {
  const { data, isLoading, error } = useQuery<{ conjuntos: Conjunto[] }>({
    queryKey: ['anuncios-ao-vivo', conta, periodo],
    queryFn: () => chamar(`&conta=${conta}&periodo=${periodo}`),
    staleTime: 5 * 60 * 1000,
  })
  if (isLoading) return <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Lendo conjuntos…</p>
  if (error) return <p className="text-xs text-rose-500">{(error as Error).message}</p>
  const lista = data?.conjuntos || []
  if (!lista.length) return <p className="text-xs text-muted-foreground">Nenhum conjunto gastou nesse período.</p>
  return (
    <div className="border-t border-border pt-3 space-y-2.5">
      {lista.map(l => {
        const cpc = custo(l)
        return (
          <div key={l.id} className="text-xs flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium break-words">{l.conjunto}</p>
              <p className="text-muted-foreground break-words">{l.campanha}</p>
            </div>
            <div className="text-right shrink-0 tabular-nums">
              <p className="font-medium">{brl(l.gasto)}</p>
              <p className="text-muted-foreground">
                {l.conversas ? `${l.conversas} conv · ${brl(cpc!)}` : l.leads ? `${l.leads} leads` : `${l.cliques} cliques`}
              </p>
              <p className={cn('text-muted-foreground', l.frequencia >= 2.5 && 'text-amber-500')}>freq {l.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SeloSaldo({ conta: c }: { conta: Conta }) {
  if (c.saldo == null) {
    return <Badge variant="outline" className="shrink-0 text-muted-foreground font-normal">Cartão</Badge>
  }
  const zerada = c.saldo <= 1
  const curto = c.diasDeSaldo != null && c.diasDeSaldo <= 5
  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0 font-normal tabular-nums',
        zerada ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
          : curto ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
          : 'text-muted-foreground',
      )}
    >
      {zerada ? 'Sem saldo' : `Saldo ${brl(c.saldo)}${c.diasDeSaldo != null ? ` · ${c.diasDeSaldo.toLocaleString('pt-BR')} d` : ''}`}
    </Badge>
  )
}

function Seta({ delta, menorMelhor, neutro }: { delta: number | null; menorMelhor?: boolean; neutro?: boolean }) {
  if (delta == null || Math.abs(delta) < 1) return null
  const subiu = delta > 0
  const bom = neutro ? null : menorMelhor ? !subiu : subiu
  const Icone = subiu ? ArrowUp : ArrowDown
  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium tabular-nums',
      bom == null ? 'text-muted-foreground' : bom ? 'text-emerald-500' : 'text-rose-500',
    )}>
      <Icone className="h-3 w-3" />{Math.abs(Math.round(delta))}%
    </span>
  )
}

function Kpi({ icon: Icon, rotulo, valor, delta, detalhe, menorMelhor, neutro }: {
  icon: any; rotulo: string; valor: string; delta?: number | null; detalhe?: string; menorMelhor?: boolean; neutro?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{rotulo}</p>
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        <p className="text-xl font-bold tabular-nums mt-1">{valor}</p>
        <div className="mt-1 min-h-4 flex items-center gap-2 text-xs text-muted-foreground">
          {delta != null && <Seta delta={delta} menorMelhor={menorMelhor} neutro={neutro} />}
          {detalhe && <span>{detalhe}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function Metrica({ rotulo, valor, delta, menorMelhor, antes }: {
  rotulo: string; valor: string; delta?: number | null; menorMelhor?: boolean; antes?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="font-semibold tabular-nums text-sm flex items-center gap-1.5 flex-wrap">
        {valor}
        {delta != null && <Seta delta={delta} menorMelhor={menorMelhor} />}
      </p>
      {antes && <p className="text-[11px] text-muted-foreground tabular-nums">antes {antes}</p>}
    </div>
  )
}
