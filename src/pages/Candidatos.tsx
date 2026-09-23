import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { TECNICAS, ABERTAS } from '@/data/vagaTrafego'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, Trophy, AlertTriangle, ExternalLink, MessageCircle, Check, X } from 'lucide-react'

interface Candidato {
  id: string; criado_em: string; nome: string; whatsapp: string; email: string | null
  cidade: string | null; link_prova: string | null; anos_experiencia: number | null
  verba_gerida: string | null; contas_simultaneas: string | null; verticais: string[] | null
  disponibilidade: string | null; aceita_pj: boolean | null; pretensao: string | null
  situacao_atual: string | null; se_entrar: string | null; horas_dia: string | null
  respostas: Record<string, any>
  score_tecnico: number | null; score_aberto: number | null; score_total: number | null
  notas_dimensao: Record<string, number> | null
  parecer: string | null; pontos_fortes: string[] | null; alertas: string[] | null
  erro_correcao: string | null; status: string; observacao_interna: string | null
}

const STATUS = ['novo', 'triagem', 'entrevista', 'teste', 'reprovado', 'contratado'] as const
const STATUS_CLS: Record<string, string> = {
  novo: 'bg-muted text-muted-foreground border-border',
  triagem: 'bg-info/10 text-info border-info/30',
  entrevista: 'bg-warning/20 text-warning border-warning/30',
  teste: 'bg-primary/15 text-primary border-primary/30',
  reprovado: 'bg-destructive/10 text-destructive border-destructive/30',
  contratado: 'bg-success/20 text-success border-success/30',
}
const notaCls = (n: number | null) =>
  n == null ? 'text-muted-foreground' : n >= 75 ? 'text-success' : n >= 55 ? 'text-warning' : 'text-destructive'

