import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  MapPin, Loader2, Upload, Sparkles, Link as LinkIcon, Copy, Check,
  Eye, EyeOff, Image as ImageIcon, X, TrendingUp, TrendingDown, Minus, MessageCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

type ClientRow = { id: string; name: string; slug: string | null }
type Metric = { key: string; label: string; current: number | null; previous: number | null; delta_pct: number | null; unit?: string }
type Module = { titulo: string; valor: string; delta_pct: number | null; legenda: string; image_url: string }
type Ponto = { tipo: 'gargalo' | 'oportunidade'; titulo: string; texto: string }
type Acao = { titulo: string; texto: string }
type Whatsapp = { saudacao?: string; intro?: string; resumo?: string; avaliacoes?: string; pedido_avaliacao?: string }
type Analysis = {
  resumo_cliente?: string
  destaque?: string
  observacoes?: string
  modules?: Module[]
  diagnostico?: { pontos?: Ponto[]; acoes?: Acao[] }
  whatsapp?: Whatsapp
}
type Report = {
  id: string
  slug: string
  client_name: string
  period_label: string
  metrics: Metric[]
  analysis: Analysis
  review_messages: string
  status: 'draft' | 'published'
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function hojeData() {
  const d = new Date()
  return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`
}

/** Comprime o print no navegador (max 1100px, jpeg) e devolve base64 puro. Falha alto. */
async function fileToBase64(file: File): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    throw new Error('formato HEIC não funciona, mande PNG ou JPG (no iPhone use um print da tela)')
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('não consegui ler o arquivo'))
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    const t = setTimeout(() => reject(new Error('tempo esgotado lendo a imagem')), 15000)
    i.onload = () => { clearTimeout(t); resolve(i) }
    i.onerror = () => { clearTimeout(t); reject(new Error('não consegui decodificar a imagem (formato?)')) }
    i.src = dataUrl
  })
  const max = 1100
  const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((img.width || 1) * scale))
  canvas.height = Math.max(1, Math.round((img.height || 1) * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('navegador não suporta canvas')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const out = canvas.toDataURL('image/jpeg', 0.72)
  const data = out.split(',')[1]
  if (!data) throw new Error('falha ao comprimir a imagem')
  return { data, mediaType: 'image/jpeg' }
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">sem comparativo</span>
  const up = pct > 0, flat = pct === 0
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const cls = flat ? 'text-muted-foreground' : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
  return (
    <span className={`text-xs font-medium inline-flex items-center gap-1 ${cls}`}>
      <Icon className="w-3 h-3" /> {up ? '+' : ''}{pct}%
    </span>
  )
}

export default function GoogleReports() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [clientId, setClientId] = useState('')
  const [period, setPeriod] = useState(hojeData())
  const [files, setFiles] = useState<File[]>([])
  const [analysis, setAnalysis] = useState('')
  const [reviewMessages, setReviewMessages] = useState('')
  const [generating, setGenerating] = useState(false)
  const [current, setCurrent] = useState<Report | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ['clients-min'],
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase.from('clients').select('id, name, slug').order('name')
      if (error) throw error
      return data || []
    },
  })

  const { data: reports } = useQuery({
    queryKey: ['google-reports', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Report[]> => {
      const { data, error } = await supabase
        .from('google_reports')
        .select('id, slug, client_name, period_label, metrics, analysis, review_messages, status')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data || []) as Report[]
    },
  })

  const publicUrl = (slug: string) => `${window.location.origin}/r/${slug}`

  function onPick(list: FileList | null) {
    if (!list || list.length === 0) return
    const all = Array.from(list)
    const imgs = all.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif)$/i.test(f.name))
    const ignored = all.length - imgs.length
    if (ignored > 0) toast.error(`${ignored} arquivo(s) ignorado(s) (não é imagem)`)
    if (imgs.length) {
      setFiles((prev) => [...prev, ...imgs].slice(0, 12))
      toast.success(`${imgs.length} print(s) adicionado(s)`)
    }
  }

  async function generate() {
    if (!clientId) return toast.error('Selecione o cliente')
    if (files.length === 0) return toast.error('Suba pelo menos um print')
    setGenerating(true)
    try {
      // Cada print falha sozinho (com o nome), sem derrubar o lote nem pendurar
      const settled = await Promise.allSettled(files.map(fileToBase64))
      const images: { data: string; mediaType: string }[] = []
      const fails: string[] = []
      settled.forEach((r, i) => {
        if (r.status === 'fulfilled') images.push(r.value)
        else fails.push(`${files[i].name.slice(0, 20)}: ${r.reason?.message || 'erro'}`)
      })
      if (fails.length) toast.error(`Print com problema — ${fails.join(' · ')}`)
      if (images.length === 0) { toast.error('Nenhum print pôde ser lido. Tente PNG/JPG.'); setGenerating(false); return }

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/reports/google/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ clientId, periodLabel: period, analysis, reviewMessages, images }),
      })
      const txt = await res.text()
      let data: any = {}
      try { data = JSON.parse(txt) } catch { throw new Error(`Servidor respondeu ${res.status}: ${txt.slice(0, 120) || 'sem corpo'}`) }
      if (!res.ok) throw new Error(data.detail?.formErrors?.join(', ') || data.detail || data.error || `Falha (${res.status})`)
      setCurrent(data.report)
      setFiles([])
      qc.invalidateQueries({ queryKey: ['google-reports', clientId] })
      toast.success('Relatório gerado. Revise e publique.')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar relatório')
    } finally {
      setGenerating(false)
    }
  }

  async function saveReview(report: Report, text: string) {
    const { error } = await supabase.from('google_reports').update({ review_messages: text }).eq('id', report.id)
    if (error) return toast.error('Falha ao salvar mensagens')
    toast.success('Mensagens de avaliação salvas')
    qc.invalidateQueries({ queryKey: ['google-reports', clientId] })
  }

  async function togglePublish(report: Report) {
    const next = report.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('google_reports').update({ status: next }).eq('id', report.id)
    if (error) return toast.error('Falha ao atualizar status')
    setCurrent((c) => (c && c.id === report.id ? { ...c, status: next } : c))
    qc.invalidateQueries({ queryKey: ['google-reports', clientId] })
    toast.success(next === 'published' ? 'Relatório publicado. Link liberado.' : 'Relatório despublicado')
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(publicUrl(slug))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success('Link copiado')
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    toast.success('Mensagem copiada')
  }

  /** Sequência pronta de mensagens pro WhatsApp, na ordem de envio. */
  function whatsappMessages(r: Report): { label: string; text: string }[] {
    const w = r.analysis?.whatsapp || {}
    const link = publicUrl(r.slug)
    const msgs: { label: string; text: string }[] = []
    if (w.saudacao) msgs.push({ label: '1 · Saudação', text: w.saudacao })
    msgs.push({ label: '2 · Relatório + link', text: `${w.intro || 'Segue o relatório de otimização do seu Google Meu Negócio.'}\n\n${link}` })
    if (w.resumo) msgs.push({ label: '3 · Resumo', text: w.resumo })
    if (w.avaliacoes) msgs.push({ label: '4 · Importância das avaliações', text: w.avaliacoes })
    if (w.pedido_avaliacao) msgs.push({ label: '5 · Texto pro cliente pedir avaliação', text: `${w.pedido_avaliacao}\n[cole aqui o link de avaliação do Google]` })
    return msgs
  }

  const preview = current
  const reviewDraft = useMemo(() => preview?.review_messages ?? '', [preview])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Relatório Google</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Suba os prints do painel do Google Meu Negócio. A IA lê os números, monta o relatório e gera um link visual pro cliente. Sem PDF.
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo relatório</CardTitle>
          <CardDescription>Cliente, período e os prints. O único texto que você digita é o das mensagens de avaliação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <select
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setCurrent(null) }}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                disabled={loadingClients}
              >
                <option value="">{loadingClients ? 'Carregando...' : 'Selecione o cliente'}</option>
                {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Período</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2 de junho de 2026" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Análise da quinzena</Label>
            <Textarea
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              placeholder="Escreva a análise da quinzena: o que foi feito, o que melhorou, os destaques. A IA organiza isso no relatório e puxa os números dos prints. Ela não inventa nada além do que você escrever."
              className="min-h-[140px]"
              maxLength={6000}
            />
            <div className="text-[10px] text-muted-foreground text-right">{analysis.length}/6000</div>
          </div>

          {/* Upload */}
          <div className="space-y-1.5">
            <Label>Prints do painel (de onde a IA lê os números)</Label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files) }}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Arraste os prints aqui ou clique pra escolher (até 10)</p>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <ImageIcon className="w-3 h-3" /> {f.name.slice(0, 18)}
                    <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Mensagens de avaliação</Label>
            <Textarea
              value={reviewMessages}
              onChange={(e) => setReviewMessages(e.target.value)}
              placeholder="O que destacar sobre as avaliações do mês (novas avaliações, respostas, nota média...)."
              className="min-h-[90px]"
              maxLength={4000}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={generate} disabled={generating} size="lg">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {generating ? 'Lendo os prints...' : 'Gerar relatório'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview do relatório gerado */}
      {preview && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> {preview.client_name} · {preview.period_label}
                </CardTitle>
                <CardDescription className="mt-1">{preview.analysis?.destaque}</CardDescription>
              </div>
              <Badge variant={preview.status === 'published' ? 'default' : 'secondary'}>
                {preview.status === 'published' ? 'Publicado' : 'Rascunho'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {preview.metrics?.map((m) => (
                <div key={m.key} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-2xl font-bold tracking-tight">{m.current ?? '—'}{m.unit}</p>
                  <DeltaBadge pct={m.delta_pct} />
                </div>
              ))}
            </div>

            {preview.analysis?.resumo_cliente && (
              <p className="text-sm leading-relaxed">{preview.analysis.resumo_cliente}</p>
            )}

            {/* Prints por módulo (registro oficial) */}
            {preview.analysis?.modules && preview.analysis.modules.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Prints por módulo</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {preview.analysis.modules.map((m, i) => (
                    <div key={i} className="rounded-lg border overflow-hidden">
                      {m.image_url && <img src={m.image_url} alt={m.titulo} className="w-full h-24 object-cover" />}
                      <div className="p-2">
                        <p className="text-xs font-medium truncate">{m.titulo}</p>
                        <p className="text-sm font-bold">{m.valor}{m.delta_pct != null && <span className="text-xs font-normal text-muted-foreground"> ({m.delta_pct > 0 ? '+' : ''}{m.delta_pct}%)</span>}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnóstico */}
            {((preview.analysis?.diagnostico?.pontos?.length || 0) > 0 || (preview.analysis?.diagnostico?.acoes?.length || 0) > 0) && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Gargalos e oportunidades</p>
                  <ul className="space-y-1.5 text-sm">
                    {preview.analysis?.diagnostico?.pontos?.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${p.tipo === 'gargalo' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <span><strong>{p.titulo}.</strong> {p.texto}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Próximos passos</p>
                  <ol className="space-y-1.5 text-sm list-decimal list-inside">
                    {preview.analysis?.diagnostico?.acoes?.map((ac, i) => (
                      <li key={i}><strong>{ac.titulo}.</strong> {ac.texto}</li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {preview.analysis?.observacoes && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Obs. interna: {preview.analysis.observacoes}</p>
            )}

            {/* Mensagens de avaliação editáveis */}
            <div className="space-y-1.5 pt-1">
              <Label>Mensagens de avaliação (editável)</Label>
              <Textarea
                defaultValue={reviewDraft}
                key={preview.id}
                onBlur={(e) => { if (e.target.value !== preview.review_messages) saveReview(preview, e.target.value) }}
                className="min-h-[80px]"
                maxLength={4000}
              />
            </div>

            {/* Ações */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button onClick={() => togglePublish(preview)} variant={preview.status === 'published' ? 'secondary' : 'default'}>
                {preview.status === 'published' ? <><EyeOff className="w-4 h-4 mr-2" />Despublicar</> : <><Eye className="w-4 h-4 mr-2" />Publicar</>}
              </Button>
              <Button variant="outline" onClick={() => copyLink(preview.slug)} disabled={preview.status !== 'published'}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}Copiar link
              </Button>
              {preview.status === 'published' && (
                <a href={publicUrl(preview.slug)} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                  <LinkIcon className="w-3.5 h-3.5" /> abrir
                </a>
              )}
            </div>

            {/* Mensagens prontas pro WhatsApp */}
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Mensagens pro WhatsApp</p>
                <span className="text-xs text-muted-foreground">copia e cola na ordem</span>
              </div>
              {whatsappMessages(preview).map((m, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{m.label}</p>
                      <p className="text-sm whitespace-pre-line break-words">{m.text}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyText(m.text)} title="Copiar">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico do cliente */}
      {clientId && reports && reports.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Relatórios deste cliente</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <button className="text-sm font-medium hover:text-primary text-left" onClick={() => setCurrent(r)}>
                  {r.period_label || 'Sem período'}
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">
                    {r.status === 'published' ? 'Publicado' : 'Rascunho'}
                  </Badge>
                  {r.status === 'published' && (
                    <button onClick={() => copyLink(r.slug)} className="text-muted-foreground hover:text-primary" title="Copiar link">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loadingClients && <Skeleton className="h-40 w-full" />}
    </div>
  )
}
