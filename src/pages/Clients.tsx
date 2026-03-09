import { useEffect, useState, useCallback } from 'react'
import { Search, Eye, Building2, User, Plus, Pencil, Trash2, MessageSquare, Send, ExternalLink, Instagram } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { Client, Delivery, Invoice, Interaction, STATUS_CONFIG, PLANO_CONFIG, formatCurrency, formatDate } from '@/types'
import { useUsdRate, mrrBRL } from '@/hooks/useUsdRate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'

function getHealthColor(score: number) {
  if (score >= 75) return 'bg-success'
  if (score >= 50) return 'bg-warning'
  return 'bg-danger'
}

const EMPTY_FORM = {
  name: '',
  company: '',
  phone: '',
  email: '',
  segment: '',
  plano: 'starter',
  mrr: '',
  status: 'ativo',
  health_score: 80,
  inicio_contrato: new Date().toISOString().split('T')[0],
  notes: '',
  instagram: '',
  dia_vencimento: '',
}

const INTERACTION_TYPES = [
  { value: 'reuniao', label: 'Reunião' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'nota', label: 'Nota Interna' },
]

type ClientForm = typeof EMPTY_FORM

export default function Clients() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientDeliveries, setClientDeliveries] = useState<Delivery[]>([])
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([])
  const [clientInteractions, setClientInteractions] = useState<Interaction[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planoFilter, setPlanoFilter] = useState('all')

  // Create/Edit modal
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ClientForm, string>>>({})

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Log interaction
  const [interactionForm, setInteractionForm] = useState({ tipo: 'reuniao', descricao: '' })
  const [savingInteraction, setSavingInteraction] = useState(false)

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('mrr', { ascending: false })
    setClients(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  const openNewClient = () => {
    setEditingClient(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowForm(true)
  }

  const openEditClient = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingClient(client)
    setForm({
      name: client.name,
      company: client.company,
      phone: client.phone,
      email: client.email || '',
      segment: client.segment,
      plano: client.plano,
      mrr: String(client.mrr),
      status: client.status,
      health_score: client.health_score,
      inicio_contrato: client.inicio_contrato,
      notes: client.notes || '',
      instagram: client.instagram || '',
      dia_vencimento: client.dia_vencimento ? String(client.dia_vencimento) : '',
    })
    setFormErrors({})
    setShowForm(true)
  }

  const setField = (field: keyof ClientForm, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ClientForm, string>> = {}
    if (!form.name.trim()) errors.name = 'Nome é obrigatório'
    if (!form.company.trim()) errors.company = 'Empresa é obrigatória'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Email inválido'
    if (form.mrr !== '' && isNaN(Number(form.mrr))) errors.mrr = 'MRR deve ser um número'
    if (!form.inicio_contrato) errors.inicio_contrato = 'Data de início é obrigatória'
    if (form.dia_vencimento !== '' && (isNaN(Number(form.dia_vencimento)) || Number(form.dia_vencimento) < 1 || Number(form.dia_vencimento) > 31)) {
      errors.dia_vencimento = 'Dia inválido (1-31)'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveClient = async () => {
    if (!validateForm()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      segment: form.segment.trim(),
      plano: form.plano,
      mrr: form.mrr !== '' ? parseFloat(form.mrr) : 0,
      status: form.status,
      health_score: form.health_score,
      inicio_contrato: form.inicio_contrato,
      notes: form.notes.trim() || null,
      instagram: form.instagram.trim() || null,
      dia_vencimento: form.dia_vencimento !== '' ? parseInt(form.dia_vencimento) : null,
    }
    const { error } = editingClient
      ? await supabase.from('clients').update(payload).eq('id', editingClient.id)
      : await supabase.from('clients').insert(payload)
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar cliente', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: editingClient ? 'Cliente atualizado!' : 'Cliente criado!', description: `${form.name} salvo com sucesso.` })
      setShowForm(false)
      setEditingClient(null)
      if (editingClient && selectedClient?.id === editingClient.id) {
        setSelectedClient(prev => prev ? { ...prev, ...payload } : null)
      }
      fetchClients()
    }
  }

  const handleDeleteClient = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('clients').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast({ title: 'Erro ao excluir cliente', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Cliente excluído', description: `${deleteTarget.name} foi removido.`, variant: 'destructive' })
      setDeleteTarget(null)
      if (selectedClient?.id === deleteTarget.id) setSelectedClient(null)
      fetchClients()
    }
  }

  const openClient = async (client: Client) => {
    setSelectedClient(client)
    setInteractionForm({ tipo: 'reuniao', descricao: '' })
    const [{ data: deliveries }, { data: invoices }, { data: interactions }] = await Promise.all([
      supabase.from('deliveries').select('*').eq('client_id', client.id).order('prazo'),
      supabase.from('invoices').select('*').eq('client_id', client.id).order('vencimento', { ascending: false }),
      supabase.from('interactions').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    ])
    setClientDeliveries(deliveries || [])
    setClientInvoices(invoices || [])
    setClientInteractions(interactions || [])
  }

  const refreshInteractions = async (clientId: string) => {
    const { data } = await supabase.from('interactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setClientInteractions(data || [])
  }

  const handleLogInteraction = async () => {
    if (!selectedClient || !interactionForm.descricao.trim()) return
    setSavingInteraction(true)
    const { error } = await supabase.from('interactions').insert({
      client_id: selectedClient.id,
      tipo: interactionForm.tipo,
      descricao: interactionForm.descricao.trim(),
      user_id: user?.id || null,
    })
    setSavingInteraction(false)
    if (error) {
      toast({ title: 'Erro ao registrar interação', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Interação registrada!', description: 'Adicionada ao histórico do cliente.' })
      setInteractionForm({ tipo: 'reuniao', descricao: '' })
      refreshInteractions(selectedClient.id)
    }
  }

  const saveNotes = async () => {
    if (!selectedClient) return
    await supabase.from('clients').update({ notes: selectedClient.notes }).eq('id', selectedClient.id)
    toast({ title: 'Notas salvas!', description: 'Anotações atualizadas com sucesso.' })
    fetchClients()
  }

  const filtered = clients.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (planoFilter !== 'all' && c.plano !== planoFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.company.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="risco">Em Risco</SelectItem>
            <SelectItem value="inadimplente">Inadimplente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planoFilter} onValueChange={setPlanoFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Plano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos planos</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openNewClient} className="gap-2 ml-auto">
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Cliente</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health Score</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((client) => {
              const statusConf = STATUS_CONFIG[client.status]
              const planoConf = PLANO_CONFIG[client.plano]
              return (
                <TableRow key={client.id} className="border-border hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                          {client.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{client.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{client.company}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs capitalize ${planoConf?.className}`}>
                      {planoConf?.label || client.plano}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-success text-sm">{formatCurrency(client.mrr)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${statusConf?.className}`}>
                      {statusConf?.label || client.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Score</span>
                        <span className={`font-bold ${client.health_score >= 75 ? 'text-success' : client.health_score >= 50 ? 'text-warning' : 'text-danger'}`}>
                          {client.health_score}
                        </span>
                      </div>
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getHealthColor(client.health_score)}`}
                          style={{ width: `${client.health_score}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(client.inicio_contrato)}</TableCell>
                  <TableCell>
                    {client.instagram ? (
                      <a
                        href={`https://instagram.com/${client.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
                        title={`Abrir ${client.instagram} no Instagram`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary">
                          <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                        </svg>
                        <span className="text-muted-foreground">{client.instagram}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openClient(client)} className="gap-1 text-xs">
                        <Eye className="h-3 w-3" /> Ver
                      </Button>
                      <Button variant="ghost" size="sm" onClick={e => openEditClient(client, e)} className="gap-1 text-xs">
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => { e.stopPropagation(); setDeleteTarget(client) }}
                        className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum cliente encontrado</p>
          </div>
        )}
      </div>

      {/* Create / Edit Client Modal */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditingClient(null) } }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingClient ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name">Nome <span className="text-destructive">*</span></Label>
              <Input id="cf-name" placeholder="Nome do responsável" value={form.name} onChange={e => setField('name', e.target.value)} className={formErrors.name ? 'border-destructive' : ''} maxLength={100} />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cf-company">Empresa <span className="text-destructive">*</span></Label>
                <Input id="cf-company" placeholder="Nome da empresa" value={form.company} onChange={e => setField('company', e.target.value)} className={formErrors.company ? 'border-destructive' : ''} maxLength={100} />
                {formErrors.company && <p className="text-xs text-destructive">{formErrors.company}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-phone">Telefone</Label>
                <Input id="cf-phone" placeholder="(00) 00000-0000" value={form.phone} onChange={e => setField('phone', e.target.value)} maxLength={20} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cf-email">Email</Label>
                <Input id="cf-email" type="email" placeholder="email@empresa.com" value={form.email} onChange={e => setField('email', e.target.value)} className={formErrors.email ? 'border-destructive' : ''} maxLength={255} />
                {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-segment">Segmento</Label>
                <Input id="cf-segment" placeholder="Ex: saúde, varejo..." value={form.segment} onChange={e => setField('segment', e.target.value)} maxLength={60} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cf-instagram">Instagram</Label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="cf-instagram" placeholder="@perfil" value={form.instagram} onChange={e => setField('instagram', e.target.value)} className="pl-9" maxLength={60} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-venc">Venc. Mensalidade (dia)</Label>
                <Input id="cf-venc" type="number" placeholder="Ex: 5" min="1" max="31" value={form.dia_vencimento} onChange={e => setField('dia_vencimento', e.target.value)} className={formErrors.dia_vencimento ? 'border-destructive' : ''} />
                {formErrors.dia_vencimento && <p className="text-xs text-destructive">{formErrors.dia_vencimento}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <Select value={form.plano} onValueChange={v => setField('plano', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="risco">Em Risco</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cf-mrr">MRR (R$)</Label>
                <Input id="cf-mrr" type="number" placeholder="0,00" min="0" step="0.01" value={form.mrr} onChange={e => setField('mrr', e.target.value)} className={formErrors.mrr ? 'border-destructive' : ''} />
                {formErrors.mrr && <p className="text-xs text-destructive">{formErrors.mrr}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-inicio">Início do Contrato <span className="text-destructive">*</span></Label>
                <Input id="cf-inicio" type="date" value={form.inicio_contrato} onChange={e => setField('inicio_contrato', e.target.value)} className={formErrors.inicio_contrato ? 'border-destructive' : ''} />
                {formErrors.inicio_contrato && <p className="text-xs text-destructive">{formErrors.inicio_contrato}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Health Score</Label>
                <span className={`text-sm font-bold ${form.health_score >= 75 ? 'text-success' : form.health_score >= 50 ? 'text-warning' : 'text-danger'}`}>
                  {form.health_score}/100
                </span>
              </div>
              <Slider min={0} max={100} step={1} value={[form.health_score]} onValueChange={([v]) => setField('health_score', v)} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Em Risco</span>
                <span>Saudável</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-notes">Notas</Label>
              <Textarea id="cf-notes" placeholder="Observações sobre o cliente..." value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} maxLength={1000} className="resize-none" />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            {editingClient && (
              <Button variant="destructive" onClick={() => { setShowForm(false); setDeleteTarget(editingClient) }} disabled={saving} className="mr-auto">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={saving} className="gap-2">
              {saving
                ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : editingClient ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />
              }
              {saving ? 'Salvando...' : editingClient ? 'Atualizar' : 'Criar Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
              Esta ação não pode ser desfeita e todos os dados relacionados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Detail Modal */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/15 text-primary font-bold">
                    {selectedClient?.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle>{selectedClient?.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground font-normal">{selectedClient?.company}</p>
                </div>
              </div>
              <div className="flex gap-2 pr-8">
                <Button variant="outline" size="sm" onClick={e => selectedClient && openEditClient(selectedClient, e)} className="gap-1 text-xs">
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setDeleteTarget(selectedClient); setSelectedClient(null) }} className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                  <Trash2 className="h-3 w-3" /> Excluir
                </Button>
              </div>
            </div>
          </DialogHeader>
          {selectedClient && (
            <Tabs defaultValue="info">
              <TabsList className="w-full bg-muted">
                <TabsTrigger value="info" className="flex-1 text-xs">Informações</TabsTrigger>
                <TabsTrigger value="history" className="flex-1 text-xs">
                  Histórico {clientInteractions.length > 0 && <span className="ml-1 bg-primary/20 text-primary text-xs rounded-full px-1.5">{clientInteractions.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="deliveries" className="flex-1 text-xs">Entregas</TabsTrigger>
                <TabsTrigger value="invoices" className="flex-1 text-xs">Faturas</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1 text-xs">Notas</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Email', value: selectedClient.email || '—' },
                    { label: 'Telefone', value: selectedClient.phone || '—' },
                    { label: 'Segmento', value: selectedClient.segment },
                    { label: 'Plano', value: PLANO_CONFIG[selectedClient.plano]?.label || selectedClient.plano },
                    { label: 'MRR', value: formatCurrency(selectedClient.mrr) },
                    { label: 'Início Contrato', value: formatDate(selectedClient.inicio_contrato) },
                  ].map(item => (
                    <div key={item.label} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className="font-medium">{item.value}</p>
                    </div>
                  ))}
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Instagram</p>
                    {selectedClient.instagram ? (
                      <a
                        href={`https://instagram.com/${selectedClient.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary flex items-center gap-1 hover:underline"
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        {selectedClient.instagram.startsWith('@') ? selectedClient.instagram : `@${selectedClient.instagram}`}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    ) : (
                      <p className="font-medium text-muted-foreground">—</p>
                    )}
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Venc. Mensalidade</p>
                    <p className="font-medium">
                      {selectedClient.dia_vencimento ? `Dia ${selectedClient.dia_vencimento} de cada mês` : '—'}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Health Score</p>
                  <div className="flex items-center gap-3">
                    <Progress value={selectedClient.health_score} className="flex-1 h-3" />
                    <span className={`font-bold ${selectedClient.health_score >= 75 ? 'text-success' : selectedClient.health_score >= 50 ? 'text-warning' : 'text-danger'}`}>
                      {selectedClient.health_score}/100
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4 space-y-4">
                {/* Log Interaction Form */}
                <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Registrar Interação
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={interactionForm.tipo} onValueChange={v => setInteractionForm(p => ({ ...p, tipo: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTERACTION_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Descreva a interação..."
                      value={interactionForm.descricao}
                      onChange={e => setInteractionForm(p => ({ ...p, descricao: e.target.value }))}
                      rows={1}
                      className="col-span-2 min-h-8 resize-none text-xs"
                      maxLength={500}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleLogInteraction}
                    disabled={savingInteraction || !interactionForm.descricao.trim()}
                  >
                    {savingInteraction
                      ? <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      : <Send className="h-3.5 w-3.5" />
                    }
                    {savingInteraction ? 'Salvando...' : 'Registrar'}
                  </Button>
                </div>

                {/* Interaction List */}
                {clientInteractions.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">Nenhuma interação registrada</p>
                ) : (
                  <div className="space-y-2">
                    {clientInteractions.map(i => {
                      const typeConf = INTERACTION_TYPES.find(t => t.value === i.tipo)
                      return (
                        <div key={i.id} className="flex gap-3 p-3 bg-muted/30 rounded-lg border-l-2 border-primary/40">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">{typeConf?.label || i.tipo}</Badge>
                              <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm">{i.descricao}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="deliveries" className="mt-4">
                {clientDeliveries.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma entrega registrada</p>
                ) : (
                  <div className="space-y-2">
                    {clientDeliveries.map(d => (
                      <div key={d.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                        <Badge variant="outline" className="text-xs capitalize shrink-0">{d.tipo}</Badge>
                        <p className="flex-1 truncate">{d.titulo}</p>
                        <Badge variant="outline" className={`text-xs capitalize shrink-0 ${d.status === 'entregue' ? 'bg-success/20 text-success border-success/30' : ''}`}>{d.status}</Badge>
                        <p className="text-xs text-muted-foreground shrink-0">{formatDate(d.prazo)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="invoices" className="mt-4">
                {clientInvoices.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma fatura registrada</p>
                ) : (
                  <div className="space-y-2">
                    {clientInvoices.map(inv => (
                      <div key={inv.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                        <p className="font-bold text-success flex-1">{formatCurrency(inv.valor)}</p>
                        <p className="text-muted-foreground">{formatDate(inv.vencimento)}</p>
                        <Badge variant="outline" className={`text-xs capitalize ${inv.status === 'pago' ? 'bg-success/20 text-success border-success/30' : inv.status === 'atrasado' ? 'bg-danger/20 text-danger border-danger/30' : ''}`}>
                          {inv.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4 space-y-3">
                <Textarea
                  value={selectedClient.notes || ''}
                  onChange={e => setSelectedClient(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Adicione suas anotações sobre este cliente..."
                  className="min-h-32 bg-muted/30 border-border"
                  rows={6}
                />
                <Button onClick={saveNotes} className="w-full">Salvar Notas</Button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
