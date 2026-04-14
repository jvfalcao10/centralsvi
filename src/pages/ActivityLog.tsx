import { useEffect, useState } from 'react'
import { Clock, User, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Activity {
  id: string
  user_name: string
  action: string
  entity_type: string
  entity_name: string | null
  details: string | null
  created_at: string
}

const ENTITY_COLORS: Record<string, string> = {
  prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  client: 'bg-green-500/20 text-green-400 border-green-500/30',
  onboarding: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  delivery: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  invoice: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

function timeAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')

  async function fetchActivities() {
    setLoading(true)
    let query = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(100)
    if (typeFilter !== 'all') query = query.eq('entity_type', typeFilter)
    const { data } = await query
    if (data) setActivities(data)
    setLoading(false)
  }

  useEffect(() => { fetchActivities() }, [typeFilter])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Atividades</SelectItem>
              <SelectItem value="prospect">Prospecção</SelectItem>
              <SelectItem value="lead">Pipeline</SelectItem>
              <SelectItem value="client">Clientes</SelectItem>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="delivery">Entregas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchActivities}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar</Button>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Histórico de Atividades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhuma atividade registrada ainda.</p>
          ) : (
            <div className="space-y-1">
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.user_name || 'Sistema'}</span>{' '}
                      <span className="text-muted-foreground">{a.action}</span>
                      {a.entity_name && <span className="font-medium"> — {a.entity_name}</span>}
                    </p>
                    {a.details && <p className="text-xs text-muted-foreground mt-0.5">{a.details}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={ENTITY_COLORS[a.entity_type] || 'bg-slate-500/20 text-slate-400'}>
                      {a.entity_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
