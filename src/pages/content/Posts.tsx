import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, ArrowRight, Lightbulb, Wrench, Clock, CheckCircle2, Sparkles, Send, MessageSquareWarning, Link2, Paperclip } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  ContentPost,
  ContentFormat,
  PostStatus,
  POST_STATUS_CONFIG,
  CONTENT_FORMAT_CONFIG,
  formatDate,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface StaffClient {
  id: string
  name: string
  company: string
}

const COLUMNS: { id: PostStatus; label: string; icon: typeof Lightbulb }[] = [
  { id: 'ideia', label: 'Ideia', icon: Lightbulb },
  { id: 'producao', label: 'Em produção', icon: Wrench },
  { id: 'aprovacao', label: 'Com o cliente', icon: Send },
  { id: 'ajuste', label: 'Ajuste pedido', icon: MessageSquareWarning },
  { id: 'aprovado', label: 'Aprovado', icon: CheckCircle2 },
  { id: 'agendado', label: 'Agendado', icon: Clock },
  { id: 'publicado', label: 'Publicado', icon: Sparkles },
]

const FORMAT_OPTIONS: ContentFormat[] = ['carrossel', 'reels', 'stories', 'feed']

const EMPTY_FORM = {
  title: '',
  format: 'carrossel' as ContentFormat,
  category: '',
  status: 'ideia' as PostStatus,
  scheduled_date: '',
  caption: '',
  hashtags: '',
  notes: '',
  // Entregável: vídeo não sobe pra cá. Fica no Drive (qualidade + peso) e vem o
  // link, mais um print pro cliente ver sem precisar baixar nada.
  arquivo_url: '',
  preview_url: '',
}

type PostForm = typeof EMPTY_FORM

