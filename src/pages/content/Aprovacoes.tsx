import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowRight, Check, CheckCircle2, ClipboardList, Clock, FileText, Loader2, MessageSquare, Pencil, RefreshCw, Save, Search, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import {
  APPROVAL_STATUSES, approvalActionLabel, approvalDate, approvalHasDestination, approvalTypeLabel,
  extractApprovalFacts, safeApprovalUrl, getApprovalDraft, rememberApprovalDraft, forgetApprovalDraft, retainApprovalDraftsForUser,
  type ApprovalStatus, type ContentApproval,
} from '@/lib/content-approval'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25
const STATUS_ICON = { pendente: Clock, aprovado: CheckCircle2, enviado: Send, reprovado: MessageSquare }
const STATUS_LABEL = { pendente: 'Aguardando revisão', aprovado: 'Aprovado pela equipe', enviado: 'Envio registrado', reprovado: 'Não aprovado' }
const STATUS_STYLE = {
  pendente: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  aprovado: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  enviado: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  reprovado: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

function ContentMarkdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none break-words dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:bg-muted prose-pre:text-foreground prose-table:text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={url => safeApprovalUrl(url) || ''}
        components={{
          h1: ({ children }) => <h1 className="mb-3 mt-6 text-xl font-semibold leading-snug first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-6 text-lg font-semibold leading-snug first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold leading-snug first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-4 text-sm font-semibold first:mt-0">{children}</h4>,
          h5: ({ children }) => <h5 className="mb-2 mt-4 text-sm font-semibold first:mt-0">{children}</h5>,
          h6: ({ children }) => <h6 className="mb-2 mt-4 text-sm font-semibold first:mt-0">{children}</h6>,
          p: ({ children }) => <p className="my-3 text-sm leading-7 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-2 pl-6 text-sm leading-relaxed">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-2 pl-6 text-sm leading-relaxed">{children}</ol>,
          li: ({ children }) => <li className="pl-1 marker:text-muted-foreground">{children}</li>,
          blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-primary/30 pl-4 text-muted-foreground">{children}</blockquote>,
          hr: () => <hr className="my-6 border-border" />,
          pre: ({ children }) => <pre className="my-4 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs leading-relaxed">{children}</pre>,
          code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          a: ({ href, children }) => {
            const safe = href && safeApprovalUrl(href)
            return safe ? <a href={safe} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{children}</a> : <span>{children}</span>
          },
          img: ({ src, alt }) => {
            const safe = src && safeApprovalUrl(src)
            return safe ? <a href={safe} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Ver imagem: {alt || 'imagem vinculada'}</a> : <span>{alt || 'Imagem sem endereço válido'}</span>
          },
          table: ({ children }) => <div className="my-4 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
          th: ({ children }) => <th className="border-b-2 border-border bg-muted/30 px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top leading-relaxed">{children}</td>,
        }}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

function DecisionContext({ row }: { row: ContentApproval }) {
  const monthly = row.tipo === 'plano_mensal'
  const briefing = row.tipo === 'briefing'
  return (
    <div className="rounded-lg border border-primary/15 bg-primary/[0.04] p-4">
      <div className="flex gap-3">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 space-y-1.5 text-sm">
          <p className="font-medium">
            {row.status === 'enviado' ? 'O que este registro confirma'
              : row.status === 'reprovado' ? 'Conteúdo que precisa de revisão'
                : briefing ? 'Revisão de um briefing interno'
                  : monthly ? 'Revisão antes do envio ao cliente' : 'Revisão interna deste conteúdo'}
          </p>
          <p className="leading-relaxed text-muted-foreground">
            {row.status === 'enviado' ? `Há um registro de envio${row.enviado_em ? ` em ${approvalDate(row.enviado_em)}` : ''}. A confirmação de entrega não está disponível nesta tela.`
              : row.status === 'reprovado' ? 'Esta fila reúne pedidos de ajuste e recusas anteriores. Confira o motivo registrado antes de retomar a revisão.'
                : briefing ? 'A aprovação registra a revisão interna deste briefing. O encaminhamento à produção fica com a equipe.'
                  : monthly ? 'A aprovação coloca este texto na fila de planos aprovados para envio. A programação de envio não está confirmada nesta tela.'
                    : 'A aprovação registra a decisão da equipe. O próximo encaminhamento deste tipo de conteúdo ainda não está definido nesta tela.'}
          </p>
          {briefing && <p className="text-xs font-medium">Destino: equipe interna</p>}
          {monthly && (approvalHasDestination(row) ? (
            <div className="pt-1 text-xs">
              <p>Destino cadastrado: grupo associado a {row.cliente}</p>
              <details className="mt-1 text-muted-foreground">
                <summary className="w-fit cursor-pointer underline underline-offset-2">Ver identificação do grupo</summary>
                <p className="mt-1 break-all">{row.chatid}</p>
              </details>
            </div>
          ) : <p className="pt-1 text-xs font-medium text-amber-700 dark:text-amber-300">Sem grupo de destino. Cadastre o grupo antes de aprovar para envio.</p>)}
        </div>
      </div>
    </div>
  )
}

const matchesSearch = (row: ContentApproval, search: string) =>
  `${row.cliente} ${row.titulo}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))

export default function Aprovacoes() {
  const { toast } = useToast()
  const { user } = useAuth()
  const userId = user?.id || null
  const navigate = useNavigate()
  const [tab, setTab] = useState<ApprovalStatus>('pendente')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<ContentApproval[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [baseline, setBaseline] = useState<ContentApproval | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [countRevision, setCountRevision] = useState(0)
  const [counts, setCounts] = useState<Partial<Record<ApprovalStatus, number | null>>>({})
  const [countError, setCountError] = useState(false)
  const [countLoading, setCountLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const listSequence = useRef(0)
  const mounted = useRef(true)
  const [adjusting, setAdjusting] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const pendingNavigation = useRef<{ run: () => void; discardText: boolean } | null>(null)
  const selectionOwner = useRef<string | null>(null)

  const selected = rows.find(row => row.id === selectedId) || null
  const draftDirty = !!selected && baseline?.status === 'pendente' && draft !== baseline.texto
  const reasonDirty = !!reason.trim()
  const dirty = draftDirty || reasonDirty
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const selectionRef = useRef(selectedId)
  selectionRef.current = selectedId
  const searchRef = useRef(search)
  searchRef.current = search
  const visibleRows = useMemo(() => rows.filter(row => matchesSearch(row, search)), [rows, search])
  const facts = useMemo(() => extractApprovalFacts(draft), [draft])

  const selectRow = useCallback((row: ContentApproval | null) => {
    selectionOwner.current = userId
    const recovered = row && userId ? getApprovalDraft(userId, row.id) : undefined
    setSelectedId(row?.id || null)
    setBaseline(recovered?.baseline || row)
    setDraft(recovered?.text ?? row?.texto ?? '')
    setEditing(!!recovered)
    setRecoveryMessage(recovered ? recovered.baseline.atualizado_em === row?.atualizado_em && recovered.baseline.status === row?.status
      ? 'Sua edição não salva foi recuperada nesta sessão.'
      : 'Sua edição foi recuperada, mas o registro mudou desde então. O texto foi preservado para você revisar; a versão anterior não poderá sobrescrever a nova.' : null)
    setOperationError(null)
    setAdjusting(!!recovered?.reason)
    setReason(recovered?.reason || '')
  }, [userId])

  useEffect(() => { retainApprovalDraftsForUser(userId) }, [userId])
  useEffect(() => {
    if (!userId || selectionOwner.current !== userId || !selected || !baseline) return
    if (dirty) rememberApprovalDraft(userId, { baseline, text: draft, reason })
    else forgetApprovalDraft(userId, selected.id)
  }, [userId, selected, baseline, dirty, draft, reason])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    const sequence = ++listSequence.current
    let cancelled = false
    setLoading(true)
    setLoadingMore(false)
    setListError(null)
    setRows([])
    setHasMore(false)
    setOffset(0)
    selectRow(null)
    async function read() {
      try {
        let query = supabase.from('content_aprovacoes').select('*').eq('status', tab)
        if (type) query = query.eq('tipo', type)
        const { data, error } = await query.order('criado_em', { ascending: false }).order('id', { ascending: false }).range(0, PAGE_SIZE - 1)
        if (cancelled || sequence !== listSequence.current) return
        if (error) throw new Error(error.message)
        if (!Array.isArray(data)) throw new Error('A consulta não retornou uma lista válida. Tente atualizar novamente.')
        const incoming = data as ContentApproval[]
        setRows(incoming)
        setHasMore(incoming.length === PAGE_SIZE)
        setOffset(incoming.length)
        selectRow(incoming.find(row => userId && getApprovalDraft(userId, row.id) && matchesSearch(row, searchRef.current)) || incoming.find(row => matchesSearch(row, searchRef.current)) || null)
      } catch (error) {
        if (!cancelled && sequence === listSequence.current) setListError(error instanceof Error ? error.message : 'A consulta não foi concluída.')
      } finally {
        if (!cancelled && sequence === listSequence.current) setLoading(false)
      }
    }
    void read()
    return () => { cancelled = true }
  }, [tab, type, revision, selectRow, userId])

  useEffect(() => {
    let cancelled = false
    setCountLoading(true)
    async function readCounts() {
      const result = await Promise.allSettled(APPROVAL_STATUSES.map(async status => {
        let query = supabase.from('content_aprovacoes').select('id', { count: 'exact', head: true }).eq('status', status.value)
        if (type) query = query.eq('tipo', type)
        const { count, error } = await query
        if (error || typeof count !== 'number') throw new Error(error?.message || 'Contagem indisponível')
        return { status: status.value, count }
      }))
      if (cancelled) return
      const next: Partial<Record<ApprovalStatus, number | null>> = {}
      result.forEach((entry, index) => { next[APPROVAL_STATUSES[index].value] = entry.status === 'fulfilled' ? entry.value.count : null })
      setCounts(next)
      setCountError(result.some(entry => entry.status === 'rejected'))
      setCountLoading(false)
    }
    void readCounts()
    return () => { cancelled = true }
  }, [type, revision, countRevision])

  const requestNavigation = useCallback((action: () => void) => {
    if (busyRef.current) return
    if (dirtyRef.current) {
      pendingNavigation.current = { run: action, discardText: true }
      setConfirmLeave(true)
    } else action()
  }, [])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !busyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const linkClick = (event: MouseEvent) => {
      if ((!dirtyRef.current && !busyRef.current) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') as HTMLAnchorElement | null : null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.origin === window.location.origin) return
      event.preventDefault()
      event.stopPropagation()
      requestNavigation(() => {
        if (url.origin === window.location.origin) navigate(url.pathname + url.search + url.hash)
        else window.location.assign(url.href)
      })
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', linkClick, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', linkClick, true) }
  }, [navigate, requestNavigation])

  const loadMore = async () => {
    if (loadingMore || loading || busyRef.current || !hasMore) return
    const sequence = listSequence.current
    setLoadingMore(true)
    setListError(null)
    try {
      let query = supabase.from('content_aprovacoes').select('*').eq('status', tab)
      if (type) query = query.eq('tipo', type)
      const { data, error } = await query.order('criado_em', { ascending: false }).order('id', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
      if (sequence !== listSequence.current || !mounted.current) return
      if (error) throw new Error(error.message)
      if (!Array.isArray(data)) throw new Error('A consulta não retornou uma lista válida. Tente novamente.')
      const incoming = data as ContentApproval[]
      setRows(current => [...current, ...incoming.filter(row => !current.some(existing => existing.id === row.id))])
      setOffset(current => current + incoming.length)
      setHasMore(incoming.length === PAGE_SIZE)
      if (!selectionRef.current && !dirtyRef.current) selectRow(incoming.find(row => matchesSearch(row, searchRef.current)) || null)
    } catch (error) {
      if (sequence === listSequence.current && mounted.current) setListError(error instanceof Error ? error.message : 'Não foi possível carregar mais itens.')
    } finally {
      if (mounted.current && sequence === listSequence.current) setLoadingMore(false)
    }
  }

  const mutate = async (action: 'save' | 'approve' | 'adjust' | 'reopen'): Promise<boolean> => {
    if (!selected || busyRef.current || loadingMore) return false
    if (action !== 'reopen' && !draft.trim()) { setOperationError('O texto não pode ficar vazio.'); return false }
    if (action === 'adjust' && !reason.trim()) { setOperationError('Informe o motivo dos ajustes.'); return false }
    if (action === 'approve' && selected.tipo === 'plano_mensal' && !approvalHasDestination(selected)) {
      setOperationError('Cadastre o grupo de destino antes de aprovar para envio.'); return false
    }
    const original = baseline || selected
    if (!original.atualizado_em?.trim()) {
      setOperationError('A versão deste conteúdo não está disponível. Atualize a lista antes de salvar.'); return false
    }
    busyRef.current = true
    setBusy(true)
    setOperationError(null)
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData?.user?.id) throw new Error('Não foi possível confirmar sua sessão. Entre novamente antes de salvar a decisão.')
      if (selectionOwner.current !== userId) throw new Error('Sua sessão mudou. Atualize a lista antes de salvar a decisão.')
      const patch: Partial<ContentApproval> = action === 'save' ? { texto: draft }
        : action === 'approve' ? { texto: draft, status: 'aprovado', aprovado_por: userData.user.id }
          : action === 'adjust' ? { texto: draft, status: 'reprovado', motivo: reason.trim(), aprovado_por: null }
            : { status: 'pendente', aprovado_por: null }
      // O trigger touch_aprovacoes renova a versão em toda escrita. Usar essa
      // versão evita incluir o conteúdo inteiro no URL do filtro de atualização.
      const { data, error } = await supabase.from('content_aprovacoes').update(patch)
        .eq('id', original.id).eq('status', original.status).eq('atualizado_em', original.atualizado_em)
        .select('*').maybeSingle()
      if (error) throw new Error(error.message)
      if (!data || data.id !== selected.id) throw new Error('Este conteúdo mudou ou não está mais disponível para você. Suas alterações continuam aqui. Atualize a lista antes de tentar novamente.')
      if (!mounted.current) return false
      const saved = data as ContentApproval
      if (userId) forgetApprovalDraft(userId, selected.id)
      if (action === 'save') {
        setRows(current => current.map(row => row.id === saved.id ? saved : row))
        setDraft(saved.texto)
        setBaseline(saved)
        setRecoveryMessage(null)
        setEditing(false)
        toast({ title: 'Rascunho salvo', description: 'O conteúdo continua pendente de revisão.' })
      } else {
        const nextRows = rows.filter(row => row.id !== saved.id)
        setRows(nextRows)
        setOffset(current => Math.max(0, current - 1))
        selectRow(nextRows.find(row => matchesSearch(row, search)) || null)
        setCountRevision(current => current + 1)
        toast(action === 'approve' ? {
          title: selected.tipo === 'briefing' ? 'Briefing aprovado internamente' : selected.tipo === 'plano_mensal' ? 'Plano aprovado para envio' : 'Conteúdo aprovado pela equipe',
          description: selected.tipo === 'plano_mensal' ? 'A decisão foi registrada. A programação de envio ainda precisa ser confirmada.' : 'A decisão foi registrada. O encaminhamento fica com a equipe.',
        } : action === 'adjust' ? { title: 'Ajustes solicitados', description: 'Texto e motivo salvos. A equipe precisa acompanhar a revisão.' }
          : { title: 'Conteúdo voltou para revisão', description: 'O motivo anterior permanece no registro.' })
      }
      return true
    } catch (error) {
      if (mounted.current) setOperationError(error instanceof Error ? error.message : 'Não foi possível salvar. Suas alterações foram preservadas.')
      return false
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const continueNavigation = () => {
    const action = pendingNavigation.current
    pendingNavigation.current = null
    setConfirmLeave(false)
    action?.run()
  }
  const closeAdjustments = () => {
    if (busyRef.current) return
    if (reason.trim()) {
      pendingNavigation.current = { run: () => setAdjusting(false), discardText: false }
      setConfirmLeave(true)
    } else setAdjusting(false)
  }
  const refresh = () => requestNavigation(() => { setRevision(current => current + 1) })

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Revisão da equipe</p>
          <h1 className="text-2xl font-semibold tracking-tight">Aprovações de conteúdo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Revise uma proposta de cada vez e registre sua decisão.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={busy || loadingMore}>
          <RefreshCw className={cn('mr-2 h-3.5 w-3.5', loading && 'animate-spin')} /> Atualizar
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={value => requestNavigation(() => { setSearch(''); setTab(value as ApprovalStatus) })} className="min-w-0 max-w-full">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
            {APPROVAL_STATUSES.map(status => {
              const Icon = STATUS_ICON[status.value]
              return <TabsTrigger key={status.value} value={status.value} disabled={busy} className="gap-1.5 whitespace-nowrap py-2 text-xs">
                <Icon className="h-3.5 w-3.5" /> {status.label}
                <span className="ml-0.5 min-w-3 text-[10px] opacity-65" aria-label={countLoading ? 'Contagem carregando' : counts[status.value] == null ? 'Contagem indisponível' : `${counts[status.value]} itens`}>
                  {countLoading ? '…' : counts[status.value] == null ? '—' : counts[status.value]}
                </span>
              </TabsTrigger>
            })}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label htmlFor="approval-type" className="text-muted-foreground">Tipo de conteúdo</label>
          <select id="approval-type" value={type} disabled={busy} onChange={event => {
            const value = event.target.value
            requestNavigation(() => { setSearch(''); setType(value) })
          }} className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="">Todos os tipos</option><option value="briefing">Briefings internos</option><option value="plano_mensal">Planos para cliente</option>
          </select>
        </div>
      </div>
      {countError && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">Algumas contagens estão indisponíveis. A lista abaixo pode ser revisada normalmente.</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside aria-label="Fila de revisão" className="min-w-0 overflow-hidden rounded-xl border bg-card lg:sticky lg:top-4">
          <div className="space-y-3 border-b p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{APPROVAL_STATUSES.find(status => status.value === tab)?.label}</h2>
              <span className="text-[11px] text-muted-foreground">{loading ? 'Carregando…' : `${rows.length} carregados`}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input aria-label="Buscar nos itens carregados" placeholder="Buscar cliente ou título" value={search} disabled={busy} className="h-9 pl-8 text-xs" onChange={event => {
                const value = event.target.value
                requestNavigation(() => {
                  setSearch(value)
                  if (!selected || !matchesSearch(selected, value)) selectRow(rows.find(row => matchesSearch(row, value)) || null)
                })
              }} />
            </div>
            <p className="text-[10px] text-muted-foreground">A busca considera os itens já carregados.</p>
          </div>
          {loading ? <div role="status" className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando conteúdo…</div>
            : <div className="max-h-72 overflow-y-auto lg:max-h-[calc(100vh-340px)]">
              {visibleRows.map(row => <button key={row.id} type="button" aria-pressed={selectedId === row.id} disabled={busy}
                onClick={() => { if (row.id !== selectedId) requestNavigation(() => selectRow(row)) }}
                className={cn('relative block w-full border-b px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:opacity-60', selectedId === row.id && 'bg-primary/[0.07] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary')}>
                <span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-primary">{row.cliente}</span><span className="shrink-0 text-[10px] text-muted-foreground">{approvalDate(row.criado_em)}</span></span>
                <span className="mt-1 block text-sm font-medium leading-snug line-clamp-2">{row.titulo || 'Conteúdo sem título'}</span>
                <span className="mt-2 block text-[10px] text-muted-foreground">{approvalTypeLabel(row.tipo)}{(selectedId === row.id && dirty || userId && getApprovalDraft(userId, row.id)) && <span className="ml-1.5 text-amber-700 dark:text-amber-300">· Edição não salva</span>}</span>
              </button>)}
              {!visibleRows.length && !listError && <p className="p-5 text-sm leading-relaxed text-muted-foreground">{search ? 'Nenhum resultado entre os itens carregados.' : 'Nenhum conteúdo nesta fila.'}</p>}
            </div>}
          {listError && <div role="alert" className="space-y-2 border-t p-4 text-xs text-destructive"><p>Não foi possível carregar {rows.length ? 'mais itens' : 'a lista'}: {listError}</p><Button size="sm" variant="outline" onClick={rows.length ? loadMore : refresh} disabled={busy || loadingMore}>Tentar novamente</Button></div>}
          {hasMore && !loading && <div className="border-t p-3"><Button className="w-full" variant="ghost" size="sm" onClick={loadMore} disabled={busy || loadingMore}>{loadingMore ? 'Carregando…' : 'Carregar mais itens'}</Button></div>}
        </aside>

        {selected && !loading ? (
          <article aria-label="Conteúdo selecionado" className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="space-y-5 p-5 sm:p-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><FileText className="h-3.5 w-3.5" />{approvalTypeLabel(selected.tipo)}</span>
                  <Badge variant="outline" className={STATUS_STYLE[selected.status]}>{STATUS_LABEL[selected.status]}</Badge>
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-primary">{selected.cliente}</p>
                  <h2 className="text-xl font-semibold leading-snug tracking-tight">{selected.titulo || 'Conteúdo sem título'}</h2>
                  <p className="mt-2 text-xs text-muted-foreground">Criado em {approvalDate(selected.criado_em)}{selected.mes ? ` · Referência: ${selected.mes}${selected.ano ? ` ${selected.ano}` : ''}` : ''}</p>
                </div>
              </div>
              <DecisionContext row={selected} />
              {recoveryMessage && <p role="status" className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">{recoveryMessage}</p>}
              {selected.motivo && <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4"><h3 className="text-sm font-medium">{selected.status === 'reprovado' ? 'Motivo registrado' : 'Motivo da revisão anterior'}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{selected.motivo}</p></div>}
              <section aria-label="Resumo do conteúdo" className="space-y-3">
                <div><h3 className="text-sm font-semibold">O que o texto informa</h3><p className="mt-1 text-xs text-muted-foreground">Campos identificados no conteúdo, sem completar informações ausentes.</p></div>
                <dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
                  {facts.map(fact => <div key={fact.key} className="min-w-0 bg-card p-3.5 sm:last:col-span-2"><dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{fact.label}</dt><dd className={cn('mt-1.5 whitespace-pre-line break-words text-sm', !fact.value && 'text-muted-foreground')}>{fact.value || 'Não informado'}</dd></div>)}
                </dl>
              </section>
              <section aria-label="Conteúdo completo" className="space-y-3 border-t pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Conteúdo completo</h3>
                  {selected.status === 'pendente' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(value => !value)}>
                    {editing ? <><FileText className="mr-1.5 h-3.5 w-3.5" /> Voltar à leitura</> : <><Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar texto</>}
                  </Button>}
                </div>
                {editing ? <div className="space-y-2"><label htmlFor="approval-draft" className="text-xs text-muted-foreground">Texto do conteúdo</label><Textarea id="approval-draft" value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} rows={20} className="min-h-80 font-mono text-xs leading-relaxed" /><p className="text-xs text-muted-foreground">Use Salvar rascunho para manter as alterações sem aprovar.</p></div>
                  : <div className="max-h-[34rem] overflow-y-auto pr-2"><ContentMarkdown text={draft} /></div>}
              </section>
            </div>
            <div className="sticky bottom-0 space-y-3 border-t bg-card/95 p-4 backdrop-blur sm:px-6">
              {operationError && <p role="alert" className="text-sm text-destructive">{operationError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground" aria-live="polite">{busy ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</span> : dirty ? <span className="text-amber-700 dark:text-amber-300">Alterações não salvas</span> : selected.status === 'pendente' ? 'Revise o conteúdo antes de decidir.' : STATUS_LABEL[selected.status]}</div>
                <div className="flex flex-wrap gap-2">
                  {selected.status === 'pendente' ? <>
                    {draftDirty && <Button variant="outline" size="sm" onClick={() => void mutate('save')} disabled={busy || loadingMore}><Save className="mr-1.5 h-3.5 w-3.5" /> Salvar rascunho</Button>}
                    <Button variant="outline" size="sm" disabled={busy || loadingMore} onClick={() => { setReason(''); setOperationError(null); setAdjusting(true) }}><MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Solicitar ajustes</Button>
                    <Button size="sm" disabled={busy || loadingMore || selected.tipo === 'plano_mensal' && !approvalHasDestination(selected)} onClick={() => void mutate('approve')}><Check className="mr-1.5 h-3.5 w-3.5" /> {approvalActionLabel(selected.tipo)}</Button>
                  </> : selected.status !== 'enviado' && <Button variant="outline" size="sm" disabled={busy || loadingMore} onClick={() => void mutate('reopen')}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Voltar para revisão</Button>}
                </div>
              </div>
            </div>
          </article>
        ) : <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-muted-foreground"><ClipboardList className="mb-3 h-8 w-8 opacity-35" /><p className="text-sm">{loading ? 'Preparando a revisão…' : 'Selecione um conteúdo da lista para revisar.'}</p></div>}
      </div>

      <Dialog open={adjusting} onOpenChange={open => { if (!open) closeAdjustments() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar ajustes</DialogTitle><DialogDescription>Registre o que precisa mudar. O texto atual e o motivo ficam salvos para a equipe acompanhar a revisão.</DialogDescription></DialogHeader>
          <div className="space-y-2"><label htmlFor="approval-reason" className="text-sm font-medium">Motivo dos ajustes</label><Textarea id="approval-reason" placeholder="Descreva o que deve ser revisto…" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} rows={5} /></div>
          {operationError && <p role="alert" className="text-sm text-destructive">{operationError}</p>}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={closeAdjustments}>Cancelar</Button><Button disabled={busy} onClick={() => void mutate('adjust')}>{busy ? 'Salvando…' : 'Registrar ajustes'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmLeave} onOpenChange={open => { if (!busyRef.current) setConfirmLeave(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Há alterações não salvas</AlertDialogTitle><AlertDialogDescription>{reasonDirty ? 'O motivo dos ajustes ainda não foi registrado. Continue editando para concluir o pedido ou descarte as alterações.' : 'Salve o rascunho antes de continuar ou descarte as alterações desta edição.'}</AlertDialogDescription></AlertDialogHeader>
          {operationError && <p role="alert" className="text-sm text-destructive">{operationError}</p>}
          <AlertDialogFooter className="flex-wrap gap-2 sm:space-x-0">
            <Button variant="ghost" disabled={busy} onClick={() => { pendingNavigation.current = null; setConfirmLeave(false) }}>Continuar editando</Button>
            <Button variant="outline" disabled={busy} onClick={() => {
              if (userId && selected) forgetApprovalDraft(userId, selected.id)
              if (pendingNavigation.current?.discardText) { setDraft(selected?.texto || ''); setBaseline(selected); setEditing(false); setRecoveryMessage(null) }
              setReason('')
              continueNavigation()
            }}>Descartar alterações</Button>
            {!reasonDirty && <Button disabled={busy} onClick={async () => { if (await mutate('save')) continueNavigation() }}>{busy ? 'Salvando…' : 'Salvar e continuar'}</Button>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
