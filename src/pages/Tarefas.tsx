import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { isClienteMedico, formatDate } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Circle, CircleDot, CheckCircle2, AlertTriangle,
  Folder, Users, User, LayoutList, Kanban, UserPlus, ListPlus, Inbox,
} from 'lucide-react'

interface Tarefa {
  id: string
  titulo: string
  descricao: string
  cliente_id: string | null
  cliente_nome: string | null
  dono_id: string | null
  dono_nome: string | null
  lista_id: string | null
  lista_nome: string | null
  prazo: string | null
  status: 'aberta' | 'fazendo' | 'feita'
  prioridade: 'baixa' | 'normal' | 'alta'
  origem: string
  criado_em: string
}
interface ClienteMin { id: string; name: string; segment?: string | null }
interface Pessoa { user_id: string; name: string }
interface Lista { id: string; nome: string; emoji: string; ordem: number }

type Selecao =
  | { tipo: 'visao'; id: 'minhas' | 'todas' | 'atrasadas' | 'feitas' }
  | { tipo: 'cliente'; id: string }
  | { tipo: 'pessoa'; id: string }
  | { tipo: 'lista'; id: string }

const FORM_VAZIO = { titulo: '', descricao: '', cliente_id: '', dono_id: '', lista_id: '', prazo: '', prioridade: 'normal' }
type FormTarefa = typeof FORM_VAZIO

const STATUS_UI = {
  aberta: { label: 'Aberta', cls: 'bg-muted text-muted-foreground border-border', Icon: Circle },
  fazendo: { label: 'Fazendo', cls: 'bg-info/10 text-info border-info/30', Icon: CircleDot },
  feita: { label: 'Feita', cls: 'bg-success/10 text-success border-success/30', Icon: CheckCircle2 },
} as const
const COLUNAS: Tarefa['status'][] = ['aberta', 'fazendo', 'feita']

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function iniciais(nome: string | null) {
  return (nome || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

/** Chip de pessoa com iniciais, estilo avatar do ClickUp. */
function PessoaChip({ nome, mini }: { nome: string | null; mini?: boolean }) {
  if (!nome) return <span className="text-xs text-muted-foreground">sem dono</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`${mini ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'} rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0`}>
        {iniciais(nome)}
      </span>
      {!mini && <span className="text-sm">{nome.split(' ')[0]}</span>}
    </span>
  )
}