export default function Posts() {
  const { toast } = useToast()
  const { isClient, isStaff } = useAuth()

  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)

  const [staffClients, setStaffClients] = useState<StaffClient[]>([])
  const [selectedStaffClientId, setSelectedStaffClientId] = useState<string>('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ContentPost | null>(null)
  const [form, setForm] = useState<PostForm>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PostForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ContentPost | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    (async () => {
      if (isClient) {
        const { data } = await supabase.rpc('current_client_id')
        if (data) setClientId(data as string)
      } else if (isStaff) {
        const { data } = await supabase
          .from('clientes_operacional')
          .select('id, name, company')
          .order('name')
        setStaffClients((data || []) as StaffClient[])
      }
    })()
  }, [isClient, isStaff])

  const activeClientId = isClient ? clientId : (selectedStaffClientId || null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('content_posts').select('*').order('created_at', { ascending: false })
    if (activeClientId) q = q.eq('client_id', activeClientId)
    const { data, error } = await q
    if (error) {
      toast({ title: 'Erro ao carregar posts', description: error.message, variant: 'destructive' })
      setPosts([])
    } else {
      setPosts((data || []) as ContentPost[])
    }
    setLoading(false)
  }, [activeClientId, toast])

  useEffect(() => {
    if (isClient && !clientId) return
    if (isStaff && !selectedStaffClientId) {
      setPosts([])
      setLoading(false)
      return
    }
    fetchPosts()
  }, [isClient, isStaff, clientId, selectedStaffClientId, fetchPosts])

  const postsByColumn = useMemo(() => {
    // Deriva das COLUMNS pra nunca esquecer uma etapa nova aqui.
    const grouped = Object.fromEntries(COLUMNS.map(c => [c.id, []])) as Record<PostStatus, ContentPost[]>

    for (const p of posts) grouped[p.status]?.push(p)
    return grouped
  }, [posts])

  const openNew = (initialStatus: PostStatus = 'ideia') => {
    if (isStaff && !selectedStaffClientId) {
      toast({ title: 'Selecione um cliente', description: 'Escolha qual cliente receberá o post.', variant: 'destructive' })
      return
    }
    setEditing(null)
    setForm({ ...EMPTY_FORM, status: initialStatus })
    setFormErrors({})
    setShowForm(true)
  }

  const openEdit = (post: ContentPost) => {
    setEditing(post)
    setForm({
      title: post.title,
      format: post.format,
      category: post.category || '',
      status: post.status,
      scheduled_date: post.scheduled_date ? post.scheduled_date.slice(0, 10) : '',
      caption: post.caption || '',
      hashtags: post.hashtags || '',
      notes: post.notes || '',
      arquivo_url: post.arquivo_url || '',
      preview_url: post.preview_url || '',
    })
    setFormErrors({})
    setShowForm(true)
  }

  const setField = <K extends keyof PostForm>(field: K, value: PostForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof PostForm, string>> = {}
    if (!form.title.trim()) errs.title = 'Título é obrigatório'
    if ((form.status === 'agendado' || form.status === 'publicado') && !form.scheduled_date) {
      errs.scheduled_date = 'Data é obrigatória para este status'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    if (!editing && !activeClientId) {
      toast({ title: 'Cliente não definido', description: 'Selecione um cliente antes de criar.', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      format: form.format,
      category: form.category.trim() || null,
      status: form.status,
      scheduled_date: form.scheduled_date || null,
      published_at: form.status === 'publicado' ? new Date().toISOString() : null,
      caption: form.caption.trim() || null,
      hashtags: form.hashtags.trim() || null,
      notes: form.notes.trim() || null,
      arquivo_url: form.arquivo_url.trim() || null,
      preview_url: form.preview_url.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('content_posts').update(payload).eq('id', editing.id)
      : await supabase.from('content_posts').insert({ ...payload, client_id: activeClientId })
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editing ? 'Post atualizado!' : 'Post criado!' })
    setShowForm(false)
    setEditing(null)
    fetchPosts()
  }

  const moveTo = async (post: ContentPost, status: PostStatus) => {
    if (status === post.status) return
    const patch: Partial<ContentPost> = { status }
    if (status === 'publicado' && !post.published_at) {
      patch.published_at = new Date().toISOString()
    }
    const { error } = await supabase.from('content_posts').update(patch).eq('id', post.id)
    if (error) {
      toast({ title: 'Erro ao mover', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Post movido', description: `→ ${POST_STATUS_CONFIG[status].label}` })
    fetchPosts()
  }

  /**
   * Manda a peça pro cliente: gera o token do link público, move pra "Com o
   * cliente" e copia o link. O mesmo token serve pra Sofia disparar no WhatsApp.
   *
   * Exige arquivo ou print de propósito: aprovar no escuro é o que fazia a
   * aprovação acontecer fora do sistema e voltar como "aprovado" sem rastro.
   */
  const sendForApproval = async (post: ContentPost) => {
    if (!post.client_id) {
      toast({ title: 'Post sem cliente', description: 'Atribua um cliente ao post antes.', variant: 'destructive' })
      return
    }
    if (!post.arquivo_url && !post.preview_url) {
      toast({
        title: 'Falta o entregável',
        description: 'Coloque o link do arquivo (Drive) ou o print antes de mandar pro cliente.',
        variant: 'destructive',
      })
      return
    }

    const token = post.token || `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '').slice(0, 32)

    const { error } = await supabase.from('content_posts').update({
      status: 'aprovacao',
      token,
      enviado_em: new Date().toISOString(),
      motivo_ajuste: null,
    }).eq('id', post.id)

    if (error) {
      toast({ title: 'Erro ao enviar pra aprovação', description: error.message, variant: 'destructive' })
      return
    }

    // Mantém o painel do cliente em sincronia com o link (as duas portas valem).
    await supabase.from('painel_post_approvals').upsert({
      post_id: post.id,
      client_id: post.client_id,
      status: 'aguardando',
      decided_at: null,
      decided_by: null,
    }, { onConflict: 'post_id' })

    const link = `${window.location.origin}/aprovar/conteudo/${token}`
    try { await navigator.clipboard.writeText(link) } catch { /* clipboard bloqueado, o link aparece no card */ }

    toast({
      title: 'Link de aprovação copiado',
      description: 'Cole no WhatsApp do cliente. Quando ele responder, a etapa muda sozinha.',
    })
    fetchPosts()
  }

  const copyApprovalLink = async (post: ContentPost) => {
    if (!post.token) return
    const link = `${window.location.origin}/aprovar/conteudo/${post.token}`
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Link copiado' })
    } catch {
      toast({ title: 'Copie o link', description: link })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('content_posts').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Post excluído', variant: 'destructive' })
    setDeleteTarget(null)
    fetchPosts()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestor de Posts</h1>
          <p className="text-sm text-muted-foreground">Fluxo editorial Kanban de ideia a publicação</p>
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
          <Button size="sm" onClick={() => openNew()} className="gap-2">
            <Plus className="h-4 w-4" /> Novo post
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : isStaff && !selectedStaffClientId ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Selecione um cliente no topo para ver seu Kanban de posts.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const items = postsByColumn[col.id]
            const ColIcon = col.icon
            const conf = POST_STATUS_CONFIG[col.id]
            return (
              <div key={col.id} className="flex flex-col bg-card border border-border rounded-xl">
                <div className="flex items-center justify-between px-3 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <ColIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{col.label}</span>
                    <Badge variant="outline" className={`text-xs ${conf.className}`}>{items.length}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openNew(col.id)} title="Novo nesta coluna">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex-1 p-2 space-y-2 min-h-32">
                  {items.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-lg">
                      Nenhum card aqui
                    </div>
                  ) : (
                    items.map(post => {
                      const fmt = CONTENT_FORMAT_CONFIG[post.format]
                      return (
                        <div
                          key={post.id}
                          onClick={() => openEdit(post)}
                          className="group bg-background border border-border rounded-lg p-3 space-y-2 cursor-pointer hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <p className="flex-1 text-sm font-medium line-clamp-2">{post.title}</p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100">
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent onClick={e => e.stopPropagation()}>
                                {COLUMNS.filter(c => c.id !== post.status).map(c => (
                                  <DropdownMenuItem key={c.id} onClick={() => moveTo(post, c.id)}>
                                    Mover para {c.label}
                                  </DropdownMenuItem>
                                ))}
                                {isStaff && post.client_id && (
                                  <DropdownMenuItem onClick={() => sendForApproval(post)}>
                                    <Send className="h-3.5 w-3.5 mr-2" />
                                    {post.status === 'ajuste' ? 'Reenviar pro cliente' : 'Enviar pra aprovação do cliente'}
                                  </DropdownMenuItem>
                                )}
                                {isStaff && post.token && (
                                  <DropdownMenuItem onClick={() => copyApprovalLink(post)}>
                                    <Link2 className="h-3.5 w-3.5 mr-2" />Copiar link de aprovação
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {post.preview_url && (
                            <img
                              src={post.preview_url}
                              alt=""
                              loading="lazy"
                              className="w-full h-24 object-cover rounded-md border border-border"
                            />
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={`text-xs ${fmt.className}`}>{fmt.label}</Badge>
                            {post.arquivo_url && (
                              <Badge variant="outline" className="text-[10px] gap-1 bg-info/10 text-info border-info/30">
                                <Paperclip className="h-2.5 w-2.5" /> arquivo
                              </Badge>
                            )}
                            {post.category && (
                              <span className="text-xs text-muted-foreground">· {post.category}</span>
                            )}
                          </div>

                          {/* O que o cliente respondeu, na cara do card */}
                          {post.status === 'ajuste' && post.motivo_ajuste && (
                            <p className="text-xs text-danger bg-danger/10 border border-danger/25 rounded-md px-2 py-1.5 line-clamp-3">
                              {post.motivo_ajuste}
                            </p>
                          )}
                          {post.status === 'aprovado' && post.aprovado_por && (
                            <p className="text-xs text-success">
                              Aprovado por {post.aprovado_por}
                              {post.aprovado_em ? ` · ${formatDate(post.aprovado_em.slice(0, 10))}` : ''}
                            </p>
                          )}
                          {post.status === 'aprovacao' && (
                            <p className="text-xs text-orange-400">
                              Aguardando o cliente
                              {post.enviado_em ? ` desde ${formatDate(post.enviado_em.slice(0, 10))}` : ''}
                            </p>
                          )}

                          {post.scheduled_date && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarIcon className="h-3 w-3" />
                              {formatDate(post.scheduled_date.slice(0, 10))}
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={e => { e.stopPropagation(); openEdit(post) }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={e => { e.stopPropagation(); setDeleteTarget(post) }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditing(null) } }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editing ? 'Editar post' : 'Novo post'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="pf-title">Título <span className="text-destructive">*</span></Label>
              <Input
                id="pf-title"
                placeholder="Ex: 5 sinais que seu filho precisa do pediatra"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                className={formErrors.title ? 'border-destructive' : ''}
                maxLength={200}
              />
              {formErrors.title && <p className="text-xs text-destructive">{formErrors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Formato</Label>
                <Select value={form.format} onValueChange={(v: ContentFormat) => setField('format', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map(f => (
                      <SelectItem key={f} value={f}>{CONTENT_FORMAT_CONFIG[f].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-cat">Categoria</Label>
                <Input
                  id="pf-cat"
                  placeholder="Ex: Educativo"
                  value={form.category}
                  onChange={e => setField('category', e.target.value)}
                  maxLength={60}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: PostStatus) => setField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-date">Data agendada</Label>
                <Input
                  id="pf-date"
                  type="date"
                  value={form.scheduled_date}
                  onChange={e => setField('scheduled_date', e.target.value)}
                  className={formErrors.scheduled_date ? 'border-destructive' : ''}
                />
                {formErrors.scheduled_date && <p className="text-xs text-destructive">{formErrors.scheduled_date}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-caption">Caption</Label>
              <Textarea
                id="pf-caption"
                placeholder="Texto do post..."
                value={form.caption}
                onChange={e => setField('caption', e.target.value)}
                rows={4}
                maxLength={2200}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-tags">Hashtags</Label>
              <Input
                id="pf-tags"
                placeholder="#pediatria #xinguara"
                value={form.hashtags}
                onChange={e => setField('hashtags', e.target.value)}
                maxLength={500}
              />
            </div>

            {/* Entregável: é o que o cliente vai ver na hora de aprovar */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 text-info" />
                <Label className="text-sm">Entregável</Label>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-arquivo" className="text-xs">Link do arquivo (Drive)</Label>
                <Input
                  id="pf-arquivo"
                  placeholder="https://drive.google.com/..."
                  value={form.arquivo_url}
                  onChange={e => setField('arquivo_url', e.target.value)}
                  maxLength={600}
                />
                <p className="text-xs text-muted-foreground">
                  Vídeo fica no Drive, não sobe pra cá: mantém a qualidade e não pesa.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-preview" className="text-xs">Print / prévia (URL da imagem)</Label>
                <Input
                  id="pf-preview"
                  placeholder="https://... (o cliente vê sem baixar nada)"
                  value={form.preview_url}
                  onChange={e => setField('preview_url', e.target.value)}
                  maxLength={600}
                />
              </div>

              {form.preview_url && (
                <img
                  src={form.preview_url}
                  alt="Prévia"
                  className="w-full max-h-48 object-contain rounded-md border border-border bg-muted/20"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-notes">Notas internas</Label>
              <Textarea
                id="pf-notes"
                placeholder="Observações para a equipe..."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={3}
                maxLength={1000}
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
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post?</AlertDialogTitle>
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
