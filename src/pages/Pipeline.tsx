import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Search, X, Plus, Pencil, Trash2, ExternalLink, Instagram } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Lead, PIPELINE_STAGES, formatCurrency, getDaysAgo } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
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
  instagram: '',
}

// Stages shown in "Avançar" (excludes perdido)
const ACTIVE_STAGES = PIPELINE_STAGES.filter(s => s.id !== 'perdido')

export default function Pipeline() {
  const { toast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [filters, setFilters] = useState({ source: '', segment: '' })
  const [search, setSearch] = useState('')

  // New lead modal
  const [showNewLead, setShowNewLead] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [nameError, setNameError] = useState('')

  // Edit lead modal
  const [showEditLead, setShowEditLead] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editNameError, setEditNameError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Delete lead
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const setEditField = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
    if (field === 'name') setEditNameError('')
  }

  const handleCreateLead = async () => {
    if (!form.name.trim()) { setNameError('Nome é obrigatório'); return }
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
      instagram: form.instagram.trim() || null,
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

  const openEditLead = (lead: Lead) => {
    setEditForm({
      name: lead.name,
      company: lead.company || '',
      phone: lead.phone || '',
      email: lead.email || '',
      segment: lead.segment || '',
      source: lead.source,
      stage: lead.stage,
      plano: lead.plano || '',
      ticket_estimado: lead.ticket_estimado ? String(lead.ticket_estimado) : '',
      notes: lead.notes || '',
      instagram: lead.instagram || '',
    })
    setEditNameError('')
    setShowEditLead(true)
  }

  const handleEditLead = async () => {
    if (!selectedLead) return
    if (!editForm.name.trim()) { setEditNameError('Nome é obrigatório'); return }
    setEditSaving(true)
    const payload = {
      name: editForm.name.trim(),
      company: editForm.company.trim() || null,
      phone: editForm.phone.trim(),
      email: editForm.email.trim() || null,
      segment: editForm.segment.trim() || null,
      source: editForm.source,
      stage: editForm.stage,
      plano: editForm.plano || null,
      ticket_estimado: editForm.ticket_estimado ? parseFloat(editForm.ticket_estimado) : null,
      notes: editForm.notes.trim() || null,
      instagram: editForm.instagram.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('leads').update(payload).eq('id', selectedLead.id)
    setEditSaving(false)
    if (error) {
      toast({ title: 'Erro ao atualizar lead', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Lead atualizado!', description: `${editForm.name} salvo com sucesso.` })
      setShowEditLead(false)
      setSelectedLead(prev => prev ? { ...prev, ...payload } : null)
      fetchLeads()
    }
  }

  const handleDeleteLead = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('leads').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast({ title: 'Erro ao excluir lead', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Lead excluído', description: `${deleteTarget.name} foi removido.`, variant: 'destructive' })
      setDeleteTarget(null)
      if (selectedLead?.id === deleteTarget.id) setSelectedLead(null)
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
    const stages = ACTIVE_STAGES.map(s => s.id)
    const currentIdx = stages.indexOf(selectedLead.stage)
    if (currentIdx < 0 || currentIdx >= stages.length - 1) return
    const nextStage = stages[currentIdx + 1]
    const { error } = await supabase.from('leads').update({ stage: nextStage }).eq('id', selectedLead.id)
    if (!error) {
      toast({ title: 'Lead avançado!', description: `Movido para ${ACTIVE_STAGES[currentIdx + 1].label}` })
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

  const LeadFormFields = ({ f, setF, nameErr }: { f: typeof EMPTY_FORM; setF: (k: string, v: string) => void; nameErr: string }) => (
    <div className="space-y-4 py-1">
      <div className="space-y-1.5">
        <Label>Nome <span className="text-destructive">*</span></Label>
        <Input placeholder="Nome do lead" value={f.name} onChange={e => setF('name', e.target.value)} className={nameErr ? 'border-destructive' : ''} maxLength={100} />
        {nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Empresa</Label>
          <Input placeholder="Empresa" value={f.company} onChange={e => setF('company', e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input placeholder="(00) 00000-0000" value={f.phone} onChange={e => setF('phone', e.target.value)} maxLength={20} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="email@exemplo.com" value={f.email} onChange={e => setF('email', e.target.value)} maxLength={255} />
        </div>
        <div className="space-y-1.5">
          <Label>Segmento</Label>
          <Input placeholder="Ex: saúde, varejo..." value={f.segment} onChange={e => setF('segment', e.target.value)} maxLength={60} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Origem</Label>
          <Select value={f.source} onValueChange={v => setF('source', v)}>
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
          <Select value={f.stage} onValueChange={v => setF('stage', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Plano</Label>
          <Select value={f.plano || 'none'} onValueChange={v => setF('plano', v === 'none' ? '' : v)}>
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
          <Label>Ticket Estimado (R$)</Label>
          <Input type="number" placeholder="0,00" min="0" step="0.01" value={f.ticket_estimado} onChange={e => setF('ticket_estimado', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Notas</Label>
        <Textarea placeholder="Observações sobre o lead..." value={f.notes} onChange={e => setF('notes', e.target.value)} rows={3} maxLength={1000} className="resize-none" />
      </div>
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
          <LeadFormFields f={form} setF={setField} nameErr={nameError} />
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowNewLead(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreateLead} disabled={saving} className="gap-2">
              {saving ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Modal */}
      <Dialog open={showEditLead} onOpenChange={open => { setShowEditLead(open); if (!open) setEditNameError('') }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Editar Lead
            </DialogTitle>
          </DialogHeader>
          <LeadFormFields f={editForm} setF={setEditField} nameErr={editNameError} />
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={() => { setShowEditLead(false); setDeleteTarget(selectedLead) }}
              disabled={editSaving}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setShowEditLead(false)} disabled={editSaving}>Cancelar</Button>
            <Button onClick={handleEditLead} disabled={editSaving} className="gap-2">
              {editSaving ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <Pencil className="h-4 w-4" />}
              {editSaving ? 'Salvando...' : 'Atualizar Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLead}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead && !showEditLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="text-lg">{selectedLead?.name}</DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => selectedLead && openEditLead(selectedLead)}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => { setDeleteTarget(selectedLead); setSelectedLead(null) }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Empresa</Label>
                  <p className="mt-0.5 font-medium">{selectedLead.company || '—'}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Telefone</Label>
                  <p className="mt-0.5 font-medium">{selectedLead.phone || '—'}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="mt-0.5 font-medium truncate">{selectedLead.email || '—'}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Segmento</Label>
                  <p className="mt-0.5 font-medium capitalize">{selectedLead.segment || '—'}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Origem</Label>
                  <p className="mt-0.5 font-medium capitalize">{selectedLead.source}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Plano</Label>
                  <p className="mt-0.5 font-medium capitalize">{selectedLead.plano || '—'}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Ticket Estimado</Label>
                  <p className="mt-0.5 font-bold text-success">{selectedLead.ticket_estimado ? formatCurrency(selectedLead.ticket_estimado) : '—'}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Etapa</Label>
                  <p className="mt-0.5 font-medium capitalize">{PIPELINE_STAGES.find(s => s.id === selectedLead.stage)?.label || selectedLead.stage}</p>
                </div>
              </div>
              {selectedLead.notes && (
                <div className="p-3 bg-muted/40 rounded-lg">
                  <Label className="text-muted-foreground text-xs">Notas</Label>
                  <p className="text-sm mt-1">{selectedLead.notes}</p>
                </div>
              )}
              {selectedLead.stage !== 'perdido' && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={handleMoveNext} disabled={selectedLead.stage === 'fechado'}>
                    Avançar etapa
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleMarkLost}>
                    Marcar como perdido
                  </Button>
                </div>
              )}
              {selectedLead.stage === 'perdido' && (
                <div className="p-3 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
                  Este lead foi marcado como perdido. Edite para reabri-lo em outra etapa.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
