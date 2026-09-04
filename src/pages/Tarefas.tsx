import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { isClienteMedico, formatDate } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, Circle, CircleDot, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Tarefa {
  id: string
  titulo: string
  descricao: string
  cliente_id: string | null
  cliente_nome: string | null
  dono_id: string | null
  dono_nome: string | null
  prazo: string | null
  status: 'aberta' | 'fazendo' | 'feita'
  prioridade: 'baixa' | 'normal' | 'alta'
  origem: string
  criado_em: string
}
interface ClienteMin { id: string; name: string; segment?: string | null }
interface Pessoa { user_id: string; name: string }

const FORM_VAZIO = { titulo: '', descricao: '', cliente_id: '', dono_id: '', prazo: '', prioridade: 'normal' }
type FormTarefa = typeof FORM_VAZIO

const STATUS_ORDEM: Record<Tarefa['status'], number> = { aberta: 0, fazendo: 1, feita: 2 }
const STATUS_UI: Record<Tarefa['status'], { label: string; cls: string; Icon: typeof Circle }> = {
  aberta: { label: 'Aberta', cls: 'bg-muted text-muted-foreground border-border', Icon: Circle },
  fazendo: { label: 'Fazendo', cls: 'bg-info/10 text-info border-info/30', Icon: CircleDot },
  feita: { label: 'Feita', cls: 'bg-success/10 text-success border-success/30', Icon: CheckCircle2 },
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Tarefas() {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const [visao, setVisao] = useState<'minhas' | 'todas' | 'atrasadas'>('minhas')
  const [filtroCliente, setFiltroCliente] = useState('todos')
  const [mostrarFeitas, setMostrarFeitas] = useState(false)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Tarefa | null>(null)
  const [form, setForm] = useState<FormTarefa>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [apagando, setApagando] = useState<Tarefa | null>(null)

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ['tarefas'],
    queryFn: async (): Promise<Tarefa[]> => {
      const { data, error } = await supabase.from('tarefas').select('*').order('criado_em', { ascending: false })
      if (error) throw error
      return (data || []) as Tarefa[]
    },
  })
  const { data: clientes = [] } = useQuery({
    queryKey: ['tarefas-clientes'],
    queryFn: async (): Promise<ClienteMin[]> => {
      const { data } = await supabase.from('clientes_operacional').select('id, name, segment').order('name')
      return (data || []) as ClienteMin[]
    },
  })
  const { data: pessoas = [] } = useQuery({
    queryKey: ['tarefas-pessoas'],
    queryFn: async (): Promise<Pessoa[]> => {
      const { data } = await supabase.from('profiles').select('user_id, name').order('name')
      return (data || []) as Pessoa[]
    },
  })

  const hoje = hojeISO()
  const atrasada = (t: Tarefa) => t.status !== 'feita' && !!t.prazo && t.prazo < hoje

  const filtradas = useMemo(() => {
    let lista = tarefas
    if (visao === 'minhas') lista = lista.filter(t => t.dono_id === user?.id)
    if (visao === 'atrasadas') lista = lista.filter(atrasada)
    if (filtroCliente !== 'todos') lista = lista.filter(t => t.cliente_id === filtroCliente)
    if (!mostrarFeitas && visao !== 'atrasadas') lista = lista.filter(t => t.status !== 'feita')
    const q = busca.trim().toLowerCase()
    if (q) lista = lista.filter(t =>
      t.titulo.toLowerCase().includes(q) ||
      (t.cliente_nome || '').toLowerCase().includes(q) ||
      (t.dono_nome || '').toLowerCase().includes(q))
    // atrasada primeiro, depois por status e prazo mais perto
    return [...lista].sort((a, b) => {
      const at = atrasada(a) ? 0 : 1, bt = atrasada(b) ? 0 : 1
      if (at !== bt) return at - bt
      if (STATUS_ORDEM[a.status] !== STATUS_ORDEM[b.status]) return STATUS_ORDEM[a.status] - STATUS_ORDEM[b.status]
      return (a.prazo || '9999').localeCompare(b.prazo || '9999')
    })
  }, [tarefas, visao, filtroCliente, mostrarFeitas, busca, user?.id])

  const nAtrasadas = tarefas.filter(atrasada).length
  const nMinhas = tarefas.filter(t => t.dono_id === user?.id && t.status !== 'feita').length

  function abrirNova() { setEditando(null); setForm({ ...FORM_VAZIO, dono_id: user?.id || '' }); setAberto(true) }
  function abrirEdicao(t: Tarefa) {
    setEditando(t)
    setForm({
      titulo: t.titulo, descricao: t.descricao || '',
      cliente_id: t.cliente_id || '', dono_id: t.dono_id || '',
      prazo: t.prazo || '', prioridade: t.prioridade,
    })
    setAberto(true)
  }

  async function salvar() {
    if (!form.titulo.trim()) return toast.error('Dá um título pra tarefa')
    setSalvando(true)
    const cliente = clientes.find(c => c.id === form.cliente_id)
    const dono = pessoas.find(p => p.user_id === form.dono_id)
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      cliente_id: form.cliente_id || null,
      cliente_nome: cliente?.name || null,
      dono_id: form.dono_id || null,
      dono_nome: dono?.name || null,
      prazo: form.prazo || null,
      prioridade: form.prioridade,
    }
    const { error } = editando
      ? await supabase.from('tarefas').update(payload).eq('id', editando.id)
      : await supabase.from('tarefas').insert({ ...payload, criado_por: user?.id || null })
    setSalvando(false)
    if (error) return toast.error(`Não salvou: ${error.message}`)
    toast.success(editando ? 'Tarefa atualizada' : 'Tarefa criada')
    setAberto(false); setEditando(null)
    qc.invalidateQueries({ queryKey: ['tarefas'] })
  }

  async function mudarStatus(t: Tarefa) {
    const prox: Tarefa['status'] = t.status === 'aberta' ? 'fazendo' : t.status === 'fazendo' ? 'feita' : 'aberta'
    const { error } = await supabase.from('tarefas').update({ status: prox }).eq('id', t.id)
    if (error) return toast.error(`Não mudou: ${error.message}`)
    qc.invalidateQueries({ queryKey: ['tarefas'] })
  }

  async function apagar() {
    if (!apagando) return
    const { error } = await supabase.from('tarefas').delete().eq('id', apagando.id)
    setApagando(null)
    if (error) return toast.error(`Não apagou: ${error.message}`)
    toast.success('Tarefa apagada')
    qc.invalidateQueries({ queryKey: ['tarefas'] })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            {nMinhas > 0 ? `${nMinhas} sua(s) em aberto` : 'Nada em aberto no seu nome'}
            {nAtrasadas > 0 && <span className="text-destructive font-medium"> · {nAtrasadas} atrasada(s) no time</span>}
          </p>
        </div>
        <Button size="sm" onClick={abrirNova} className="gap-2 ml-auto"><Plus className="h-4 w-4" /> Nova tarefa</Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {([['minhas', 'Minhas'], ['todas', 'Todas'], ['atrasadas', `Atrasadas${nAtrasadas ? ` (${nAtrasadas})` : ''}`]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setVisao(v)}
              className={`px-3 py-1.5 text-sm ${visao === v ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/40'}`}>
              {label}
            </button>
          ))}
        </div>
        <Select value={filtroCliente} onValueChange={setFiltroCliente}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clientes.map(c => (
              <SelectItem key={c.id} value={c.id} className={isClienteMedico(c) ? 'text-info' : ''}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, cliente ou dono..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={mostrarFeitas} onChange={e => setMostrarFeitas(e.target.checked)} className="accent-primary" />
          feitas
        </label>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {tarefas.length === 0 ? 'Nenhuma tarefa ainda. Cria a primeira no botão acima.' : 'Nada com esses filtros.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Dono</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map(t => {
                  const st = STATUS_UI[t.status]
                  const tarde = atrasada(t)
                  const cli = clientes.find(c => c.id === t.cliente_id)
                  const medico = cli ? isClienteMedico(cli) : isClienteMedico({ name: t.cliente_nome, segment: null })
                  return (
                    <TableRow key={t.id} className="border-border hover:bg-muted/20">
                      <TableCell>
                        {/* clique no status avanca: aberta -> fazendo -> feita -> aberta */}
                        <button onClick={() => mudarStatus(t)} title="Clique pra avançar o status">
                          <Badge variant="outline" className={`text-xs cursor-pointer ${st.cls}`}>
                            <st.Icon className="h-3 w-3 mr-1" />{st.label}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <p className={`text-sm font-medium ${t.status === 'feita' ? 'line-through text-muted-foreground' : ''}`}>
                          {t.prioridade === 'alta' && <span className="text-destructive mr-1">!</span>}
                          {t.titulo}
                        </p>
                        {t.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{t.descricao}</p>}
                      </TableCell>
                      <TableCell className={`text-sm ${medico ? 'text-info' : ''}`}>{t.cliente_nome || <span className="text-muted-foreground">interna</span>}</TableCell>
                      <TableCell className="text-sm">{t.dono_nome || <span className="text-muted-foreground">sem dono</span>}</TableCell>
                      <TableCell>
                        {t.prazo ? (
                          <span className={`text-sm flex items-center gap-1 ${tarde ? 'text-destructive font-medium' : ''}`}>
                            {tarde && <AlertTriangle className="h-3.5 w-3.5" />}{formatDate(t.prazo)}
                          </span>
                        ) : <span className="text-muted-foreground text-sm">sem prazo</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEdicao(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setApagando(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={o => { setAberto(o); if (!o) setEditando(null) }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{editando ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="tf-titulo">Título <span className="text-destructive">*</span></Label>
              <Input id="tf-titulo" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="O que precisa ser feito" maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-desc">Descrição</Label>
              <Textarea id="tf-desc" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} maxLength={4000}
                placeholder="Contexto, links, o que é 'pronto' nessa tarefa" className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={form.cliente_id || 'nenhum'} onValueChange={v => setForm(f => ({ ...f, cliente_id: v === 'nenhum' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Interna (sem cliente)</SelectItem>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id} className={isClienteMedico(c) ? 'text-info' : ''}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dono</Label>
                <Select value={form.dono_id || 'ninguem'} onValueChange={v => setForm(f => ({ ...f, dono_id: v === 'ninguem' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguem">Sem dono</SelectItem>
                    {pessoas.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}{p.user_id === user?.id ? ' (você)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tf-prazo">Prazo</Label>
                <Input id="tf-prazo" type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar tarefa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apagando} onOpenChange={o => !o && setApagando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>{apagando && `"${apagando.titulo}" some pra todo mundo. Se ela já foi feita, prefira marcar como feita.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={apagar} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
