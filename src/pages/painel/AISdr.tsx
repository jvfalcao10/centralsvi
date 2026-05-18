import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bot, Loader2, Save, Sparkles, AlertCircle, X, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { usePainelContext } from '@/components/PainelLayout'

type SdrConfig = {
  client_id: string
  enabled: boolean
  persona: string
  instructions: string
  handoff_triggers: string[]
  model: string
  updated_at: string | null
}

const PERSONA_PLACEHOLDER = `Você é a Sofia, atendente da [nome da empresa].
Atende dúvidas, qualifica leads e agenda avaliação gratuita.
Horário de atendimento: seg-sex 8h às 18h.
Endereço: ...
Especialidades: ...`

const INSTRUCTIONS_PLACEHOLDER = `Quando o lead pedir agendamento, peça nome completo e melhor horário.
Não dê preço por mensagem. Sempre marque avaliação primeiro.
Se for emergência ou criança, escale pro humano na hora.`

export default function PainelAISdr() {
  const { client, slug } = usePainelContext()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<SdrConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [newTrigger, setNewTrigger] = useState('')

  const { data: config, isLoading } = useQuery({
    queryKey: ['painel-sdr-config', client.id],
    queryFn: async (): Promise<SdrConfig> => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/painel/sdr/config?clientSlug=${slug}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'load_failed')
      return data.config
    },
  })

  useEffect(() => {
    if (config && !draft) setDraft(config)
  }, [config, draft])

  async function save() {
    if (!draft) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/painel/sdr/config?clientSlug=${slug}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        enabled: draft.enabled,
        persona: draft.persona,
        instructions: draft.instructions,
        handoff_triggers: draft.handoff_triggers,
        model: draft.model,
      }),
    })
    setSaving(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.message || 'Falha ao salvar')
      return
    }
    toast.success('IA SDR atualizada')
    qc.invalidateQueries({ queryKey: ['painel-sdr-config', client.id] })
  }

  function addTrigger() {
    if (!draft) return
    const t = newTrigger.trim()
    if (!t || draft.handoff_triggers.includes(t)) return
    setDraft({ ...draft, handoff_triggers: [...draft.handoff_triggers, t] })
    setNewTrigger('')
  }

  function removeTrigger(t: string) {
    if (!draft) return
    setDraft({ ...draft, handoff_triggers: draft.handoff_triggers.filter((x) => x !== t) })
  }

  if (isLoading || !draft) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const personaEmpty = !draft.persona.trim()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">IA SDR</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Atendente automática no WhatsApp que qualifica leads, marca call e passa pra humano quando faz sentido.
        </p>
      </div>

      {/* Toggle ON/OFF */}
      <Card className={draft.enabled ? 'border-primary/40' : ''}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {draft.enabled ? <Sparkles className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4 text-muted-foreground" />}
                {draft.enabled ? 'IA SDR ligada' : 'IA SDR desligada'}
              </CardTitle>
              <CardDescription className="mt-1">
                {draft.enabled
                  ? 'Toda nova mensagem no WhatsApp recebe resposta automática. Você é avisado quando o lead pede pra falar com humano.'
                  : 'Mensagens chegam no Inbox normal. Sua equipe responde tudo manualmente.'}
              </CardDescription>
              {draft.enabled && personaEmpty && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Defina uma persona antes de ligar. A IA não responde sem persona.
                </div>
              )}
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Persona */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Persona</CardTitle>
          <CardDescription>
            Quem é a IA, o que oferece, horário e qualquer info crítica. A IA fala com base nisso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.persona}
            onChange={(e) => setDraft({ ...draft, persona: e.target.value })}
            placeholder={PERSONA_PLACEHOLDER}
            className="min-h-[180px] font-mono text-xs"
            maxLength={2000}
          />
          <div className="text-[10px] text-muted-foreground text-right mt-1">{draft.persona.length}/2000</div>
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras especiais</CardTitle>
          <CardDescription>
            Comportamento específico: como agendar, o que nunca dizer, quando escalar com urgência.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.instructions}
            onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
            placeholder={INSTRUCTIONS_PLACEHOLDER}
            className="min-h-[120px] font-mono text-xs"
            maxLength={2000}
          />
          <div className="text-[10px] text-muted-foreground text-right mt-1">{draft.instructions.length}/2000</div>
        </CardContent>
      </Card>

      {/* Handoff triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gatilhos pra passar pro humano</CardTitle>
          <CardDescription>
            Quando a mensagem do lead contém uma dessas palavras, a IA não responde e marca a conversa como não-lida pra você atender.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {draft.handoff_triggers.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button type="button" onClick={() => removeTrigger(t)} aria-label={`Remover ${t}`}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {draft.handoff_triggers.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhum gatilho. A IA atende tudo sozinha.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTrigger() } }}
              placeholder="Adicionar gatilho (ex: preço, cancelar...)"
              maxLength={80}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={addTrigger} disabled={!newTrigger.trim()}>
              <Plus className="w-4 h-4 mr-1" />Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modelo (avançado) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modelo</CardTitle>
          <CardDescription>
            Padrão é Claude Haiku 4.5 (mais rápido). Use Sonnet 4.6 se precisar de respostas mais sofisticadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            className="w-full max-w-xs h-10 px-3 rounded-md border bg-background text-sm"
          >
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (rápido)</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (sofisticado)</option>
          </select>
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  )
}
