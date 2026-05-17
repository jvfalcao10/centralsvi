import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckSquare, Check, AlertCircle, MessageSquare, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { usePainelContext } from '@/components/PainelLayout'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Approval = {
  id: string
  post_id: string
  status: 'aguardando' | 'aprovado' | 'mudancas_pedidas'
  decided_at: string | null
  created_at: string
  post?: {
    id: string
    title: string
    format: string
    caption: string | null
    hashtags: string | null
    scheduled_date: string | null
  }
}

type Comment = {
  id: string
  user_id: string | null
  actor_kind: 'user' | 'svi_team' | 'client' | 'system'
  content: string
  kind: 'comment' | 'approval' | 'change_request'
  created_at: string
  profiles?: { name: string | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  aguardando: 'Aguardando',
  aprovado: 'Aprovado',
  mudancas_pedidas: 'Pediu mudanças',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  aguardando: 'default',
  aprovado: 'secondary',
  mudancas_pedidas: 'destructive',
}

export default function PainelAprovacoes() {
  const { client } = usePainelContext()
  const [selected, setSelected] = useState<Approval | null>(null)

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['painel-approvals', client.id],
    queryFn: async (): Promise<Approval[]> => {
      const { data } = await supabase
        .from('painel_post_approvals')
        .select(`
          id, post_id, status, decided_at, created_at,
          post:content_posts(id, title, format, caption, hashtags, scheduled_date)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(50)
      return (data as any) || []
    },
  })

  const pending = (approvals || []).filter(a => a.status === 'aguardando')
  const past = (approvals || []).filter(a => a.status !== 'aguardando')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Conteúdo</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Aprovações de posts</h1>
        <p className="text-muted-foreground mt-1">
          O time da SVI envia os criativos aqui. Você aprova ou pede ajustes em segundos — chega de aprovar por WhatsApp.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />Pendentes ({pending.length})
        </h2>
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : pending.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <CheckSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Sem aprovações pendentes. Tudo em dia.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {pending.map(a => (
              <ApprovalCard key={a.id} approval={a} onOpen={() => setSelected(a)} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />Histórico ({past.length})
          </h2>
          <div className="grid gap-3">
            {past.slice(0, 10).map(a => (
              <ApprovalCard key={a.id} approval={a} onOpen={() => setSelected(a)} compact />
            ))}
          </div>
        </section>
      )}

      <ApprovalDialog approval={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function ApprovalCard({ approval, onOpen, compact }: { approval: Approval; onOpen: () => void; compact?: boolean }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onOpen}>
      <CardContent className={compact ? 'p-4' : 'p-5'}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="capitalize">{approval.post?.format || '—'}</Badge>
              <Badge variant={STATUS_VARIANT[approval.status]}>{STATUS_LABEL[approval.status]}</Badge>
            </div>
            <div className="font-semibold truncate">{approval.post?.title || 'Post sem título'}</div>
            {!compact && approval.post?.caption && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{approval.post.caption}</p>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              Enviado {formatDistanceToNow(new Date(approval.created_at), { addSuffix: true, locale: ptBR })}
            </div>
          </div>
          {approval.status === 'aguardando' && (
            <Button size="sm">Revisar</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ApprovalDialog({ approval, onClose }: { approval: Approval | null; onClose: () => void }) {
  const { client } = usePainelContext()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: comments } = useQuery({
    queryKey: ['painel-comments', approval?.post_id],
    enabled: !!approval,
    queryFn: async (): Promise<Comment[]> => {
      const { data } = await supabase
        .from('painel_post_comments')
        .select('id, user_id, actor_kind, content, kind, created_at, profiles:user_id(name)')
        .eq('post_id', approval!.post_id)
        .order('created_at', { ascending: true })
      return (data as any) || []
    },
  })

  if (!approval) return null

  async function decide(decision: 'aprovado' | 'mudancas_pedidas') {
    setSubmitting(true)
    const trimmed = comment.trim()

    // Validação: pedir mudanças requer comentário
    if (decision === 'mudancas_pedidas' && !trimmed) {
      toast.error('Escreva o que precisa ajustar.')
      setSubmitting(false)
      return
    }

    const { error: ae } = await supabase
      .from('painel_post_approvals')
      .update({ status: decision, decided_at: new Date().toISOString(), decided_by: user?.id })
      .eq('id', approval!.id)

    if (ae) {
      toast.error('Erro ao salvar decisão')
      setSubmitting(false)
      return
    }

    if (trimmed) {
      await supabase.from('painel_post_comments').insert({
        post_id: approval!.post_id,
        client_id: client.id,
        user_id: user?.id,
        actor_kind: 'client',
        content: trimmed,
        kind: decision === 'aprovado' ? 'approval' : 'change_request',
      })
    }

    toast.success(decision === 'aprovado' ? 'Post aprovado.' : 'Mudanças pedidas. Time SVI foi notificado.')
    setComment('')
    qc.invalidateQueries({ queryKey: ['painel-approvals'] })
    qc.invalidateQueries({ queryKey: ['painel-comments'] })
    onClose()
  }

  async function justComment() {
    const trimmed = comment.trim()
    if (!trimmed) return
    setSubmitting(true)
    await supabase.from('painel_post_comments').insert({
      post_id: approval!.post_id,
      client_id: client.id,
      user_id: user?.id,
      actor_kind: 'client',
      content: trimmed,
      kind: 'comment',
    })
    setComment('')
    qc.invalidateQueries({ queryKey: ['painel-comments'] })
    setSubmitting(false)
    toast.success('Comentário enviado')
  }

  return (
    <Dialog open={!!approval} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{approval.post?.title || 'Post pra revisar'}</DialogTitle>
          <DialogDescription>
            Status atual: <Badge variant={STATUS_VARIANT[approval.status]}>{STATUS_LABEL[approval.status]}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {approval.post?.caption && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Legenda</div>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{approval.post.caption}</p>
            </div>
          )}
          {approval.post?.hashtags && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Hashtags</div>
              <p className="text-sm text-muted-foreground">{approval.post.hashtags}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Conversa ({comments?.length || 0})
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(comments || []).map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    c.actor_kind === 'svi_team' ? 'bg-primary/20 text-primary' : 'bg-muted'
                  }`}>
                    {c.kind === 'approval' ? <Check className="w-3.5 h-3.5" /> :
                     c.kind === 'change_request' ? <AlertCircle className="w-3.5 h-3.5" /> :
                     <MessageSquare className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {c.actor_kind === 'svi_team' ? 'Equipe SVI' : c.profiles?.name || 'Cliente'}
                      </span>
                      {' · '}
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                    <div className="text-sm mt-0.5">{c.content}</div>
                  </div>
                </div>
              ))}
              {(comments || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sem comentários ainda.</p>
              )}
            </div>
          </div>

          <div>
            <Textarea
              placeholder="Escreva um comentário ou descreva o ajuste pedido…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row">
          {approval.status === 'aguardando' ? (
            <>
              <Button variant="outline" onClick={() => decide('mudancas_pedidas')} disabled={submitting}>
                Pedir mudanças
              </Button>
              <Button onClick={() => decide('aprovado')} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Aprovar
              </Button>
            </>
          ) : (
            <Button onClick={justComment} disabled={submitting || !comment.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar comentário
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
