import { useEffect, useState, useCallback } from 'react'
import { Loader2, Target, CalendarDays, Settings2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  CommercialPersonaKey,
  CommercialPersona,
  CommercialDailyReport,
  CommercialGoals,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useCommercialPersona } from '@/hooks/useCommercialPersona'
import { personaMetrics, monthlyGoal, MetricKey } from './personaConfig'
import DailyReportForm from './DailyReportForm'
import GoalsEditor from './GoalsEditor'
import HistoryTable from './HistoryTable'

interface Props {
  persona: CommercialPersonaKey
}

export default function PersonaDashboard({ persona }: Props) {
  const { user } = useAuth()
  const { isAdmin, canEditGoals, persona: myPersona } = useCommercialPersona()
  const { toast } = useToast()
  const [goals, setGoals] = useState<CommercialGoals | null>(null)
  const [reports, setReports] = useState<CommercialDailyReport[]>([])
  const [personaUser, setPersonaUser] = useState<CommercialPersona | null>(null)
  const [loading, setLoading] = useState(true)
  const [showGoalsEditor, setShowGoalsEditor] = useState(false)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  // Compute current ISO week (Mon - Sun)
  const dayOfWeek = (today.getDay() + 6) % 7 // 0=Mon, 6=Sun
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Find user_id of this persona
    let targetUserId = user?.id
    if (isAdmin || (myPersona && myPersona.persona !== persona)) {
      // Admin viewing someone else - look up their user_id
      const { data: pData } = await supabase
        .from('commercial_personas')
        .select('*')
        .eq('persona', persona)
        .maybeSingle()
      if (pData) {
        targetUserId = (pData as CommercialPersona).user_id
        setPersonaUser(pData as CommercialPersona)
      } else {
        setPersonaUser(null)
      }
    } else if (myPersona && myPersona.persona === persona) {
      setPersonaUser(myPersona)
      targetUserId = myPersona.user_id
    }

    // 2. Goals
    const { data: gData } = await supabase
      .from('commercial_goals')
      .select('*')
      .eq('persona', persona)
      .maybeSingle()
    setGoals(gData as CommercialGoals | null)

    // 3. Reports for current month (for progress calc + history)
    if (targetUserId) {
      const { data: rData } = await supabase
        .from('commercial_daily_reports')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('data', fmt(monthStart))
        .order('data', { ascending: false })
      setReports((rData as CommercialDailyReport[]) ?? [])
    } else {
      setReports([])
    }

    setLoading(false)
  }, [persona, user?.id, isAdmin, myPersona])

  useEffect(() => { fetchData() }, [fetchData])

  // Sum metric across reports in a date range
  const sumIn = (key: MetricKey, fromDate: Date) => {
    const fromStr = fmt(fromDate)
    return reports
      .filter(r => r.data >= fromStr)
      .reduce((s, r) => s + ((r as any)[key] as number ?? 0), 0)
  }

  const metrics = personaMetrics[persona]

  const canFillReport =
    !!user && (
      (myPersona && myPersona.persona === persona) ||
      isAdmin
    )

  const showEmptyState = !personaUser && !loading

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    )
  }

  if (showEmptyState) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Persona <span className="font-medium">{persona}</span> ainda não tem usuário atribuído.
          {isAdmin && <span className="block mt-2">Atribua via SQL ou pela aba Equipe.</span>}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Persona header + actions */}
      <div className="flex items-center justify-between">
        <div>
          {personaUser && (
            <p className="text-sm text-muted-foreground">
              Usuário: <span className="font-medium text-foreground">{personaUser.display_name}</span>
            </p>
          )}
        </div>
        {canEditGoals && goals && (
          <Button variant="outline" size="sm" onClick={() => setShowGoalsEditor(true)} className="gap-2">
            <Settings2 className="h-4 w-4" /> Editar metas
          </Button>
        )}
      </div>

      {/* Monthly progress cards */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Progresso mensal</h2>
          <span className="text-xs text-muted-foreground">
            ({today.toLocaleString('pt-BR', { month: 'long' })} · até {monthEndDate.getDate()} dias)
          </span>
        </div>
        <div className={`grid gap-3 ${metrics.length > 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
          {metrics.map((m) => {
            const realizedMonth = sumIn(m.key, monthStart)
            const goalRaw = goals ? (goals as any)[m.goalKey] as number : 0
            const goalMonth = monthlyGoal(persona, goalRaw)
            const pct = goalMonth > 0 ? Math.min(100, (realizedMonth / goalMonth) * 100) : 0
            return (
              <Card key={m.key} className="border-border bg-card">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{realizedMonth}</span>
                    <span className="text-xs text-muted-foreground">/ {goalMonth || '—'}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% da meta</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Weekly progress */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Progresso semanal</h2>
          <span className="text-xs text-muted-foreground">
            (semana de {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
          </span>
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {metrics.map((m) => {
            const realizedWeek = sumIn(m.key, weekStart)
            const goalRaw = goals ? (goals as any)[m.goalKey] as number : 0
            // Weekly goal = monthly / 4 (or already weekly for ruan)
            const weeklyGoal = persona === 'ruan' ? goalRaw : Math.ceil(goalRaw / 4)
            const pct = weeklyGoal > 0 ? Math.min(100, (realizedWeek / weeklyGoal) * 100) : 0
            return (
              <Card key={m.key} className="border-border bg-card">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold">{realizedWeek}</span>
                    <span className="text-xs text-muted-foreground">/ {weeklyGoal || '—'}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% da semana</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Daily report form (only for own persona or admin) */}
      {canFillReport && personaUser && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm">Relatório de hoje · {today.toLocaleDateString('pt-BR')}</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyReportForm
              persona={persona}
              userId={personaUser.user_id}
              date={fmt(today)}
              onSaved={() => { fetchData(); toast({ title: 'Relatório salvo!' }) }}
            />
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm">Histórico do mês</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryTable persona={persona} reports={reports} />
        </CardContent>
      </Card>

      {/* Goals editor dialog */}
      {goals && (
        <Dialog open={showGoalsEditor} onOpenChange={setShowGoalsEditor}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Editar metas — {persona}</DialogTitle></DialogHeader>
            <GoalsEditor
              persona={persona}
              goals={goals}
              onSaved={() => { setShowGoalsEditor(false); fetchData(); toast({ title: 'Metas atualizadas!' }) }}
              onCancel={() => setShowGoalsEditor(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
