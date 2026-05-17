import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Sparkles, Loader2, Zap, Newspaper, Lightbulb, Target, AlertTriangle,
  BarChart3, ExternalLink, MessageCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePainelContext } from '@/components/PainelLayout'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<string, string> = {
  news: 'Notícia',
  content_idea: 'Ideia de conteúdo',
  opportunity: 'Oportunidade',
  risk: 'Risco',
  recommendation: 'Recomendação',
  campaign_analysis: 'Análise de campanha',
  win_pattern: 'Padrão vencedor',
  creative_fatigue: 'Fadiga de criativo',
  copy_suggestion: 'Sugestão de copy',
}

const KIND_ICON: Record<string, any> = {
  news: Newspaper,
  content_idea: Lightbulb,
  opportunity: Target,
  risk: AlertTriangle,
  recommendation: Sparkles,
  campaign_analysis: BarChart3,
  win_pattern: Target,
  creative_fatigue: AlertTriangle,
  copy_suggestion: Lightbulb,
}

const KIND_COLOR: Record<string, string> = {
  news: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  content_idea: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  opportunity: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  risk: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  recommendation: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  campaign_analysis: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
  win_pattern: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  creative_fatigue: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  copy_suggestion: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
}

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'news', label: '📰 Notícias' },
  { value: 'content_idea', label: '💡 Ideias' },
  { value: 'opportunity', label: '🎯 Oportunidades' },
  { value: 'risk', label: '⚠️ Riscos' },
  { value: 'recommendation', label: '✨ Recomendações' },
]

export default function PainelInsights() {
  const { client, slug } = usePainelContext()
  const qc = useQueryClient()
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const { data: insights, isLoading } = useQuery({
    queryKey: ['painel-insights', client.id],
    queryFn: async () => {
      const { data } = await supabase.from('painel_insights')
        .select('id, title, body, kind, severity, status, source_label, source_url, created_at')
        .eq('client_id', client.id).order('created_at', { ascending: false }).limit(100)
      return data ?? []
    },
  })

  async function generateNow() {
    setGenerating(true)
    toast.info('Analisando seu nicho via Perplexity…', { duration: 4000 })
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/painel/insights/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ clientSlug: slug }),
    })
    const data = await res.json()
    setGenerating(false)
    if (!res.ok) {
      toast.error(data.message || data.error || 'Falha ao gerar insights')
      return
    }
    if (data.created === 0) {
      toast.info('A IA não encontrou nada novo dessa vez.')
      return
    }
    toast.success(`${data.created} insight${data.created > 1 ? 's' : ''} novo${data.created > 1 ? 's' : ''}.`)
    qc.invalidateQueries({ queryKey: ['painel-insights', client.id] })
  }

  // Conta por tipo pra os filtros
  const countByKind = useMemo(() => {
    const map: Record<string, number> = { all: 0 }
    ;(insights || []).forEach((i: any) => {
      map.all++
      map[i.kind] = (map[i.kind] || 0) + 1
    })
    return map
  }, [insights])

  const filtered = useMemo(() => {
    if (filter === 'all') return insights || []
    return (insights || []).filter((i: any) => i.kind === filter)
  }, [insights, filter])

  const isEmpty = !isLoading && (insights ?? []).length === 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Inteligência</p>
          <h1 className="text-3xl font-semibold tracking-tighter mt-1">Insights IA</h1>
          <p className="text-muted-foreground mt-1">
            Notícias do nicho, ideias de conteúdo e oportunidades. Atualizado todo dia 6h.
          </p>
        </div>
        <Button onClick={generateNow} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          {generating ? 'Analisando…' : 'Gerar agora'}
        </Button>
      </div>

      {!isLoading && !isEmpty && (
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="flex flex-wrap h-auto justify-start">
            {FILTERS.map(f => (
              <TabsTrigger key={f.value} value={f.value} className="gap-2">
                {f.label}
                {countByKind[f.value] > 0 && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">{countByKind[f.value]}</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Ainda sem insights</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              A análise busca notícias atuais do seu nicho, ideias de conteúdo e oportunidades de mercado.
              Roda todo dia às 6h. Clica em <strong>Gerar agora</strong> pra trazer já.
            </p>
            <div className="mt-6 flex gap-2 justify-center">
              <Button onClick={generateNow} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Gerar agora
              </Button>
              <Link to={`/cliente/${slug}/conversa`}>
                <Button variant="outline"><MessageCircle className="w-4 h-4 mr-2" />Falar com a SVI</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum insight desse tipo. Tenta outro filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((i: any) => {
            const Icon = KIND_ICON[i.kind] || Sparkles
            const colorClass = KIND_COLOR[i.kind] || ''
            return (
              <Card key={i.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn('w-10 h-10 rounded-md flex items-center justify-center shrink-0 border', colorClass)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className={colorClass}>{KIND_LABEL[i.kind] || i.kind}</Badge>
                        {i.severity !== 'info' && (
                          <Badge variant={i.severity === 'critical' || i.severity === 'high' ? 'destructive' : 'secondary'}>
                            {i.severity}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(i.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <h3 className="font-semibold leading-tight">{i.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-wrap">{i.body}</p>
                      {(i.source_label || i.source_url) && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs">
                          {i.source_label && <span className="text-muted-foreground">Fonte: {i.source_label}</span>}
                          {i.source_url && (
                            <a
                              href={i.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
                            >
                              Ler matéria<ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
