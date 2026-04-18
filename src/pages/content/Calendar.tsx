import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  ContentPost,
  ContentFormat,
  PostStatus,
  CONTENT_FORMAT_CONFIG,
  POST_STATUS_CONFIG,
  formatDate,
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Toggle } from '@/components/ui/toggle'

interface StaffClient {
  id: string
  name: string
  company: string
}

const FORMAT_OPTIONS: ContentFormat[] = ['carrossel', 'reels', 'stories', 'feed']
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const GOAL_STORAGE_KEY = 'content_calendar_weekly_goal'

function ymdLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - r.getDay())
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfWeek(d: Date): Date {
  const r = startOfWeek(d)
  r.setDate(r.getDate() + 6)
  r.setHours(23, 59, 59, 999)
  return r
}

function buildMonthGrid(viewDate: Date): Date[] {
  const som = startOfMonth(viewDate)
  const startPad = som.getDay()
  const cells: Date[] = []
  const first = new Date(som)
  first.setDate(first.getDate() - startPad)
  for (let i = 0; i < 42; i++) {
    const d = new Date(first)
    d.setDate(first.getDate() + i)
    cells.push(d)
  }
  return cells
}

export default function Calendar() {
  const { toast } = useToast()
  const { isClient, isStaff } = useAuth()

  const [viewDate, setViewDate] = useState(new Date())
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)

  const [staffClients, setStaffClients] = useState<StaffClient[]>([])
  const [selectedStaffClientId, setSelectedStaffClientId] = useState<string>('')

  const [enabledFormats, setEnabledFormats] = useState<Set<ContentFormat>>(new Set(FORMAT_OPTIONS))

  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(GOAL_STORAGE_KEY) : null
    const n = raw ? parseInt(raw) : NaN
    return !isNaN(n) && n >= 0 ? n : 5
  })

  useEffect(() => {
    try { localStorage.setItem(GOAL_STORAGE_KEY, String(weeklyGoal)) } catch {
      // WHY: localStorage can throw in private browsing / SSR contexts
    }
  }, [weeklyGoal])

  const [sheetDate, setSheetDate] = useState<Date | null>(null)

  const [detailPost, setDetailPost] = useState<ContentPost | null>(null)

  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({
    title: '',
    format: 'carrossel' as ContentFormat,
    category: '',
    scheduled_date: '',
  })
  const [newErrors, setNewErrors] = useState<Record<string, string>>({})
  const [savingNew, setSavingNew] = useState(false)

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

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const from = ymdLocal(startOfMonth(viewDate))
    const to = ymdLocal(endOfMonth(viewDate))
    let q = supabase
      .from('content_posts')
      .select('*')
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date')
    if (activeClientId) q = q.eq('client_id', activeClientId)
    const { data, error } = await q
    if (error) {
      toast({ title: 'Erro ao carregar posts', description: error.message, variant: 'destructive' })
      setPosts([])
    } else {
      setPosts((data || []) as ContentPost[])
    }
    setLoading(false)
  }, [viewDate, activeClientId, toast])

  useEffect(() => {
    if (isClient && !clientId) return
    if (isStaff && !selectedStaffClientId) {
      setPosts([])
      setLoading(false)
      return
    }
    fetchPosts()
  }, [isClient, isStaff, clientId, selectedStaffClientId, fetchPosts])

  const postsByDay = useMemo(() => {
    const map = new Map<string, ContentPost[]>()
    for (const p of posts) {
      if (!p.scheduled_date) continue
      if (!enabledFormats.has(p.format)) continue
      const key = p.scheduled_date.slice(0, 10)
      const arr = map.get(key) || []
      arr.push(p)
      map.set(key, arr)
    }
    return map
  }, [posts, enabledFormats])

  const today = new Date()
  const todayKey = ymdLocal(today)
  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate])

  const weekStart = startOfWeek(today)
  const weekEnd = endOfWeek(today)
  const weekCount = posts.filter(p => {
    if (!p.scheduled_date) return false
    const d = new Date(p.scheduled_date + 'T00:00:00')
    return d >= weekStart && d <= weekEnd
  }).length
  const weekPct = weeklyGoal > 0 ? Math.min(100, Math.round((weekCount / weeklyGoal) * 100)) : 0

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  const goToday = () => setViewDate(new Date())

  const toggleFormat = (f: ContentFormat) => {
    setEnabledFormats(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const openNewForDay = (d: Date) => {
    if (isStaff && !selectedStaffClientId) {
      toast({ title: 'Selecione um cliente', variant: 'destructive' })
      return
    }
    setNewForm({ title: '', format: 'carrossel', category: '', scheduled_date: ymdLocal(d) })
    setNewErrors({})
    setShowNewForm(true)
  }

  const saveNewPost = async () => {
    const errs: Record<string, string> = {}
    if (!newForm.title.trim()) errs.title = 'Título é obrigatório'
    if (!newForm.scheduled_date) errs.scheduled_date = 'Data é obrigatória'
    setNewErrors(errs)
    if (Object.keys(errs).length) return
    if (!activeClientId) {
      toast({ title: 'Cliente não definido', variant: 'destructive' })
      return
    }
    setSavingNew(true)
    const { error } = await supabase.from('content_posts').insert({
      client_id: activeClientId,
      title: newForm.title.trim(),
      format: newForm.format,
      category: newForm.category.trim() || null,
      status: 'agendado',
      scheduled_date: newForm.scheduled_date,
    })
    setSavingNew(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Post agendado!' })
    setShowNewForm(false)
    fetchPosts()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendário Editorial</h1>
          <p className="text-sm text-muted-foreground">Visão mensal dos posts agendados e publicados</p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <Select value={selectedStaffClientId} onValueChange={setSelectedStaffClientId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
              <SelectContent>
                {staffClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} — {c.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" className="gap-2" onClick={() => openNewForDay(today)}>
            <Plus className="h-4 w-4" /> Novo post
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-44 text-center">
                <p className="font-semibold capitalize">
                  {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={nextMonth} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} className="h-8">Hoje</Button>
            </div>

            <div className="flex items-center gap-1">
              {FORMAT_OPTIONS.map(f => {
                const conf = CONTENT_FORMAT_CONFIG[f]
                const on = enabledFormats.has(f)
                return (
                  <Toggle
                    key={f}
                    pressed={on}
                    onPressedChange={() => toggleFormat(f)}
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${conf.chipBg}`} />
                    {conf.label}
                  </Toggle>
                )
              })}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="wg" className="text-xs text-muted-foreground">Meta semanal</Label>
            <Input
              id="wg"
              type="number"
              min="0"
              max="50"
              value={weeklyGoal}
              onChange={e => setWeeklyGoal(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-7 w-20 text-sm"
            />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">{weekCount}<span className="text-sm text-muted-foreground font-normal">/{weeklyGoal}</span></span>
            <span className="text-xs text-muted-foreground">posts esta semana</span>
          </div>
          <Progress value={weekPct} className="h-2" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : isStaff && !selectedStaffClientId ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Selecione um cliente no topo para ver o calendário.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEKDAYS.map(w => (
              <div key={w} className="px-2 py-2 text-xs font-semibold text-center text-muted-foreground">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day, idx) => {
              const key = ymdLocal(day)
              const dayPosts = postsByDay.get(key) || []
              const inMonth = day.getMonth() === viewDate.getMonth()
              const isToday = key === todayKey
              const visible = dayPosts.slice(0, 3)
              const overflow = dayPosts.length - visible.length

              return (
                <div
                  key={idx}
                  onClick={() => setSheetDate(day)}
                  className={`min-h-24 border-b border-r border-border p-1.5 cursor-pointer transition-colors hover:bg-muted/30
                    ${!inMonth ? 'bg-muted/20 opacity-50' : ''}
                    ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}
                    ${idx >= 35 ? 'border-b-0' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isToday ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center' : ''}`}>
                      {day.getDate()}
                    </span>
                    {dayPosts.length === 0 && inMonth && (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {visible.map(p => {
                      const fmt = CONTENT_FORMAT_CONFIG[p.format]
                      return (
                        <button
                          key={p.id}
                          onClick={e => { e.stopPropagation(); setDetailPost(p) }}
                          className="w-full flex items-center gap-1 text-left bg-muted/50 hover:bg-muted rounded px-1 py-0.5"
                          title={p.title}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${fmt.chipBg}`} />
                          <span className="text-xs truncate">{p.title}</span>
                        </button>
                      )
                    })}
                    {overflow > 0 && (
                      <div className="text-xs text-muted-foreground pl-2">+{overflow}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Sheet open={!!sheetDate} onOpenChange={open => { if (!open) setSheetDate(null) }}>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle>
              {sheetDate && sheetDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </SheetTitle>
            <SheetDescription>
              Posts agendados neste dia
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {sheetDate && (postsByDay.get(ymdLocal(sheetDate)) || []).map(p => {
              const fmt = CONTENT_FORMAT_CONFIG[p.format]
              const st = POST_STATUS_CONFIG[p.status]
              return (
                <button
                  key={p.id}
                  onClick={() => { setDetailPost(p); setSheetDate(null) }}
                  className="w-full text-left bg-background border border-border rounded-lg p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full mt-1.5 shrink-0 ${fmt.chipBg}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${fmt.className}`}>{fmt.label}</Badge>
                        <Badge variant="outline" className={`text-xs ${st.className}`}>{st.label}</Badge>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}

            {sheetDate && (postsByDay.get(ymdLocal(sheetDate)) || []).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum post neste dia</p>
            )}
          </div>

          <Button
            className="w-full mt-4 gap-2"
            onClick={() => {
              if (sheetDate) {
                openNewForDay(sheetDate)
                setSheetDate(null)
              }
            }}
          >
            <Plus className="h-4 w-4" /> Novo post para este dia
          </Button>
        </SheetContent>
      </Sheet>

      <Dialog open={!!detailPost} onOpenChange={open => { if (!open) setDetailPost(null) }}>
        <DialogContent className="max-w-lg bg-card border-border">
          {detailPost && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{detailPost.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${CONTENT_FORMAT_CONFIG[detailPost.format].className}`}>
                    {CONTENT_FORMAT_CONFIG[detailPost.format].label}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${POST_STATUS_CONFIG[detailPost.status].className}`}>
                    {POST_STATUS_CONFIG[detailPost.status].label}
                  </Badge>
                  {detailPost.category && (
                    <Badge variant="outline" className="text-xs">{detailPost.category}</Badge>
                  )}
                </div>
                {detailPost.scheduled_date && (
                  <p className="text-muted-foreground">
                    Agendado para: <span className="text-foreground font-medium">{formatDate(detailPost.scheduled_date.slice(0, 10))}</span>
                  </p>
                )}
                {detailPost.caption && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Caption</p>
                    <p className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-lg">{detailPost.caption}</p>
                  </div>
                )}
                {detailPost.hashtags && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Hashtags</p>
                    <p className="text-sm text-primary">{detailPost.hashtags}</p>
                  </div>
                )}
                {detailPost.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm text-muted-foreground">{detailPost.notes}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailPost(null)}>Fechar</Button>
                <Link to="/content/posts">
                  <Button className="gap-2">
                    Abrir no Gestor <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNewForm} onOpenChange={open => { if (!open) setShowNewForm(false) }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Novo post
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="cf-t">Título <span className="text-destructive">*</span></Label>
              <Input
                id="cf-t"
                value={newForm.title}
                onChange={e => setNewForm(p => ({ ...p, title: e.target.value }))}
                className={newErrors.title ? 'border-destructive' : ''}
                maxLength={200}
              />
              {newErrors.title && <p className="text-xs text-destructive">{newErrors.title}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Formato</Label>
                <Select value={newForm.format} onValueChange={(v: ContentFormat) => setNewForm(p => ({ ...p, format: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map(f => (
                      <SelectItem key={f} value={f}>{CONTENT_FORMAT_CONFIG[f].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-d">Data</Label>
                <Input
                  id="cf-d"
                  type="date"
                  value={newForm.scheduled_date}
                  onChange={e => setNewForm(p => ({ ...p, scheduled_date: e.target.value }))}
                  className={newErrors.scheduled_date ? 'border-destructive' : ''}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-c">Categoria</Label>
              <Input
                id="cf-c"
                value={newForm.category}
                onChange={e => setNewForm(p => ({ ...p, category: e.target.value }))}
                maxLength={60}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewForm(false)} disabled={savingNew}>Cancelar</Button>
            <Button onClick={saveNewPost} disabled={savingNew} className="gap-2">
              {savingNew
                ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                : <Plus className="h-4 w-4" />
              }
              {savingNew ? 'Salvando...' : 'Criar post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
