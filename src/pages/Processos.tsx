import { useState } from 'react'
import { BookOpen, AlertTriangle, CheckCircle2, Clock, User, Lightbulb, Repeat } from 'lucide-react'
import { PROCESSOS } from '@/data/processos'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * Processos de entrega, do contrato ao go-live.
 *
 * Mora na Central e não no ClickUp por decisão do João (11/08/2026): a meta é
 * sair do ClickUp até nov/26, então processo novo lá só aumenta a migração. E
 * vira ativo de produto quando a Central for vendida pra outras agências.
 */

const COR: Record<string, { borda: string; texto: string; fundo: string }> = {
  primary: { borda: 'border-primary/30', texto: 'text-primary', fundo: 'bg-primary/10' },
  info:    { borda: 'border-info/30',    texto: 'text-info',    fundo: 'bg-info/10' },
  success: { borda: 'border-success/30', texto: 'text-success', fundo: 'bg-success/10' },
}

export default function Processos() {
  const [aba, setAba] = useState(PROCESSOS[0].id)

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Processos de Entrega
        </h1>
        <p className="text-sm text-muted-foreground">
          O que a SVI faz do contrato assinado até o cliente no ar, por oferta.
        </p>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="bg-muted flex-wrap h-auto">
          {PROCESSOS.map(p => (
            <TabsTrigger key={p.id} value={p.id}>{p.nome}</TabsTrigger>
          ))}
        </TabsList>

        {PROCESSOS.map(p => {
          const c = COR[p.cor]
          return (
            <TabsContent key={p.id} value={p.id} className="space-y-4 mt-4">
              {/* cabeçalho da oferta */}
              <Card className={`${c.borda} bg-card`}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className={`text-lg font-bold ${c.texto}`}>{p.nome}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{p.resumo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className={`text-xs ${c.fundo} ${c.texto} ${c.borda}`}>
                        <Clock className="h-3 w-3 mr-1" />{p.prazo}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{p.preco}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.escopo.map(e => (
                      <Badge key={e} variant="outline" className="text-xs font-normal">{e}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* doutrina, quando tem */}
              {p.doutrina && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
                  <p className="text-sm font-semibold text-warning flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" /> {p.doutrina.titulo}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{p.doutrina.texto}</p>
                </div>
              )}

              {/* fases */}
              <div className="space-y-3">
                {p.fases.map(f => (
                  <div key={f.n} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2.5">
                      <span className={`shrink-0 w-8 h-8 rounded-lg grid place-items-center text-sm font-bold ${c.fundo} ${c.texto}`}>
                        {f.n}
                      </span>
                      <span className="font-semibold text-sm">{f.titulo}</span>
                      <Badge variant="outline" className="text-xs">{f.prazo}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                        <User className="h-3 w-3" />{f.dono}
                      </span>
                    </div>

                    <div className="p-4 space-y-2.5">
                      {f.passos.map((passo, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                          <p className="text-sm text-muted-foreground leading-snug">
                            {passo.texto}
                            {passo.proposto && (
                              <Badge variant="outline" className="ml-2 text-[10px] bg-muted text-muted-foreground align-middle">
                                proposto, ainda não é prática
                              </Badge>
                            )}
                          </p>
                        </div>
                      ))}

                      {f.alerta && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/5 p-3 mt-1">
                          <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                          <p className="text-sm text-muted-foreground leading-snug">{f.alerta}</p>
                        </div>
                      )}

                      <p className="text-xs pt-1">
                        <span className="text-muted-foreground">Saída: </span>
                        <span className="text-success">{f.saida}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* rotina permanente */}
              {p.rotina && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">A rotina depois do go-live</span>
                  </div>
                  <div className="divide-y divide-border">
                    {p.rotina.map(r => (
                      <div key={r.quando} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs font-medium text-primary w-32 shrink-0">{r.quando}</span>
                        <span className="text-sm text-muted-foreground flex-1 min-w-0">{r.oque}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{r.quem}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
