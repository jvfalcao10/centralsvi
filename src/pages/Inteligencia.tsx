import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Brain, Plus, ExternalLink, ArrowLeft, Copy, Check, Loader2,
  Instagram, Music2, Youtube, Link2, Archive, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const WEBHOOK = 'https://n8n.svicompany.com.br/webhook/cofre-intel'

type Estado = 'recebido' | 'analisado' | 'modelado' | 'entregue' | 'arquivado' | 'erro'

interface IntelItem {
  id: string
  criado_em: string
  origem: string
  tipo: string
  plataforma: string | null
  fonte_url: string | null
  autor: string | null
  titulo: string | null
  legenda: string | null
  transcricao: string | null
  resumo: string | null
  motor: string | null
  angulo: string | null
  mecanismo: string | null
  formato_sugerido: string | null
  sugestao_clientes: string[] | null
  estado: Estado
  cliente: string | null
  formato: string | null
  entregavel: string | null
  responsavel: string | null
  clickup_url: string | null
  enviado_por: string | null
  erro: string | null
}

const ESTADO_LABEL: Record<Estado, string> = {
  recebido: 'recebido',
  analisado: 'analisado',
  modelado: 'modelado',
  entregue: 'entregue',
  arquivado: 'arquivado',
  erro: 'erro',
}

const ESTADO_STYLE: Record<Estado, string> = {
  recebido: 'bg-muted text-muted-foreground border-border',
  analisado: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  modelado: 'bg-primary/15 text-primary border-primary/30',
  entregue: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  arquivado: 'bg-muted text-muted-foreground border-border',
  erro: 'bg-red-500/15 text-red-400 border-red-500/30',
}

function PlataformaIcon({ p }: { p: string | null }) {
  const cls = 'h-4 w-4 text-muted-foreground'
  if (p === 'instagram') return <Instagram className={cls} />
  if (p === 'tiktok') return <Music2 className={cls} />
  if (p === 'youtube') return <Youtube className={cls} />
  return <Link2 className={cls} />
}

function quando(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Belem',
  })
}

/** Bloco de leitura com rótulo. Só aparece quando tem conteúdo. */
function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="mb-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{titulo}</p>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  )
}

