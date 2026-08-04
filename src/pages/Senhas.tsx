import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Copy, Check, Search, KeyRound, Loader2, ExternalLink, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Cred {
  id: string
  cliente: string
  servico: string
  login: string | null
  senha: string | null
  url: string | null
  obs: string | null
  atualizado_em: string
}

export default function Senhas() {
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [visivel, setVisivel] = useState<Record<string, boolean>>({})
  const [copiado, setCopiado] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['client-credentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_credentials')
        .select('*')
        .order('cliente')
      if (error) throw error
      return (data || []) as Cred[]
    },
  })

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return data || []
    return (data || []).filter(c =>
      c.cliente.toLowerCase().includes(t) ||
      (c.login || '').toLowerCase().includes(t) ||
      c.servico.toLowerCase().includes(t),
    )
  }, [data, q])

  const copiar = async (texto: string, id: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(id)
      setTimeout(() => setCopiado(null), 1500)
    } catch {
      toast({ title: 'Não consegui copiar', variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const semSenha = (data || []).filter(c => !c.senha).length

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" /> Senhas dos clientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acesso interno da equipe. Cliente nunca enxerga esta página. Também dá pra perguntar pra Sofia no WhatsApp.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, @ ou serviço…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {semSenha > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {semSenha} cliente(s) ainda sem senha cadastrada.
        </div>
      )}

      <div className="space-y-2">
        {filtrados.map(c => {
          const aberto = !!visivel[c.id]
          return (
            <Card key={c.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{c.cliente}</p>
                    <Badge variant="outline" className="capitalize text-[10px]">{c.servico}</Badge>
                  </div>
                  {c.login && (
                    <a
                      href={c.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-0.5"
                    >
                      {c.login} <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                  {c.obs && <p className="text-[11px] text-amber-600 mt-1">{c.obs}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <code
                    className={cn(
                      'px-3 py-2 rounded-md bg-muted/50 border border-border text-sm font-mono min-w-[150px] text-center select-all',
                      !c.senha && 'text-muted-foreground italic',
                    )}
                  >
                    {c.senha ? (aberto ? c.senha : '•'.repeat(Math.min(c.senha.length, 12))) : 'sem senha'}
                  </code>
                  {c.senha && (
                    <>
                      <button
                        onClick={() => setVisivel(v => ({ ...v, [c.id]: !v[c.id] }))}
                        className="p-2 rounded-md border border-border hover:bg-accent transition-colors"
                        title={aberto ? 'Ocultar' : 'Revelar'}
                      >
                        {aberto ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => copiar(c.senha as string, c.id)}
                        className="p-2 rounded-md border border-border hover:bg-accent transition-colors"
                        title="Copiar"
                      >
                        {copiado === c.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum resultado para "{q}".</p>
        )}
      </div>
    </div>
  )
}
