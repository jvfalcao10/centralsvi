import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, MessageSquare, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useToast } from '@/hooks/use-toast'
import { Client } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Phase {
  id: string; title: string; period: string; tasks: string[]; message: string
}

const PHASES: Phase[] = [
  { id: 'semana1', title: 'Semana 1 — Coleta e Diagnóstico', period: 'Dias 1-7',
    tasks: [
      'Enviar sequência de boas-vindas', 'Criar pasta do cliente no drive',
      'Registrar na planilha de onboarding', 'Agendar reunião de kickoff',
      'Realizar reunião de kickoff', 'Preencher briefing completo',
      'Coletar todos os acessos (Instagram, GMB)', 'Análise de concorrência concluída',
      'Identidade visual definida + templates criados', 'Agendar call de secretária para Semana 3',
    ],
    message: 'Doutor(a) [NOME], atualização da semana:\n\nConcluímos o diagnóstico completo. Analisamos seus concorrentes na região, definimos os procedimentos que vamos destacar e a identidade visual já está sendo criada.\n\nNa próxima semana, você vai ver:\n- Seu Instagram completamente reformulado\n- Landing page de agendamento pronta\n- Google Meu Negócio otimizado\n\nEstamos no ritmo certo. Qualquer dúvida, só chamar.',
  },
  { id: 'semana2', title: 'Semana 2 — Setup de Presença', period: 'Dias 8-14',
    tasks: [
      'Instagram reformulado (bio, foto, destaques)', 'Google Meu Negócio criado/otimizado',
      'Landing page pronta e aprovada', 'Pixel Meta instalado e testado',
      'Google Tag Manager instalado', 'Calendário de conteúdo Mês 1 pronto',
      'Primeiros 4-6 criativos produzidos', 'Kit luz + mic entregue ao médico',
    ],
    message: 'Doutor(a) [NOME], atualização da semana:\n\nSeu Instagram foi completamente reformulado — dá uma olhada no perfil e me diz o que achou.\n\nTambém finalizamos:\n- Sua página de agendamento online\n- Seu Google Meu Negócio otimizado\n- Os primeiros conteúdos para publicação\n\nNa próxima semana, vamos ligar o tráfego.\n\nEstamos avançando bem!',
  },
  { id: 'semana3', title: 'Semana 3 — Ativação de Tráfego', period: 'Dias 15-21',
    tasks: [
      'Meta Ads Campanha 1 (reconhecimento) no ar', 'Meta Ads Campanha 2 (conversão) no ar',
      'Google Ads Search no ar', 'Primeiros posts publicados',
      'WhatsApp Business configurado', 'Call 1 com secretária realizada',
      'Script de atendimento entregue',
    ],
    message: 'Doutor(a) [NOME], atualização da semana:\n\nAs campanhas entraram no ar! Seu consultório agora aparece:\n- No Google quando buscam sua especialidade em [CIDADE]\n- No Instagram para pessoas da região\n\nTambém fizemos o treinamento com a secretária.\n\nOs primeiros pacientes da internet estão chegando!',
  },
  { id: 'semana4', title: 'Semana 4 — Sistema de Conversão', period: 'Dias 22-28',
    tasks: [
      'CRM Kommo configurado (pipeline + campos)', 'WhatsApp integrado ao Kommo',
      'Scripts de follow-up entregues', 'Métricas monitoradas + ajustes realizados',
      'Call 2 com secretária realizada', 'Secretária registrando leads',
    ],
    message: 'Doutor(a) [NOME], atualização:\n\nResultados das primeiras semanas de campanha em breve no relatório.\n\nSegunda call com a secretária realizada — atendimento evoluindo. CRM sendo implantado.\n\nNa próxima semana: remarketing + relatório mensal.',
  },
  { id: 'semana56', title: 'Semana 5-6 — Escala e Otimização', period: 'Dias 29-45',
    tasks: [
      'CRM Kommo 100% operacional', 'Remarketing Meta ativado',
      'Primeiro relatório mensal produzido', 'Call 3 com secretária realizada',
      'Reunião mensal com médico realizada', 'Sistema completo rodando',
    ],
    message: 'Doutor(a) [NOME], atualização:\n\nO sistema está completo e rodando:\n- Campanhas otimizadas com dados do primeiro mês\n- Remarketing ativado\n- CRM implantado — nenhum lead se perde\n\nA fase de estruturação terminou. Agora é escala.',
  },
]

const TOTAL_TASKS = PHASES.reduce((sum, p) => sum + p.tasks.length, 0)

