import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Network, Plus, Search, MoreVertical, Copy, Pencil, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { errorMessage } from '@/lib/data-access'
import {
  PASTAS_MAPA, formatarBrasilia, gerarSlug, markdownInicial, rotuloPasta, trocarTituloNoMarkdown, type MapaMental,
} from '@/lib/mapas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import DataLoadError from '@/components/DataLoadError'

type MapaResumo = Omit<MapaMental, 'markdown'>
const OUTRA = '__outra__'
const TODAS = '__todas__'

interface Formulario {
  modo: 'novo' | 'renomear'
  id?: string
  titulo: string
  pasta: string
  pastaNova: string
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Slug único: se já existe, numera. */
async function slugLivre(base: string) {
  const { data, error } = await supabase.from('mapas_mentais').select('slug').like('slug', `${base}%`)
  if (error) throw new Error(error.message)
  const usados = new Set((data || []).map(r => r.slug as string))
  if (!usados.has(base)) return base
  for (let n = 2; n < 1000; n++) if (!usados.has(`${base}-${n}`)) return `${base}-${n}`
  return `${base}-${Date.now()}`
}

export default function Mapas() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [pasta, setPasta] = useState(TODAS)
  const [form, setForm] = useState<Formulario | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [apagando, setApagando] = useState<MapaResumo | null>(null)
  const [duplicando, setDuplicando] = useState<string | null>(null)

  const { data: mapas, isLoading, error, refetch } = useQuery({
    queryKey: ['mapas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapas_mentais')
        .select('id, titulo, slug, pasta, criado_por, atualizado_por, created_at, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data || []) as MapaResumo[]
    },
  })

  const { data: nomes } = useQuery({
    queryKey: ['perfis-nomes'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, name')
      return new Map((data || []).map(p => [p.user_id as string, p.name as string]))
    },
  })

