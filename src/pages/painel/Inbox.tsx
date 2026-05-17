import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Send, MessageCircle, Loader2, Phone, User2, Search, ExternalLink, Inbox as InboxIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/AuthContext'
import { usePainelContext } from '@/components/PainelLayout'
import { LeadDetailDialog } from '@/components/painel/LeadDetailDialog'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

type Thread = {
  id: string
  client_id: string
  external_phone: string | null
  lead_id: string | null
  title: string
  last_message_at: string | null
  last_message_preview: string | null
  unread_for_svi: number
  created_at: string
}

type Message = {
  id: string
  thread_id: string
  user_id: string | null
  actor_kind: 'client' | 'svi_team' | 'lead'
  direction: 'inbound' | 'outbound' | null
  content: string
  created_at: string
}

export default function PainelInbox() {
  const { client, slug } = usePainelContext()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('thread'))
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const { data: threads, isLoading } = useQuery({
    queryKey: ['painel-inbox-threads', client.id],
    queryFn: async (): Promise<Thread[]> => {
      const { data } = await supabase
        .from('painel_threads')
        .select('id, client_id, external_phone, lead_id, title, last_message_at, last_message_preview, unread_for_svi, created_at')
        .eq('client_id', client.id)
        .eq('kind', 'whatsapp_lead')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200)
      return (data as Thread[]) || []
    },
    refetchInterval: 30_000,
  })

  const { data: messages, isLoading: loadingMsgs } = useQuery({
    queryKey: ['painel-inbox-msgs', selectedId],
    enabled: !!selectedId,
    queryFn: async (): Promise<Message[]> => {
      const { data } = await supabase
        .from('painel_thread_messages')
        .select('id, thread_id, user_id, actor_kind, direction, content, created_at')
        .eq('thread_id', selectedId!)
        .order('created_at', { ascending: true })
        .limit(500)
      return (data as Message[]) || []
    },
  })

  const selectedThread = useMemo(() => (threads || []).find(t => t.id === selectedId), [threads, selectedId])

  // Realtime
  useEffect(() => {
    if (!client.id) return
    const ch = supabase
      .channel(`inbox-${client.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'painel_thread_messages',
        filter: `client_id=eq.${client.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['painel-inbox-threads', client.id] })
        if (selectedId) qc.invalidateQueries({ queryKey: ['painel-inbox-msgs', selectedId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [client.id, selectedId, qc])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Zera unread quando seleciona thread
  useEffect(() => {
    if (!selectedThread || selectedThread.unread_for_svi === 0) return
    supabase.from('painel_threads').update({ unread_for_svi: 0 }).eq('id', selectedThread.id)
      .then(() => qc.invalidateQueries({ queryKey: ['painel-inbox-threads', client.id] }))
  }, [selectedThread, client.id, qc])

  // Sincroniza URL param
  function selectThread(id: string) {
    setSelectedId(id)
    setSearchParams({ thread: id }, { replace: true })
  }

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads || []
    const q = search.toLowerCase()
    return (threads || []).filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.external_phone || '').includes(q) ||
      (t.last_message_preview || '').toLowerCase().includes(q)
    )
  }, [threads, search])

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()
    const text = reply.trim()
    if (!text || sending || !selectedThread) return
    setSending(true)
    const tempContent = text
    setReply('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/painel/inbox/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ clientSlug: slug, threadId: selectedThread.id, content: text }),
    })
    setSending(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.message || 'Falha ao enviar')
      setReply(tempContent) // restaura
      return
    }
    qc.invalidateQueries({ queryKey: ['painel-inbox-msgs', selectedThread.id] })
    qc.invalidateQueries({ queryKey: ['painel-inbox-threads', client.id] })
  }

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-140px)] flex gap-3">
      {/* Lista de threads */}
      <Card className="w-80 shrink-0 flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <InboxIcon className="w-4 h-4" />Inbox WhatsApp
            </h2>
            <Badge variant="secondary">{(threads || []).length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa…"
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-3 space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
              {search ? 'Nada encontrado.' : 'Nenhuma conversa ainda.'}
              {!search && (
                <p className="text-xs mt-2">Conversas chegam quando alguém manda WhatsApp pra você.</p>
              )}
            </div>
          ) : (
            filteredThreads.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectThread(t.id)}
                className={cn(
                  'w-full text-left p-3 border-b hover:bg-accent transition-colors',
                  selectedId === t.id && 'bg-accent'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-sm truncate flex-1">{t.title}</div>
                  {t.unread_for_svi > 0 && (
                    <Badge className="text-[10px] px-1.5 py-0 h-4">{t.unread_for_svi}</Badge>
                  )}
                </div>
                {t.external_phone && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Phone className="w-2.5 h-2.5" />{t.external_phone}
                  </div>
                )}
                {t.last_message_preview && (
                  <div className="text-xs text-muted-foreground line-clamp-2">{t.last_message_preview}</div>
                )}
                {t.last_message_at && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true, locale: ptBR })}
                  </div>
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </Card>

      {/* Painel da conversa */}
      <Card className="flex-1 flex flex-col">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
              Selecione uma conversa
            </div>
          </div>
        ) : (
          <>
            {/* Header thread */}
            <div className="p-3 border-b flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{selectedThread?.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5" />{selectedThread?.external_phone}
                  </div>
                </div>
              </div>
              {selectedThread?.lead_id && (
                <Button variant="outline" size="sm" onClick={() => setOpenLeadId(selectedThread.lead_id)}>
                  Ver lead<ExternalLink className="w-3 h-3 ml-1.5" />
                </Button>
              )}
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {loadingMsgs ? (
                  [0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-3/4" />)
                ) : (
                  messages?.map(m => {
                    const isInbound = m.direction === 'inbound' || m.actor_kind === 'lead'
                    return (
                      <div key={m.id} className={cn('flex flex-col gap-0.5', isInbound ? 'items-start' : 'items-end')}>
                        <div className={cn(
                          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap',
                          isInbound ? 'bg-muted' : 'bg-primary text-primary-foreground'
                        )}>
                          {m.content}
                        </div>
                        <div className="text-[10px] text-muted-foreground px-1">
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            {/* Reply */}
            <form onSubmit={sendReply} className="border-t p-3 flex items-center gap-2 bg-background">
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Resposta via WhatsApp…"
                className="flex-1"
                disabled={sending}
              />
              <Button type="submit" disabled={!reply.trim() || sending} size="icon">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </>
        )}
      </Card>

      <LeadDetailDialog
        leadId={openLeadId}
        open={!!openLeadId}
        onClose={() => setOpenLeadId(null)}
      />
    </div>
  )
}
