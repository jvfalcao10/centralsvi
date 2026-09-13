import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle2, ExternalLink, Loader2, QrCode, RefreshCw, Radio,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

type Status = 'ok' | 'atencao' | 'quebrado' | 'aguardando_qr'

interface Linha {
  nome: string
  instancia: string
  numeroEsperado: string
  numeroReal: string | null
  conectado: boolean
  numeroBate: boolean
  status: Status
  motivo: string
  ultimaCaptura: string | null
  horasSemCaptura: number | null
  ultimoLeadAtribuido: { em: string; anuncio: string | null; metaAceitou: boolean } | null
  linkWorkflow: string | null
  linkEventsManager: string
  nota?: string
}

interface Resposta {
  geradoEm: string
  comEventos: boolean
  fontes: Record<string, { ok: boolean; erro?: string }>
  resumo: { total: number; ok: number; atencao: number; quebrado: number; aguardandoQr: number }
  linhas: Linha[]
}

const STATUS_UI: Record<Status, { rotulo: string; classe: string; bolinha: string }> = {
  ok: { rotulo: 'De pé', classe: 'text-emerald-600 dark:text-emerald-400', bolinha: 'bg-emerald-500' },
  atencao: { rotulo: 'Atenção', classe: 'text-amber-600 dark:text-amber-400', bolinha: 'bg-amber-500' },
  quebrado: { rotulo: 'Quebrado', classe: 'text-red-600 dark:text-red-400', bolinha: 'bg-red-500' },
  aguardando_qr: { rotulo: 'Aguardando QR', classe: 'text-muted-foreground', bolinha: 'bg-zinc-400' },
}

const ORDEM: Record<Status, number> = { quebrado: 0, atencao: 1, aguardando_qr: 2, ok: 3 }

async function buscar(comEventos: boolean): Promise<Resposta> {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(`/api/trackeamento${comEventos ? '?eventos=1' : ''}`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  })
  if (!r.ok) throw new Error(`falhou: ${r.status}`)
  return r.json()
}

function quando(iso: string | null): string {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function telefone(n: string | null): string {
  if (!n) return '—'
  const d = n.replace(/\D/g, '').replace(/^55/, '')
  if (d.length < 10) return n
  return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`
}

export default function Trackeamento() {
  const [comEventos, setComEventos] = useState(false)
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['trackeamento', comEventos],
    queryFn: () => buscar(comEventos),
    staleTime: 60_000,
  })

  const linhas = [...(data?.linhas ?? [])].sort(
    (a, b) => ORDEM[a.status] - ORDEM[b.status] || a.nome.localeCompare(b.nome),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trackeamento</h1>
          <p className="text-sm text-muted-foreground">
            Anúncio, WhatsApp e Meta. Uma linha por cliente que roda clique para WhatsApp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={comEventos ? 'default' : 'outline'}
            size="sm"
            onClick={() => setComEventos((v) => !v)}
            disabled={isFetching}
          >
            {comEventos ? 'Com eventos' : 'Buscar eventos'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ['De pé', data.resumo.ok, 'text-emerald-600 dark:text-emerald-400'],
            ['Atenção', data.resumo.atencao, 'text-amber-600 dark:text-amber-400'],
            ['Quebrados', data.resumo.quebrado, 'text-red-600 dark:text-red-400'],
            ['Aguardando QR', data.resumo.aguardandoQr, 'text-muted-foreground'],
          ] as const).map(([rotulo, valor, classe]) => (
            <Card key={rotulo}>
              <CardContent className="p-4">
                <div className={`text-2xl font-semibold ${classe}`}>{valor}</div>
                <div className="text-xs text-muted-foreground">{rotulo}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Não consegui ler o estado: {String((error as Error).message)}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      <div className="space-y-2">
        {linhas.map((l) => {
          const ui = STATUS_UI[l.status]
          return (
            <Card key={l.instancia}>
              <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
                <div className="flex min-w-[200px] flex-1 items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ui.bolinha}`} />
                  <div>
                    <div className="font-medium">{l.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {telefone(l.numeroReal || l.numeroEsperado)}
                      {!l.numeroBate && l.numeroReal && (
                        <span className="text-red-600 dark:text-red-400">
                          {' '}(esperado {telefone(l.numeroEsperado)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-w-[150px]">
                  <div className={`text-sm font-medium ${ui.classe}`}>{ui.rotulo}</div>
                  <div className="text-xs text-muted-foreground">{l.motivo}</div>
                </div>

                <div className="min-w-[130px]">
                  <div className="text-xs text-muted-foreground">Última mensagem</div>
                  <div className="text-sm">
                    {l.linkWorkflow ? quando(l.ultimaCaptura) : '—'}
                    {l.horasSemCaptura !== null && l.horasSemCaptura >= 24 && (
                      <span className="text-amber-600 dark:text-amber-400"> ({l.horasSemCaptura}h)</span>
                    )}
                  </div>
                </div>

                <div className="min-w-[170px]">
                  <div className="text-xs text-muted-foreground">Último lead de anúncio</div>
                  {!data?.comEventos ? (
                    <div className="text-sm text-muted-foreground">clique em Buscar eventos</div>
                  ) : l.ultimoLeadAtribuido ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      {l.ultimoLeadAtribuido.metaAceitou
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      {quando(l.ultimoLeadAtribuido.em)}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">nenhum ainda</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {l.status === 'aguardando_qr' && (
                    <Badge variant="outline" className="gap-1">
                      <QrCode className="h-3 w-3" /> QR
                    </Badge>
                  )}
                  {l.linkWorkflow && (
                    <a href={l.linkWorkflow} target="_blank" rel="noreferrer"
                       className="text-muted-foreground hover:text-foreground" title="Abrir no n8n">
                      <Radio className="h-4 w-4" />
                    </a>
                  )}
                  <a href={l.linkEventsManager} target="_blank" rel="noreferrer"
                     className="text-muted-foreground hover:text-foreground" title="Abrir no Events Manager">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                {l.nota && (
                  <div className="w-full text-xs text-muted-foreground">{l.nota}</div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {data && (
        <p className="text-xs text-muted-foreground">
          Lido em {quando(data.geradoEm)}. O alerta automático continua rodando de 30 em 30 minutos
          no workflow Vigia do Trackeamento e avisa no WhatsApp quando algum canal cai.
        </p>
      )}
    </div>
  )
}