export default function Candidatos() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [aberto, setAberto] = useState<Candidato | null>(null)

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['vaga-candidatos'],
    queryFn: async (): Promise<Candidato[]> => {
      const { data, error } = await supabase.from('vaga_candidatos').select('*')
        .order('score_total', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data || []) as Candidato[]
    },
  })

  const filtrados = useMemo(() => {
    let l = lista
    if (filtro !== 'todos') l = l.filter(c => c.status === filtro)
    const q = busca.trim().toLowerCase()
    if (q) l = l.filter(c => c.nome.toLowerCase().includes(q) || (c.cidade || '').toLowerCase().includes(q))
    return l
  }, [lista, filtro, busca])

  async function mudarStatus(c: Candidato, status: string) {
    const { error } = await supabase.from('vaga_candidatos').update({ status }).eq('id', c.id)
    if (error) return toast.error(`Não mudou: ${error.message}`)
    setAberto(a => (a && a.id === c.id ? { ...a, status } : a))
    qc.invalidateQueries({ queryKey: ['vaga-candidatos'] })
  }

  const wpp = (n: string) => `https://wa.me/${n.replace(/\D/g, '').length <= 11 ? '55' + n.replace(/\D/g, '') : n.replace(/\D/g, '')}`

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Candidatos · Gestor de tráfego</h1>
          <p className="text-sm text-muted-foreground">
            {lista.length} candidatura(s), ordenadas pela nota. Link do formulário:{' '}
            <a href="/vaga/trafego" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              central.svicompany.com.br/vaga/trafego
            </a>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-0 sm:min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou cidade..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-16">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-muted-foreground">
            {lista.length === 0 ? 'Nenhuma candidatura ainda.' : 'Nada com esses filtros.'}
          </p>
          {lista.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Divulgue o link do formulário. Assim que alguém responder, a nota aparece aqui sozinha.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((c, i) => (
            <button key={c.id} onClick={() => setAberto(c)}
              className="w-full text-left rounded-xl border border-border bg-card p-3 sm:p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="shrink-0 text-center w-12">
                  <div className={`text-xl font-bold ${notaCls(c.score_total)}`}>
                    {c.score_total == null ? '—' : Math.round(c.score_total)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">de 100</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                    {i === 0 && filtro === 'todos' && !busca && c.score_total != null && <Trophy className="h-3.5 w-3.5 text-primary" />}
                    {c.nome}
                    <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_CLS[c.status]}`}>{c.status}</Badge>
                    {(c.alertas?.length || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                        <AlertTriangle className="h-3 w-3" />{c.alertas!.length}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.cidade, c.verba_gerida, c.anos_experiencia ? `${c.anos_experiencia} anos` : null].filter(Boolean).join(' · ')}
                  </p>
                  {c.parecer && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.parecer}</p>}
                </div>
                <div className="hidden sm:block text-right shrink-0 text-xs text-muted-foreground">
                  <p>técnica <span className={notaCls(c.score_tecnico)}>{c.score_tecnico == null ? '—' : Math.round(c.score_tecnico)}</span></p>
                  <p>respostas <span className={notaCls(c.score_aberto)}>{c.score_aberto == null ? '—' : Math.round(c.score_aberto)}</span></p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!aberto} onOpenChange={o => !o && setAberto(null)}>
        <DialogContent className="sm:max-w-[720px]">
          {aberto && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {aberto.nome}
                  <span className={`text-xl font-bold ${notaCls(aberto.score_total)}`}>
                    {aberto.score_total == null ? '—' : Math.round(aberto.score_total)}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild className="gap-1.5">
                  <a href={wpp(aberto.whatsapp)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </Button>
                {aberto.link_prova && (
                  <Button size="sm" variant="outline" asChild className="gap-1.5">
                    <a href={aberto.link_prova} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Prova
                    </a>
                  </Button>
                )}
                <Select value={aberto.status} onValueChange={v => mudarStatus(aberto, v)}>
                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[['Cidade', aberto.cidade], ['Verba já gerida', aberto.verba_gerida],
                  ['Hoje faz', aberto.situacao_atual], ['Se entrar', aberto.se_entrar],
                  ['Tempo por dia', aberto.horas_dia],
                  ['Contas juntas', aberto.contas_simultaneas], ['Disponibilidade', aberto.disponibilidade],
                  ['Pretensão', aberto.pretensao], ['PJ', aberto.aceita_pj === null ? null : aberto.aceita_pj ? 'sim' : 'não'],
                  ['Experiência', aberto.anos_experiencia ? `${aberto.anos_experiencia} anos` : null],
                  ['Verticais', aberto.verticais?.join(', ')]].map(([k, v]) => (
                  <div key={String(k)} className="p-2 rounded-lg bg-muted/40">
                    <p className="text-muted-foreground">{k}</p>
                    <p className="font-medium">{v || 'não informou'}</p>
                  </div>
                ))}
              </div>

              {aberto.erro_correcao && (
                <p className="text-xs p-2 rounded-lg bg-warning/10 text-warning border border-warning/30">{aberto.erro_correcao}</p>
              )}
              {aberto.parecer && (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Parecer</p>
                  <p className="text-sm">{aberto.parecer}</p>
                </div>
              )}
              {(aberto.pontos_fortes?.length || 0) > 0 && (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Pontos fortes</p>
                  {aberto.pontos_fortes!.map((p, i) => (
                    <p key={i} className="text-sm flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" />{p}</p>
                  ))}
                </div>
              )}
              {(aberto.alertas?.length || 0) > 0 && (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-destructive">O que preocupa</p>
                  {aberto.alertas!.map((p, i) => (
                    <p key={i} className="text-sm flex gap-2"><AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />{p}</p>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Situações de conta</p>
                {TECNICAS.map((q, i) => {
                  const dada = aberto.respostas?.[q.id]
                  const res = aberto.respostas?.__gabarito?.[q.id] as string | undefined
                  const alt = q.alternativas.find(a => a.id === dada)
                  return (
                    <div key={q.id} className="text-sm border-l-2 pl-3 py-1"
                      style={{ borderColor: res === 'certa' ? 'hsl(var(--success))' : res === 'parcial' ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>
                      <p className="text-xs text-muted-foreground">{i + 1}. {q.pergunta}</p>
                      <p className="flex items-start gap-1.5">
                        {res === 'certa' ? <Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> : <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                        {alt?.texto || 'sem resposta'}
                      </p>
                      {res !== 'certa' && <p className="text-xs text-destructive mt-0.5">{q.pega}</p>}
                    </div>
                  )
                })}
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Respostas escritas</p>
                {ABERTAS.map(q => (
                  <div key={q.id} className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      {q.pergunta}
                      {aberto.notas_dimensao?.[q.dimensao] != null && (
                        <Badge variant="outline" className="text-[10px]">{aberto.notas_dimensao[q.dimensao]}/10</Badge>
                      )}
                    </p>
                    <p className="text-sm whitespace-pre-wrap rounded-lg bg-muted/40 p-2">{aberto.respostas?.[q.id] || 'sem resposta'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
