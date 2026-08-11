import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, ExternalLink, FileText, Wrench } from 'lucide-react'
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

type DocTipo = 'estrategia' | 'roteiros' | 'proposta' | 'site' | 'outro'
type DocStatus = 'ativo' | 'nao_finalizado' | 'arquivado'

interface Documento {
  id: string
  cliente_nome: string
  titulo: string
  tipo: DocTipo
  descricao: string
  url: string
  mes: string
  status: DocStatus
  created_at: string
}

const TIPO_OPTIONS: DocTipo[] = ['estrategia', 'roteiros', 'proposta', 'site', 'outro']
const TIPO_LABEL: Record<DocTipo, string> = {
  estrategia: 'estratégia', roteiros: 'roteiros', proposta: 'proposta', site: 'site', outro: 'outro',
}
const TIPO_VARIANT: Record<DocTipo, string> = {
  estrategia: 'bg-primary/15 text-primary border-primary/30',
  roteiros: 'bg-primary/15 text-primary border-primary/30',
  proposta: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  site: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  outro: 'bg-muted text-muted-foreground border-border',
}

const STATUS_OPTIONS: DocStatus[] = ['ativo', 'nao_finalizado', 'arquivado']
const STATUS_LABEL: Record<DocStatus, string> = {
  ativo: '🟢 Ativo', nao_finalizado: '🚧 Não finalizado', arquivado: '📦 Arquivado',
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
function mesLabel(iso: string): string {
  const [y, m] = iso.split('-')
  return `${MESES[Number(m) - 1] || ''} ${y}`
}
function currentMonthInput(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EMPTY_FORM = {
  cliente_nome: '', titulo: '', tipo: 'estrategia' as DocTipo,
  descricao: '', url: '', mesInput: currentMonthInput(),
}
type DocForm = typeof EMPTY_FORM

export default function Documentos() {
  const { toast } = useToast()

  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [clienteFilter, setClienteFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('ativo')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<DocForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .order('mes', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) {
      toast({ title: 'Erro ao carregar documentos', description: error.message, variant: 'destructive' })
      setDocs([])
    } else {
      setDocs((data || []) as Documento[])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const clientes = useMemo(
    () => [...new Set(docs.map(d => d.cliente_nome))].filter(Boolean).sort(),
    [docs],
  )
  const pendentes = useMemo(() => docs.filter(d => d.status === 'nao_finalizado').length, [docs])

  const filtered = useMemo(
    () => docs.filter(d =>
      (clienteFilter === 'all' || d.cliente_nome === clienteFilter) &&
      (statusFilter === 'all' || d.status === statusFilter)),
    [docs, clienteFilter, statusFilter],
  )

  const byMonth = useMemo(() => {
    const m: Record<string, Documento[]> = {}
    filtered.forEach(d => { (m[d.mes] = m[d.mes] || []).push(d) })
    return Object.keys(m).sort().reverse().map(mes => ({ mes, items: m[mes] }))
  }, [filtered])

  async function setStatus(d: Documento, novo: DocStatus) {
    const { error } = await supabase.from('documentos').update({ status: novo }).eq('id', d.id)
    if (error) { toast({ title: 'Não deu', description: error.message, variant: 'destructive' }); return }
    fetchDocs()
  }

  async function arquivarMes(mes: string) {
    if (!confirm(`Arquivar todos os ativos de ${mesLabel(mes)}? (não mexe nos 🚧 não finalizados)`)) return
    const { error } = await supabase.rpc('arquivar_documentos_do_mes', { p_mes: mes })
    if (error) { toast({ title: 'Não deu', description: error.message, variant: 'destructive' }); return }
    toast({ title: 'Mês arquivado', description: mesLabel(mes) })
    fetchDocs()
  }

  async function save() {
    if (!form.cliente_nome.trim() || !form.titulo.trim() || !form.url.trim()) {
      toast({ title: 'Faltou preencher', description: 'Cliente, título e link são obrigatórios.', variant: 'destructive' })
      return
    }
    setSaving(true)
    const mes = `${form.mesInput || currentMonthInput()}-01`
    const { error } = await supabase.from('documentos').insert({
      cliente_nome: form.cliente_nome.trim(),
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      url: form.url.trim(),
      mes,
      status: 'ativo',
    })
    setSaving(false)
    if (error) {
      toast({
        title: 'Não deu',
        description: error.message.includes('duplicate') ? 'Esse link já está cadastrado.' : error.message,
        variant: 'destructive',
      })
      return
    }
    toast({ title: 'Documento adicionado' })
    setForm({ ...EMPTY_FORM, mesInput: form.mesInput })
    setShowForm(false)
    fetchDocs()
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todo entregável com link, por cliente e mês. Fim do mês, arquiva. Mês novo, entram os novos.
          </p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM, mesInput: currentMonthInput() }); setShowForm(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar link
        </Button>
      </div>

      {pendentes > 0 && (
        <button
          onClick={() => setStatusFilter('nao_finalizado')}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-500 px-3 py-1.5 text-sm font-medium hover:bg-orange-500/15 transition-colors">
          <Wrench className="h-4 w-4" /> {pendentes} não finalizado{pendentes > 1 ? 's' : ''} · retomar
        </button>
      )}

      <div className="flex flex-wrap gap-2 my-5">
        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clientes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto min-w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">🟢 Ativos</SelectItem>
            <SelectItem value="nao_finalizado">🚧 Não finalizados</SelectItem>
            <SelectItem value="arquivado">📦 Arquivados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm py-10 text-center">Carregando…</p>
      ) : byMonth.length === 0 ? (
        <p className="text-muted-foreground text-sm py-10 text-center">Nada por aqui ainda.</p>
      ) : (
        byMonth.map(({ mes, items }) => (
          <div key={mes} className="mb-7">
            <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">{mesLabel(mes)}</h2>
              <span className="text-xs text-muted-foreground">{items.length}</span>
              <Button variant="ghost" size="sm" className="ml-auto text-xs h-7" onClick={() => arquivarMes(mes)}>
                📦 arquivar o mês
              </Button>
            </div>

            <div className="space-y-2">
              {items.map(d => (
                <div key={d.id}
                  className={`flex items-start gap-3 rounded-xl border bg-card p-4 ${
                    d.status === 'arquivado' ? 'border-border opacity-50'
                    : d.status === 'nao_finalizado' ? 'border-orange-500/40'
                    : 'border-border'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold">{d.cliente_nome || '—'}</span>
                      <Badge variant="outline" className={`text-[10px] uppercase ${TIPO_VARIANT[d.tipo]}`}>
                        {TIPO_LABEL[d.tipo]}
                      </Badge>
                      {d.status === 'nao_finalizado' && (
                        <Badge variant="outline" className="text-[10px] bg-orange-500/15 text-orange-500 border-orange-500/40">🚧 não finalizado</Badge>
                      )}
                      {d.status === 'arquivado' && (
                        <Badge variant="outline" className="text-[10px]">📦 arquivado</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{d.titulo}</div>
                    {d.descricao && <div className="text-xs text-muted-foreground/80 mt-0.5">{d.descricao}</div>}
                    <a href={d.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 break-all">
                      <ExternalLink className="h-3 w-3 shrink-0" /> {d.url}
                    </a>
                  </div>
                  <Select value={d.status} onValueChange={v => setStatus(d, v as DocStatus)}>
                    <SelectTrigger className="w-auto min-w-[150px] h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Input value={form.cliente_nome} placeholder="Ex: Dra. Enia"
                onChange={e => setForm({ ...form, cliente_nome: e.target.value })} />
            </div>
            <div>
              <Label>Título</Label>
              <Input value={form.titulo} placeholder="Ex: Estratégia + roteiros"
                onChange={e => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as DocTipo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Mês</Label>
                <Input type="month" value={form.mesInput}
                  onChange={e => setForm({ ...form, mesInput: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Link</Label>
              <Input value={form.url} placeholder="https://…"
                onChange={e => setForm({ ...form, url: e.target.value })} />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea rows={2} value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