export default function Onboarding() {
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['semana1']))
  const [messageDialog, setMessageDialog] = useState<Phase | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      if (data) setClients(data)
      setLoading(false)
    })
  }, [])

  const fetchChecks = useCallback(async (clientId: string) => {
    // Try Supabase first, fall back to localStorage
    const { data, error } = await supabase
      .from('onboarding_tasks')
      .select('phase, task_index, completed')
      .eq('client_id', clientId)

    if (data && data.length > 0) {
      const map: Record<string, boolean> = {}
      data.forEach((t: any) => { map[`${t.phase}_${t.task_index}`] = t.completed })
      setChecks(map)
    } else {
      // Fallback to localStorage for backwards compat
      try {
        const local = localStorage.getItem(`onboarding_${clientId}`)
        if (local) setChecks(JSON.parse(local))
        else setChecks({})
      } catch { setChecks({}) }
    }
  }, [])

  useEffect(() => {
    if (selectedClient) fetchChecks(selectedClient)
  }, [selectedClient, fetchChecks])

  const client = clients.find(c => c.id === selectedClient)

  async function toggleCheck(taskKey: string) {
    const [phase, indexStr] = taskKey.split('_')
    const taskIndex = parseInt(indexStr)
    const newVal = !checks[taskKey]
    const next = { ...checks, [taskKey]: newVal }
    setChecks(next)

    // Save to localStorage as backup
    if (selectedClient) localStorage.setItem(`onboarding_${selectedClient}`, JSON.stringify(next))

    // Save to Supabase
    if (selectedClient) {
      const { error } = await supabase.from('onboarding_tasks').upsert({
        client_id: selectedClient, phase, task_index: taskIndex,
        completed: newVal, completed_at: newVal ? new Date().toISOString() : null,
      }, { onConflict: 'client_id,phase,task_index' })

      if (!error && newVal) {
        const phaseObj = PHASES.find(p => p.id === phase)
        const taskName = phaseObj?.tasks[taskIndex] || ''
        await logActivity('completou tarefa de onboarding', 'onboarding', selectedClient, `${client?.name}: ${taskName}`)
      }
    }
  }

  function togglePhase(phaseId: string) {
    const next = new Set(expandedPhases)
    next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId)
    setExpandedPhases(next)
  }

  const completedCount = Object.values(checks).filter(Boolean).length
  const progressPct = TOTAL_TASKS > 0 ? (completedCount / TOTAL_TASKS) * 100 : 0

  function personalizeMessage(msg: string) {
    let result = msg
    if (client) {
      result = result.replace(/\[NOME\]/g, client.name)
      result = result.replace(/\[CIDADE\]/g, client.segment || '')
      result = result.replace(/\[ESPECIALIDADE\]/g, client.company || '')
    }
    return result
  }

  async function copyMessage(phase: Phase) {
    await navigator.clipboard.writeText(personalizeMessage(phase.message))
    setCopied(true)
    toast({ title: 'Mensagem copiada!' })
    setTimeout(() => setCopied(false), 2000)
  }

  // Calculate health score from onboarding progress
  useEffect(() => {
    if (selectedClient && client) {
      const pct = Math.round(progressPct)
      const newHealth = Math.min(100, Math.max(20, pct))
      if (Math.abs(newHealth - client.health_score) > 5) {
        supabase.from('clients').update({ health_score: newHealth }).eq('id', selectedClient)
      }
    }
  }, [progressPct, selectedClient, client])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-full sm:w-[300px]">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.company}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selectedClient && (
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-muted-foreground">Progresso do Onboarding</span>
              <span className="text-sm font-medium">{completedCount}/{TOTAL_TASKS} ({Math.round(progressPct)}%)</span>
            </div>
            <Progress value={progressPct} className="h-2.5" />
          </div>
        )}
      </div>

      {!selectedClient ? (
        <Card className="border-border bg-card">
          <CardContent className="py-16 text-center text-muted-foreground">
            Selecione um cliente para ver o checklist de onboarding dos 45 dias.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {PHASES.map(phase => {
            const isExpanded = expandedPhases.has(phase.id)
            const phaseChecks = phase.tasks.map((_, i) => checks[`${phase.id}_${i}`] || false)
            const phaseDone = phaseChecks.filter(Boolean).length
            const phaseTotal = phase.tasks.length
            const allDone = phaseDone === phaseTotal

            return (
              <Card key={phase.id} className={`border-border bg-card ${allDone ? 'border-green-500/30' : ''}`}>
                <CardHeader className="cursor-pointer select-none py-4" onClick={() => togglePhase(phase.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <CardTitle className="text-sm font-semibold">{phase.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{phase.period}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={allDone ? 'bg-green-500/20 text-green-400 border-green-500/30' : phaseDone > 0 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}>
                        {phaseDone}/{phaseTotal}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setMessageDialog(phase) }} title="Ver mensagem semanal">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
                    <div className="space-y-2 ml-7">
                      {phase.tasks.map((task, i) => {
                        const key = `${phase.id}_${i}`
                        const checked = checks[key] || false
                        return (
                          <div key={key}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30 border-border hover:border-primary/20'}`}
                            onClick={() => toggleCheck(key)}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleCheck(key)} />
                            <span className={`text-sm flex-1 ${checked ? 'line-through text-muted-foreground' : ''}`}>{task}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!messageDialog} onOpenChange={() => setMessageDialog(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader><DialogTitle className="text-sm">Mensagem Semanal — {messageDialog?.title}</DialogTitle></DialogHeader>
          {messageDialog && (
            <div className="space-y-4">
              <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                {personalizeMessage(messageDialog.message)}
              </div>
              <Button onClick={() => copyMessage(messageDialog)} className="w-full">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copiado!' : 'Copiar Mensagem'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
