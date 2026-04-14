import { useEffect, useState, useMemo, useCallback } from 'react'
import { Search, Plus, Instagram, Trash2, ArrowRight, Phone, Calendar, Target, MessageCircle, TrendingUp, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useToast } from '@/hooks/use-toast'
import {
  Prospect, PROSPECT_TIER_CONFIG, PROSPECT_STATUS_CONFIG, PROSPECT_CHANNELS,
  CITIES, SPECIALTIES, formatDate
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const EMPTY_FORM = {
  name: '', specialty: '', city: '', instagram: '',
  tier: 'verde' as const, signal: '', notes: '',
  nextFollowUp: new Date().toISOString().split('T')[0],
}

function whatsappLink(phone: string) {
  const clean = phone.replace(/\D/g, '')
  return `https://wa.me/55${clean}`
}

export default function Prospecting() {
  const { toast } = useToast()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState('todos')

  const fetchProspects = useCallback(async () => {
    const { data } = await supabase
      .from('prospects')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setProspects(data.map((p: any) => ({
        id: p.id, name: p.name, specialty: p.specialty, city: p.city,
        instagram: p.instagram || '', tier: p.tier, touch: p.touch,
        channel: p.channel, status: p.status, signal: p.signal || '',
        nextFollowUp: p.next_follow_up || '', notes: p.notes || '',
        createdAt: p.created_at,
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProspects() }, [fetchProspects])

  // Today's follow-ups
  const today = new Date().toISOString().split('T')[0]
  const todayFollowUps = prospects.filter(p =>
    p.nextFollowUp && p.nextFollowUp <= today &&
    !['fechado', 'perdido', 'nao_agora'].includes(p.status)
  )
  const overdueCount = todayFollowUps.length

  // Metrics
  const activeProspects = prospects.filter(p => !['fechado', 'perdido', 'nao_agora'].includes(p.status))
  const dmsEnviadas = prospects.filter(p => p.status !== 'novo').length
  const respostas = prospects.filter(p => ['respondeu','whatsapp','call_agendada','call_realizada','proposta_enviada','fechado'].includes(p.status)).length
  const taxaResposta = dmsEnviadas > 0 ? ((respostas / dmsEnviadas) * 100).toFixed(1) : '0'
  const transWhatsapp = prospects.filter(p => ['whatsapp','call_agendada','call_realizada','proposta_enviada','fechado'].includes(p.status)).length
  const callsAgendadas = prospects.filter(p => ['call_agendada','call_realizada','proposta_enviada','fechado'].includes(p.status)).length
  const fechados = prospects.filter(p => p.status === 'fechado').length

  const filtered = useMemo(() => {
    let list = prospects
    if (tab === 'hoje') list = todayFollowUps
    else if (tab === 'ativos') list = activeProspects
    return list.filter(p => {
      if (search && !`${p.name} ${p.specialty} ${p.instagram}`.toLowerCase().includes(search.toLowerCase())) return false
      if (tierFilter !== 'all' && p.tier !== tierFilter) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (cityFilter !== 'all' && p.city !== cityFilter) return false
      return true
    })
  }, [prospects, search, tierFilter, statusFilter, cityFilter, tab, todayFollowUps, activeProspects])

  async function handleAdd() {
    setSaving(true)
    const { error } = await supabase.from('prospects').insert({
      name: form.name, specialty: form.specialty, city: form.city,
      instagram: form.instagram, tier: form.tier, signal: form.signal,
      notes: form.notes, next_follow_up: form.nextFollowUp || null,
    })
    if (error) { toast({ title: 'Erro ao salvar', variant: 'destructive' }); setSaving(false); return }
    await logActivity('criou prospect', 'prospect', undefined, form.name)
    setForm(EMPTY_FORM); setShowForm(false); setSaving(false)
    toast({ title: 'Prospect adicionado' })
    fetchProspects()
  }

  async function advanceTouch(id: string) {
    const p = prospects.find(pr => pr.id === id)
    if (!p || p.touch >= 5) return
    const newTouch = p.touch + 1
    let newStatus = p.status
    if (p.status === 'novo' && newTouch === 1) newStatus = 'enviado'
    // Auto-set next follow-up based on touch timing
    const followUpDays = [0, 3, 4, 5, 7][p.touch] || 3
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + followUpDays)
    await supabase.from('prospects').update({
      touch: newTouch, status: newStatus, updated_at: new Date().toISOString(),
      next_follow_up: nextDate.toISOString().split('T')[0],
    }).eq('id', id)
    await logActivity(`avançou para toque ${newTouch}`, 'prospect', id, p.name)
    fetchProspects()
  }

  async function updateStatus(id: string, status: string) {
    let channel: 'dm' | 'whatsapp' | 'call' = 'dm'
    if (['whatsapp','call_agendada'].includes(status)) channel = 'whatsapp'
    if (['call_realizada','proposta_enviada','fechado'].includes(status)) channel = 'call'
    await supabase.from('prospects').update({ status, channel, updated_at: new Date().toISOString() }).eq('id', id)
    const p = prospects.find(pr => pr.id === id)
    await logActivity(`mudou status para ${status}`, 'prospect', id, p?.name)

    // Se fechou, criar lead no pipeline automaticamente
    if (status === 'fechado' && p) {
      await supabase.from('leads').insert({
        name: p.name, phone: '', source: 'prospeccao', stage: 'fechado',
        segment: p.specialty, notes: `Convertido da prospecção. Sinal: ${p.signal}`,
        instagram: p.instagram, prospect_id: id,
      })
      await logActivity('converteu prospect em lead', 'lead', undefined, p.name)
      toast({ title: `${p.name} convertido para Pipeline!` })
    }
    fetchProspects()
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds)
    await supabase.from('prospects').delete().in('id', ids)
    await logActivity(`removeu ${ids.length} prospect(s)`, 'prospect')
    setSelectedIds(new Set())
    toast({ title: `${ids.length} prospect(s) removido(s)` })
    fetchProspects()
  }

  async function bulkNaoAgora() {
    const ids = Array.from(selectedIds)
    await supabase.from('prospects').update({ status: 'nao_agora' }).in('id', ids)
    setSelectedIds(new Set())
    toast({ title: 'Marcados como "Não Agora"' })
    fetchProspects()
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: 'Total Prospects', value: prospects.length, icon: Target },
          { label: 'Follow-ups Hoje', value: overdueCount, icon: Clock, alert: overdueCount > 0 },
          { label: 'DMs Enviadas', value: dmsEnviadas, icon: MessageCircle },
          { label: 'Respostas', value: respostas, icon: TrendingUp },
          { label: 'Taxa Resposta', value: `${taxaResposta}%`, icon: TrendingUp },
          { label: 'WhatsApp', value: transWhatsapp, icon: Phone },
          { label: 'Fechados', value: fechados, icon: Calendar },
        ].map(m => (
          <Card key={m.label} className={`border-border bg-card ${m.alert ? 'border-warning/50' : ''}`}>
            <CardContent className="p-3 text-center">
              <m.icon className={`h-4 w-4 mx-auto mb-1 ${m.alert ? 'text-warning' : 'text-muted-foreground'}`} />
              <p className="text-muted-foreground text-[10px] mb-0.5">{m.label}</p>
              <p className={`text-xl font-bold ${m.alert ? 'text-warning' : ''}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="todos">Todos ({prospects.length})</TabsTrigger>
            <TabsTrigger value="hoje" className={overdueCount > 0 ? 'text-warning' : ''}>
              Hoje ({overdueCount})
            </TabsTrigger>
            <TabsTrigger value="ativos">Ativos ({activeProspects.length})</TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          <Button onClick={() => setShowForm(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </div>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tiers</SelectItem>
            {Object.entries(PROSPECT_TIER_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(PROSPECT_STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
          <Button variant="outline" size="sm" onClick={bulkNaoAgora}>Não Agora</Button>
          <Button variant="destructive" size="sm" onClick={deleteSelected}><Trash2 className="h-3 w-3 mr-1" /> Remover</Button>
        </div>
      )}

      {/* Table */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Nome</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Toque</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  {tab === 'hoje' ? 'Nenhum follow-up para hoje.' : 'Nenhum prospect encontrado.'}
                </TableCell></TableRow>
              ) : filtered.map(p => {
                const tier = PROSPECT_TIER_CONFIG[p.tier]
                const status = PROSPECT_STATUS_CONFIG[p.status] || { label: p.status, className: '' }
                const channel = PROSPECT_CHANNELS[p.channel] || { label: p.channel, className: '' }
                const isOverdue = p.nextFollowUp && p.nextFollowUp <= today && !['fechado','perdido','nao_agora'].includes(p.status)
                return (
                  <TableRow key={p.id} className={`hover:bg-accent/50 ${isOverdue ? 'bg-warning/5' : ''}`}>
                    <TableCell><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{p.name}</span>
                        {p.instagram && (
                          <a href={`https://instagram.com/${p.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-pink-400">
                            <Instagram className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      {p.signal && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{p.signal}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{p.specialty}</TableCell>
                    <TableCell className="text-sm">{p.city}</TableCell>
                    <TableCell><Badge variant="outline" className={tier?.className}>{tier?.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(t => (
                          <div key={t} className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                            t <= p.touch ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>{t}</div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={channel?.className}>{channel?.label}</Badge></TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={v => updateStatus(p.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-[115px] p-1">
                          <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PROSPECT_STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className={`text-xs ${isOverdue ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                      {p.nextFollowUp ? formatDate(p.nextFollowUp) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => advanceTouch(p.id)} disabled={p.touch >= 5} title="Avançar toque">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                        {p.instagram && (
                          <a href={`https://instagram.com/${p.instagram.replace('@','')}/`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir Instagram">
                              <Instagram className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Novo Prospect</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Dr. João Silva" /></div>
              <div><Label>Instagram</Label><Input value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})} placeholder="@drjoao" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Especialidade</Label>
                <Select value={form.specialty} onValueChange={v => setForm({...form, specialty: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Cidade</Label>
                <Select value={form.city} onValueChange={v => setForm({...form, city: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tier</Label>
                <Select value={form.tier} onValueChange={(v: any) => setForm({...form, tier: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PROSPECT_TIER_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prox. Follow-up</Label><Input type="date" value={form.nextFollowUp} onChange={e => setForm({...form, nextFollowUp: e.target.value})} /></div>
            </div>
            <div><Label>Sinal Identificado</Label><Input value={form.signal} onChange={e => setForm({...form, signal: e.target.value})} placeholder="Ex: parou de postar há 30 dias" /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!form.name || !form.specialty || !form.city || saving}>
              {saving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
