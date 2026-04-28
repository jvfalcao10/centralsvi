import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CommercialGoals, CommercialPersonaKey } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { personaMetrics } from './personaConfig'

interface Props {
  persona: CommercialPersonaKey
  goals: CommercialGoals
  onSaved: () => void
  onCancel: () => void
}

export default function GoalsEditor({ persona, goals, onSaved, onCancel }: Props) {
  const metrics = personaMetrics[persona]
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const m of metrics) init[m.goalKey] = (goals as any)[m.goalKey] ?? 0
    return init
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('commercial_goals').update(values).eq('persona', persona)
    setSaving(false)
    onSaved()
  }

  const goalSuffix = persona === 'ruan' ? '/ semana' : '/ mês'

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {persona === 'ruan'
          ? 'Metas semanais. O sistema multiplica por 4 para calcular o objetivo mensal.'
          : 'Metas mensais. O sistema divide por 4 para calcular o objetivo semanal.'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.goalKey} className="space-y-1.5">
            <Label className="text-xs">{m.label} <span className="text-muted-foreground">{goalSuffix}</span></Label>
            <Input
              type="number"
              min="0"
              value={values[m.goalKey] ?? 0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                setValues(p => ({ ...p, [m.goalKey]: isNaN(n) ? 0 : n }))
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </div>
  )
}