export default function Inteligencia() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [itens, setItens] = useState<IntelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFilter, setEstadoFilter] = useState('ativos')
  const [clienteFilter, setClienteFilter] = useState('all')
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [form, setForm] = useState({ url: '', texto: '' })
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('intel_items')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(300)
    if (error) {
      toast({ title: 'Não consegui carregar o cofre', description: error.message, variant: 'destructive' })
    } else {
      setItens((data || []) as IntelItem[])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { carregar() }, [carregar])

  const item = useMemo(() => itens.find(i => i.id === id) || null, [itens, id])

  const clientes = useMemo(() => {
    const s = new Set<string>()
    itens.forEach(i => { if (i.cliente) s.add(i.cliente) })
    return Array.from(s).sort()
  }, [itens])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens.filter(i => {
      if (estadoFilter === 'ativos' && i.estado === 'arquivado') return false
      if (estadoFilter !== 'ativos' && estadoFilter !== 'all' && i.estado !== estadoFilter) return false
      if (clienteFilter !== 'all' && i.cliente !== clienteFilter) return false
      if (!q) return true
      return [i.titulo, i.resumo, i.angulo, i.autor, i.cliente, i.transcricao]
        .some(v => (v || '').toLowerCase().includes(q))
    })
  }, [itens, estadoFilter, clienteFilter, busca])

  const contagem = useMemo(() => {
    const c = { analisado: 0, modelado: 0, entregue: 0 }
    itens.forEach(i => { if (i.estado in c) c[i.estado as keyof typeof c]++ })
    return c
  }, [itens])

  async function mandarPraSofia() {
    const url = form.url.trim()
    const texto = form.texto.trim()
    if (!url && !texto) {
      toast({ title: 'Cola um link ou um texto', variant: 'destructive' })
      return
    }
    setEnviando(true)
    try {
      const r = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'analisar', url, texto, origem: 'central', enviado_por: 'Central' }),
      })
      const data = await r.json()
      if (data && data.ok) {
        toast({ title: 'Referência lida', description: data.titulo || 'já está no cofre' })
        setShowForm(false)
        setForm({ url: '', texto: '' })
        await carregar()
        if (data.id) navigate(`/inteligencia/${data.id}`)
      } else {
        toast({
          title: 'Não deu pra ler essa referência',
          description: (data && data.erro) || 'tenta outro link ou manda o vídeo pra Sofia no WhatsApp',
          variant: 'destructive',
        })
        await carregar()
      }
    } catch (e) {
      toast({
        title: 'Falhou ao falar com a Sofia',
        description: e instanceof Error ? e.message : 'erro de rede',
        variant: 'destructive',
      })
    }
    setEnviando(false)
  }

  async function arquivar(alvo: IntelItem) {
    const { error } = await supabase.from('intel_items').update({ estado: 'arquivado' }).eq('id', alvo.id)
    if (error) {
      toast({ title: 'Não consegui arquivar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Arquivado' })
    carregar()
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
    toast({ title: 'Copiado' })
  }

  // ------------------------------------------------------------- detalhe
  if (id) {
    if (loading) {
      return <div className="p-6 text-sm text-muted-foreground">carregando...</div>
    }
    if (!item) {
      return (
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/inteligencia')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> voltar pro cofre
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">Essa referência não existe mais.</p>
        </div>
      )
    }
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/inteligencia')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> cofre
        </Button>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className={ESTADO_STYLE[item.estado]}>{ESTADO_LABEL[item.estado]}</Badge>
          {item.cliente && <Badge variant="outline">{item.cliente}</Badge>}
          {item.formato && <Badge variant="outline">{item.formato}</Badge>}
          {item.responsavel && <Badge variant="outline">{item.responsavel}</Badge>}
          <span className="text-xs text-muted-foreground">{quando(item.criado_em)}</span>
        </div>

        <h1 className="text-2xl font-bold mb-3">{item.titulo || 'referência sem título'}</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {item.fonte_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={item.fonte_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> ver a origem
              </a>
            </Button>
          )}
          {item.clickup_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={item.clickup_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> task no ClickUp
              </a>
            </Button>
          )}
          {item.entregavel && (
            <Button variant="outline" size="sm" onClick={() => copiar(item.entregavel || '')}>
              {copiado ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />} copiar a peça
            </Button>
          )}
          {item.estado !== 'arquivado' && (
            <Button variant="ghost" size="sm" onClick={() => arquivar(item)}>
              <Archive className="h-4 w-4 mr-1" /> arquivar
            </Button>
          )}
        </div>

        {item.erro && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {item.erro}
          </div>
        )}

        <Bloco titulo="resumo">{item.resumo}</Bloco>
        <Bloco titulo="o que faz funcionar">{item.motor}</Bloco>
        <Bloco titulo="ângulo">{item.angulo}</Bloco>
        <Bloco titulo="mecanismo">{item.mecanismo}</Bloco>
        <Bloco titulo="formato sugerido">{item.formato_sugerido}</Bloco>
        <Bloco titulo="serve para">
          {item.sugestao_clientes && item.sugestao_clientes.length
            ? item.sugestao_clientes.join(' · ')
            : null}
        </Bloco>

        {item.entregavel && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              a peça modelada {item.cliente ? `para ${item.cliente}` : ''}
            </p>
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed font-sans">
              {item.entregavel}
            </pre>
          </div>
        )}

        {item.transcricao && (
          <details className="mb-4 rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              transcrição do original
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{item.transcricao}</p>
          </details>
        )}

        {item.legenda && (
          <details className="mb-4 rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">legenda do original</summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{item.legenda}</p>
          </details>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------- lista
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> Inteligência
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            O que você viu por aí, lido pela Sofia e virado em peça pronta pro cliente certo.
            Manda o link aqui ou no WhatsApp dela.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova referência
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 my-5 text-sm">
        <span className="text-muted-foreground">
          <strong className="text-blue-400">{contagem.analisado}</strong> esperando você dizer pra quem
        </span>
        <span className="text-muted-foreground">
          <strong className="text-primary">{contagem.modelado}</strong> modelada sem subir
        </span>
        <span className="text-muted-foreground">
          <strong className="text-emerald-400">{contagem.entregue}</strong> no ClickUp
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Tudo em aberto</SelectItem>
            <SelectItem value="analisado">Analisado</SelectItem>
            <SelectItem value="modelado">Modelado</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
            <SelectItem value="erro">Com erro</SelectItem>
            <SelectItem value="arquivado">Arquivado</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clientes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input
          placeholder="buscar por tema, ângulo, perfil..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-[260px]"
        />

        <Button variant="ghost" size="icon" onClick={carregar} title="atualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">carregando...</p>}

      {!loading && lista.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Cofre vazio por aqui. Manda um link de reel pra Sofia no WhatsApp que ele aparece nesta lista.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {lista.map(i => (
          <button
            key={i.id}
            onClick={() => navigate(`/inteligencia/${i.id}`)}
            className="w-full text-left rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <PlataformaIcon p={i.plataforma} />
              <Badge variant="outline" className={ESTADO_STYLE[i.estado]}>{ESTADO_LABEL[i.estado]}</Badge>
              {i.cliente && <Badge variant="outline">{i.cliente}</Badge>}
              {i.formato && <Badge variant="outline">{i.formato}</Badge>}
              <span className="text-xs text-muted-foreground ml-auto">{quando(i.criado_em)}</span>
            </div>
            <p className="font-medium">{i.titulo || i.fonte_url || 'referência sem título'}</p>
            {i.angulo && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{i.angulo}</p>
            )}
            {i.autor && <p className="text-xs text-muted-foreground mt-2">de {i.autor}</p>}
          </button>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova referência</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Link do Instagram, TikTok ou YouTube</Label>
              <Input
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="https://www.instagram.com/reel/..."
              />
            </div>
            <div>
              <Label>Ou cola o texto, a copy, o post</Label>
              <Textarea
                rows={6}
                value={form.texto}
                onChange={e => setForm({ ...form, texto: e.target.value })}
                placeholder="cola aqui o conteúdo que você quer guardar"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A Sofia baixa, transcreve, lê tudo e devolve o ângulo mais a sugestão de cliente. Leva
              cerca de 40 segundos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)}>cancelar</Button>
            <Button onClick={mandarPraSofia} disabled={enviando}>
              {enviando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {enviando ? 'a Sofia está lendo...' : 'mandar pra Sofia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