export default function Tarefas() {
  const { user, isAdmin } = useAuth() as any
  const qc = useQueryClient()
  const [sel, setSel] = useState<Selecao>({ tipo: 'visao', id: 'minhas' })
  const [modo, setModo] = useState<'lista' | 'quadro'>('lista')
  // filtro de dono e independente da pasta: da pra abrir um cliente e ver so
  // o que e seu, ou so o de uma pessoa. 'todos' nao filtra nada.
  const [filtroDono, setFiltroDono] = useState<'todos' | string>('todos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Tarefa | null>(null)
  const [form, setForm] = useState<FormTarefa>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [apagando, setApagando] = useState<Tarefa | null>(null)
  const [novaLista, setNovaLista] = useState(false)
  const [nomeLista, setNomeLista] = useState('')
  const [arrastando, setArrastando] = useState<string | null>(null)

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
  const { data: listas = [] } = useQuery({
    queryKey: ['tarefa-listas'],
    queryFn: async (): Promise<Lista[]> => {
      const { data } = await supabase.from('tarefa_listas').select('*').order('ordem')
      return (data || []) as Lista[]
    },
  })

  const hoje = hojeISO()
  const atrasada = (t: Tarefa) => t.status !== 'feita' && !!t.prazo && t.prazo < hoje
  const abertas = (lista: Tarefa[]) => lista.filter(t => t.status !== 'feita').length

  // contagem de abertas por agrupador, pro trilho lateral
  const porCliente = useMemo(() => {
    const m = new Map<string, number>()
    tarefas.forEach(t => { if (t.cliente_id && t.status !== 'feita') m.set(t.cliente_id, (m.get(t.cliente_id) || 0) + 1) })
    return m
  }, [tarefas])
  const porPessoa = useMemo(() => {
    const m = new Map<string, number>()
    tarefas.forEach(t => { if (t.dono_id && t.status !== 'feita') m.set(t.dono_id, (m.get(t.dono_id) || 0) + 1) })
    return m
  }, [tarefas])
  const porLista = useMemo(() => {
    const m = new Map<string, number>()
    tarefas.forEach(t => { if (t.lista_id && t.status !== 'feita') m.set(t.lista_id, (m.get(t.lista_id) || 0) + 1) })
    return m
  }, [tarefas])
  const nAtrasadas = tarefas.filter(atrasada).length
  const nMinhas = abertas(tarefas.filter(t => t.dono_id === user?.id))

  const filtradas = useMemo(() => {
    let lista = tarefas
    if (sel.tipo === 'visao') {
      if (sel.id === 'minhas') lista = lista.filter(t => t.dono_id === user?.id && t.status !== 'feita')
      if (sel.id === 'todas') lista = lista.filter(t => t.status !== 'feita')
      if (sel.id === 'atrasadas') lista = lista.filter(atrasada)
      if (sel.id === 'feitas') lista = lista.filter(t => t.status === 'feita')
    }
    if (sel.tipo === 'cliente') lista = lista.filter(t => t.cliente_id === sel.id)
    if (sel.tipo === 'pessoa') lista = lista.filter(t => t.dono_id === sel.id)
    if (sel.tipo === 'lista') lista = lista.filter(t => t.lista_id === sel.id)
    if (filtroDono !== 'todos') {
      lista = filtroDono === 'ninguem' ? lista.filter(t => !t.dono_id) : lista.filter(t => t.dono_id === filtroDono)
    }
    const q = busca.trim().toLowerCase()
    if (q) lista = lista.filter(t =>
      t.titulo.toLowerCase().includes(q) ||
      (t.cliente_nome || '').toLowerCase().includes(q) ||
      (t.dono_nome || '').toLowerCase().includes(q))
    return [...lista].sort((a, b) => {
      const at = atrasada(a) ? 0 : 1, bt = atrasada(b) ? 0 : 1
      if (at !== bt) return at - bt
      return (a.prazo || '9999').localeCompare(b.prazo || '9999')
    })
  }, [tarefas, sel, filtroDono, busca, user?.id])

  const tituloSelecao = (() => {
    if (sel.tipo === 'visao') return { minhas: 'Minhas tarefas', todas: 'Todas em aberto', atrasadas: 'Atrasadas', feitas: 'Feitas' }[sel.id]
    if (sel.tipo === 'cliente') return clientes.find(c => c.id === sel.id)?.name || 'Cliente'
    if (sel.tipo === 'pessoa') return pessoas.find(p => p.user_id === sel.id)?.name || 'Pessoa'
    return listas.find(l => l.id === sel.id)?.nome || 'Lista'
  })()

  function abrirNova() {
    setEditando(null)
    // a tarefa nova herda o contexto de onde voce esta, igual criar dentro de uma lista no ClickUp
    setForm({
      ...FORM_VAZIO,
      dono_id: sel.tipo === 'pessoa' ? sel.id : (user?.id || ''),
      cliente_id: sel.tipo === 'cliente' ? sel.id : '',
      lista_id: sel.tipo === 'lista' ? sel.id : '',
    })
    setAberto(true)
  }
  function abrirEdicao(t: Tarefa) {
    setEditando(t)
    setForm({
      titulo: t.titulo, descricao: t.descricao || '',
      cliente_id: t.cliente_id || '', dono_id: t.dono_id || '', lista_id: t.lista_id || '',
      prazo: t.prazo || '', prioridade: t.prioridade,
    })
    setAberto(true)
  }

  async function salvar() {
    if (!form.titulo.trim()) return toast.error('Dá um título pra tarefa')
    setSalvando(true)
    const cliente = clientes.find(c => c.id === form.cliente_id)
    const dono = pessoas.find(p => p.user_id === form.dono_id)
    const lst = listas.find(l => l.id === form.lista_id)
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      cliente_id: form.cliente_id || null,
      cliente_nome: cliente?.name || null,
      dono_id: form.dono_id || null,
      dono_nome: dono?.name || null,
      lista_id: form.lista_id || null,
      lista_nome: lst?.nome || null,
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

  async function moverStatus(id: string, status: Tarefa['status']) {
    const { error } = await supabase.from('tarefas').update({ status }).eq('id', id)
    if (error) return toast.error(`Não mudou: ${error.message}`)
    qc.invalidateQueries({ queryKey: ['tarefas'] })
  }
  async function avancarStatus(t: Tarefa) {
    const prox: Tarefa['status'] = t.status === 'aberta' ? 'fazendo' : t.status === 'fazendo' ? 'feita' : 'aberta'
    moverStatus(t.id, prox)
  }

  async function apagar() {
    if (!apagando) return
    const { error } = await supabase.from('tarefas').delete().eq('id', apagando.id)
    setApagando(null)
    if (error) return toast.error(`Não apagou: ${error.message}`)
    toast.success('Tarefa apagada')
    qc.invalidateQueries({ queryKey: ['tarefas'] })
  }

  async function criarLista() {
    if (!nomeLista.trim()) return toast.error('Dá um nome pra lista')
    const { error } = await supabase.from('tarefa_listas').insert({ nome: nomeLista.trim(), ordem: listas.length })
    if (error) return toast.error(`Não criou: ${error.message}`)
    toast.success('Lista criada')
    setNovaLista(false); setNomeLista('')
    qc.invalidateQueries({ queryKey: ['tarefa-listas'] })
  }

  const railItem = (ativo: boolean) =>
    `w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-left transition-colors ${
      ativo ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
    }`
  const railCount = (n: number) => n > 0 && (
    <span className="ml-auto text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full bg-muted text-muted-foreground flex items-center justify-center">{n}</span>
  )

  const cartao = (t: Tarefa) => {
    const tarde = atrasada(t)
    const cli = clientes.find(c => c.id === t.cliente_id)
    const medico = cli ? isClienteMedico(cli) : isClienteMedico({ name: t.cliente_nome, segment: null })
    return (
      <div key={t.id}
        draggable
        onDragStart={() => setArrastando(t.id)}
        onDragEnd={() => setArrastando(null)}
        className={`group rounded-lg border border-border bg-card p-3 space-y-2 cursor-grab active:cursor-grabbing hover:border-primary/30 ${arrastando === t.id ? 'opacity-40' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium leading-snug ${t.status === 'feita' ? 'line-through text-muted-foreground' : ''}`}>
            {t.prioridade === 'alta' && <span className="text-destructive mr-1">!</span>}{t.titulo}
          </p>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => abrirEdicao(t)}><Pencil className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setApagando(t)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
        {(t.cliente_nome || t.lista_nome) && (
          <p className={`text-xs ${medico ? 'text-info' : 'text-muted-foreground'}`}>{t.cliente_nome || t.lista_nome}</p>
        )}
        <div className="flex items-center justify-between">
          <PessoaChip nome={t.dono_nome} mini />
          {t.prazo ? (
            <span className={`text-xs flex items-center gap-1 ${tarde ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {tarde && <AlertTriangle className="h-3 w-3" />}{formatDate(t.prazo)}
            </span>
          ) : <span className="text-xs text-muted-foreground/50">sem prazo</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 animate-fade-in min-h-[calc(100vh-8rem)]">

      {/* ===== trilho lateral: pastas e listas, igual ClickUp ===== */}
      <aside className="w-56 shrink-0 hidden lg:flex flex-col gap-4">
        <Button size="sm" onClick={abrirNova} className="gap-2 w-full"><Plus className="h-4 w-4" /> Nova tarefa</Button>

        <div className="space-y-0.5">
          <button className={railItem(sel.tipo === 'visao' && sel.id === 'minhas')} onClick={() => setSel({ tipo: 'visao', id: 'minhas' })}>
            <Inbox className="h-4 w-4" /> Minhas {railCount(nMinhas)}
          </button>
          <button className={railItem(sel.tipo === 'visao' && sel.id === 'todas')} onClick={() => setSel({ tipo: 'visao', id: 'todas' })}>
            <LayoutList className="h-4 w-4" /> Todas {railCount(abertas(tarefas))}
          </button>
          <button className={railItem(sel.tipo === 'visao' && sel.id === 'atrasadas')} onClick={() => setSel({ tipo: 'visao', id: 'atrasadas' })}>
            <AlertTriangle className={`h-4 w-4 ${nAtrasadas > 0 ? 'text-destructive' : ''}`} /> Atrasadas {railCount(nAtrasadas)}
          </button>
          <button className={railItem(sel.tipo === 'visao' && sel.id === 'feitas')} onClick={() => setSel({ tipo: 'visao', id: 'feitas' })}>
            <CheckCircle2 className="h-4 w-4" /> Feitas
          </button>
        </div>

        <div>
          <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Folder className="h-3 w-3" /> Clientes
          </p>
          <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
            {clientes.filter(c => porCliente.has(c.id)).map(c => (
              <button key={c.id} className={railItem(sel.tipo === 'cliente' && sel.id === c.id)} onClick={() => setSel({ tipo: 'cliente', id: c.id })}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isClienteMedico(c) ? 'bg-info' : 'bg-primary'}`} />
                <span className="truncate">{c.name}</span> {railCount(porCliente.get(c.id) || 0)}
              </button>
            ))}
            {clientes.filter(c => porCliente.has(c.id)).length === 0 && (
              <p className="px-2.5 text-xs text-muted-foreground/60">nenhum cliente com tarefa</p>
            )}
          </div>
        </div>

        <div>
          <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Equipe
          </p>
          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            {pessoas.filter(p => porPessoa.has(p.user_id)).map(p => (
              <button key={p.user_id} className={railItem(sel.tipo === 'pessoa' && sel.id === p.user_id)} onClick={() => setSel({ tipo: 'pessoa', id: p.user_id })}>
                <User className="h-3.5 w-3.5" />
                <span className="truncate">{p.name.split(' ')[0]}{p.user_id === user?.id ? ' (você)' : ''}</span>
                {railCount(porPessoa.get(p.user_id) || 0)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Folder className="h-3 w-3" /> Listas
          </p>
          <div className="space-y-0.5">
            {listas.map(l => (
              <button key={l.id} className={railItem(sel.tipo === 'lista' && sel.id === l.id)} onClick={() => setSel({ tipo: 'lista', id: l.id })}>
                <span className="text-xs">{l.emoji}</span>
                <span className="truncate">{l.nome}</span> {railCount(porLista.get(l.id) || 0)}
              </button>
            ))}
            <button className={railItem(false)} onClick={() => setNovaLista(true)}>
              <ListPlus className="h-3.5 w-3.5" /> Nova lista
            </button>
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-border">
          {/* convite entra pelo fluxo que ja existe na Equipe */}
          <Link to="/team" className={railItem(false)}>
            <UserPlus className="h-4 w-4" /> Convidar pessoa
          </Link>
        </div>
      </aside>

      {/* ===== area principal ===== */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{tituloSelecao}</h1>
            <p className="text-sm text-muted-foreground">
              {filtradas.length} tarefa(s)
              {filtroDono !== 'todos' && ` de ${filtroDono === 'ninguem' ? 'ninguém' : filtroDono === user?.id ? 'você' : (pessoas.find(p => p.user_id === filtroDono)?.name.split(' ')[0] || '')}`}
              {nAtrasadas > 0 && sel.tipo === 'visao' && sel.id !== 'feitas' ? ` · ${nAtrasadas} atrasada(s) no time` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setModo('lista')} title="Ver como lista"
                className={`px-2.5 py-1.5 ${modo === 'lista' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/40'}`}>
                <LayoutList className="h-4 w-4" />
              </button>
              <button onClick={() => setModo('quadro')} title="Ver como quadro"
                className={`px-2.5 py-1.5 ${modo === 'quadro' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/40'}`}>
                <Kanban className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" onClick={abrirNova} className="gap-2 lg:hidden"><Plus className="h-4 w-4" /> Nova</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por título, cliente ou dono..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroDono} onValueChange={setFiltroDono}>
            <SelectTrigger className={`w-44 ${filtroDono !== 'todos' ? 'border-primary/40 text-primary' : ''}`}>
              <SelectValue placeholder="Dono" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo mundo</SelectItem>
              {user?.id && <SelectItem value={user.id}>Só as minhas</SelectItem>}
              {pessoas.filter(p => p.user_id !== user?.id).map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
              ))}
              <SelectItem value="ninguem">Sem dono</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-16">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            {tarefas.length === 0 ? 'Nenhuma tarefa ainda. Cria a primeira no botão Nova tarefa.' : 'Nada aqui com esses filtros.'}
          </p>
        ) : modo === 'quadro' ? (
          /* ===== quadro kanban: arrasta o cartao pra coluna ===== */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {COLUNAS.map(st => {
              const doStatus = filtradas.filter(t => t.status === st)
              const ui = STATUS_UI[st]
              return (
                <div key={st}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (arrastando) { moverStatus(arrastando, st); setArrastando(null) } }}
                  className="rounded-xl border border-border bg-muted/20 p-2.5 space-y-2 min-h-[200px]">
                  <div className="flex items-center gap-2 px-1">
                    <ui.Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{ui.label}</span>
                    <span className="text-xs text-muted-foreground/60 ml-auto">{doStatus.length}</span>
                  </div>
                  {doStatus.map(cartao)}
                </div>
              )
            })}
          </div>
        ) : (
          /* ===== lista agrupada ===== */
          <div className="rounded-xl border border-border overflow-hidden">
            {filtradas.map((t, i) => {
              const tarde = atrasada(t)
              const st = STATUS_UI[t.status]
              const cli = clientes.find(c => c.id === t.cliente_id)
              const medico = cli ? isClienteMedico(cli) : isClienteMedico({ name: t.cliente_nome, segment: null })
              return (
                <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <button onClick={() => avancarStatus(t)} title="Clique pra avançar o status" className="shrink-0">
                    <Badge variant="outline" className={`text-xs cursor-pointer ${st.cls}`}>
                      <st.Icon className="h-3 w-3 mr-1" />{st.label}
                    </Badge>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${t.status === 'feita' ? 'line-through text-muted-foreground' : ''}`}>
                      {t.prioridade === 'alta' && <span className="text-destructive mr-1">!</span>}{t.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      <span className={medico ? 'text-info' : ''}>{t.cliente_nome || t.lista_nome || 'sem lista'}</span>
                      {t.descricao && <span> · {t.descricao}</span>}
                    </p>
                  </div>
                  <div className="hidden sm:block shrink-0"><PessoaChip nome={t.dono_nome} /></div>
                  <div className="w-24 text-right shrink-0">
                    {t.prazo ? (
                      <span className={`text-xs inline-flex items-center gap-1 ${tarde ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {tarde && <AlertTriangle className="h-3 w-3" />}{formatDate(t.prazo)}
                      </span>
                    ) : <span className="text-xs text-muted-foreground/50">sem prazo</span>}
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEdicao(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setApagando(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== nova/editar tarefa ===== */}
      <Dialog open={aberto} onOpenChange={o => { setAberto(o); if (!o) setEditando(null) }}>
        <DialogContent className="sm:max-w-[540px]">
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
                    <SelectItem value="nenhum">Sem cliente</SelectItem>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id} className={isClienteMedico(c) ? 'text-info' : ''}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Lista</Label>
                <Select value={form.lista_id || 'nenhuma'} onValueChange={v => setForm(f => ({ ...f, lista_id: v === 'nenhuma' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Sem lista</SelectItem>
                    {listas.map(l => <SelectItem key={l.id} value={l.id}>{l.emoji} {l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
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

      {/* ===== nova lista ===== */}
      <Dialog open={novaLista} onOpenChange={setNovaLista}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Nova lista</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="nl-nome">Nome da lista</Label>
            <Input id="nl-nome" value={nomeLista} onChange={e => setNomeLista(e.target.value)} placeholder="Ex: CS Rotina, Mentoria..." maxLength={60}
              onKeyDown={e => e.key === 'Enter' && criarLista()} />
            <p className="text-xs text-muted-foreground">Clientes e pessoas já agrupam sozinhos nas pastas ao lado. Lista é pro que não é nem um nem outro.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaLista(false)}>Cancelar</Button>
            <Button onClick={criarLista}>Criar</Button>
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
