import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, Clock, Mail, Phone, Instagram, Building2, MessageSquare, Link as LinkIcon, RefreshCw, Search, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatTimestamp } from '@/types'

interface SignupRequest {
  id: string
  user_id: string
  email: string
  name: string
  company: string
  phone: string | null
  instagram: string | null
  segment: string | null
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  client_id: string | null
  rejection_reason: string | null
  created_at: string
  reviewed_at: string | null
}

interface ExistingClient {
  id: string
  name: string
  company: string
  email: string | null
}

export default function Approvals() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<SignupRequest[]>([])
  const [existingClients, setExistingClients] = useState<ExistingClient[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [loading, setLoading] = useState(true)

  const [approveDialog, setApproveDialog] = useState<SignupRequest | null>(null)
  const [linkToExisting, setLinkToExisting] = useState<string>('new')
  const [rejectDialog, setRejectDialog] = useState<SignupRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<SignupRequest | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: reqs }, { data: clis }] = await Promise.all([
      supabase
        .from('client_signup_requests')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, name, company, email')
        .is('user_id', null) // apenas clientes sem login linkado
        .order('company'),
    ])
    setRequests((reqs || []) as SignupRequest[])
    setExistingClients((clis || []) as ExistingClient[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = requests.filter(r => {
    if (r.status !== tab) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.instagram?.toLowerCase().includes(q)
    )
  })

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  async function handleApprove() {
    if (!approveDialog) return
    setActing(true)
    const { error } = await supabase.rpc('approve_client_signup', {
      _request_id: approveDialog.id,
      _link_to_client_id: linkToExisting === 'new' ? null : linkToExisting,
    })
    setActing(false)
    if (error) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Cliente aprovado', description: `${approveDialog.name} agora tem acesso ao painel.` })
    setApproveDialog(null)
    setLinkToExisting('new')
    load()
  }

  async function handleReject() {
    if (!rejectDialog) return
    setActing(true)
    const { error } = await supabase.rpc('reject_client_signup', {
      _request_id: rejectDialog.id,
      _reason: rejectReason.trim() || null,
    })
    setActing(false)
    if (error) {
      toast({ title: 'Erro ao rejeitar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Solicitação rejeitada' })
    setRejectDialog(null)
    setRejectReason('')
    load()
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aprovações de Clientes</h1>
          <p className="text-sm text-muted-foreground">Novos cadastros aguardando análise da equipe SVI.Co</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pendentes" value={counts.pending} icon={Clock} color="warning" />
        <StatCard label="Aprovados" value={counts.approved} icon={CheckCircle2} color="success" />
        <StatCard label="Rejeitados" value={counts.rejected} icon={XCircle} color="danger" />
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, empresa, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading && <div className="text-center text-sm text-muted-foreground py-12">Carregando...</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12 bg-card border border-border rounded-xl">
              Nenhuma solicitação {tab === 'pending' ? 'pendente' : tab === 'approved' ? 'aprovada' : 'rejeitada'}.
            </div>
          )}
          {filtered.map(r => (
            <RequestCard
              key={r.id} req={r}
              onApprove={() => setApproveDialog(r)}
              onReject={() => setRejectDialog(r)}
              onDelete={() => setDeleteDialog(r)}
            />
          ))}
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={o => !o && setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar {approveDialog?.name}</DialogTitle>
            <DialogDescription>
              Você pode criar um novo cliente no CRM ou vincular este cadastro a um cliente existente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Vincular a:</label>
              <Select value={linkToExisting} onValueChange={setLinkToExisting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ Criar novo cliente no CRM</SelectItem>
                  {existingClients.length > 0 && (
                    <>
                      {existingClients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company} — {c.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {linkToExisting === 'new' ? (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                Um novo registro em <strong>Clientes</strong> será criado com: <strong>{approveDialog?.company}</strong> ({approveDialog?.name}).
              </div>
            ) : (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                O login será vinculado ao cliente existente selecionado. O email e telefone do cadastro preencherão campos vazios.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Cancelar</Button>
            <Button onClick={handleApprove} disabled={acting}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {acting ? 'Aprovando...' : 'Aprovar acesso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={o => !o && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar {rejectDialog?.name}?</DialogTitle>
            <DialogDescription>
              O motivo (opcional) será exibido ao usuário na tela de pendência.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da rejeição (opcional)..."
            value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={acting}>
              {acting ? 'Rejeitando...' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete request */}
      <AlertDialog open={!!deleteDialog} onOpenChange={o => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar registro de {deleteDialog?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove permanentemente o registro de aprovação ({deleteDialog?.email}).
              {deleteDialog?.status === 'approved' && deleteDialog?.client_id && (
                <span className="block mt-2 text-warning text-xs">
                  ⚠️ Este registro está vinculado a um cliente no CRM. Apagar aqui não remove o cliente — só o histórico de aprovação.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault()
                if (!deleteDialog) return
                setDeleting(true)
                const { error } = await supabase
                  .from('client_signup_requests')
                  .delete()
                  .eq('id', deleteDialog.id)
                setDeleting(false)
                if (error) {
                  toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' })
                  return
                }
                toast({ title: 'Registro apagado' })
                setDeleteDialog(null)
                load()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Apagando...' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: 'warning' | 'success' | 'danger' }) {
  const colorMap = {
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
    danger: 'bg-destructive/10 text-destructive',
  }
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-3xl font-bold mt-1">{value}</div>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  )
}

function RequestCard({ req, onApprove, onReject, onDelete }: { req: SignupRequest; onApprove: () => void; onReject: () => void; onDelete: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold truncate">{req.name}</h3>
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" /> {req.company}
            </Badge>
            {req.segment && <Badge variant="secondary" className="text-xs">{req.segment}</Badge>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
            <a href={`mailto:${req.email}`} className="flex items-center gap-1.5 hover:text-primary truncate">
              <Mail className="h-3 w-3 flex-shrink-0" /> {req.email}
            </a>
            {req.phone && (
              <a href={`https://wa.me/55${req.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary">
                <Phone className="h-3 w-3 flex-shrink-0" /> {req.phone}
              </a>
            )}
            {req.instagram && (
              <a href={`https://instagram.com/${req.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary">
                <Instagram className="h-3 w-3 flex-shrink-0" /> {req.instagram}
              </a>
            )}
          </div>
          {req.message && (
            <div className="mt-3 text-sm text-foreground bg-muted/40 rounded-md p-3 flex gap-2">
              <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
              <span className="italic">"{req.message}"</span>
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Solicitado em {formatTimestamp(req.created_at)}</span>
            {req.client_id && (
              <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Vinculado</span>
            )}
            {req.rejection_reason && (
              <span className="text-destructive">Motivo: {req.rejection_reason}</span>
            )}
          </div>
        </div>
        {req.status === 'pending' && (
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={onApprove}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={onReject}>
              <XCircle className="h-4 w-4 mr-1.5" /> Rejeitar
            </Button>
          </div>
        )}
        {(req.status === 'approved' || req.status === 'rejected') && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={onDelete}
            title="Apagar registro"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
