import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors,
  closestCenter, useDroppable, useDraggable,
} from '@dnd-kit/core'
import { Phone, Mail, GripVertical, User2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/painel/format'
import { LEAD_STATUS_LABELS, type LeadStatus } from '@/lib/painel/types'
import { cn } from '@/lib/utils'

type Lead = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  status: LeadStatus
  source: string | null
  estimated_value_brl: number | null
  score: number
}

const COLUMNS: { id: LeadStatus; label: string; tone: string }[] = [
  { id: 'new', label: 'Novos', tone: 'bg-blue-500' },
  { id: 'contacted', label: 'Contatado', tone: 'bg-gray-500' },
  { id: 'qualified', label: 'Qualificado', tone: 'bg-indigo-500' },
  { id: 'meeting', label: 'Reunião', tone: 'bg-purple-500' },
  { id: 'proposal', label: 'Proposta', tone: 'bg-amber-500' },
  { id: 'won', label: 'Ganhou', tone: 'bg-emerald-500' },
  { id: 'lost', label: 'Perdeu', tone: 'bg-red-500' },
]

export function LeadsKanban({
  clientId, onOpenLead,
}: { clientId: string; onOpenLead: (id: string) => void }) {
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)

  const { data: leads, isLoading } = useQuery({
    queryKey: ['painel-leads-kanban', clientId],
    queryFn: async (): Promise<Lead[]> => {
      const { data } = await supabase
        .from('painel_leads')
        .select('id, full_name, email, phone, status, source, estimated_value_brl, score')
        .eq('client_id', clientId)
        .neq('status', 'nurturing')
        .order('created_at', { ascending: false })
        .limit(500)
      return (data as Lead[]) || []
    },
  })

  const byColumn = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>()
    COLUMNS.forEach(c => map.set(c.id, []))
    ;(leads || []).forEach(l => {
      const arr = map.get(l.status as LeadStatus)
      if (arr) arr.push(l)
    })
    return map
  }, [leads])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const activeLead = activeId ? (leads || []).find(l => l.id === activeId) : null

  async function moveLead(leadId: string, newStatus: LeadStatus) {
    const prev = qc.getQueryData<Lead[]>(['painel-leads-kanban', clientId])
    // optimistic
    qc.setQueryData<Lead[]>(['painel-leads-kanban', clientId], (old) =>
      (old || []).map(l => l.id === leadId ? { ...l, status: newStatus } : l)
    )
    const { error } = await supabase.from('painel_leads').update({ status: newStatus }).eq('id', leadId)
    if (error) {
      qc.setQueryData(['painel-leads-kanban', clientId], prev)
      toast.error('Erro ao mover')
      return
    }
    toast.success(`Movido para ${LEAD_STATUS_LABELS[newStatus]}`, { duration: 2000 })
    qc.invalidateQueries({ queryKey: ['painel-leads'] })
    qc.invalidateQueries({ queryKey: ['painel-dashboard-v2'] })
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    if (!e.over) return
    const leadId = String(e.active.id)
    const newStatus = String(e.over.id) as LeadStatus
    const lead = (leads || []).find(l => l.id === leadId)
    if (!lead || lead.status === newStatus) return
    moveLead(leadId, newStatus)
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {COLUMNS.map(c => <Skeleton key={c.id} className="h-96" />)}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 min-h-[500px]">
        {COLUMNS.map(col => {
          const items = byColumn.get(col.id) || []
          const total = items.reduce((s, l) => s + Number(l.estimated_value_brl || 0), 0)
          return (
            <Column key={col.id} id={col.id} label={col.label} tone={col.tone} count={items.length} totalValue={total}>
              {items.map(l => (
                <LeadCard key={l.id} lead={l} onClick={() => onOpenLead(l.id)} />
              ))}
            </Column>
          )
        })}
      </div>
      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} dragging />}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  id, label, tone, count, totalValue, children,
}: {
  id: LeadStatus; label: string; tone: string; count: number; totalValue: number; children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-lg bg-muted/40 border transition-colors',
        isOver ? 'border-primary bg-primary/5' : 'border-transparent'
      )}
    >
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('w-2 h-2 rounded-full', tone)} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="ml-auto text-xs tabular-nums font-medium">{count}</span>
        </div>
        {totalValue > 0 && (
          <div className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(totalValue)}</div>
        )}
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[700px]">
        {children}
      </div>
    </div>
  )
}

function LeadCard({ lead, onClick, dragging }: { lead: Lead; onClick?: () => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  const opacity = isDragging ? 0.3 : 1

  return (
    <Card
      ref={setNodeRef}
      style={{ opacity }}
      className={cn(
        'p-2.5 bg-background border cursor-pointer hover:border-primary/40 transition-colors',
        dragging && 'shadow-elevated rotate-1'
      )}
      onClick={(e) => {
        if (!isDragging && onClick) onClick()
        e.stopPropagation()
      }}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 mt-0.5 cursor-grab active:cursor-grabbing"
          aria-label="Arrastar"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <User2 className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className="text-sm font-medium truncate">{lead.full_name}</div>
          </div>
          <div className="space-y-0.5 text-[11px] text-muted-foreground">
            {lead.email && (
              <div className="flex items-center gap-1 truncate"><Mail className="w-2.5 h-2.5 shrink-0" />{lead.email}</div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-1"><Phone className="w-2.5 h-2.5 shrink-0" />{lead.phone}</div>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {lead.source && <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{lead.source}</Badge>}
            {lead.estimated_value_brl && (
              <span className="text-[10px] tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                {formatCurrency(Number(lead.estimated_value_brl))}
              </span>
            )}
            {lead.score > 0 && (
              <span className="text-[10px] tabular-nums text-muted-foreground ml-auto">★ {lead.score}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
