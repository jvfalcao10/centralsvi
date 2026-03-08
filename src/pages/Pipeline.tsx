import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Search, X, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Lead, PIPELINE_STAGES, formatCurrency, getDaysAgo } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const SOURCE_COLORS: Record<string, string> = {
  organico: 'bg-success/20 text-success border-success/30',
  pago: 'bg-info/20 text-info border-info/30',
  indicacao: 'bg-warning/20 text-warning border-warning/30',
  evento: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

const EMPTY_FORM = {
  name: '',
  company: '',
  phone: '',
  email: '',
  segment: '',
  source: 'organico',
  stage: 'lead',
  plano: '',
  ticket_estimado: '',
  notes: '',
}

export default function Pipeline() {
  const { toast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [filters, setFilters] = useState({ source: '', segment: '' })
  const [search, setSearch] = useState('')
  const [showNewLead, setShowNewLead] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [nameError, setNameError] = useState('')

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    else setLeads(data || [])
    setLoading(false)
  }, [toast])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const setField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'name') setNameError('')
  }

  const handleCreateLead = async () => {
    if (!form.name.trim()) {
      setNameError('Nome é obrigatório')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      segment: form.segment.trim() || null,
      source: form.source,
      stage: form.stage,
      plano: form.plano || null,
      ticket_estimado: form.ticket_estimado ? parseFloat(form.ticket_estimado) : null,
      notes: form.notes.trim() || null,
    }
    const { error } = await supabase.from('leads').insert(payload)
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Lead criado!', description: `${form.name} adicionado ao pipeline` })
      setForm(EMPTY_FORM)
      setShowNewLead(false)
      fetchLeads()
    }
  }

  const filteredLeads = leads.filter(l => {
    if (filters.source && l.source !== filters.source) return false
    if (filters.segment && l.segment !== filters.segment) return false
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.company?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const getLeadsByStage = (stageId: string) => filteredLeads.filter(l => l.stage === stageId)

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const { draggableId, destination } = result
    const newStage = destination.droppableId

    setLeads(prev => prev.map(l => l.id === draggableId ? { ...l, stage: newStage } : l))

    const { error } = await supabase.from('leads').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', draggableId)
    if (error) {
      toast({ title: 'Erro ao mover lead', variant: 'destructive' })
      fetchLeads()
    }
  }

  const handleMoveNext = async () => {
    if (!selectedLead) return
    const stages = PIPELINE_STAGES.map(s => s.id)
    const currentIdx = stages.indexOf(selectedLead.stage)
    if (currentIdx >= stages.length - 1) return

    const nextStage = stages[currentIdx + 1]
    const { error } = await supabase.from('leads').update({ stage: nextStage }).eq('id', selectedLead.id)
    if (!error) {
      toast({ title: 'Lead avançado!', description: `Movido para ${PIPELINE_STAGES[currentIdx + 1].label}` })
      setSelectedLead(prev => prev ? { ...prev, stage: nextStage } : null)
      fetchLeads()
    }
  }

  const handleMarkLost = async () => {
    if (!selectedLead) return
    const { error } = await supabase.from('leads').update({ stage: 'perdido' }).eq('id', selectedLead.id)
    if (!error) {
      toast({ title: 'Lead marcado como perdido', variant: 'destructive' })
      setSelectedLead(null)
      fetchLeads()
    }
  }

  const clearFilters = () => { setFilters({ source: '', segment: '' }); setSearch('') }

  const segments = [...new Set(leads.map(l => l.segment).filter(Boolean))]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filters.source || 'all'} onValueChange={v => setFilters(p => ({ ...p, source: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="organico">Orgânico</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="indicacao">Indicação</SelectItem>
            <SelectItem value="evento">Evento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.segment || 'all'} onValueChange={v => setFilters(p => ({ ...p, segment: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Segmento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos segmentos</SelectItem>
            {segments.map(s => s && <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filters.source || filters.segment || search) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-muted-foreground">
            <X className="h-4 w-4" /> Limpar
          </Button>
        )}
        <Button size="sm" onClick={() => setShowNewLead(true)} className="gap-2 ml-auto">
          <Plus className="h-4 w-4" /> Novo Lead
        </Button>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id)
            return (
              <div key={stage.id} className="flex-shrink-0 w-64">
                <div className={`rounded-xl border ${stage.color} p-3 mb-2`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-foreground">{stage.label}</h3>
                    <span className="text-xs bg-background/50 rounded-full px-2 py-0.5 text-muted-foreground">
                      {stageLeads.length}
                    </span>
                  </div>
                  {stageLeads.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(stageLeads.reduce((s, l) => s + (l.ticket_estimado || 0), 0))}
                    </p>
                  )}
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-24 space-y-2 rounded-xl p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                    >
                      {stageLeads.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedLead(lead)}
                              className={`bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all ${snapshot.isDragging ? 'shadow-xl rotate-1 border-primary/50' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-foreground truncate">{lead.name}</p>
                                  {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">{getDaysAgo(lead.created_at)}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {lead.segment && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">{lead.segment}</Badge>
                                )}
                                {lead.source && (
                                  <Badge variant="outline" className={`text-xs px-1.5 py-0 capitalize ${SOURCE_COLORS[lead.source] || ''}`}>{lead.source}</Badge>
                                )}
                              </div>
                              {lead.ticket_estimado && (
                                <p className="text-success text-sm font-bold">{formatCurrency(lead.ticket_estimado)}</p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* New Lead Modal */}
      <Dialog open={showNewLead} onOpenChange={open => { setShowNewLead(open); if (!open) { setForm(EMPTY_FORM); setNameError('') } }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Novo Lead
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="nl-name">Nome <span className="text-destructive">*</span></Label>
              <Input
                id="nl-name"
                placeholder="Nome do lead"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                className={nameError ? 'border-destructive' : ''}
                maxLength={100}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            {/* Empresa + Telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nl-company">Empresa</Label>
                <Input id="nl-company" placeholder="Empresa" value={form.company} onChange={e => setField('company', e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-phone">Telefone</Label>
                <Input id="nl-phone" placeholder="(00) 00000-0000" value={form.phone} onChange={e => setField('phone', e.target.value)} maxLength={20} />
              </div>
            </div>

            {/* Email + Segmento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nl-email">Email</Label>
                <Input id="nl-email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => setField('email', e.target.value)} maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-segment">Segmento</Label>
                <Input id="nl-segment" placeholder="Ex: saúde, varejo..." value={form.segment} onChange={e => setField('segment', e.target.value)} maxLength={60} />
              </div>
            </div>

            {/* Origem + Etapa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select value={form.source} onValueChange={v => setField('source', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organico">Orgânico</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select value={form.stage} onValueChange={v => setField('stage', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Plano + Ticket Estimado */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <Select value={form.plano || 'none'} onValueChange={v => setField('plano', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-ticket">Ticket Estimado (R$)</Label>
                <Input
                  id="nl-ticket"
                  type="number"
                  placeholder="0,00"
                  min="0"
                  step="0.01"
                  value={form.ticket_estimado}
                  onChange={e => setField('ticket_estimado', e.target.value)}
                />
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="nl-notes">Notas</Label>
              <Textarea
                id="nl-notes"
                placeholder="Observações sobre o lead..."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowNewLead(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLead} disabled={saving} className="gap-2">
              {saving ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedLead?.name}</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-muted-foreground text-xs">Empresa</Label><p>{selectedLead.company || '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Telefone</Label><p>{selectedLead.phone || '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Email</Label><p>{selectedLead.email || '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Segmento</Label><p className="capitalize">{selectedLead.segment || '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Origem</Label><p className="capitalize">{selectedLead.source}</p></div>
                <div><Label className="text-muted-foreground text-xs">Plano</Label><p className="capitalize">{selectedLead.plano || '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Ticket Estimado</Label><p className="text-success font-bold">{selectedLead.ticket_estimado ? formatCurrency(selectedLead.ticket_estimado) : '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Etapa</Label>
                  <p className="capitalize">{PIPELINE_STAGES.find(s => s.id === selectedLead.stage)?.label || selectedLead.stage}</p>
                </div>
              </div>
              {selectedLead.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Notas</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{selectedLead.notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleMoveNext} disabled={selectedLead.stage === 'fechado'}>
                  Avançar etapa
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleMarkLost}>
                  Marcar como perdido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
