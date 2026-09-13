import { useEffect, useMemo, useState, useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvided, type DraggableStateSnapshot,
} from '@hello-pangea/dnd'
import {
  LayoutGrid, Users, RefreshCw, Pencil, ExternalLink, Copy, Image as ImageIcon, Check, Star, EyeOff,
  Search, Settings2, Plus, Trash2, ArrowUp, ArrowDown, Paperclip, MessageSquare, Save, GripVertical, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/data-access'
import { localDateISO } from '@/lib/management-metrics'
import DataLoadError from '@/components/DataLoadError'
import {
  ORGANIZER_PERIODS, ORGANIZER_FILTERS, ORGANIZER_ORDERS, ORGANIZER_PRIORITIES,
  parseOrganizerPeriod, parseOrganizerFilter, parseOrganizerOrder, parseOrganizerPriority,
  organizerPeriodStart, filterOrganizerPieces, organizerAssignees, organizerStage, organizerPosted,
} from '@/lib/organizer-planning'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/components/ui/context-menu'

/**
 * Organizador de postagens — flyers e vídeos do histórico disponível na Central.
 * Fonte: postagens_organizador (n8n sincroniza do ClickUp a cada 15 min e lê a resposta do
 * cliente no grupo do WhatsApp). Arrastar ou usar o botão direito grava em postagens_acoes e o
 * n8n aplica no ClickUp em até 2 min. As etapas (nome, ordem, etapas novas) ficam em
 * postagens_config e valem para todo mundo. Etapa nova tem uma "base" entre as sete do ClickUp:
 * é o status que a peça recebe lá quando entra nela. Postado é um registro da Central:
 * preserva a etapa e o status no ClickUp e não publica arquivos em redes sociais.
 *
 * Arrasto: o card inteiro é a alça (botão esquerdo, 5px de tolerância antes de virar arrasto).
 * O card arrastado é renderizado num portal no <body> (renderClone), imune a overflow/transform
 * de ancestrais. Clique só abre o painel quando não veio de um arrasto (event.defaultPrevented).
 * Quadro: altura fixa (cabe na tela) e único container de rolagem nos dois eixos; cabeçalho de
 * coluna fixo (sticky); pressionar no fundo + arrastar rola o quadro (pan); setas rolam uma coluna;
 * roda do mouse rola pro lado e Shift + roda sobe e desce (listener nativo, não passivo).
 */

type Anexo = { t: string; u: string; th: string; ext: string }
type Peca = {
  id: string; nome: string; cli: string; dono: string; tipo: 'post' | 'video'; url: string
  thumb: string | null; etapa: string; status: string; resp: string | null; resp_por: string | null
  resp_quando: number | null; due: number | null; updated: number; lista_id: string
  postado_em: string | null; prioridade: boolean; oculto: boolean
  descricao: string | null; assignees: string[] | null; anexos_lista: Anexo[] | null
  etapa_manual: string | null; etapa_manual_status: string | null; nota: string | null
}
type Etapa = { id: string; nome: string; base: string }

const BASES = ['fazer', 'producao', 'ajuste', 'pronto', 'cliente', 'aprovado', 'feito'] as const
const BASE_NOME: Record<string, string> = {
  fazer: 'A fazer', producao: 'Em produção', ajuste: 'Ajuste', pronto: 'Pronto pra enviar',
  cliente: 'Com o cliente', aprovado: 'Aprovado', feito: 'Concluído',
}
const ETAPAS_PADRAO: Etapa[] = BASES.map(b => ({ id: b, nome: BASE_NOME[b], base: b }))
const ETAPA_POSTADO: Etapa = { id: 'postado', nome: 'Postado', base: 'feito' }
// status (já normalizado: trim + minúsculo, como o sync grava) que cada lista recebe ao entrar numa base
const STATUS_MAP: Record<string, Record<string, string>> = {
  '901521539717': { fazer: 'para ser feita', producao: 'irei enviar ainda', ajuste: 'alteração', pronto: 'para aprovação', cliente: 'enviado-cliente', aprovado: 'aprovado-cliente', feito: 'complete' },
  '901524992979': { fazer: 'para ser feita', producao: 'irei enviar ainda', ajuste: 'alteração', pronto: 'para aprovação', cliente: 'enviado-cliente', aprovado: 'aprovado-cliente', feito: 'complete' },
  '901523996247': { fazer: 'para ser feita', producao: 'para ser feita', ajuste: 'para ser feita', pronto: 'para aprovação', cliente: 'para aprovação', aprovado: 'complete', feito: 'complete' },
  '901525777266': { fazer: 'editar', producao: 'em andamento', ajuste: 'em andamento', pronto: 'enviar cliente', cliente: 'enviado', aprovado: 'aprovado', feito: 'postado' },
  '901523658547': { fazer: 'executar', producao: 'em edição', ajuste: 'em edição', pronto: 'aprovação', cliente: 'aprovação', aprovado: 'completed', feito: 'completed' },
}
const LISTA_NOME: Record<string, string> = {
  '901521539717': 'José · Designer', '901524992979': 'Laís · Design', '901523996247': 'Sarah',
  '901525777266': 'Ismael · Editor', '901523658547': 'Math · Editor de vídeo',
}

const limpaNome = (n: string) =>
  n.replace(/^(HOJE|QUA|QUI|SEX|SEG|TER|SÁB|SAB|DOM)[^·]*·\s*/i, '').replace(/^\[[^\]]+\]\s*/, '')
