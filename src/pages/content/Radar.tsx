import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Plus, ExternalLink, Sparkles, ArrowRightCircle, Trash2,
  Radar as RadarIcon, LayoutList, LayoutGrid,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  ContentTrend,
  TrendRelevance,
  PautaUrgency,
  RadarScope,
  RadarCategory,
  TREND_RELEVANCE_CONFIG,
  PAUTA_URGENCY_CONFIG,
  RADAR_CATEGORY_CONFIG,
  SVI_CATEGORIES,
  CLIENT_CATEGORIES,
  formatTimestamp,
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

interface StaffClient {
  id: string
  name: string
  company: string
}

const RELEVANCE_OPTIONS: TrendRelevance[] = ['alta', 'media', 'baixa']
const URGENCY_OPTIONS: PautaUrgency[] = ['evergreen', 'tendencia', 'sazonal']
const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo período' },
  { value: '1', label: 'Últimas 24h' },
  { value: '3', label: 'Últimas 72h' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
]

const EMPTY_TREND_FORM = {
  title: '',
  source: '',
  url: '',
  relevance: 'media' as TrendRelevance,
  category: '' as RadarCategory | '',
  summary: '',
}

const EMPTY_PAUTA_FORM = {
  title: '',
  category: '',
  format_suggestion: '',
  urgency: 'tendencia' as PautaUrgency,
  notes: '',
}

function categoriesForScope(scope: RadarScope): RadarCategory[] {
  return scope === 'svi' ? SVI_CATEGORIES : CLIENT_CATEGORIES
}

function normalizeCategory(raw: string | null | undefined): RadarCategory | null {
  if (!raw) return null
  const k = raw.toLowerCase().trim() as RadarCategory
  return k in RADAR_CATEGORY_CONFIG ? k : null
}