  const pastasConhecidas = useMemo(() => {
    const extras = new Set<string>()
    for (const m of mapas || []) if (!PASTAS_MAPA.some(p => p.valor === m.pasta)) extras.add(m.pasta)
    return [...PASTAS_MAPA.map(p => p.valor), ...[...extras].sort()]
  }, [mapas])

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim())
    return (mapas || []).filter(m => (pasta === TODAS || m.pasta === pasta) && (!q || normalizar(m.titulo).includes(q)))
  }, [mapas, busca, pasta])

  function abrirNovo() {
    setForm({ modo: 'novo', titulo: '', pasta: pasta === TODAS ? 'geral' : pasta, pastaNova: '' })
  }

  function abrirRenomear(m: MapaResumo) {
    setForm({ modo: 'renomear', id: m.id, titulo: m.titulo, pasta: m.pasta, pastaNova: '' })
  }

  function pastaDoForm(f: Formulario) {
    return f.pasta === OUTRA ? gerarSlug(f.pastaNova) : f.pasta
  }

  async function confirmarForm() {
    if (!form) return
    const titulo = form.titulo.trim()
    if (!titulo) { toast.error('Falta o título.'); return }
    if (form.pasta === OUTRA && !form.pastaNova.trim()) { toast.error('Dá um nome pra pasta.'); return }
    const pastaFinal = pastaDoForm(form)
    setSalvando(true)
    try {
      if (form.modo === 'novo') {
        const slug = await slugLivre(gerarSlug(titulo))
        const { data, error } = await supabase
          .from('mapas_mentais')
          .insert({ titulo, slug, pasta: pastaFinal, markdown: markdownInicial(titulo), criado_por: user?.id ?? null, atualizado_por: user?.id ?? null })
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        toast.success('Mapa criado.')
        setForm(null)
        qc.invalidateQueries({ queryKey: ['mapas'] })
        navigate(`/mapas/${data.id}`)
        return
      }
      const { data: atual, error: erroLeitura } = await supabase.from('mapas_mentais').select('markdown').eq('id', form.id!).single()
      if (erroLeitura) throw new Error(erroLeitura.message)
      const { error } = await supabase
        .from('mapas_mentais')
        .update({ titulo, pasta: pastaFinal, markdown: trocarTituloNoMarkdown(atual.markdown as string, titulo), atualizado_por: user?.id ?? null })
        .eq('id', form.id!)
      if (error) throw new Error(error.message)
      toast.success('Mapa renomeado.')
      setForm(null)
      qc.invalidateQueries({ queryKey: ['mapas'] })
      qc.invalidateQueries({ queryKey: ['mapa', form.id] })
    } catch (e) {
      toast.error(`Não deu: ${errorMessage(e)}`)
    } finally {
      setSalvando(false)
    }
  }

  async function duplicar(m: MapaResumo) {
    setDuplicando(m.id)
    try {
      const { data: orig, error: erroLeitura } = await supabase.from('mapas_mentais').select('*').eq('id', m.id).single()
      if (erroLeitura) throw new Error(erroLeitura.message)
      const titulo = `${orig.titulo} (cópia)`
      const slug = await slugLivre(`${orig.slug}-copia`)
      const { data, error } = await supabase
        .from('mapas_mentais')
        .insert({ titulo, slug, pasta: orig.pasta, markdown: trocarTituloNoMarkdown(orig.markdown as string, titulo), criado_por: user?.id ?? null, atualizado_por: user?.id ?? null })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      toast.success('Cópia criada.')
      qc.invalidateQueries({ queryKey: ['mapas'] })
      navigate(`/mapas/${data.id}`)
    } catch (e) {
      toast.error(`Não duplicou: ${errorMessage(e)}`)
    } finally {
      setDuplicando(null)
    }
  }

  async function apagar() {
    if (!apagando) return
    const alvo = apagando
    setApagando(null)
    const { error } = await supabase.from('mapas_mentais').delete().eq('id', alvo.id)
    if (error) { toast.error(`Não apagou: ${error.message}`); return }
    toast.success('Mapa apagado.')
    qc.invalidateQueries({ queryKey: ['mapas'] })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Network className="h-5 w-5 text-primary" /> Mapas</h1>
          <p className="text-sm text-muted-foreground mt-1">Mapas mentais da equipe: reunião, estudo e carteira. Todo mundo da casa edita.</p>
        </div>
        <Button onClick={abrirNovo} className="w-full sm:w-auto h-11 sm:h-9"><Plus className="h-4 w-4 mr-1" /> Novo mapa</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título" className="pl-9" aria-label="Buscar mapa" />
        </div>
        <Select value={pasta} onValueChange={setPasta}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por pasta"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as pastas</SelectItem>
            {pastasConhecidas.map(p => <SelectItem key={p} value={p}>{rotuloPasta(p)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : error ? (
        <DataLoadError onRetry={() => refetch()} />
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {(mapas || []).length === 0 ? 'Nenhum mapa ainda. Crie o primeiro.' : 'Nenhum mapa com esse filtro.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map(m => (
            <Card key={m.id} className="group">
              <CardContent className="p-4 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Link to={`/mapas/${m.id}`} className="font-medium hover:text-primary line-clamp-2 break-words">{m.titulo}</Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{rotuloPasta(m.pasta)}</Badge>
                    <span>
                      Atualizado {formatarBrasilia(m.updated_at)}
                      {m.atualizado_por && nomes?.get(m.atualizado_por) ? ` por ${nomes.get(m.atualizado_por)}` : ''}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 shrink-0" aria-label={`Ações de ${m.titulo}`}>
                      {duplicando === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => duplicar(m)}><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => abrirRenomear(m)}><Pencil className="h-4 w-4 mr-2" /> Renomear</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setApagando(m)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Apagar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={aberto => { if (!aberto) setForm(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.modo === 'novo' ? 'Novo mapa' : 'Renomear mapa'}</DialogTitle>
            <DialogDescription>{form?.modo === 'novo' ? 'O título vira a raiz do mapa.' : 'O título da raiz muda junto. O link do Obsidian continua o mesmo.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mapa-titulo">Título</Label>
              <Input id="mapa-titulo" autoFocus value={form?.titulo ?? ''} onChange={e => setForm(f => f ? { ...f, titulo: e.target.value } : f)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarForm() } }} placeholder="Reunião com o Dr. Brenno" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mapa-pasta">Pasta</Label>
              <Select value={form?.pasta ?? 'geral'} onValueChange={v => setForm(f => f ? { ...f, pasta: v } : f)}>
                <SelectTrigger id="mapa-pasta" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pastasConhecidas.map(p => <SelectItem key={p} value={p}>{rotuloPasta(p)}</SelectItem>)}
                  <SelectItem value={OUTRA}>Outra pasta...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form?.pasta === OUTRA && (
              <div className="space-y-1.5">
                <Label htmlFor="mapa-pasta-nova">Nome da pasta nova</Label>
                <Input id="mapa-pasta-nova" value={form.pastaNova} onChange={e => setForm(f => f ? { ...f, pastaNova: e.target.value } : f)} placeholder="ex.: vendas" />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setForm(null)}>Cancelar</Button>
            <Button className="w-full sm:w-auto" onClick={confirmarForm} disabled={salvando}>
              {salvando ? 'Salvando...' : form?.modo === 'novo' ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apagando} onOpenChange={aberto => { if (!aberto) setApagando(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este mapa?</AlertDialogTitle>
            <AlertDialogDescription>Some pra todo mundo. Não dá pra desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={apagar}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
