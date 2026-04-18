import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search, Check, X, AlertTriangle, Lightbulb } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  ContentPauta,
  PautaUrgency,
  PautaStatus,
  PAUTA_URGENCY_CONFIG,
  PAUTA_STATUS_CONFIG,
  formatTimestamp,
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface StaffClient {
  id: string
  name: string
  company: string
}

const URGENCY_OPTIONS: PautaUrgency[] = ['evergreen', 'tendencia', 'sazonal']
const STATUS_OPTIONS: PautaStatus[] = ['disponivel', 'usada', 'descartada']

const EMPTY_FORM = {
  title: '',
  category: '',
  format_suggestion: '',
  urgency: 'evergreen' as PautaUrgency,
  notes: '',
}

type PautaForm = typeof EMPTY_FORM

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function Pautas() {
  const { toast } = useToast()
  const { isClient, isStaff } = useAuth()

  const [pautas, setPautas] = useState<ContentPauta[]>([])
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)

  const [staffClients, setStaffClients] = useState<StaffClient[]>([])
  const [selectedStaffClientId, setSelectedStaffClientId] = useState<string>('')

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ContentPauta | null>(null)
  const [form, setForm] = useState<PautaForm>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PautaForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ContentPauta | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    (async () => {
      if (isClient) {
        const { data } = await supabase.rpc('current_client_id')
        if (data) setClientId(data as string)
      } else if (isStaff) {
        const { data } = await supabase
          .from('clients')
          .select('id, name, company')
          .order('name')
        setStaffClients((data || []) as StaffClient[])
      }
    })()
  }, [isClient, isStaff])

  const activeClientId = isClient ? clientId : (selectedStaffClientId || null)

  const fetchPautas = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('content_pautas').select('*').order('created_at', { ascending: false })
    if (activeClientId) q = q.eq('client_id', activeClientId)
    const { data, error } = await q
    if (error) {
      toast({ title: 'Erro ao carregar pautas', description: error.message, variant: 'destructive' })
      setPautas([])
    } else {
      setPautas((data || []) as ContentPauta[])
    }
    setLoading(false)
  }, [activeClientId, toast])

  useEffect(() => {
    if (isClient && !clientId) return
    if (isStaff && !selectedStaffClientId) {
      setPautas([])
      setLoading(false)
      return
    }
    fetchPautas()
  }, [isClient, isStaff, clientId, selectedStaffClientId, fetchPautas])

  const filtered = useMemo(() => {
    return pautas.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (urgencyFilter !== 'all' && p.urgency !== urgencyFilter) return false
      if (categoryFilter && !(p.category || '').toLowerCase().includes(categoryFilter.toLowerCase())) return false
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [pautas, search, categoryFilter, urgencyFilter, statusFilter])

  const openNew = () => {
    if (isStaff && !selectedStaffClientId) {
      toast({ title: 'Selecione um cliente', description: 'Escolha qual cliente receberá a pauta.', variant: 'destructive' })
      return
    }
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowForm(true)
  }

  const openEdit = (p: ContentPauta) => {
    setEditing(p)
    setForm({
      title: p.title,
      category: p.category || '',
      format_suggestion: p.format_suggestion || '',
      urgency: p.urgency,
      notes: p.notes || '',
    })
    setFormErrors({})
    setShowForm(true)
  }

  const setField = <K extends keyof PautaForm>(field: K, value: PautaForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof PautaForm, string>> = {}
    if (!form.title.trim()) errs.title = 'Título é obrigatório'
    if (!form.category.trim()) errs.category = 'Categoria é obrigatória'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    if (!editing && !activeClientId) {
      toast({ title: 'Cliente não definido', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      format_suggestion: form.format_suggestion.trim() || null,
      urgency: form.urgency,
      notes: form.notes.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('content_pautas').update(payload).eq('id', editing.id)
      : await supabase.from('content_pautas').insert({ ...payload, client_id: activeClientId, status: 'disponivel' })
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editing ? 'Pauta atualizada!' : 'Pauta criada!' })
    setShowForm(false)
    setEditing(null)
    fetchPautas()
  }

  const setStatus = async (p: ContentPauta, status: PautaStatus) => {
    const { error } = await supabase.from('content_pautas').update({ status }).eq('id', p.id)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Pauta marcada como ${PAUTA_STATUS_CONFIG[status].label.toLowerCase()}` })
    fetchPautas()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('content_pautas').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Pauta excluída', variant: 'destructive' })
    setDeleteTarget(null)
    fetchPautas()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Banco de Pautas</h1>
          <p className="text-sm text-muted-foreground">Ideias e temas prontos para virar post</p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <Select value={selectedStaffClientId} onValueChange={setSelectedStaffClientId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
              <SelectContent>
                {staffClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} — {c.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova pauta
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar pautas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Input placeholder="Categoria" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-40" />
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Urgência" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas urgências</SelectItem>
            {URGENCY_OPTIONS.map(u => (
              <SelectItem key={u} value={u}>{PAUTA_URGENCY_CONFIG[u].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{PAUTA_STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : isStaff && !selectedStaffClientId ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Selecione um cliente no topo para ver suas pautas.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma pauta encontrada com esses filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(p => {
            const urg = PAUTA_URGENCY_CONFIG[p.urgency]
            const st = PAUTA_STATUS_CONFIG[p.status]
            const stale = p.status === 'disponivel' && daysSince(p.created_at) > 30
            return (
              <div
                key={p.id}
                className={`bg-card border rounded-xl p-4 space-y-3 hover:border-primary/40 transition-colors ${stale ? 'border-warning/50' : 'border-border'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug flex-1">{p.title}</p>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {p.category && (
                    <Badge variant="outline" className="text-xs">{p.category}</Badge>
                  )}
                  <Badge variant="outline" className={`text-xs ${urg.className}`}>{urg.label}</Badge>
                  <Badge variant="outline" className={`text-xs ${st.className}`}>{st.label}</Badge>
                </div>

                {p.format_suggestion && (
                  <p className="text-xs text-muted-foreground">Formato: {p.format_suggestion}</p>
                )}

                {p.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>
                )}

                {stale && (
                  <div className="flex items-center gap-1.5 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Não utilizada há mais de 30 dias
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">{formatTimestamp(p.created_at)}</span>
                  <div className="flex items-center gap-1">
                    {p.status !== 'usada' && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-success hover:text-success hover:bg-success/10" onClick={() => setStatus(p, 'usada')}>
                        <Check className="h-3 w-3" /> Usada
                      </Button>
                    )}
                    {p.status !== 'descartada' && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => setStatus(p, 'descartada')}>
                        <X className="h-3 w-3" /> Descartar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditing(null) } }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editing ? 'Editar pauta' : 'Nova pauta'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="bf-title">Título <span className="text-destructive">*</span></Label>
              <Input
                id="bf-title"
                placeholder="Ex: Erros comuns na introdução alimentar"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                className={formErrors.title ? 'border-destructive' : ''}
                maxLength={200}
              />
              {formErrors.title && <p className="text-xs text-destructive">{formErrors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bf-cat">Categoria <span className="text-destructive">*</span></Label>
                <Input
                  id="bf-cat"
                  placeholder="Ex: Educativo"
                  value={form.category}
                  onChange={e => setField('category', e.target.value)}
                  className={formErrors.category ? 'border-destructive' : ''}
                  maxLength={60}
                />
                {formErrors.category && <p className="text-xs text-destructive">{formErrors.category}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bf-fmt">Formato sugerido</Label>
                <Input
                  id="bf-fmt"
                  placeholder="Ex: Carrossel 7 slides"
                  value={form.format_suggestion}
                  onChange={e => setField('format_suggestion', e.target.value)}
                  maxLength={60}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Urgência</Label>
              <Select value={form.urgency} onValueChange={(v: PautaUrgency) => setField('urgency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map(u => (
                    <SelectItem key={u} value={u}>{PAUTA_URGENCY_CONFIG[u].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bf-notes">Notas / direcionamentos</Label>
              <Textarea
                id="bf-notes"
                placeholder="Ângulo, ganchos, referências..."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={4}
                maxLength={2000}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving
                ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />
              }
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar pauta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pauta?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <span className="font-semibold text-foreground">{deleteTarget?.title}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