const dias = (ms: number) => Math.max(0, Math.round((Date.now() - ms) / 86400000))
const fmtData = (ms: number | null | undefined, hora = false) => typeof ms === 'number' && ms > 0 && Number.isFinite(new Date(ms).getTime())
  ? new Date(ms).toLocaleString('pt-BR', hora ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit' })
  : ''
const fmtIso = (s: string | null) => s && Number.isFinite(new Date(s).getTime()) ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Data não informada'
const esconderImg = (e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = 'none' }

function normalizaConfig(v: unknown): Etapa[] {
  if (Array.isArray(v) && v.length) {
    const arr = (v as Etapa[]).filter(e => e.id !== 'postado')
    const ids = new Set(arr.map(e => e.id))
    const faltam = ETAPAS_PADRAO.filter(e => !ids.has(e.id))
    return [...arr.map(e => ({ id: e.id, nome: e.id === 'feito' && e.nome === 'Postado / Concluído' ? BASE_NOME.feito : e.nome || BASE_NOME[e.id] || e.id, base: e.base || (BASES.includes(e.id as never) ? e.id : 'fazer') })), ...faltam, ETAPA_POSTADO]
  }
  if (v && typeof v === 'object') {
    const d = v as Record<string, string>
    return [...ETAPAS_PADRAO.map(e => ({ ...e, nome: e.id === 'feito' && d[e.id] === 'Postado / Concluído' ? BASE_NOME.feito : d[e.id] || e.nome })), ETAPA_POSTADO]
  }
  return [...ETAPAS_PADRAO, ETAPA_POSTADO]
}

// ---------- componentes estáveis (fora do render: não remontam a cada estado da página) ----------

type Acoes = {
  bloqueadas: boolean
  etapas: Etapa[]
  etapaAtual: (p: Peca) => string
  nomeEtapa: (id: string) => string
  abrir: (p: Peca) => void
  mover: (p: Peca, destino: string) => void
  marcarPostado: (p: Peca) => void
  patch: (id: string, campos: Partial<Peca>) => void
  copiar: (txt: string, rotulo: string) => void
}

function BadgeResp({ p }: { p: Peca }) {
  if (p.resp === 'aprovado') return <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">aprovado no grupo{p.resp_por ? ` · ${p.resp_por.split(' ')[0]}` : ''}</Badge>
  if (p.resp === 'ajuste') return <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">pediu ajuste{p.resp_por ? ` · ${p.resp_por.split(' ')[0]}` : ''}</Badge>
  if (p.resp === 'sem resposta') return <Badge variant="outline" className="text-muted-foreground">sem resposta no grupo</Badge>
  return null
}

// sem imagem não mostra nada no lugar (nada de quadrado cinza); a imagem nunca é arrastável por conta própria
function Thumb({ p, cls }: { p: Peca; cls: string }) {
  if (!p.thumb) return null
  return <img src={p.thumb} alt="" loading="lazy" draggable={false} referrerPolicy="no-referrer"
    className={cls + ' object-cover bg-muted pointer-events-none select-none'} onError={esconderImg} />
}

function MenuAcoes({ p, a }: { p: Peca; a: Acoes }) {
  return (
    <ContextMenuContent className="w-60">
      <ContextMenuItem onClick={() => a.abrir(p)}><Search className="h-4 w-4 mr-2" />Abrir informações</ContextMenuItem>
      <ContextMenuItem onClick={() => window.open(p.url, '_blank')}><ExternalLink className="h-4 w-4 mr-2" />Abrir no ClickUp</ContextMenuItem>
      {p.thumb && <ContextMenuItem onClick={() => window.open(p.thumb!, '_blank')}><ImageIcon className="h-4 w-4 mr-2" />Ver a arte</ContextMenuItem>}
      <ContextMenuItem onClick={() => a.copiar(window.location.origin + '/content/organizador?' + new URLSearchParams({ peca: p.id }), 'Link da demanda')}><Copy className="h-4 w-4 mr-2" />Copiar link da demanda</ContextMenuItem>
      <ContextMenuItem onClick={() => a.copiar(p.url, 'Link')}><Copy className="h-4 w-4 mr-2" />Copiar link do ClickUp</ContextMenuItem>
      <ContextMenuItem onClick={() => a.copiar(limpaNome(p.nome), 'Nome')}><Copy className="h-4 w-4 mr-2" />Copiar nome da peça</ContextMenuItem>
      {p.descricao && <ContextMenuItem onClick={() => a.copiar(p.descricao!, 'Descrição')}><Copy className="h-4 w-4 mr-2" />Copiar descrição</ContextMenuItem>}
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={a.bloqueadas}><LayoutGrid className="h-4 w-4 mr-2" />Mover para</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          {a.etapas.map(e => <ContextMenuItem key={e.id} disabled={a.bloqueadas || e.id === a.etapaAtual(p)} onClick={() => a.mover(p, e.id)}>{e.nome}</ContextMenuItem>)}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem disabled={a.bloqueadas} onClick={() => a.marcarPostado(p)}><Check className="h-4 w-4 mr-2" />{p.postado_em ? 'Desmarcar postado' : 'Marcar como postado'}</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={a.bloqueadas} onClick={() => a.patch(p.id, { prioridade: !p.prioridade })}><Star className="h-4 w-4 mr-2" />{p.prioridade ? 'Tirar prioridade' : 'Priorizar'}</ContextMenuItem>
      <ContextMenuItem disabled={a.bloqueadas} onClick={() => a.patch(p.id, { oculto: !p.oculto })}><EyeOff className="h-4 w-4 mr-2" />{p.oculto ? 'Mostrar de novo' : 'Ocultar do quadro'}</ContextMenuItem>
    </ContextMenuContent>
  )
}

/** Visual do card. Usado no quadro e também no clone que acompanha o mouse durante o arrasto. */
function CardVisual({ p, a, arrastando }: { p: Peca; a: Acoes; arrastando?: boolean }) {
  const et = a.etapaAtual(p)
  const base = a.etapas.find(e => e.id === et)?.base
  const atrasada = (base === 'fazer' || base === 'cliente') && dias(p.updated) >= 5
  return (
    <div className={`rounded-lg border bg-card p-2.5 space-y-2 select-none transition-shadow ${arrastando ? 'shadow-2xl ring-2 ring-primary/60 rotate-1' : 'hover:border-primary/50'} ${p.prioridade ? 'border-primary/60' : 'border-border'} ${p.oculto ? 'opacity-50' : ''}`}>
      <div className="flex gap-2.5">
        <Thumb p={p} cls="w-14 h-[84px] rounded-md flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-primary truncate">{p.cli}</div>
          <div className="text-xs leading-snug line-clamp-3">{limpaNome(p.nome)}</div>
        </div>
        <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" aria-hidden />
      </div>
      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground items-center">
        <span className="px-1.5 py-0.5 rounded bg-muted">{p.tipo === 'video' ? '🎬' : '🖼️'} {p.dono}</span>
        <span className={`px-1.5 py-0.5 rounded ${atrasada ? 'bg-red-500/15 text-red-300' : 'bg-muted'}`}>há {dias(p.updated)} d</span>
        {fmtData(p.due) && <span className="px-1.5 py-0.5 rounded bg-muted">prazo {fmtData(p.due)}</span>}
        {p.postado_em && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">postado</span>}
        {p.nota && <MessageSquare className="h-3 w-3 text-primary" />}
        {p.prioridade && <Star className="h-3 w-3 text-primary" />}
        <BadgeResp p={p} />
      </div>
    </div>
  )
}

/** Card no quadro: Draggable (alça = card inteiro) + menu do botão direito + clique abre o painel. */
function CardQuadro({ p, idx, a }: { p: Peca; idx: number; a: Acoes }) {
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return // veio de um arrasto: a lib marca o clique como prevenido
    a.abrir(p)
  }
  return (
    <Draggable draggableId={p.id} index={idx} isDragDisabled={a.bloqueadas}>
      {(prov: DraggableProvided) => (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} onClick={onClick}
              className="cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg">
              <CardVisual p={p} a={a} />
            </div>
          </ContextMenuTrigger>
          <MenuAcoes p={p} a={a} />
        </ContextMenu>
      )}
    </Draggable>
  )
}

