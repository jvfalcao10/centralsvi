import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, MessageCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { usePainelContext } from '@/components/PainelLayout'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

type Thread = {
  id: string
  title: string
  last_message_at: string | null
  last_message_preview: string | null
  unread_for_client: number
}

type Message = {
  id: string
  thread_id: string
  user_id: string | null
  actor_kind: 'client' | 'svi_team'
  content: string
  created_at: string
}

export default function PainelConversa() {
  const { client } = usePainelContext()
  const { user, isClient } = useAuth()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const { data: thread, isLoading: loadingThread } = useQuery({
    queryKey: ['painel-thread', client.id],
    queryFn: async (): Promise<Thread | null> => {
      const { data: existing } = await supabase
        .from('painel_threads')
        .select('id, title, last_message_at, last_message_preview, unread_for_client')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (existing) return existing as Thread

      // Cria thread default na primeira vez
      const { data: created } = await supabase
        .from('painel_threads')
        .insert({ client_id: client.id, title: 'Conversa com a SVI' })
        .select('id, title, last_message_at, last_message_preview, unread_for_client')
        .single()
      return (created as Thread) || null
    },
  })

  const { data: messages, isLoading: loadingMsgs } = useQuery({
    queryKey: ['painel-thread-msgs', thread?.id],
    enabled: !!thread,
    queryFn: async (): Promise<Message[]> => {
      const { data } = await supabase
        .from('painel_thread_messages')
        .select('id, thread_id, user_id, actor_kind, content, created_at')
        .eq('thread_id', thread!.id)
        .order('created_at', { ascending: true })
        .limit(200)
      return (data as Message[]) || []
    },
  })

  // Realtime
  useEffect(() => {
    if (!thread) return
    const ch = supabase
      .channel(`thread-${thread.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'painel_thread_messages', filter: `thread_id=eq.${thread.id}` },
        () => qc.invalidateQueries({ queryKey: ['painel-thread-msgs', thread.id] })
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [thread, qc])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Zera unread counter quando cliente abre a conversa
  useEffect(() => {
    if (!thread || !isClient || thread.unread_for_client === 0) return
    supabase
      .from('painel_threads')
      .update({ unread_for_client: 0 })
      .eq('id', thread.id)
      .then(() => qc.invalidateQueries({ queryKey: ['painel-thread', client.id] }))
  }, [thread, isClient, client.id, qc])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending || !thread) return
    setSending(true)
    setInput('')
    const { error } = await supabase.from('painel_thread_messages').insert({
      thread_id: thread.id,
      client_id: client.id,
      user_id: user?.id,
      actor_kind: isClient ? 'client' : 'svi_team',
      content: text,
    })
    setSending(false)
    if (error) {
      setInput(text)
      return
    }
    qc.invalidateQueries({ queryKey: ['painel-thread-msgs', thread.id] })
  }

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Comunicação</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Falar com a SVI</h1>
        <p className="text-muted-foreground mt-1">
          Canal direto com seu gestor de conta. Mensagens ficam no painel, sem se perder no WhatsApp.
        </p>
      </div>

      <Card className="flex-1 flex flex-col min-h-[600px]">
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-3 flex flex-col">
          {loadingThread || loadingMsgs ? (
            <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-3/4" />)}</div>
          ) : (messages || []).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 m-auto">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">Comece a conversa</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {isClient
                  ? 'Pergunta sobre estratégia, peça uma campanha, peça ajuste em algo. Equipe SVI responde aqui.'
                  : 'Cliente ainda não enviou mensagem. Seja proativo — pergunte se está tudo bem.'}
              </p>
            </div>
          ) : (
            messages?.map(m => {
              const isOwn = (isClient && m.actor_kind === 'client') || (!isClient && m.actor_kind === 'svi_team')
              return (
                <div key={m.id} className={cn('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                    isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    {m.content}
                  </div>
                  <div className="text-[10px] text-muted-foreground px-1">
                    {m.actor_kind === 'svi_team' ? 'Equipe SVI' : 'Você'} ·{' '}
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                  </div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </CardContent>
        <form onSubmit={send} className="border-t p-3 flex items-center gap-2 bg-background">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mensagem pra equipe SVI…"
            className="flex-1 border-0 focus-visible:ring-0"
            disabled={sending || !thread}
          />
          <Button type="submit" disabled={!input.trim() || sending || !thread} size="icon">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </Card>
    </div>
  )
}
