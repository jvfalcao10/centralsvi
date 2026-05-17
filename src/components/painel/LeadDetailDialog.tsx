import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  MessageSquare, Phone, Mail, Calendar, DollarSign, TrendingUp, Loader2, User2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/painel/format'
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, type LeadStatus } from '@/lib/painel/types'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Lead = {
  id: string
  client_id: string
  full_name: string
  email: string | null
  phone: string | null
  status: LeadStatus
  source: string | null
  score: number
  estimated_value_brl: number | null
  notes: string | null
  created_at: string
}

type Activity = {
  id: string
  type: string
  content: string | null
  actor_kind: string
  created_at: string
}

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  note: 'Nota',
  email: 'Email',
  whatsapp: 'WhatsApp',
  call: 'Ligação',
  meeting: 'Reunião',
  stage_change: 'Mudança de etapa',
  status_change: 'Mudança de status',
  ai_sdr_message: 'IA SDR · mensagem',
  ai_sdr_action: 'IA SDR · ação',
}

export function LeadDetailDialog({
  leadId, open, onClose,
}: { leadId: string | null; open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const { data: lead, isLoading } = useQuery({
    queryKey: ['painel-lead', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<Lead | null> => {
      const { data } = await supabase
        .from('painel_leads')
        .select('id, client_id, full_name, email, phone, status, source, score, estimated_value_brl, notes, created_at')
        .eq('id', leadId!)
        .maybeSingle()
      return data as Lead | null
    },
  })

  const { data: activities } = useQuery({
    queryKey: ['painel-lead-activities', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<Activity[]> => {
      const { data } = await supabase
        .from('painel_lead_activities')
        .select('id, type, content, actor_kind, created_at')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false })
        .limit(50)
      return (data as Activity[]) || []
    },
  })

  async function updateLead(patch: Partial<Lead>) {
    if (!lead) return
    const { error } = await supabase.from('painel_leads').update(patch).eq('id', lead.id)
    if (error) { toast.error('Erro ao atualizar lead'); return }
    qc.invalidateQueries({ queryKey: ['painel-lead', lead.id] })
    qc.invalidateQueries({ queryKey: ['painel-leads'] })
    qc.invalidateQueries({ queryKey: ['painel-dashboard-v2'] })
    toast.success('Lead atualizado')
  }

  async function addNote() {
    if (!lead || !note.trim()) return
    setSavingNote(true)
    const { error } = await supabase.from('painel_lead_activities').insert({
      client_id: lead.client_id,
      lead_id: lead.id,
      type: 'note',
      content: note.trim(),
      actor_user_id: user?.id,
      actor_kind: 'user',
    })
    setSavingNote(false)
    if (error) { toast.error('Erro ao adicionar nota'); return }
    setNote('')
    qc.invalidateQueries({ queryKey: ['painel-lead-activities', lead.id] })
    toast.success('Nota adicionada')
  }

  if (!leadId) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading || !lead ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div>{lead.full_name}</div>
                  <div className="text-xs text-muted-foreground font-normal mt-0.5">
                    Lead há {formatDistanceToNow(new Date(lead.created_at), { locale: ptBR })}
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {lead.email && (
                  <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{lead.email}</div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{lead.phone}</div>
                )}
                {lead.source && (
                  <div className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="w-3.5 h-3.5" />{lead.source}</div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={lead.status} onValueChange={(v) => updateLead({ status: v as LeadStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Score (0-100)</Label>
                  <Input
                    type="number" min={0} max={100}
                    defaultValue={lead.score}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)))
                      if (v !== lead.score) updateLead({ score: v })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Valor estimado (R$)</Label>
                  <Input
                    type="number" min={0}
                    defaultValue={lead.estimated_value_brl ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null
                      if (v !== lead.estimated_value_brl) updateLead({ estimated_value_brl: v })
                    }}
                  />
                </div>
              </div>

              <Tabs defaultValue="timeline">
                <TabsList>
                  <TabsTrigger value="timeline">Atividades ({activities?.length || 0})</TabsTrigger>
                  <TabsTrigger value="note">Nova nota</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-3 max-h-80 overflow-y-auto">
                  {(activities || []).length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Nenhuma atividade registrada. Adicione uma nota.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activities?.map(a => (
                        <div key={a.id} className="flex gap-3 text-sm">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <MessageSquare className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <Badge variant="outline" className="text-[10px]">{ACTIVITY_TYPE_LABEL[a.type] || a.type}</Badge>
                              <span className="text-muted-foreground">
                                {a.actor_kind === 'ai_sdr' ? 'IA SDR' :
                                 a.actor_kind === 'system' ? 'Sistema' :
                                 a.actor_kind === 'integration' ? 'Integração' : 'Você'}
                                {' · '}
                                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                            {a.content && <div className="mt-1 whitespace-pre-wrap">{a.content}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="note" className="mt-3">
                  <Textarea
                    placeholder="Anote algo sobre esse lead — última conversa, observação, próximo passo…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button onClick={addNote} disabled={!note.trim() || savingNote}>
                      {savingNote && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Adicionar nota
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
