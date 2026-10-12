import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Transformer } from 'markmap-lib/no-plugins'
import {
  ArrowLeft, Minus, Plus, Expand, ZoomIn, ZoomOut, Maximize, Sun, Moon, Download, ExternalLink, Save, Loader2, Trash2, StickyNote,
  Maximize2, Minimize2, AppWindow,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { errorMessage } from '@/lib/data-access'
import {
  adicionarFilho, adicionarIrmao, apagarNo, arvoreParaMarkdown, contarNos, editarNo, formatarHoraBrasilia,
  linkObsidian, markdownParaArvore, rotuloPasta, tituloDoMarkdown, type MapaMental, type NoMapa,
} from '@/lib/mapas'
import MapaCanvas, { type MapaCanvasHandle } from '@/components/mapas/MapaCanvas'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import DataLoadError from '@/components/DataLoadError'

const transformer = new Transformer()
const NIVEL_TUDO = 99
const CHAVE_FUNDO = 'svi-mapa-fundo'

type Fundo = 'preto' | 'branco'
type Visao = 'mapa' | 'texto'

interface Edicao {
  modo: 'editar' | 'filho' | 'irmao'
  caminho: number[]
  texto: string
  /** Texto do nó de origem, para o título do diálogo e para saber se mudou. */
  alvo: string
}

function lerFundoGuardado(): Fundo | null {
  try {
    const s = localStorage.getItem(CHAVE_FUNDO)
    return s === 'preto' || s === 'branco' ? s : null
  } catch {
    return null
  }
}

function guardarFundo(f: Fundo) {
  try { localStorage.setItem(CHAVE_FUNDO, f) } catch { /* sem localStorage, segue sem guardar */ }
}

export default function MapaEditor({ telaInteira = false }: { telaInteira?: boolean } = {}) {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { theme } = useTheme()
  const qc = useQueryClient()

  const { data: mapa, isLoading, error, refetch } = useQuery({
    queryKey: ['mapa', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('mapas_mentais').select('*').eq('id', id!).single()
      if (error) throw new Error(error.message)
      return data as MapaMental
    },
  })

  const [markdown, setMarkdown] = useState<string | null>(null)
  const markdownRef = useRef('')
  const ultimoSalvo = useRef('')
  const carregadoEm = useRef<string | null>(null)
  const hidratado = useRef(false)
  const salvandoRef = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const [salvoAs, setSalvoAs] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [pendente, setPendente] = useState(false)
  const [conflito, setConflito] = useState(false)
  const [visao, setVisao] = useState<Visao>('mapa')
  const [abaMobile, setAbaMobile] = useState<'texto' | 'mapa'>('texto')
  const [nivel, setNivel] = useState(2)
  const [fonte, setFonte] = useState(16)
  const [fundo, setFundo] = useState<Fundo>(() => lerFundoGuardado() ?? (theme === 'dark' ? 'preto' : 'branco'))
  const [destacados, setDestacados] = useState<Set<string>>(() => new Set())
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [confirmaApagarNo, setConfirmaApagarNo] = useState(false)
  const canvas = useRef<MapaCanvasHandle>(null)
  const raizEl = useRef<HTMLDivElement>(null)
  const [emTelaCheia, setEmTelaCheia] = useState(false)

  // Tela cheia do navegador (F11 sem F11). No iPhone a API não existe pra
  // elemento comum, então cai na rota /tela, que já ocupa a janela inteira.
  useEffect(() => {
    const atualiza = () => setEmTelaCheia(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', atualiza)
    return () => document.removeEventListener('fullscreenchange', atualiza)
  }, [])
  const urlTela = `/mapas/${id}/tela`
  const alternarTelaCheia = async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return }
      const el = raizEl.current
      if (el && el.requestFullscreen) { await el.requestFullscreen(); return }
    } catch { /* navegador recusou, cai no plano B abaixo */ }
    if (!telaInteira) window.open(urlTela, '_blank', 'noopener')
  }
  const abrirNovaAba = () => window.open(urlTela, '_blank', 'noopener')

  useEffect(() => {
    if (!mapa || hidratado.current) return
    hidratado.current = true
    markdownRef.current = mapa.markdown
    ultimoSalvo.current = mapa.markdown
    carregadoEm.current = mapa.updated_at
    setMarkdown(mapa.markdown)
    setSalvoAs(formatarHoraBrasilia(mapa.updated_at))
  }, [mapa])

  const raiz = useMemo<NoMapa | null>(() => {
    if (markdown === null) return null
    return transformer.transform(markdown).root as NoMapa
  }, [markdown])
  const totalNos = useMemo(() => (markdown === null ? 0 : contarNos(markdownParaArvore(markdown))), [markdown])

  const salvar = useCallback(async (opcoes?: { sobrescrever?: boolean }) => {
    if (!id || !user) return
    if (salvandoRef.current) { agendar(800); return }
    const md = markdownRef.current
    window.clearTimeout(timer.current)
    salvandoRef.current = true
    setSalvando(true)
    // Conflito ou erro param a fila: senão a tela tentaria de novo a cada 1,5 s.
    let reagendar = true
    try {
      if (!opcoes?.sobrescrever) {
        const { data: atual, error } = await supabase.from('mapas_mentais').select('updated_at').eq('id', id).single()
        if (error) throw new Error(error.message)
        if (carregadoEm.current && atual?.updated_at !== carregadoEm.current) { setConflito(true); reagendar = false; return }
      }
      const titulo = tituloDoMarkdown(md) ?? mapa?.titulo ?? 'Sem título'
      const { data, error } = await supabase
        .from('mapas_mentais')
        .update({ markdown: md, titulo, atualizado_por: user.id })
        .eq('id', id)
        .select('updated_at')
        .single()
      if (error) throw new Error(error.message)
      carregadoEm.current = data.updated_at
      ultimoSalvo.current = md
      setSalvoAs(formatarHoraBrasilia(data.updated_at))
      setPendente(markdownRef.current !== md)
      setDestacados(new Set())
      qc.invalidateQueries({ queryKey: ['mapas'] })
      qc.setQueryData(['mapa', id], (antigo: MapaMental | undefined) => antigo ? { ...antigo, markdown: md, titulo, updated_at: data.updated_at } : antigo)
    } catch (e) {
      reagendar = false
      toast.error(`Não salvou: ${errorMessage(e)}`)
    } finally {
      salvandoRef.current = false
      setSalvando(false)
      if (reagendar && markdownRef.current !== ultimoSalvo.current) agendar(1500)
    }
  }, [id, user, mapa?.titulo, qc])

  const salvarRef = useRef(salvar)
  salvarRef.current = salvar

  function agendar(ms: number) {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { salvarRef.current() }, ms)
  }

  // Saiu da tela com mudança pendente: tenta salvar mesmo assim.
  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (markdownRef.current && markdownRef.current !== ultimoSalvo.current) salvarRef.current()
  }, [])

  function mudarTexto(valor: string) {
    markdownRef.current = valor
    setMarkdown(valor)
    setPendente(valor !== ultimoSalvo.current)
    agendar(1500)
  }

  function aplicarArvore(nova: NoMapa, textoMexido?: string) {
    const md = arvoreParaMarkdown(nova)
    markdownRef.current = md
    setMarkdown(md)
    setPendente(md !== ultimoSalvo.current)
    if (textoMexido) setDestacados(prev => new Set(prev).add(textoMexido))
    agendar(0)
  }

  function mudarNivel(novo: number) {
    const n = Math.max(1, Math.min(NIVEL_TUDO, novo))
    setNivel(n)
    canvas.current?.aplicarNivel(n)
  }

  function trocarFundo() {
    const novo: Fundo = fundo === 'preto' ? 'branco' : 'preto'
    setFundo(novo)
    guardarFundo(novo)
  }

  function adicionarNota() {
    if (!raiz) return
    const indice = raiz.children.length
    aplicarArvore(adicionarFilho(raiz, [], 'Nova nota'), 'Nova nota')
    setEdicao({ modo: 'editar', caminho: [indice], texto: 'Nova nota', alvo: 'Nova nota' })
  }

  function exportarMd() {
    if (!mapa) return
    const blob = new Blob([markdownRef.current], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapa.slug}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function recarregar() {
    setConflito(false)
    const { data } = await refetch()
    if (!data) return
    markdownRef.current = data.markdown
    ultimoSalvo.current = data.markdown
    carregadoEm.current = data.updated_at
    setMarkdown(data.markdown)
    setPendente(false)
    setDestacados(new Set())
    setSalvoAs(formatarHoraBrasilia(data.updated_at))
    toast.success('Mapa recarregado com a versão mais nova.')
  }

  function confirmarEdicao() {
    if (!raiz || !edicao) return
    const texto = edicao.texto.trim()
    if (!texto) { toast.error('Escreve alguma coisa no nó.'); return }
    if (edicao.modo === 'editar') {
      if (texto !== edicao.alvo) aplicarArvore(editarNo(raiz, edicao.caminho, texto), texto)
    } else if (edicao.modo === 'filho') {
      aplicarArvore(adicionarFilho(raiz, edicao.caminho, texto), texto)
    } else {
      aplicarArvore(adicionarIrmao(raiz, edicao.caminho, texto), texto)
    }
    setEdicao(null)
  }

  function salvarEMudarPara(modo: 'filho' | 'irmao') {
    if (!raiz || !edicao) return
    const texto = edicao.texto.trim()
    if (texto && texto !== edicao.alvo) aplicarArvore(editarNo(raiz, edicao.caminho, texto), texto)
    setEdicao({ modo, caminho: edicao.caminho, texto: '', alvo: texto || edicao.alvo })
  }

  function apagarNoAtual() {
    if (!raiz || !edicao || edicao.caminho.length === 0) return
    aplicarArvore(apagarNo(raiz, edicao.caminho))
    setConfirmaApagarNo(false)
    setEdicao(null)
  }

  if (isLoading || (mapa && markdown === null)) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }
  if (error) return <DataLoadError onRetry={() => refetch()} />
  if (!mapa || !raiz) {
    return (
      <div className="rounded-xl border border-border p-6 space-y-3">
        <p className="font-medium">Mapa não encontrado.</p>
        <Button asChild variant="outline"><Link to="/mapas">Voltar para Mapas</Link></Button>
      </div>
    )
  }

  const mostraTexto = visao === 'texto'
  const mostraMapaNoCelular = visao === 'mapa' || abaMobile === 'mapa'
  const tituloDialogo = !edicao ? '' : edicao.modo === 'editar' ? 'Editar nó' : edicao.modo === 'filho' ? `Novo filho de "${edicao.alvo}"` : `Novo irmão de "${edicao.alvo}"`
  const estadoSalvo = salvando ? 'Salvando...' : pendente ? 'Alterações não salvas' : salvoAs ? `Salvo às ${salvoAs}` : ''

  return (
    <div ref={raizEl} className={`flex flex-col gap-2 bg-background ${telaInteira || emTelaCheia ? 'h-[100svh] p-2 sm:p-3' : 'h-[calc(100svh-5.5rem)] sm:h-[calc(100svh-7rem)] min-h-[480px]'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-9 px-2">
          {telaInteira
            ? <Link to={`/mapas/${id}`} aria-label="Voltar para a Central"><ArrowLeft className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Central</span></Link>
            : <Link to="/mapas" aria-label="Voltar para a lista de mapas"><ArrowLeft className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Mapas</span></Link>}
        </Button>
        <h1 className="text-base sm:text-lg font-semibold truncate min-w-0 flex-1">{mapa.titulo}</h1>
        <Badge variant="outline" className="shrink-0">{rotuloPasta(mapa.pasta)}</Badge>
        <span className="text-xs text-muted-foreground shrink-0">{totalNos} {totalNos === 1 ? 'nó' : 'nós'}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Ferramentas do mapa">
        <div className="flex rounded-md border border-border overflow-hidden">
          <button type="button" onClick={() => setVisao('mapa')} aria-pressed={visao === 'mapa'}
            className={`h-9 px-3 text-xs sm:text-sm ${visao === 'mapa' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}>Mapa</button>
          <button type="button" onClick={() => setVisao('texto')} aria-pressed={visao === 'texto'}
            className={`h-9 px-3 text-xs sm:text-sm border-l border-border ${visao === 'texto' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}>Texto</button>
        </div>

        <div className="flex items-center rounded-md border border-border">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => mudarNivel(nivel >= NIVEL_TUDO ? 3 : nivel - 1)} aria-label="Menos níveis" title="Menos níveis"><Minus className="h-4 w-4" /></Button>
          <span className="px-1 text-xs text-muted-foreground tabular-nums min-w-[3.5rem] text-center">{nivel >= NIVEL_TUDO ? 'tudo' : `nível ${nivel}`}</span>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => mudarNivel(nivel + 1)} aria-label="Mais níveis" title="Mais níveis"><Plus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => mudarNivel(NIVEL_TUDO)} aria-label="Abrir tudo" title="Abrir tudo"><Expand className="h-4 w-4" /></Button>
        </div>

        <div className="flex items-center rounded-md border border-border">
          <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setFonte(f => Math.max(11, f - 1))} aria-label="Letra menor" title="Letra menor">A−</Button>
          <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setFonte(f => Math.min(28, f + 1))} aria-label="Letra maior" title="Letra maior">A+</Button>
        </div>

        <div className="flex items-center rounded-md border border-border">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => canvas.current?.zoom(0.8)} aria-label="Afastar" title="Afastar"><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => canvas.current?.zoom(1.25)} aria-label="Aproximar" title="Aproximar"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => canvas.current?.centralizar()} aria-label="Centralizar" title="Centralizar"><Maximize className="h-4 w-4" /></Button>
        </div>

        <div className="flex items-center rounded-md border border-border">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={alternarTelaCheia} aria-label={emTelaCheia ? 'Sair da tela cheia' : 'Tela cheia'} title={emTelaCheia ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}>
            {emTelaCheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          {!telaInteira && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={abrirNovaAba} aria-label="Abrir em nova aba, só o mapa" title="Abrir em nova aba, só o mapa"><AppWindow className="h-4 w-4" /></Button>
          )}
        </div>

        <Button variant="outline" size="icon" className="h-9 w-9" onClick={trocarFundo} aria-label={fundo === 'preto' ? 'Fundo branco' : 'Fundo preto'} title={fundo === 'preto' ? 'Fundo branco' : 'Fundo preto'}>
          {fundo === 'preto' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={adicionarNota}><StickyNote className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">+ nota</span></Button>
        <Button variant="outline" size="sm" className="h-9" onClick={exportarMd} aria-label="Exportar .md" title="Exportar .md"><Download className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Exportar .md</span></Button>
        <Button asChild variant="outline" size="sm" className="h-9">
          <a href={linkObsidian(mapa.slug)} aria-label="Abrir no Obsidian" title="Abrir no Obsidian"><ExternalLink className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Obsidian</span></a>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline" aria-live="polite">{estadoSalvo}</span>
          <Button size="sm" className="h-9" onClick={() => salvar()} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1" /> : <Save className="h-4 w-4 sm:mr-1" />}
            <span className="hidden sm:inline">Salvar</span>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground sm:hidden" aria-live="polite">{estadoSalvo}</p>

      {mostraTexto && (
        <div className="flex md:hidden rounded-md border border-border overflow-hidden">
          <button type="button" onClick={() => setAbaMobile('texto')} aria-pressed={abaMobile === 'texto'}
            className={`flex-1 h-11 text-sm ${abaMobile === 'texto' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground'}`}>Texto</button>
          <button type="button" onClick={() => setAbaMobile('mapa')} aria-pressed={abaMobile === 'mapa'}
            className={`flex-1 h-11 text-sm border-l border-border ${abaMobile === 'mapa' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground'}`}>Mapa</button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2">
        {mostraTexto && (
          <div className={`${abaMobile === 'texto' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-h-0 md:w-1/2`}>
            <Label htmlFor="mapa-markdown" className="sr-only">Markdown do mapa</Label>
            <Textarea
              id="mapa-markdown"
              value={markdown ?? ''}
              onChange={e => mudarTexto(e.target.value)}
              spellCheck={false}
              className="flex-1 min-h-[240px] resize-none font-mono text-xs sm:text-sm leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Primeira linha "# Título". Depois lista com "- " e 2 espaços por nível. "##" e "###" também viram níveis.</p>
          </div>
        )}
        <div className={`${mostraMapaNoCelular ? 'flex' : 'hidden'} md:flex flex-1 min-h-0 ${mostraTexto ? 'md:w-1/2' : ''}`}>
          <MapaCanvas
            ref={canvas}
            raiz={raiz}
            nivelInicial={nivel}
            fonte={fonte}
            fundo={fundo}
            destacados={destacados}
            onDuploClique={(caminho, texto) => setEdicao({ modo: 'editar', caminho, texto, alvo: texto })}
            onMenuContexto={(caminho, texto) => setEdicao({ modo: 'filho', caminho, texto: '', alvo: texto })}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground hidden sm:block">Dois cliques no nó editam. Botão direito cria um filho. No celular: dois toques e toque longo.</p>

      <Dialog open={!!edicao} onOpenChange={aberto => { if (!aberto) setEdicao(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate">{tituloDialogo}</DialogTitle>
            <DialogDescription>{edicao?.modo === 'editar' ? 'O texto vira uma linha do markdown.' : 'O nó novo entra no fim e fica dourado até salvar.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="no-texto">Texto do nó</Label>
            <Textarea
              id="no-texto"
              autoFocus
              rows={4}
              value={edicao?.texto ?? ''}
              onChange={e => setEdicao(prev => prev ? { ...prev, texto: e.target.value } : prev)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirmarEdicao() } }}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
            {edicao?.modo === 'editar' && edicao.caminho.length > 0 ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive w-full sm:w-auto" onClick={() => setConfirmaApagarNo(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Apagar nó
              </Button>
            ) : <span />}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {edicao?.modo === 'editar' && <>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => salvarEMudarPara('filho')}>+ filho</Button>
                {edicao.caminho.length > 0 && <Button variant="outline" className="w-full sm:w-auto" onClick={() => salvarEMudarPara('irmao')}>+ irmão</Button>}
              </>}
              {edicao?.modo !== 'editar' && <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEdicao(null)}>Cancelar</Button>}
              <Button className="w-full sm:w-auto" onClick={confirmarEdicao}>{edicao?.modo === 'editar' ? 'Salvar' : 'Adicionar'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmaApagarNo} onOpenChange={setConfirmaApagarNo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este nó?</AlertDialogTitle>
            <AlertDialogDescription>Os filhos dele somem junto. Não dá pra desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={apagarNoAtual}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={conflito} onOpenChange={setConflito}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alguém salvou depois de você</AlertDialogTitle>
            <AlertDialogDescription>
              Outra pessoa salvou este mapa enquanto você editava. Recarregar perde o que você mudou aqui. Sobrescrever apaga o que a outra pessoa salvou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={recarregar}>Recarregar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConflito(false); salvar({ sobrescrever: true }) }}>Sobrescrever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
