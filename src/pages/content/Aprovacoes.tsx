import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, RefreshCw, Send, Sparkles, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface Aprovacao {
  id: string
  tipo: string
  cliente: string
  chatid: string | null
  mes: string | null
  ano: number | null
  titulo: string
  texto: string
  status: 'pendente' | 'aprovado' | 'enviado' | 'reprovado'
  criado_em: string
  enviado_em: string | null
}

const STATUS_TABS = [
  { value: 'pendente', label: 'Pendentes', icon: Clock },
  { value: 'aprovado', label: 'Aprovados', icon: CheckCircle2 },
  { value: 'enviado', label: 'Enviados', icon: Send },
  { value: 'reprovado', label: 'Reprovados', icon: XCircle },
] as const

const STATUS_BADGE: Record<Aprovacao['status'], string> = {
  pendente: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  aprovado: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  enviado: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  reprovado: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
}

export default function Aprovacoes() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Aprovacao['status']>('pendente')
  const [rows, setRows] = useState<Aprovacao[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('content_aprovacoes')
      .select('*')
      .eq('status', tab)
      .order('criado_em', { ascending: false })
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' })
    } else {
      setRows((data as Aprovacao[]) || [])
      const d: Record<string, string> = {}
      ;(data as Aprovacao[] || []).forEach(r => { d[r.id] = r.texto })
      setDrafts(d)
    }
    setLoading(false)
  }, [tab, toast])

  const loadCounts = useCallback(async () => {
    const result: Record<string, number> = {}
    for (const s of STATUS_TABS) {
      const { count } = await supabase
        .from('content_aprovacoes')
        .select('id', { count: 'exact', head: true })
        .eq('status', s.value)
      result[s.value] = count || 0
    }
    setCounts(result)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCounts() }, [loadCounts, rows.length])

  const aprovar = async (r: Aprovacao) => {
    setBusy(r.id)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('content_aprovacoes')
      .update({ status: 'aprovado', texto: drafts[r.id] ?? r.texto, aprovado_por: userData?.user?.id ?? null })
      .eq('id', r.id)
    setBusy(null)
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    toast({ title: 'Aprovado ✅', description: `${r.cliente} vai pro cliente no dia 28.` })
    setRows(prev => prev.filter(x => x.id !== r.id))
  }

  const reprovar = async (r: Aprovacao) => {
    setBusy(r.id)
    const { error } = await supabase
      .from('content_aprovacoes')
      .update({ status: 'reprovado' })
      .eq('id', r.id)
    setBusy(null)
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    toast({ title: 'Reprovado', description: `${r.cliente} não será enviado.` })
    setRows(prev => prev.filter(x => x.id !== r.id))
  }

  const reenfileirar = async (r: Aprovacao) => {
    setBusy(r.id)
    const { error } = await supabase
      .from('content_aprovacoes')
      .update({ status: 'pendente' })
      .eq('id', r.id)
    setBusy(null)
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    toast({ title: 'Voltou pra pendente' })
    setRows(prev => prev.filter(x => x.id !== r.id))
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Aprovações de Conteúdo IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planos gerados pela IA. O que você aprovar aqui, a Sofia envia pro grupo do cliente no dia 28.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { load(); loadCounts() }} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Atualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as Aprovacao['status'])}>
        <TabsList className="w-full sm:w-auto">
          {STATUS_TABS.map(s => (
            <TabsTrigger key={s.value} value={s.value} className="gap-1.5">
              <s.icon className="h-3.5 w-3.5" /> {s.label}
              {counts[s.value] ? <span className="ml-1 text-xs opacity-70">({counts[s.value]})</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nada em "{STATUS_TABS.find(s => s.value === tab)?.label}".</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <Card key={r.id} className="overflow-hidden">
              <CardHeader className="pb-3 flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.cliente}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.tipo === 'plano_mensal' ? 'Plano do mês' : 'Radar do dia'}
                    {r.mes ? ` · ${r.mes}${r.ano ? ' ' + r.ano : ''}` : ''}
                    {!r.chatid ? ' · ⚠️ sem grupo (só ClickUp)' : ''}
                  </p>
                </div>
                <Badge variant="outline" className={cn('shrink-0 capitalize', STATUS_BADGE[r.status])}>
                  {r.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {tab === 'pendente' ? (
                  <Textarea
                    value={drafts[r.id] ?? r.texto}
                    onChange={e => setDrafts(p => ({ ...p, [r.id]: e.target.value }))}
                    rows={12}
                    className="font-mono text-xs leading-relaxed"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted/40 rounded-md p-3 font-mono">
                    {r.texto}
                  </pre>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {tab === 'pendente' && (
                    <>
                      <Button size="sm" onClick={() => aprovar(r)} disabled={busy === r.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reprovar(r)} disabled={busy === r.id}>
                        <XCircle className="h-4 w-4 mr-1" /> Reprovar
                      </Button>
                    </>
                  )}
                  {(tab === 'aprovado' || tab === 'reprovado') && (
                    <Button size="sm" variant="outline" onClick={() => reenfileirar(r)} disabled={busy === r.id}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Voltar pra pendente
                    </Button>
                  )}
                  {r.chatid && (
                    <span className="text-[11px] text-muted-foreground ml-auto">grupo: {r.chatid.slice(0, 20)}…</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
