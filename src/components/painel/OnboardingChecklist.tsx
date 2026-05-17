import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Sparkles, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

type Step = {
  key: string
  title: string
  description: string
  to: (slug: string) => string
}

const STEPS: Step[] = [
  {
    key: 'explore_dashboard',
    title: 'Conheça sua visão geral',
    description: 'Funil, leads, custo por aquisição e tendências dos seus últimos 30 dias.',
    to: (slug) => `/cliente/${slug}`,
  },
  {
    key: 'first_lead',
    title: 'Veja seus leads',
    description: 'Pipeline em tempo real. Cada lead que entrar nas campanhas aparece aqui automaticamente.',
    to: (slug) => `/cliente/${slug}/leads`,
  },
  {
    key: 'first_approval',
    title: 'Aprove seu primeiro post',
    description: 'A equipe SVI envia conteúdo pra você aprovar — chega de WhatsApp.',
    to: (slug) => `/cliente/${slug}/aprovacoes`,
  },
  {
    key: 'check_financeiro',
    title: 'Veja seu financeiro',
    description: 'Próxima fatura, histórico de pagamento e detalhes do contrato.',
    to: (slug) => `/cliente/${slug}/financeiro`,
  },
  {
    key: 'talk_to_svi',
    title: 'Mande a primeira mensagem pra equipe',
    description: 'Fale direto com seu gestor de conta dentro do painel.',
    to: (slug) => `/cliente/${slug}/conversa`,
  },
]

export function OnboardingChecklist({ clientId, slug }: { clientId: string; slug: string }) {
  const qc = useQueryClient()

  const { data: doneKeys } = useQuery({
    queryKey: ['onboarding', clientId],
    queryFn: async (): Promise<Set<string>> => {
      const { data } = await supabase
        .from('painel_onboarding_steps')
        .select('step, completed_at')
        .eq('client_id', clientId)
        .not('completed_at', 'is', null)
      return new Set((data || []).map((d: any) => d.step))
    },
  })

  if (!doneKeys) return null

  const done = STEPS.filter(s => doneKeys.has(s.key)).length
  const total = STEPS.length
  const percent = (done / total) * 100

  if (done === total) return null // checklist some quando completo
  const dismissed = localStorage.getItem(`onboarding-dismissed-${clientId}`)
  if (dismissed) return null

  async function markDone(key: string) {
    await supabase.from('painel_onboarding_steps').upsert({
      client_id: clientId,
      step: key,
      completed_at: new Date().toISOString(),
    })
    qc.invalidateQueries({ queryKey: ['onboarding', clientId] })
  }

  function dismiss() {
    localStorage.setItem(`onboarding-dismissed-${clientId}`, '1')
    qc.invalidateQueries({ queryKey: ['onboarding', clientId] })
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Vamos preparar seu painel</h3>
              <p className="text-sm text-muted-foreground">{done}/{total} concluídos — leva menos de 10 minutos</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Ocultar checklist"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <Progress value={percent} className="h-1.5 mb-5" />

        <div className="space-y-2">
          {STEPS.map((step) => {
            const isDone = doneKeys.has(step.key)
            return (
              <div
                key={step.key}
                className={`flex items-start gap-3 p-3 rounded-md transition-colors ${
                  isDone ? 'opacity-60' : 'bg-background hover:bg-accent'
                }`}
              >
                <button
                  onClick={() => !isDone && markDone(step.key)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    isDone ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary'
                  }`}
                  aria-label={isDone ? 'Concluído' : 'Marcar como concluído'}
                >
                  {isDone && <Check className="w-3 h-3 text-primary-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}>{step.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{step.description}</div>
                </div>
                {!isDone && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={step.to(slug)}>
                      Fazer <ChevronRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
