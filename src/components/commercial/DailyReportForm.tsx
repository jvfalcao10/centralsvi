import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CommercialPersonaKey, CommercialDailyReport } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { personaMetrics } from './personaConfig'
import { Save } from 'lucide-react'

interface Props {
  persona: CommercialPersonaKey
  userId: string
  date: string  // YYYY-MM-DD
  onSaved: () => void
}

export default function DailyReportForm({ persona, userId, date, onSaved }: Props) {
  const metrics = personaMetrics[persona]
  const [values, setValues] = useState<Record<string, number>>({})
  const [observacoes, setObservacoes] = useState('')
  const [melhorias, setMelhorias] = useState('')
  const [existingId, setExistingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('commercial_daily_reports')
        .select('*')
        .eq('user_id', userId)
        .eq('data', date)
        .maybeSingle()
      if (cancelled) return
      const report = data as CommercialDailyReport | null
      if (report) {
        setExistingId(report.id)
        const initialValues: Record<string, number> = {}
        for (const m of metrics) initialValues[m.key] = (report as any)[m.key] ?? 0
        setValues(initialValues)
        setObservacoes(report.observacoes ?? '')
        setMelhorias(report.melhorias ?? '')
      } else {
        const initialValues: Record<string, number> = {}
        for (const m of metrics) initialValues[m.key] = 0
        setValues(initialValues)
        setObservacoes('')
        setMelhorias('')
        setExistingId(null)
      }
    })()
    return () => { cancelled = true }
  }, [userId, date, persona, metrics])

  const save = async () => {
    setSaving(true)
    const payload: any = {
      user_id: userId,
      data: date,
      observacoes: observacoes || null,
      melhorias: melhorias || null,
      ...values,
    }
    if (existingId) {
      await supabase.from('commercial_daily_reports').update(payload).eq('id', existingId)
    } else {
      await supabase.from('commercial_daily_reports').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  const updateValue = (key: string, raw: string) => {
    const n = parseInt(raw, 10)
    setValues(p => ({ ...p, [key]: isNaN(n) ? 0 : n }))
  }

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${metrics.length > 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
        {metrics.map((m) => (
          <div key={m.key} className="space-y-1.5">
            <Label className="text-xs">{m.label}</Label>
            <Input
              type="number"
              min="0"
              value={values[m.key] ?? 0}
              onChange={(e) => updateValue(m.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Anotações do dia</Label>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="O que rolou hoje, blockers, observações..."
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Melhorias / pontos a aplicar</Label>
          <Textarea
            value={melhorias}
            onChange={(e) => setMelhorias(e.target.value)}
            placeholder="O que ajustar amanhã, ideias de melhoria..."
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Salvando...' : existingId ? 'Atualizar relatório' : 'Salvar relatório'}
        </Button>
      </div>
    </div>
  )
}