export default function Radar() {
  const { toast } = useToast()
  const { isClient, isStaff } = useAuth()

  const [trends, setTrends] = useState<ContentTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)

  const [staffClients, setStaffClients] = useState<StaffClient[]>([])
  const [selectedStaffClientId, setSelectedStaffClientId] = useState<string>('')

  const [scope, setScope] = useState<RadarScope>('svi')
  const [selectedCats, setSelectedCats] = useState<Set<RadarCategory>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')

  const [relevanceFilter, setRelevanceFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('3')
  const [sourceFilter, setSourceFilter] = useState('')

  const [showTrendForm, setShowTrendForm] = useState(false)
  const [trendForm, setTrendForm] = useState(EMPTY_TREND_FORM)
  const [trendErrors, setTrendErrors] = useState<Record<string, string>>({})
  const [savingTrend, setSavingTrend] = useState(false)
  const [trendScope, setTrendScope] = useState<'global' | 'client'>('global')
  const [trendScopeClientId, setTrendScopeClientId] = useState<string>('')

  const [convertTrend, setConvertTrend] = useState<ContentTrend | null>(null)
  const [pautaForm, setPautaForm] = useState(EMPTY_PAUTA_FORM)
  const [pautaErrors, setPautaErrors] = useState<Record<string, string>>({})
  const [savingPauta, setSavingPauta] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ContentTrend | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    (async () => {
      if (isClient) {
        const { data } = await supabase.rpc('current_client_id')
        if (data) setClientId(data as string)
      } else if (isStaff) {
        const { data } = await supabase
          .from('clients')
          .select('id, name, company')
          .order('name')
        setStaffClients((data || []) as StaffClient[])
      }
    })()
  }, [isClient, isStaff])

  const activeClientId = isClient ? clientId : (selectedStaffClientId || null)

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('content_trends').select('*').order('captured_at', { ascending: false })

    if (isClient && activeClientId) {
      q = q.or(`client_id.is.null,client_id.eq.${activeClientId}`)
    } else if (isStaff && activeClientId) {
      q = q.or(`client_id.is.null,client_id.eq.${activeClientId}`)
    } else if (isStaff && !activeClientId) {
      q = q.is('client_id', null)
    }

    const { data, error } = await q
    if (error) {
      toast({ title: 'Erro ao carregar tendências', description: error.message, variant: 'destructive' })
      setTrends([])
    } else {
      setTrends((data || []) as ContentTrend[])
    }
    setLoading(false)
  }, [isClient, isStaff, activeClientId, toast])

  useEffect(() => {
    if (isClient && !clientId) return
    fetchTrends()
  }, [isClient, clientId, isStaff, selectedStaffClientId, fetchTrends])

  useEffect(() => {
    setSelectedCats(new Set())
  }, [scope])

  const scopeCategories = useMemo(() => categoriesForScope(scope), [scope])

  const filtered = useMemo(() => {
    const now = Date.now()
    return trends.filter(t => {
      const cat = normalizeCategory(t.category)
      if (!cat) return false
      if (!scopeCategories.includes(cat)) return false
      if (selectedCats.size > 0 && !selectedCats.has(cat)) return false
      if (relevanceFilter !== 'all' && t.relevance !== relevanceFilter) return false
      if (sourceFilter && !(t.source || '').toLowerCase().includes(sourceFilter.toLowerCase())) return false
      if (periodFilter !== 'all') {
        const days = parseInt(periodFilter)
        const ageDays = (now - new Date(t.captured_at).getTime()) / 86400000
        if (ageDays > days) return false
      }
      return true
    })
  }, [trends, scopeCategories, selectedCats, relevanceFilter, sourceFilter, periodFilter])

  const visibleColumns = useMemo(() => {
    return selectedCats.size > 0
      ? scopeCategories.filter(c => selectedCats.has(c))
      : scopeCategories
  }, [scopeCategories, selectedCats])

  const grouped = useMemo(() => {
    const map: Record<string, ContentTrend[]> = {}
    for (const c of visibleColumns) map[c] = []
    for (const t of filtered) {
      const cat = normalizeCategory(t.category)
      if (cat && map[cat]) map[cat].push(t)
    }
    return visibleColumns.map(cat => ({ cat, items: map[cat] || [] }))
  }, [filtered, visibleColumns])

  const toggleCat = (cat: RadarCategory) => {
    setSelectedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const openNewTrend = () => {
    setTrendForm(EMPTY_TREND_FORM)
    setTrendErrors({})
    setTrendScope('global')
    setTrendScopeClientId('')
    setShowTrendForm(true)
  }

  const saveTrend = async () => {
    const errs: Record<string, string> = {}
    if (!trendForm.title.trim()) errs.title = 'Título é obrigatório'
    if (!trendForm.source.trim()) errs.source = 'Fonte é obrigatória'
    if (trendScope === 'client' && !trendScopeClientId) errs.scope = 'Selecione um cliente'
    setTrendErrors(errs)
    if (Object.keys(errs).length) return

    setSavingTrend(true)
    const { error } = await supabase.from('content_trends').insert({
      client_id: trendScope === 'client' ? trendScopeClientId : null,
      title: trendForm.title.trim(),
      source: trendForm.source.trim(),
      url: trendForm.url.trim() || null,
      relevance: trendForm.relevance,
      category: trendForm.category || null,
      summary: trendForm.summary.trim() || null,
    })
    setSavingTrend(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Tendência adicionada!' })
    setShowTrendForm(false)
    fetchTrends()
  }

  const openConvert = (t: ContentTrend) => {
    setConvertTrend(t)
    setPautaForm({
      title: t.title,
      category: t.category || '',
      format_suggestion: '',
      urgency: 'tendencia',
      notes: t.summary || '',
    })
    setPautaErrors({})
  }

  const saveConvert = async () => {
    if (!convertTrend) return
    const errs: Record<string, string> = {}
    if (!pautaForm.title.trim()) errs.title = 'Título é obrigatório'
    if (!pautaForm.category.trim()) errs.category = 'Categoria é obrigatória'
    setPautaErrors(errs)
    if (Object.keys(errs).length) return

    let targetClientId = activeClientId
    if (!targetClientId && isStaff) {
      toast({ title: 'Selecione um cliente', description: 'Pautas precisam estar associadas a um cliente.', variant: 'destructive' })
      return
    }
    if (!targetClientId && isClient) {
      const { data } = await supabase.rpc('current_client_id')
      targetClientId = (data as string) || null
    }
    if (!targetClientId) {
      toast({ title: 'Cliente não definido', variant: 'destructive' })
      return
    }

    setSavingPauta(true)
    const { data: inserted, error } = await supabase
      .from('content_pautas')
      .insert({
        client_id: targetClientId,
        title: pautaForm.title.trim(),
        category: pautaForm.category.trim(),
        format_suggestion: pautaForm.format_suggestion.trim() || null,
        urgency: pautaForm.urgency,
        status: 'disponivel',
        notes: pautaForm.notes.trim() || null,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      setSavingPauta(false)
      toast({ title: 'Erro ao criar pauta', description: error?.message, variant: 'destructive' })
      return
    }

    const { error: updateErr } = await supabase
      .from('content_trends')
      .update({ converted_to_pauta_id: inserted.id })
      .eq('id', convertTrend.id)

    setSavingPauta(false)
    if (updateErr) {
      toast({ title: 'Pauta criada (aviso ao marcar tendência)', description: updateErr.message, variant: 'destructive' })
    } else {
      toast({ title: 'Tendência virou pauta!', description: pautaForm.title })
    }
    setConvertTrend(null)
    fetchTrends()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('content_trends').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Tendência excluída', variant: 'destructive' })
    setDeleteTarget(null)
    fetchTrends()
  }

  const totalShown = filtered.length

  return (
    <div className="space-y-4 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RadarIcon className="h-6 w-6 text-primary" /> Radar de Tendências
          </h1>
          <p className="text-sm text-muted-foreground">
            Notícias frescas do mercado, prontas pra virar pauta. {totalShown} resultado{totalShown === 1 ? '' : 's'} no filtro atual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <Select
              value={selectedStaffClientId || '__global__'}
              onValueChange={v => setSelectedStaffClientId(v === '__global__' ? '' : v)}
            >
              <SelectTrigger className="w-56"><SelectValue placeholder="Cliente (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">Apenas globais</SelectItem>
                {staffClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} — {c.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isStaff && (
            <Button size="sm" onClick={openNewTrend} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar tendência
            </Button>
          )}
        </div>
      </div>

      {/* SCOPE TABS + VIEW TOGGLE */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as RadarScope)}>
          <TabsList>
            <TabsTrigger value="svi" className="gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> SVI
              <span className="text-xs text-muted-foreground ml-1">({SVI_CATEGORIES.length})</span>
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> Clientes
              <span className="text-xs text-muted-foreground ml-1">({CLIENT_CATEGORIES.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as 'list' | 'kanban')}
          className="border border-border rounded-md"
        >
          <ToggleGroupItem value="kanban" aria-label="Kanban" className="h-8 px-3 gap-1.5 text-xs">
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Lista" className="h-8 px-3 gap-1.5 text-xs">
            <LayoutList className="h-3.5 w-3.5" /> Lista
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* CATEGORY CHIPS */}
      <div className="flex flex-wrap gap-2">
        {scopeCategories.map(cat => {
          const cfg = RADAR_CATEGORY_CONFIG[cat]
          const active = selectedCats.has(cat)
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCat(cat)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors',
                active ? cfg.activeChipClass : cfg.chipClass,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
              {cfg.label}
            </button>
          )
        })}
        {selectedCats.size > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCats(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground px-2 h-8"
          >
            limpar
          </button>
        )}
      </div>

      {/* SECONDARY FILTERS */}
      <div className="flex flex-wrap gap-3">
        <Select value={relevanceFilter} onValueChange={setRelevanceFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Relevância" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda relevância</SelectItem>
            {RELEVANCE_OPTIONS.map(r => (
              <SelectItem key={r} value={r}>{TREND_RELEVANCE_CONFIG[r].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Filtrar por fonte"
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="w-48"
        />
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : totalShown === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <RadarIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma tendência neste filtro.</p>
          <p className="text-xs mt-1">Tente trocar o período, limpar categorias ou alternar entre SVI/Clientes.</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanView
          columns={grouped}
          onConvert={openConvert}
          onDelete={isStaff ? setDeleteTarget : undefined}
        />
      ) : (
        <ListView
          items={filtered}
          onConvert={openConvert}
          onDelete={isStaff ? setDeleteTarget : undefined}
        />
      )}

      {/* Add Trend Dialog (staff only) */}
      <Dialog open={showTrendForm} onOpenChange={open => { if (!open) setShowTrendForm(false) }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Adicionar tendência
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="rf-t">Título <span className="text-destructive">*</span></Label>
              <Input
                id="rf-t"
                value={trendForm.title}
                onChange={e => setTrendForm(p => ({ ...p, title: e.target.value }))}
                className={trendErrors.title ? 'border-destructive' : ''}
                maxLength={200}
              />
              {trendErrors.title && <p className="text-xs text-destructive">{trendErrors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rf-s">Fonte <span className="text-destructive">*</span></Label>
                <Input
                  id="rf-s"
                  placeholder="Ex: G1, Valor, Instagram..."
                  value={trendForm.source}
                  onChange={e => setTrendForm(p => ({ ...p, source: e.target.value }))}
                  className={trendErrors.source ? 'border-destructive' : ''}
                  maxLength={80}
                />
                {trendErrors.source && <p className="text-xs text-destructive">{trendErrors.source}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={trendForm.category || '__none__'}
                  onValueChange={(v) => setTrendForm(p => ({ ...p, category: v === '__none__' ? '' : (v as RadarCategory) }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sem categoria —</SelectItem>
                    {SVI_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>SVI · {RADAR_CATEGORY_CONFIG[c].label}</SelectItem>
                    ))}
                    {CLIENT_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>Cliente · {RADAR_CATEGORY_CONFIG[c].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rf-u">URL da fonte</Label>
              <Input
                id="rf-u"
                type="url"
                placeholder="https://..."
                value={trendForm.url}
                onChange={e => setTrendForm(p => ({ ...p, url: e.target.value }))}
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Relevância</Label>
                <Select value={trendForm.relevance} onValueChange={(v: TrendRelevance) => setTrendForm(p => ({ ...p, relevance: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELEVANCE_OPTIONS.map(r => (
                      <SelectItem key={r} value={r}>{TREND_RELEVANCE_CONFIG[r].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Escopo</Label>
                <Select value={trendScope} onValueChange={(v: 'global' | 'client') => setTrendScope(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (todos)</SelectItem>
                    <SelectItem value="client">Cliente específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {trendScope === 'client' && (
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={trendScopeClientId} onValueChange={setTrendScopeClientId}>
                  <SelectTrigger className={trendErrors.scope ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — {c.company}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {trendErrors.scope && <p className="text-xs text-destructive">{trendErrors.scope}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rf-sum">Resumo</Label>
              <Textarea
                id="rf-sum"
                placeholder="O que essa tendência diz e por que importa..."
                value={trendForm.summary}
                onChange={e => setTrendForm(p => ({ ...p, summary: e.target.value }))}
                rows={4}
                maxLength={2000}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrendForm(false)} disabled={savingTrend}>Cancelar</Button>
            <Button onClick={saveTrend} disabled={savingTrend} className="gap-2">
              {savingTrend
                ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : <Plus className="h-4 w-4" />
              }
              {savingTrend ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Pauta Dialog */}
      <Dialog open={!!convertTrend} onOpenChange={open => { if (!open) setConvertTrend(null) }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Transformar em pauta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="cv-t">Título <span className="text-destructive">*</span></Label>
              <Input
                id="cv-t"
                value={pautaForm.title}
                onChange={e => setPautaForm(p => ({ ...p, title: e.target.value }))}
                className={pautaErrors.title ? 'border-destructive' : ''}
                maxLength={200}
              />
              {pautaErrors.title && <p className="text-xs text-destructive">{pautaErrors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cv-c">Categoria <span className="text-destructive">*</span></Label>
                <Input
                  id="cv-c"
                  value={pautaForm.category}
                  onChange={e => setPautaForm(p => ({ ...p, category: e.target.value }))}
                  className={pautaErrors.category ? 'border-destructive' : ''}
                  maxLength={60}
                />
                {pautaErrors.category && <p className="text-xs text-destructive">{pautaErrors.category}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cv-f">Formato sugerido</Label>
                <Input
                  id="cv-f"
                  value={pautaForm.format_suggestion}
                  onChange={e => setPautaForm(p => ({ ...p, format_suggestion: e.target.value }))}
                  maxLength={60}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Urgência</Label>
              <Select value={pautaForm.urgency} onValueChange={(v: PautaUrgency) => setPautaForm(p => ({ ...p, urgency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map(u => (
                    <SelectItem key={u} value={u}>{PAUTA_URGENCY_CONFIG[u].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cv-n">Notas</Label>
              <Textarea
                id="cv-n"
                value={pautaForm.notes}
                onChange={e => setPautaForm(p => ({ ...p, notes: e.target.value }))}
                rows={4}
                maxLength={2000}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTrend(null)} disabled={savingPauta}>Cancelar</Button>
            <Button onClick={saveConvert} disabled={savingPauta} className="gap-2">
              {savingPauta
                ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : <Sparkles className="h-4 w-4" />
              }
              {savingPauta ? 'Salvando...' : 'Criar pauta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tendência?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <span className="font-semibold text-foreground">{deleteTarget?.title}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================================
// VIEWS
// ============================================================================

interface ViewProps {
  items: ContentTrend[]
  onConvert: (t: ContentTrend) => void
  onDelete?: (t: ContentTrend) => void
}

function ListView({ items, onConvert, onDelete }: ViewProps) {
  return (
    <div className="space-y-2">
      {items.map(t => (
        <TrendCard key={t.id} trend={t} onConvert={onConvert} onDelete={onDelete} variant="full" />
      ))}
    </div>
  )
}

interface KanbanProps {
  columns: { cat: RadarCategory; items: ContentTrend[] }[]
  onConvert: (t: ContentTrend) => void
  onDelete?: (t: ContentTrend) => void
}

function KanbanView({ columns, onConvert, onDelete }: KanbanProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
      {columns.map(col => {
        const cfg = RADAR_CATEGORY_CONFIG[col.cat]
        return (
          <div
            key={col.cat}
            className={cn(
              'flex-shrink-0 w-80 rounded-xl border bg-card/40 snap-start',
              cfg.columnClass,
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', cfg.dotClass)} />
                <span className="text-sm font-semibold">{cfg.label}</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{col.items.length}</span>
            </div>
            <div className="p-2 space-y-2 max-h-[calc(100vh-360px)] overflow-y-auto">
              {col.items.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border/40 rounded-lg">
                  sem novidade
                </div>
              ) : (
                col.items.map(t => (
                  <TrendCard
                    key={t.id}
                    trend={t}
                    onConvert={onConvert}
                    onDelete={onDelete}
                    variant="compact"
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// CARD
// ============================================================================

interface TrendCardProps {
  trend: ContentTrend
  onConvert: (t: ContentTrend) => void
  onDelete?: (t: ContentTrend) => void
  variant: 'full' | 'compact'
}

function TrendCard({ trend: t, onConvert, onDelete, variant }: TrendCardProps) {
  const rel = TREND_RELEVANCE_CONFIG[t.relevance]
  const cat = normalizeCategory(t.category)
  const catCfg = cat ? RADAR_CATEGORY_CONFIG[cat] : null
  const compact = variant === 'compact'

  return (
    <div className={cn(
      'bg-card border border-border rounded-lg hover:border-primary/40 transition-colors',
      compact ? 'p-2.5 space-y-2' : 'p-4 space-y-3',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5', rel.className)}>{rel.label}</Badge>
            {catCfg && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-border">
                <span className={cn('h-1 w-1 rounded-full mr-1', catCfg.dotClass)} />
                {catCfg.label}
              </Badge>
            )}
            {!compact && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-border text-muted-foreground">
                {t.source}
              </Badge>
            )}
            {t.converted_to_pauta_id && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-success/15 text-success border-success/30">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" /> pauta
              </Badge>
            )}
          </div>
          <p className={cn(
            'font-semibold leading-snug',
            compact ? 'text-xs line-clamp-3' : 'text-sm',
          )}>
            {t.title}
          </p>
        </div>
        {!compact && (
          <span className="text-xs text-muted-foreground shrink-0">{formatTimestamp(t.captured_at)}</span>
        )}
      </div>

      {t.summary && !compact && (
        <p className="text-sm text-muted-foreground line-clamp-3">{t.summary}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
          {compact && <span className="truncate">{t.source}</span>}
          {compact && <span>·</span>}
          {compact && <span className="shrink-0">{formatTimestamp(t.captured_at)}</span>}
          {t.url && (
            <a
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1 ml-auto shrink-0"
            >
              {compact ? <ExternalLink className="h-3 w-3" /> : <>abrir <ExternalLink className="h-3 w-3" /></>}
            </a>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className={cn('text-xs gap-1', compact ? 'h-6 px-2' : 'h-7')}
            onClick={() => onConvert(t)}
          >
            <ArrowRightCircle className="h-3 w-3" />
            {compact ? 'pauta' : 'Transformar em pauta'}
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className={cn('p-0 text-destructive hover:text-destructive hover:bg-destructive/10', compact ? 'h-6 w-6' : 'h-7 w-7')}
              onClick={() => onDelete(t)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
