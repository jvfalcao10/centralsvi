import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { usePainelContext } from '@/components/PainelLayout'

const KIND_LABEL: Record<string, string> = {
  campaign_analysis: 'Análise de campanha',
  creative_fatigue: 'Fadiga de criativo',
  recommendation: 'Recomendação',
  win_pattern: 'Padrão vencedor',
  risk: 'Risco',
  copy_suggestion: 'Sugestão de copy',
}

export default function PainelInsights() {
  const { client, slug } = usePainelContext()

  const { data: insights, isLoading } = useQuery({
    queryKey: ['painel-insights', client.id],
    queryFn: async () => {
      const { data } = await supabase.from('painel_insights')
        .select('id, title, body, kind, severity, status, created_at')
        .eq('client_id', client.id).order('created_at', { ascending: false }).limit(50)
      return data ?? []
    },
  })

  const isEmpty = !isLoading && (insights ?? []).length === 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Inteligência</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Insights IA</h1>
        <p className="text-muted-foreground mt-1">Análises automáticas, padrões e recomendações geradas pela IA da SVI.</p>
      </div>

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
              A análise inteligente roda todo dia às 6h e gera recomendações sobre o que está funcionando.
              Os primeiros insights chegam quando houver pelo menos 7 dias de dados.
            </p>
            <div className="mt-6">
              <Link to={`/cliente/${slug}/conversa`}><Button variant="outline">Falar com a SVI</Button></Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {insights?.map((i: any) => (
            <Card key={i.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{KIND_LABEL[i.kind] || i.kind}</Badge>
                      {i.severity !== 'info' && (
                        <Badge variant={i.severity === 'critical' || i.severity === 'high' ? 'destructive' : 'secondary'}>{i.severity}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(i.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h3 className="font-semibold">{i.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{i.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