export default function Organizador() {
  const { user, can } = useAuth()
  const isMobile = useIsMobile()
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [params, setParams] = useSearchParams()
  const periodo = parseOrganizerPeriod(params.get('periodo'))
  const filtro = parseOrganizerFilter(params.get('filtro'))
  const ordem = parseOrganizerOrder(params.get('ordem'))
  const prioridade = parseOrganizerPriority(params.get('prioridade'))
  const pessoa = params.get('pessoa') || ''
  const pecaId = params.get('peca') || ''
  const mudarFiltro = (chave: string, valor: string) => setParams(anterior => {
    const proximo = new URLSearchParams(anterior)
    if (valor) proximo.set(chave, valor); else proximo.delete(chave)
    return proximo
  })
  const { toast } = useToast()
  const [pecas, setPecas] = useState<Peca[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>(() => normalizaConfig(null))
  const [carregando, setCarregando] = useState(true)
  const vista = params.get('vista') === 'clientes' ? 'clientes' : 'etapas'
  const setVista = (v: string) => mudarFiltro('vista', v)
  const fCli = params.get('cliente') || ''
  const setFCli = (v: string) => mudarFiltro('cliente', v)
  const fTipo = ['post', 'video'].includes(params.get('tipo') || '') ? params.get('tipo')! : ''
  const setFTipo = (v: string) => mudarFiltro('tipo', v)
  const fTxt = params.get('busca') || ''
  const setFTxt = (v: string) => mudarFiltro('busca', v)
  const mostrarFeito = params.get('concluidos') === '1'
  const setMostrarFeito = (v: boolean) => mudarFiltro('concluidos', v ? '1' : '')
  const mostrarOcultos = params.get('ocultos') === '1'
  const setMostrarOcultos = (v: boolean) => mudarFiltro('ocultos', v ? '1' : '')
  const [editando, setEditando] = useState<string | null>(null)
  const [nomeTmp, setNomeTmp] = useState('')
  const [gerenciar, setGerenciar] = useState(false)
  const [novaEtapa, setNovaEtapa] = useState({ nome: '', base: 'producao' })
  const [aberta, setAberta] = useState<Peca | null>(null)
  const [notaTmp, setNotaTmp] = useState('')

  const [erro, setErro] = useState(false)
  const [recorteCarregado, setRecorteCarregado] = useState('')
  const [consultadoEm, setConsultadoEm] = useState<Date | null>(null)
  const consultaAtual = useRef(0)
  const [erroPeca, setErroPeca] = useState('')
  const [tentativaPeca, setTentativaPeca] = useState(0)
  const recorte = `${user?.id || ''}:${periodo}`
  const [salvando, setSalvando] = useState(false)
  const escritaAtual = useRef(false)
  const versaoEscrita = useRef(0)
  const recarregarDepois = useRef(false)
  const sessaoAtual = useRef(user?.id)
  const recorteAtual = useRef(recorte)
  const montado = useRef(true)
  const carregarAtual = useRef<() => Promise<void>>(async () => {})
  sessaoAtual.current = user?.id
  recorteAtual.current = recorte
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  const carregar = useCallback(async () => {
    if (escritaAtual.current) { recarregarDepois.current = true; return }
    const consulta = ++consultaAtual.current
    setCarregando(true)
    setErro(false)
    const desde = organizerPeriodStart(periodo, Date.now())
    try {
      const [rows, config] = await Promise.all([
        fetchAllRows<Peca>((from, to) => {
          if (consulta !== consultaAtual.current) throw new Error('Consulta substituída')
          let query = supabase.from('postagens_organizador').select('*')
          if (desde !== null) query = query.gte('updated', desde)
          return query.order('updated', { ascending: false }).order('id').range(from, to)
        }),
        supabase.from('postagens_config').select('valor').eq('chave', 'etapas').maybeSingle(),
      ])
      if (config.error) throw config.error
      if (consulta !== consultaAtual.current) return
      setPecas(rows)
      setEtapas(normalizaConfig(config.data?.valor))
      setRecorteCarregado(recorte)
      setConsultadoEm(new Date())
    } catch {
      if (consulta === consultaAtual.current) setErro(true)
    } finally {
      if (consulta === consultaAtual.current) setCarregando(false)
    }
  }, [periodo, recorte])
  carregarAtual.current = carregar

  useEffect(() => {
    void carregar()
    const t = setInterval(() => { void carregar() }, 5 * 60 * 1000)
    return () => {
      clearInterval(t)
      // Contador de requisições, não uma referência de elemento: invalida inclusive atualizações manuais.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      consultaAtual.current++
    }
  }, [carregar])
  useEffect(() => { if (aberta) setNotaTmp(aberta.nota || '') }, [aberta])

  // A peça exata é consultada independentemente do período e dos filtros do quadro.
  useEffect(() => {
    let cancelado = false
    setAberta(null)
    setErroPeca('')
    if (!pecaId) return
    const versao = versaoEscrita.current
    void (async () => {
      try {
        const { data, error } = await supabase.from('postagens_organizador').select('*').eq('id', pecaId).maybeSingle()
        if (cancelado) return
        if (versao !== versaoEscrita.current) { setTentativaPeca(n => n + 1); return }
        if (error) throw error
        if (!data) setErroPeca('Peça não encontrada ou sem acesso para este usuário.')
        else setAberta(data as Peca)
      } catch {
        if (!cancelado) setErroPeca('Não foi possível carregar esta demanda. Tente novamente.')
      }
    })()
    return () => { cancelado = true }
  }, [pecaId, user?.id, tentativaPeca])

  const abrirPeca = (p: Peca) => { mudarFiltro('peca', p.id) }
  const fecharPeca = () => { setAberta(null); mudarFiltro('peca', '') }
  const pronto = recorteCarregado === recorte && !erro

  const etapaMap = useMemo(() => Object.fromEntries(etapas.map(e => [e.id, e])), [etapas])
  const nomeEtapa = (id: string) => etapaMap[id]?.nome || BASE_NOME[id] || id
  const etapaAtual = (p: Peca) => organizerStage(p, etapas)

  const clientes = useMemo(() => [...new Set(pecas.map(p => p.cli))].sort(), [pecas])

  const pessoas = useMemo(() => [...new Set(pecas.flatMap(organizerAssignees))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [pecas])
  const hoje = localDateISO()
  const filtradas = useMemo(() => filterOrganizerPieces(pecas, etapas, {
    today: hoje, filter: filtro, person: pessoa, client: fCli, type: fTipo, text: fTxt,
    mostrarFeito, mostrarOcultos, order: ordem, priority: prioridade, showPosted: true,
  }), [pecas, etapas, hoje, filtro, pessoa, fCli, fTipo, fTxt, mostrarFeito, mostrarOcultos, ordem, prioridade])

  // ---------- escrita ----------
  const patch = async (id: string, campos: Partial<Peca>, aposSalvar?: (salva: Peca, sessaoValida: () => boolean) => Promise<void>, postadoEsperado?: string | null): Promise<Peca | null> => {
    if (!user?.id || !pronto || carregando || escritaAtual.current) return null
    const usuario = user.id
    const escopo = recorte
    const sessaoValida = () => montado.current && sessaoAtual.current === usuario
    escritaAtual.current = true
    setSalvando(true)
    try {
      let gravacao = supabase.from('postagens_organizador').update(campos).eq('id', id)
      if (postadoEsperado !== undefined) gravacao = postadoEsperado === null ? gravacao.is('postado_em', null) : gravacao.eq('postado_em', postadoEsperado)
      const { data, error } = await gravacao.select('*').maybeSingle()
      if (!sessaoValida()) return null
      if (error) throw error
      if (!data || data.id !== id) throw new Error('A gravação não foi confirmada. A demanda pode ter mudado ou estar sem acesso. Atualize e tente novamente.')
      const salva = data as Peca
      versaoEscrita.current++
      if (recorteAtual.current === escopo) setPecas(ps => ps.map(p => p.id === id ? salva : p))
      setAberta(a => a?.id === id ? salva : a)
      if (aposSalvar) await aposSalvar(salva, sessaoValida)
      return sessaoValida() ? salva : null
    } catch (error) {
      if (sessaoValida()) toast({ title: 'Não salvou', description: error instanceof Error ? error.message : 'Não foi possível confirmar a gravação. Tente novamente.', variant: 'destructive' })
      return null
    } finally {
      escritaAtual.current = false
      if (montado.current) {
        setSalvando(false)
        if (recarregarDepois.current) { recarregarDepois.current = false; void carregarAtual.current() }
      }
    }
  }
  const registrarAcao = async (p: Peca, base: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('postagens_acoes').insert({ task_id: p.id, acao: 'mover', payload: { etapa: base, lista_id: p.lista_id }, criado_por: user?.email || 'central' })
      return !error
    } catch { return false }
  }
  const registrarPostado = async (p: Peca, postado: boolean) => {
    if (organizerPosted(p) === postado) return
    const salva = await patch(p.id, { postado_em: postado ? new Date().toISOString() : null }, undefined, p.postado_em ?? null)
    if (salva) {
      const destino = etapaAtual(salva)
      const concluidaOculta = etapaMap[destino]?.base === 'feito' && !mostrarFeito
      toast({ title: postado ? 'Marcado como postado' : 'Postagem desmarcada', description: postado ? 'Registro salvo na Central.' : `A peça voltou para ${nomeEtapa(destino)}.${concluidaOculta ? ' Ative “mostrar concluídos” para vê-la no quadro.' : ''}` })
    }
  }
  const mover = async (p: Peca, destino: string) => {
    if (!pronto || carregando || escritaAtual.current) return
    const e = etapaMap[destino]; if (!e || etapaAtual(p) === destino) return
    if (destino === 'postado') { await registrarPostado(p, true); return }
    const base = e.base
    const mudaClickUp = base !== p.etapa
    const statusAlvo = mudaClickUp ? (STATUS_MAP[p.lista_id]?.[base] || p.status) : p.status
    const custom = !BASES.includes(destino as never)
    await patch(p.id, {
      etapa: base,
      etapa_manual: custom ? destino : null,
      etapa_manual_status: custom ? statusAlvo : null,
      postado_em: null,
      ...(mudaClickUp ? { status: statusAlvo } : {}),
    }, async (salva, sessaoValida) => {
      if (!sessaoValida()) return
      if (mudaClickUp) {
        const registrada = await registrarAcao(salva, base)
        if (!sessaoValida()) return
        if (!registrada) {
          toast({ title: 'Etapa salva na Central; envio pendente', description: 'Não foi possível registrar a alteração para o ClickUp. A sincronização externa não está confirmada.', variant: 'destructive' })
          return
        }
      }
      toast({ title: `Movido para ${e.nome}`, description: mudaClickUp ? 'Aguardando sincronização com o ClickUp.' : 'Etapa salva no quadro.' })
    }, p.postado_em ?? null)
  }
  const marcarPostado = (p: Peca) => registrarPostado(p, !organizerPosted(p))
  const copiar = async (txt: string, rotulo: string) => {
    try { await navigator.clipboard.writeText(txt); toast({ title: `${rotulo} copiado` }) } catch { toast({ title: 'Não deu pra copiar', variant: 'destructive' }) }
  }
  const salvarEtapas = async (lista: Etapa[]) => {
    if (!pronto || carregando || escritaAtual.current) return
    const configuraveis = lista.filter(e => e.id !== 'postado')
    setEtapas(normalizaConfig(configuraveis))
    const { error } = await supabase.from('postagens_config').update({ valor: configuraveis, atualizado_em: new Date().toISOString() }).eq('chave', 'etapas')
    if (error) toast({ title: 'Etapas não salvas', description: error.message, variant: 'destructive' })
    else toast({ title: 'Etapas salvas pra todo mundo' })
  }
  const salvarNomeInline = async (id: string) => {
    const v = nomeTmp.trim(); setEditando(null)
    if (id === 'postado' || !pronto || carregando || !v || v === nomeEtapa(id)) return
    await salvarEtapas(etapas.map(e => (e.id === id ? { ...e, nome: v } : e)))
  }
  const adicionarEtapa = async () => {
    const nome = novaEtapa.nome.trim(); if (!nome) return
    const id = 'c_' + Date.now().toString(36)
    const baseIdx = etapas.findIndex(e => e.id === novaEtapa.base)
    const lista = [...etapas]; lista.splice(baseIdx + 1, 0, { id, nome, base: novaEtapa.base })
    setNovaEtapa({ nome: '', base: 'producao' })
    await salvarEtapas(lista)
  }
  const removerEtapa = async (id: string) => {
    if (id === 'postado' || BASES.includes(id as never)) return
    if (!confirm(`Apagar a etapa "${nomeEtapa(id)}"? As peças dela voltam pra etapa base.`)) return
    await salvarEtapas(etapas.filter(e => e.id !== id))
  }
  const moverEtapa = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir; if (j < 0 || j >= etapas.length || etapas[idx]?.id === 'postado' || etapas[j]?.id === 'postado') return
    const lista = [...etapas]; const [e] = lista.splice(idx, 1); lista.splice(j, 0, e)
    await salvarEtapas(lista)
  }
  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return
    const p = pecas.find(x => x.id === r.draggableId); if (!p) return
    mover(p, r.destination.droppableId)
  }

  const acoes: Acoes = { bloqueadas: !pronto || carregando || salvando, etapas, etapaAtual, nomeEtapa, abrir: abrirPeca, mover, marcarPostado, patch, copiar }

  // ---------- rolagem do quadro: setas, e "pressiona no fundo e arrasta" (pan) com o botão esquerdo ----------
  const quadroRef = useRef<HTMLDivElement>(null)
  const pan = useRef<{ x: number; y: number; sl: number; st: number; ativo: boolean } | null>(null)
  const LARGURA_COLUNA = 302
  const rolar = (dir: -1 | 1) => quadroRef.current?.scrollBy({ left: dir * LARGURA_COLUNA, behavior: 'smooth' })
  // altura do quadro = o que sobra da tela abaixo dele (a barra de filtros quebra linha conforme a largura,
  // então calc() fixo não serve); recalcula em resize e quando o que está acima muda de tamanho
  useEffect(() => {
    const el = quadroRef.current; if (!el || vista !== 'etapas') return
    const ajusta = () => {
      let top = 0
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop
      const h = Math.max(420, window.innerHeight - top - 30)
      if (Math.abs(el.clientHeight - h) > 1) el.style.height = h + 'px'
    }
    ajusta()
    window.addEventListener('resize', ajusta)
    const ro = typeof ResizeObserver !== 'undefined' && el.parentElement ? new ResizeObserver(ajusta) : null
    if (ro && el.parentElement) ro.observe(el.parentElement)
    return () => { window.removeEventListener('resize', ajusta); ro?.disconnect() }
  }, [vista, carregando])
  // roda do mouse sobre o quadro rola PRO LADO; Shift + roda sobe e desce; trackpad na horizontal fica nativo.
  // Listener nativo porque o React registra wheel como passivo (preventDefault não funcionaria).
  useEffect(() => {
    const el = quadroRef.current; if (!el || vista !== 'etapas') return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1
      const dx = e.deltaX * k, dy = e.deltaY * k
      if (e.shiftKey) { e.preventDefault(); el.scrollTop += dy || dx; return }
      if (Math.abs(dy) > Math.abs(dx)) { e.preventDefault(); el.scrollLeft += dy }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [vista, carregando])
  const panInicio = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !quadroRef.current) return
    // em cima de card, botão, campo ou link não é pan (o card tem o arrasto dele)
    if ((e.target as HTMLElement).closest('[data-rfd-draggable-id], button, input, select, textarea, a')) return
    const el = quadroRef.current
    pan.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, ativo: false }
    el.setPointerCapture(e.pointerId)
  }
  const panMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pan.current; const el = quadroRef.current; if (!p || !el) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (!p.ativo && Math.abs(dx) + Math.abs(dy) < 4) return
    p.ativo = true
    el.scrollLeft = p.sl - dx; el.scrollTop = p.st - dy
    el.classList.add('cursor-grabbing')
  }
  const panFim = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = quadroRef.current; if (!pan.current || !el) return
    pan.current = null
    el.classList.remove('cursor-grabbing')
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  }

  const colunas = etapas.filter(e => e.id === 'postado' || mostrarFeito || e.base !== 'feito')
  const porEtapa = (id: string) => filtradas.filter(p => etapaAtual(p) === id)
  const porCliente = useMemo(() => {
    const m: Record<string, Peca[]> = {}
    filtradas.forEach(p => { (m[p.cli] = m[p.cli] || []).push(p) })
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
  }, [filtradas])
  const filtrosExtrasAtivos = [periodo !== '21', filtro !== 'all', !!pessoa, !!fCli, !!fTipo, mostrarFeito, mostrarOcultos].filter(Boolean).length

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><LayoutGrid className="h-6 w-6 shrink-0 text-primary" /> Organizador de postagens</h1>
          <p className="text-sm text-muted-foreground">
            {carregando ? 'Consultando histórico…' : erro ? 'Histórico indisponível' : `${filtradas.length} de ${pecas.length} peças no recorte`}{pronto && <span className="hidden md:inline"> · Arraste para mover ou clique para abrir a demanda.</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!pronto || carregando || salvando} onClick={() => setGerenciar(true)}><Settings2 className="h-4 w-4 mr-1" /> Etapas</Button>
          <Button variant="outline" size="sm" disabled={carregando || salvando} onClick={() => { void carregar() }}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant={vista === 'etapas' ? 'default' : 'outline'} onClick={() => setVista('etapas')}><LayoutGrid className="h-4 w-4 mr-1" />Etapas</Button>
          <Button size="sm" variant={vista === 'clientes' ? 'default' : 'outline'} onClick={() => setVista('clientes')}><Users className="h-4 w-4 mr-1" />Por cliente</Button>
          {vista === 'etapas' && (
            <div className="ml-auto flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" title="Rolar o quadro pra esquerda" aria-label="Rolar pra esquerda" onClick={() => rolar(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Rolar o quadro pra direita" aria-label="Rolar pra direita" onClick={() => rolar(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-end">
          <div className="relative col-span-2 md:w-48"><Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" /><Input aria-label="Buscar demandas" value={fTxt} onChange={e => setFTxt(e.target.value)} placeholder="buscar…" className="h-9 pl-8 w-full" /></div>
          <label className="min-w-0 text-xs text-muted-foreground space-y-1"><span className="block">Prioridade</span><select aria-label="Prioridade" value={prioridade} onChange={e => mudarFiltro('prioridade', e.target.value)} className="h-9 w-full md:w-auto max-w-full rounded-md border border-input bg-background px-2 md:px-3 text-xs md:text-sm text-foreground">
            {ORGANIZER_PRIORITIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></label>
          <label className="min-w-0 text-xs text-muted-foreground space-y-1"><span className="block">Ordenar por</span><select aria-label="Ordenação" value={ordem} onChange={e => mudarFiltro('ordem', e.target.value)} className="h-9 w-full md:w-auto max-w-full rounded-md border border-input bg-background px-2 md:px-3 text-xs md:text-sm text-foreground">
            {ORGANIZER_ORDERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></label>
        </div>
      </div>

      <details open={!isMobile || filtrosAbertos} onToggle={e => { if (isMobile) setFiltrosAbertos(e.currentTarget.open) }} className="rounded-lg border border-border px-3 py-2 md:rounded-none md:border-0 md:p-0">
        <summary className="cursor-pointer text-sm font-medium md:hidden">Filtros{filtrosExtrasAtivos > 0 ? ` · ${filtrosExtrasAtivos} ativos` : ' · histórico de 21 dias'}</summary>
        <div className="mt-3 space-y-3 md:mt-0">
          <div className="grid grid-cols-1 gap-3 md:flex md:flex-wrap md:items-end">
            <label className="min-w-0 text-xs text-muted-foreground space-y-1"><span className="block">Histórico por última atualização</span><select aria-label="Período do histórico" value={periodo} onChange={e => mudarFiltro('periodo', e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{ORGANIZER_PERIODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label className="min-w-0 text-xs text-muted-foreground space-y-1"><span className="block">Pendências</span><select aria-label="Pendências" value={filtro} onChange={e => mudarFiltro('filtro', e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{ORGANIZER_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label className="min-w-0 text-xs text-muted-foreground space-y-1"><span className="block">Responsável na demanda</span><select aria-label="Responsável na demanda" value={pessoa} onChange={e => mudarFiltro('pessoa', e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todos os responsáveis</option>{pessoa && !pessoas.includes(pessoa) && <option value={pessoa}>{pessoa} (fora do recorte)</option>}{pessoas.map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            <select aria-label="Cliente" value={fCli} onChange={e => setFCli(e.target.value)} className="h-9 w-full md:w-auto max-w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos os clientes</option>{fCli && !clientes.includes(fCli) && <option value={fCli}>{fCli} (fora do recorte)</option>}{clientes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label="Tipo de conteúdo" value={fTipo} onChange={e => setFTipo(e.target.value)} className="h-9 w-full md:w-auto max-w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Posts e vídeos</option><option value="post">Só posts</option><option value="video">Só vídeos</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><input type="checkbox" checked={mostrarFeito} onChange={e => setMostrarFeito(e.target.checked)} /> mostrar concluídos</label>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><input type="checkbox" checked={mostrarOcultos} onChange={e => setMostrarOcultos(e.target.checked)} /> mostrar ocultos</label>
            <Button size="sm" variant="ghost" onClick={() => setParams(anterior => {
              const limpos = new URLSearchParams()
              for (const chave of ['periodo', 'vista', 'peca']) { const valor = anterior.get(chave); if (valor) limpos.set(chave, valor) }
              return limpos
            })}>Limpar filtros</Button>
            {can('manager') && <Link to="/operacional/carga" className="text-sm text-primary py-2 md:ml-auto">Carga de demandas →</Link>}
          </div>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Sobre o histórico, os filtros e a rolagem{consultadoEm && pronto ? ` · consultado às ${consultadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</summary><p className="mt-2 max-w-3xl">O período usa a última atualização da peça; atraso e ordenação por prazo usam a data de entrega. Prioridade e prazo traz primeiro as peças priorizadas, com os prazos mais próximos. Ao ordenar por prazo, peças sem data ficam ao fim. Postado registra que a publicação já aconteceu, sem publicar automaticamente. Concluído é a etapa de produção; filtros de pendências excluem concluídas e postadas. Responsáveis vêm da demanda no ClickUp; o nome da fila não substitui a atribuição. A sincronização do ClickUp ocorre a cada 15 minutos. Use a roda do mouse para rolar para os lados e Shift + roda para cima e para baixo. Também pode pressionar e arrastar o fundo, usar as setas ou abrir as ações com o botão direito.</p></details>
        </div>
      </details>

      {erro ? <DataLoadError onRetry={() => { void carregar() }} /> : !pronto ? <p role="status" className="py-8 text-sm text-muted-foreground">Carregando histórico e etapas…</p> : vista === 'etapas' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* O quadro cabe na tela e é o ÚNICO container de rolagem (x e y): barra sempre à vista, a lib rola
              sozinha perto das bordas, e pressionar no fundo + arrastar rola o quadro (pan).
              items-stretch: toda coluna fica da altura da maior, então soltar em qualquer ponto da coluna conta. */}
          <div ref={quadroRef} onPointerDown={panInicio} onPointerMove={panMove} onPointerUp={panFim} onPointerCancel={panFim}
            className="flex gap-3 items-stretch overflow-auto overscroll-x-contain h-[calc(100vh-275px)] min-h-[420px] pb-2 cursor-grab select-none">
            {colunas.map(e => {
              const its = porEtapa(e.id)
              const custom = e.id !== 'postado' && !BASES.includes(e.id as never)
              return (
                <Droppable droppableId={e.id} key={e.id}
                  getContainerForClone={() => document.body}
                  renderClone={(prov: DraggableProvided, snap: DraggableStateSnapshot, rubric) => (
                    <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} className="w-[274px]">
                      <CardVisual p={its[rubric.source.index]} a={acoes} arrastando={snap.isDragging} />
                    </div>
                  )}>
                  {(prov, snap) => (
                    <div ref={prov.innerRef} {...prov.droppableProps}
                      className={`flex-shrink-0 w-[290px] min-h-full flex flex-col rounded-xl border transition-colors ${snap.isDraggingOver ? 'border-primary bg-primary/5' : 'border-border bg-card/60'}`}>
                      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 border-b border-border bg-card rounded-t-xl">
                        {e.id === 'postado' ? <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Postado</span> : editando === e.id ? (
                          <input autoFocus value={nomeTmp} onChange={ev => setNomeTmp(ev.target.value)} onBlur={() => salvarNomeInline(e.id)}
                            onKeyDown={ev => { if (ev.key === 'Enter') salvarNomeInline(e.id); if (ev.key === 'Escape') setEditando(null) }}
                            className="bg-transparent border-b border-primary text-xs font-semibold uppercase tracking-wider outline-none w-full" />
                        ) : (
                          <button className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1 group text-left" onClick={() => { setEditando(e.id); setNomeTmp(e.nome) }} title={custom ? `Etapa própria · base: ${BASE_NOME[e.base]}` : 'Renomear etapa (vale pra todo mundo)'}>
                            {e.nome} <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-70" />
                          </button>
                        )}
                        <span className="text-xs text-muted-foreground">{its.length}</span>
                      </div>
                      <div className="flex-1 p-2 space-y-2">
                        {its.map((p, i) => <CardQuadro key={p.id} p={p} idx={i} a={acoes} />)}
                        {prov.placeholder}
                        {!its.length && <div className="text-xs text-muted-foreground p-3">{snap.isDraggingOver ? 'solta aqui' : 'nada aqui'}</div>}
                      </div>
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      ) : (
        <div className="space-y-3">
          {porCliente.map(([cli, its]) => (
            <details key={cli} className="rounded-xl border border-border bg-card/60">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary flex justify-between">
                <span>{cli}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {its.length} peças · {etapas.filter(e => its.some(p => etapaAtual(p) === e.id)).map(e => `${its.filter(p => etapaAtual(p) === e.id).length} ${e.nome.toLowerCase()}`).join(' · ')}
                </span>
              </summary>
              <div className="border-t border-border divide-y divide-border">
                {its.map(p => (
                  <ContextMenu key={p.id}>
                    <ContextMenuTrigger asChild>
                      <div className={`grid ${p.thumb ? 'grid-cols-[44px_1fr_auto]' : 'grid-cols-[1fr_auto]'} gap-3 items-center px-4 py-2 text-xs cursor-pointer hover:bg-muted/40`} onClick={() => abrirPeca(p)}>
                        <Thumb p={p} cls="w-11 h-16 rounded-md" />
                        <div>
                          <div className="text-sm">{limpaNome(p.nome)}</div>
                          <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-2 items-center">
                            <span className="uppercase tracking-wider text-primary">{nomeEtapa(etapaAtual(p))}</span>
                            <span>{p.tipo === 'video' ? '🎬' : '🖼️'} {p.dono} · há {dias(p.updated)} d</span>
                            {fmtData(p.due) ? <span>prazo {fmtData(p.due)}</span> : <span>sem prazo</span>}
                            {p.prioridade && <span className="text-primary flex items-center gap-1"><Star className="h-3 w-3" />prioridade</span>}
                            {p.postado_em && <span className="text-emerald-400">registrado em {fmtIso(p.postado_em)}</span>}
                            <BadgeResp p={p} />
                          </div>
                        </div>
                        <a href={p.url} target="_blank" rel="noopener" className="text-primary hover:underline" onClick={ev => ev.stopPropagation()}>ClickUp</a>
                      </div>
                    </ContextMenuTrigger>
                    <MenuAcoes p={p} a={acoes} />
                  </ContextMenu>
                ))}
              </div>
            </details>
          ))}
          {!porCliente.length && <div className="text-sm text-muted-foreground p-4">nada com esse filtro</div>}
        </div>
      )}

      {/* ---------- painel da demanda ---------- */}
      <Sheet open={!!pecaId} onOpenChange={o => { if (!o) fecharPeca() }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {!aberta && <div className="space-y-4"><SheetHeader><SheetTitle>Demanda do Organizador</SheetTitle><SheetDescription className="sr-only">Informações da peça selecionada.</SheetDescription></SheetHeader>{erroPeca ? <><p role="alert" className="text-sm">{erroPeca}</p><Button variant="outline" onClick={() => setTentativaPeca(n => n + 1)}>Tentar novamente</Button></> : <p role="status">Carregando demanda…</p>}</div>}
          {aberta && (
            <div className="space-y-5">
              <SheetHeader>
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">{aberta.cli}</div>
                <SheetTitle className="text-base leading-snug">{limpaNome(aberta.nome)}</SheetTitle><SheetDescription className="sr-only">Prazo, responsáveis, descrição e ações desta peça.</SheetDescription>
              </SheetHeader>

              <div className="flex gap-4">
                {aberta.thumb && (
                  <a href={aberta.thumb} target="_blank" rel="noopener" className="flex-shrink-0">
                    <img src={aberta.thumb} referrerPolicy="no-referrer" alt="" draggable={false} className="w-40 rounded-lg border border-border object-cover"
                      onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }} />
                  </a>
                )}
                <div className="text-sm space-y-1.5 flex-1">
                  <div><span className="text-muted-foreground">Etapa:</span> <b>{nomeEtapa(etapaAtual(aberta))}</b></div>
                  <div><span className="text-muted-foreground">Status no ClickUp:</span> {aberta.status}</div>
                  <div><span className="text-muted-foreground">Lista:</span> {LISTA_NOME[aberta.lista_id] || aberta.lista_id}</div>
                  <div><span className="text-muted-foreground">Quem faz:</span> {organizerAssignees(aberta).join(', ') || 'Sem responsável na demanda'}</div>
                  <div><span className="text-muted-foreground">Tipo:</span> {aberta.tipo === 'video' ? 'vídeo' : 'post'}</div>
                  <div><span className="text-muted-foreground">Prazo:</span> {fmtData(aberta.due) || 'sem prazo'}</div>
                  <div><span className="text-muted-foreground">Última mexida:</span> {fmtData(aberta.updated, true)} · há {dias(aberta.updated)} d</div>
                  {aberta.postado_em && <div><span className="text-muted-foreground">Postagem registrada em:</span> {fmtIso(aberta.postado_em)}</div>}
                  <div className="pt-1 flex flex-wrap gap-1"><BadgeResp p={aberta} />{aberta.resp_quando ? <span className="text-xs text-muted-foreground">{fmtData(aberta.resp_quando, true)}</span> : null}</div>
                </div>
              </div>

              <Button size="sm" variant="outline" onClick={() => copiar(window.location.origin + '/content/organizador?' + new URLSearchParams({ peca: aberta.id }), 'Link da demanda')}><Copy className="h-4 w-4 mr-1" />Copiar link da demanda</Button>
              {!pronto && <p role="alert" className="text-sm text-warning">Carregue o histórico e as etapas para editar esta demanda.</p>}
              {salvando && <p role="status" className="text-xs text-muted-foreground">Salvando alteração…</p>}
              <fieldset disabled={!pronto || carregando || salvando} className="contents">
              <div className="flex flex-wrap gap-2">
                <select aria-label="Etapa da demanda" value={etapaAtual(aberta)} onChange={e => mover(aberta, e.target.value)} className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm">
                  {etapas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={() => window.open(aberta.url, '_blank')}><ExternalLink className="h-4 w-4 mr-1" />ClickUp</Button>
                <Button size="sm" variant="outline" onClick={() => marcarPostado(aberta)}><Check className="h-4 w-4 mr-1" />{aberta.postado_em ? 'Desmarcar postado' : 'Marcar como postado'}</Button>
                <Button size="sm" variant="outline" onClick={() => patch(aberta.id, { prioridade: !aberta.prioridade })}><Star className="h-4 w-4 mr-1" />{aberta.prioridade ? 'Tirar prioridade' : 'Priorizar'}</Button>
                <Button size="sm" variant="outline" onClick={() => patch(aberta.id, { oculto: !aberta.oculto })}><EyeOff className="h-4 w-4 mr-1" />{aberta.oculto ? 'Mostrar' : 'Ocultar'}</Button>
              </div>
              <p className="text-xs text-muted-foreground">Registra na Central que a peça já foi postada.</p>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Observação interna</div>
                <Textarea value={notaTmp} onChange={e => setNotaTmp(e.target.value)} placeholder="Anota aqui o que o time precisa saber sobre essa peça…" className="min-h-[70px] text-sm" />
                <div className="flex justify-end mt-1">
                  <Button size="sm" variant="secondary" disabled={notaTmp === (aberta.nota || '')} onClick={() => patch(aberta.id, { nota: notaTmp || null })}><Save className="h-4 w-4 mr-1" />Salvar observação</Button>
                </div>
              </div>

              </fieldset>
              {aberta.anexos_lista && aberta.anexos_lista.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Anexos ({aberta.anexos_lista.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {aberta.anexos_lista.map((a, i) => (
                      <a key={i} href={a.u} target="_blank" rel="noopener" className="block w-20" title={a.t}>
                        {a.th ? <img src={a.th} referrerPolicy="no-referrer" alt="" draggable={false} className="w-20 h-20 object-cover rounded-md border border-border" /> : <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center text-[10px] uppercase text-muted-foreground">{a.ext || 'arquivo'}</div>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Descrição no ClickUp</div>
                {aberta.descricao
                  ? <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/40 rounded-lg p-3 max-h-[420px] overflow-y-auto font-sans">{aberta.descricao}</pre>
                  : <div className="text-sm text-muted-foreground">sem descrição</div>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ---------- gerenciar etapas ---------- */}
      <Dialog open={gerenciar} onOpenChange={setGerenciar}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Etapas do funil</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">As sete etapas do ClickUp podem ser renomeadas e reordenadas. Etapa nova precisa de uma base: é o status que a peça recebe no ClickUp quando entra nela. Vale pra todo mundo. Postado é uma coluna fixa de registro de publicação.</p>
          <fieldset disabled={!pronto || carregando || salvando} className="contents">
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
            {etapas.filter(e => e.id !== 'postado').map((e, idx) => {
              const custom = !BASES.includes(e.id as never)
              return (
                <div key={e.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                  <Input defaultValue={e.nome} onBlur={ev => { const v = ev.target.value.trim(); if (v && v !== e.nome) salvarEtapas(etapas.map(x => (x.id === e.id ? { ...x, nome: v } : x))) }} className="h-8 text-sm" />
                  {custom
                    ? <select value={e.base} onChange={ev => salvarEtapas(etapas.map(x => (x.id === e.id ? { ...x, base: ev.target.value } : x)))} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                        {BASES.map(b => <option key={b} value={b}>base: {BASE_NOME[b]}</option>)}
                      </select>
                    : <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-28 text-center">ClickUp</span>}
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => moverEtapa(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === etapas.length - 2} onClick={() => moverEtapa(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" disabled={!custom} onClick={() => removerEtapa(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input value={novaEtapa.nome} onChange={e => setNovaEtapa({ ...novaEtapa, nome: e.target.value })} placeholder="nome da etapa nova" className="h-9 text-sm" onKeyDown={e => { if (e.key === 'Enter') adicionarEtapa() }} />
            <select value={novaEtapa.base} onChange={e => setNovaEtapa({ ...novaEtapa, base: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
              {BASES.map(b => <option key={b} value={b}>base: {BASE_NOME[b]}</option>)}
            </select>
            <Button size="sm" onClick={adicionarEtapa}><Plus className="h-4 w-4 mr-1" />Criar</Button>
          </div>
          </fieldset>
        </DialogContent>
      </Dialog>
    </div>
  )
}
