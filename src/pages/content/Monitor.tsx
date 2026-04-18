import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, ExternalLink, Instagram, Youtube, Linkedin, ArrowUpDown, Eye, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { ContentReference, RefPlatform, formatTimestamp } from '@/types'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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

const PLATFORM_OPTIONS: RefPlatform[] = ['instagram', 'youtube', 'linkedin', 'tiktok']

const PLATFORM_CONFIG: Record<RefPlatform, { label: string; className: string }> = {
  instagram: { label: 'Instagram', className: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  youtube:   { label: 'YouTube',   className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  linkedin:  { label: 'LinkedIn',  className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  tiktok:    { label: 'TikTok',    className: 'bg-muted text-foreground' },
}

function PlatformIcon({ platform, className }: { platform: RefPlatform; className?: string }) {
  switch (platform) {
    case 'instagram': return <Instagram className={className} />
    case 'youtube':   return <Youtube className={className} />
    case 'linkedin':  return <Linkedin className={className} />
    case 'tiktok':    return <Youtube className={className} />
  }
}

function handleUrl(platform: RefPlatform, handle: string): string {
  const clean = handle.replace(/^@/, '')
  switch (platform) {
    case 'instagram': return `https://instagram.com/${clean}`
    case 'youtube':   return `https://youtube.com/@${clean}`
    case 'linkedin':  return `https://linkedin.com/in/${clean}`
    case 'tiktok':    return `https://tiktok.com/@${clean}`
  }
}

type SortKey = 'name' | 'followers_count' | 'posts_per_week'

const EMPTY_FORM = {
  name: '',
  platform: 'instagram' as RefPlatform,
  handle: '',
  specialty: '',
  followers_count: '',
  posts_per_week: '',
  top_formats: '',
  notes: '',
}

type RefForm = typeof EMPTY_FORM

export default function Monitor() {
  const { toast } = useToast()
  const { isClient, isStaff } = useAuth()

  const [refs, setRefs] = useState<ContentReference[]>([])
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)

  const [staffClients, setStaffClients] = useState<StaffClient[]>([])
  const [selectedStaffClientId, setSelectedStaffClientId] = useState<string>('')

  const [platformFilter, setPlatformFilter] = useState('all')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ContentReference | null>(null)
  const [form, setForm] = useState<RefForm>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RefForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<ContentReference | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<ContentReference | null>(null)
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

  const fetchRefs = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('content_references').select('*').order('name')
    if (activeClientId) q = q.eq('client_id', activeClientId)
    const { data, error } = await q
    if (error) {
      toast({ title: 'Erro ao carregar referências', description: error.message, variant: 'destructive' })
      setRefs([])
    } else {
      setRefs((data || []) as ContentReference[])
    }
    setLoading(false)
  }, [activeClientId, toast])

  useEffect(() => {
    if (isClient && !clientId) return
    if (isStaff && !selectedStaffClientId) {
      setRefs([])
      setLoading(false)
      return
    }
    fetchRefs()
  }, [isClient, isStaff, clientId, selectedStaffClientId, fetchRefs])

  const filteredSorted = useMemo(() => {
    const filtered = refs.filter(r => {
      if (platformFilter !== 'all' && r.platform !== platformFilter) return false
      if (specialtyFilter && !(r.specialty || '').toLowerCase().includes(specialtyFilter.toLowerCase())) return false
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'followers_count') cmp = (a.followers_count || 0) - (b.followers_count || 0)
      else if (sortBy === 'posts_per_week') cmp = (a.posts_per_week || 0) - (b.posts_per_week || 0)
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [refs, platformFilter, specialtyFilter, sortBy, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(true) }
  }

  const openNew = () => {
    if (isStaff && !selectedStaffClientId) {
      toast({ title: 'Selecione um cliente', variant: 'destructive' })
      return
    }
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowForm(true)
  }

  const openEdit = (r: ContentReference) => {
    setEditing(r)
    setForm({
      name: r.name,
      platform: r.platform,
      handle: r.handle,
      specialty: r.specialty || '',
      followers_count: r.followers_count != null ? String(r.followers_count) : '',
      posts_per_week: r.posts_per_week != null ? String(r.posts_per_week) : '',
      top_formats: r.top_formats || '',
      notes: r.notes || '',
    })
    setFormErrors({})
    setShowForm(true)
  }

  const setField = <K extends keyof RefForm>(field: K, value: RefForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof RefForm, string>> = {}
    if (!form.name.trim()) errs.name = 'Nome é obrigatório'
    if (!form.handle.trim()) errs.handle = 'Handle é obrigatório'
    if (form.followers_count && isNaN(Number(form.followers_count))) errs.followers_count = 'Número inválido'
    if (form.posts_per_week && isNaN(Number(form.posts_per_week))) errs.posts_per_week = 'Número inválido'
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
      name: form.name.trim(),
      platform: form.platform,
      handle: form.handle.trim().replace(/^@/, ''),
      specialty: form.specialty.trim() || null,
      followers_count: form.followers_count ? parseInt(form.followers_count) : null,
      posts_per_week: form.posts_per_week ? parseInt(form.posts_per_week) : null,
      top_formats: form.top_formats.trim() || null,
      notes: form.notes.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('content_references').update(payload).eq('id', editing.id)
      : await supabase.from('content_references').insert({ ...payload, client_id: activeClientId })
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editing ? 'Referência atualizada!' : 'Referência adicionada!' })
    setShowForm(false)
    setEditing(null)
    fetchRefs()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('content_references').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Referência excluída', variant: 'destructive' })
    setDeleteTarget(null)
    if (detail?.id === deleteTarget.id) setDetail(null)
    fetchRefs()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Monitor de Referências</h1>
          <p className="text-sm text-muted-foreground">Perfis que inspiram a estratégia de conteúdo</p>
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
            <Plus className="h-4 w-4" /> Adicionar referência
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas plataformas</SelectItem>
            {PLATFORM_OPTIONS.map(p => (
              <SelectItem key={p} value={p}>{PLATFORM_CONFIG[p].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Especialidade"
          value={specialtyFilter}
          onChange={e => setSpecialtyFilter(e.target.value)}
          className="w-52"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : isStaff && !selectedStaffClientId ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Selecione um cliente no topo para ver suas referências.
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma referência cadastrada.</p>
          <p className="text-xs mt-1">Adicione perfis que inspiram a estratégia de conteúdo.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                    Nome <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort('followers_count')} className="flex items-center gap-1 hover:text-foreground">
                    Seguidores <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort('posts_per_week')} className="flex items-center gap-1 hover:text-foreground">
                    Posts/sem <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Top formatos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSorted.map(r => {
                const platConf = PLATFORM_CONFIG[r.platform]
                return (
                  <TableRow
                    key={r.id}
                    className="border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDetail(r)}
                  >
                    <TableCell className="font-medium text-sm">{r.name}</TableCell>
                    <TableCell>
                      <a
                        href={handleUrl(r.platform, r.handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <PlatformIcon platform={r.platform} className="h-3.5 w-3.5" />
                        @{r.handle}
                      </a>
                    </TableCell>
                    <TableCell>
                      {r.specialty ? (
                        <Badge variant="outline" className="text-xs">{r.specialty}</Badge>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.followers_count != null
                        ? new Intl.NumberFormat('pt-BR').format(r.followers_count)
                        : <span className="text-muted-foreground/40">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.posts_per_week != null ? r.posts_per_week : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-48 truncate">
                      {r.top_formats || <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setDetail(r) }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); openEdit(r) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={e => { e.stopPropagation(); setDeleteTarget(r) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!detail} onOpenChange={open => { if (!open) setDetail(null) }}>
        <SheetContent className="bg-card border-border overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>
                  <Badge variant="outline" className={`text-xs ${PLATFORM_CONFIG[detail.platform].className}`}>
                    {PLATFORM_CONFIG[detail.platform].label}
                  </Badge>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Handle</p>
                  <a
                    href={handleUrl(detail.platform, detail.handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <PlatformIcon platform={detail.platform} className="h-4 w-4" />
                    @{detail.handle} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {detail.specialty && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Especialidade</p>
                    <p className="text-sm">{detail.specialty}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground">Seguidores</p>
                    <p className="text-lg font-bold">
                      {detail.followers_count != null
                        ? new Intl.NumberFormat('pt-BR').format(detail.followers_count)
                        : '—'}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground">Posts/semana</p>
                    <p className="text-lg font-bold">{detail.posts_per_week ?? '—'}</p>
                  </div>
                </div>

                {detail.top_formats && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Top formatos</p>
                    <p className="text-sm">{detail.top_formats}</p>
                  </div>
                )}

                {detail.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm whitespace-pre-wrap p-3 bg-muted/40 rounded-lg">{detail.notes}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Adicionada em {formatTimestamp(detail.created_at)}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => { openEdit(detail); setDetail(null) }}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => { setDeleteTarget(detail); setDetail(null) }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditing(null) } }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editing ? 'Editar referência' : 'Adicionar referência'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="mf-name">Nome <span className="text-destructive">*</span></Label>
              <Input
                id="mf-name"
                placeholder="Nome do perfil"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                className={formErrors.name ? 'border-destructive' : ''}
                maxLength={120}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plataforma</Label>
                <Select value={form.platform} onValueChange={(v: RefPlatform) => setField('platform', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map(p => (
                      <SelectItem key={p} value={p}>{PLATFORM_CONFIG[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mf-h">Handle <span className="text-destructive">*</span></Label>
                <Input
                  id="mf-h"
                  placeholder="@usuario"
                  value={form.handle}
                  onChange={e => setField('handle', e.target.value)}
                  className={formErrors.handle ? 'border-destructive' : ''}
                  maxLength={60}
                />
                {formErrors.handle && <p className="text-xs text-destructive">{formErrors.handle}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mf-spec">Especialidade</Label>
              <Input
                id="mf-spec"
                placeholder="Ex: Pediatria, Nutrição Infantil..."
                value={form.specialty}
                onChange={e => setField('specialty', e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mf-fc">Seguidores</Label>
                <Input
                  id="mf-fc"
                  type="number"
                  min="0"
                  placeholder="Ex: 12000"
                  value={form.followers_count}
                  onChange={e => setField('followers_count', e.target.value)}
                  className={formErrors.followers_count ? 'border-destructive' : ''}
                />
                {formErrors.followers_count && <p className="text-xs text-destructive">{formErrors.followers_count}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mf-ppw">Posts/semana</Label>
                <Input
                  id="mf-ppw"
                  type="number"
                  min="0"
                  max="50"
                  placeholder="Ex: 5"
                  value={form.posts_per_week}
                  onChange={e => setField('posts_per_week', e.target.value)}
                  className={formErrors.posts_per_week ? 'border-destructive' : ''}
                />
                {formErrors.posts_per_week && <p className="text-xs text-destructive">{formErrors.posts_per_week}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mf-tf">Top formatos</Label>
              <Input
                id="mf-tf"
                placeholder="Ex: Reels educativos, carrossel de dicas"
                value={form.top_formats}
                onChange={e => setField('top_formats', e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mf-n">Notas</Label>
              <Textarea
                id="mf-n"
                placeholder="O que gostamos / o que copiar / o que evitar..."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={4}
                maxLength={2000}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            {editing && (
              <Button
                variant="destructive"
                onClick={() => { setShowForm(false); setDeleteTarget(editing) }}
                disabled={saving}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving
                ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />
              }
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir referência?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? Esta ação não pode ser desfeita.
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
