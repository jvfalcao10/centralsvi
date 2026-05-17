import { useRef, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePainelContext } from '@/components/PainelLayout'
import { cn } from '@/lib/utils'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function PainelChat() {
  const { client, slug } = usePainelContext()
  const [search] = useSearchParams()
  const scope = (search.get('scope') as 'growth_agent' | 'sdr_agent') || 'growth_agent'

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput(''); setLoading(true)
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/painel/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ scope, clientSlug: slug, messages: next }),
      })
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.reply || '—' }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Tive um problema agora. Tenta de novo em alguns segundos.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">
          {scope === 'sdr_agent' ? 'IA SDR' : 'Agente de crescimento'}
        </p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">
          {scope === 'sdr_agent' ? 'IA SDR' : 'Agente IA'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {scope === 'sdr_agent'
            ? 'Atendimento e qualificação automática de leads. Conectada ao seu CRM.'
            : 'Pergunte qualquer coisa sobre sua operação. A IA responde com base nos seus dados.'}
        </p>
      </div>

      <Card className="flex-1 flex flex-col min-h-[600px]">
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 m-auto">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">
                {scope === 'sdr_agent' ? `Sou a IA SDR de ${client.name}` : `Como posso ajudar com ${client.name}?`}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {scope === 'sdr_agent'
                  ? 'Posso responder leads, qualificar interesse e marcar reuniões automaticamente.'
                  : 'Posso analisar suas campanhas, sugerir copy, identificar fadiga ou explicar qualquer métrica.'}
              </p>
            </div>
          )}
          {messages.map((m, idx) => (
            <div key={idx} className={cn(m.role === 'user' ? 'flex justify-end' : 'flex justify-start items-start gap-3')}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={cn(
                m.role === 'user'
                  ? 'max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm'
                  : 'max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap'
              )}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />Pensando…
            </div>
          )}
          <div ref={endRef} />
        </CardContent>
        <form onSubmit={send} className="border-t p-3 flex items-center gap-2 bg-background">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={scope === 'sdr_agent' ? 'Pergunte sobre um lead ou peça uma ação…' : 'Pergunte qualquer coisa sobre sua operação…'}
            className="flex-1 border-0 focus-visible:ring-0"
            disabled={loading}
          />
          <Button type="submit" disabled={!input.trim() || loading} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  )
}
