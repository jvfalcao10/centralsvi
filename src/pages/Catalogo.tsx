import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Boxes, ExternalLink, Globe, Loader2, Moon, RefreshCw,
  Search, Workflow, WrenchIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Status = 'ok' | 'atencao' | 'quebrado' | 'dormente' | 'desconhecido'

interface Item {
  id: string
  nome: string
  tipo: 'site' | 'workflow'
  url: string | null
  dominioProprio: boolean
  criadoEm: string | null
  atualizadoEm: string | null
  diasParado: number | null
  ativo: boolean | null
  status: Status
  httpStatus: number | null
  ultimaExecucao: { em: string; status: string } | null
  flags: string[]
  grupo: string
}

interface Resposta {
  geradoEm: string
  comHealth: boolean
  fontes: Record<string, { ok: boolean; total: number; erro?: string; nota?: string }>
  resumo: {
    total: number; sites: number; workflows: number
    quebrados: number; dormentes: number; inacabados: number
  }
  itens: Item[]
}

const STATUS_UI: Record<Status, { rotulo: string; classe: string; bolinha: string }> = {
  ok:           { rotulo: 'No ar',        classe: 'text-emerald-600 dark:text-emerald-400', bolinha: 'bg-emerald-500' },
  atencao:      { rotulo: 'Atenção',      classe: 'text-amber-600 dark:text-amber-400',     bolinha: 'bg-amber-500' },
  quebrado:     { rotulo: 'Quebrado',     classe: 'text-red-600 dark:text-red-400',         bolinha: 'bg-red-500' },
  dormente:     { rotulo: 'Dormente',     classe: 'text-muted-foreground',                  bolinha: 'bg-zinc-400' },
  desconhecido: { rotulo: 'Sem checagem', classe: 'text-muted-foreground',                  bolinha: 'bg-zinc-300' },
}

async function buscar(comHealth: boolean): Promise<Resposta> {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(`/api/catalogo${comHealth ? '?health=1' : ''}`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  })
  if (!r.ok) throw new Error(`Falhou (${r.status})`)
  return r.json()
}

export default function Catalogo() {
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'tudo' | 'problemas' | 'inacabados'>('tudo')
  const [tipo, setTipo] = useState<'todos' | 'site' | 'workflow'>('todos')
  const [health, setHealth] = useState(false)

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['catalogo', health],
    queryFn: () => buscar(health),
    staleTime: 5 * 60_000,
  })

  // Inventário entra rápido; a checagem de saúde chega logo depois, sozinha.
  useEffect(() => {
    if (data && !data.comHealth && !health) setHealth(true)
  }, [data, health])

  const itens = useMemo(() => {
    let lista = data?.itens ?? []
    if (aba === 'problemas') lista = lista.filter(i => i.status === 'quebrado')
    if (aba === 'inacabados') lista = lista.filter(i => i.flags.length > 0)
    if (tipo !== 'todos') lista = lista.filter(i => i.tipo === tipo)
    const q = busca.trim().toLowerCase()
    if (q) {
      lista = lista.filter(i =>
        i.nome.toLowerCase().includes(q) ||
        (i.url || '').toLowerCase().includes(q) ||
        i.flags.some(f => f.toLowerCase().includes(q))
      )
    }
    return lista
  }, [data, aba, tipo, busca])

  const r = data?.resumo

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Boxes className="h-6 w-6" /> Catálogo
          </h1>
          <p className="text-sm text-muted-foreground">
            Tudo que a SVI já criou, vivo e checado na fonte. Nada é escrito à mão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/40">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="font-medium">Não consegui montar o catálogo.</p>
              <p className="text-muted-foreground">{String((error as Error).message)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && Object.entries(data.fontes).some(([, f]) => !f.ok) && (
        <Card className="border-amber-500/40">
          <CardContent className="space-y-1 pt-6 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Fonte fora do ar
            </p>
            {Object.entries(data.fontes).filter(([, f]) => !f.ok).map(([nome, f]) => (
              <p key={nome} className="text-muted-foreground">
                <span className="font-mono">{nome}</span>: {f.erro}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metrica titulo="Total" valor={r?.total} icone={Boxes} carregando={isLoading} />
        <Metrica titulo="Sites" valor={r?.sites} icone={Globe} carregando={isLoading} />
        <Metrica titulo="Workflows" valor={r?.workflows} icone={Workflow} carregando={isLoading} />
        <Metrica titulo="Quebrados" valor={r?.quebrados} icone={AlertTriangle} carregando={isLoading} tom="text-red-500" />
        <Metrica titulo="Inacabados" valor={r?.inacabados} icone={WrenchIcon} carregando={isLoading} tom="text-amber-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={aba} onValueChange={v => setAba(v as typeof aba)}>
          <TabsList>
            <TabsTrigger value="tudo">Tudo</TabsTrigger>
            <TabsTrigger value="problemas">
              Problemas{r?.quebrados ? ` (${r.quebrados})` : ''}
            </TabsTrigger>
            <TabsTrigger value="inacabados">
              Inacabados{r?.inacabados ? ` (${r.inacabados})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={tipo} onValueChange={v => setTipo(v as typeof tipo)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="site">Sites</TabsTrigger>
            <TabsTrigger value="workflow">Workflows</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, URL ou problema…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nada aqui. {aba === 'problemas' && 'Nenhum item quebrado — bom sinal.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {itens.map(i => <Linha key={i.id} item={i} />)}
        </div>
      )}

      {data && (
        <p className="text-xs text-muted-foreground">
          Gerado em {new Date(data.geradoEm).toLocaleString('pt-BR')}
          {data.comHealth ? ' · com checagem de saúde' : ' · checando saúde…'}
          {' · '}mostrando {itens.length} de {data.resumo.total}
          {Object.entries(data.fontes)
            .filter(([, f]) => f.ok && f.nota)
            .map(([nome, f]) => (
              <span key={nome} className="block">
                {nome}: {f.nota}
              </span>
            ))}
        </p>
      )}
    </div>
  )
}

function Metrica({
  titulo, valor, icone: Icone, carregando, tom,
}: {
  titulo: string; valor?: number; icone: any; carregando: boolean; tom?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="text-xs text-muted-foreground">{titulo}</p>
          {carregando
            ? <Skeleton className="mt-1 h-7 w-12" />
            : <p className={`text-2xl font-bold ${tom || ''}`}>{valor ?? '—'}</p>}
        </div>
        <Icone className={`h-5 w-5 ${tom || 'text-muted-foreground'}`} />
      </CardContent>
    </Card>
  )
}

function Linha({ item }: { item: Item }) {
  const ui = STATUS_UI[item.status]
  const Icone = item.tipo === 'site' ? Globe : Workflow

  return (
    <Card className="transition-colors hover:bg-accent/40">
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ui.bolinha}`} title={ui.rotulo} />
        <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />

        <div className="min-w-[180px] flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.nome}</span>
            {item.tipo === 'workflow' && item.ativo === false && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Moon className="h-3 w-3" /> off
              </Badge>
            )}
          </div>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              {item.url.replace(/^https?:\/\//, '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {item.flags.map(f => (
            <Badge key={f} variant="secondary" className="text-xs font-normal">{f}</Badge>
          ))}
        </div>

        <div className="ml-auto shrink-0 text-right text-xs">
          <p className={ui.classe}>
            {ui.rotulo}{item.httpStatus ? ` · ${item.httpStatus}` : ''}
          </p>
          <p className="text-muted-foreground">
            {item.diasParado === null
              ? '—'
              : item.diasParado === 0
                ? 'hoje'
                : `há ${item.diasParado}d`}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
