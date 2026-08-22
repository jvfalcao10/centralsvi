import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Copy, Check, Search, KeyRound, Loader2, ExternalLink, AlertTriangle, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface Cred {
  id: string
  cliente: string
  servico: string
  login: string | null
  senha: string | null
  url: string | null
  obs: string | null
  atualizado_em: string
}

const FORM_VAZIO = { cliente: '', servico: 'instagram', login: '', senha: '', url: '', obs: '' }
type FormCred = typeof FORM_VAZIO

export default function Senhas() {
  const { toast } = useToast()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [visivel, setVisivel] = useState<Record<string, boolean>>({})
  const [copiado, setCopiado] = useState<string | null>(null)

  // Cadastro e edicao manual. Antes a tela era so leitura e a senha tinha que
  // ser digitada direto no banco, entao ficava faltando e ninguem completava.
  const [editando, setEditando] = useState<Cred | null>(null)
  const [form, setForm] = useState<FormCred>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [apagando, setApagando] = useState<Cred | null>(null)

  const abrirNova = () => {
    setEditando(null)
    setForm(FORM_VAZIO)
    setAberto(true)
  }

  const abrirEdicao = (c: Cred) => {
    setEditando(c)
    setForm({
      cliente: c.cliente,
      servico: c.servico || 'instagram',
      login: c.login || '',
      senha: c.senha || '',
      url: c.url || '',
      obs: c.obs || '',
    })
    setAberto(true)
  }

  const salvar = async () => {
    if (!form.cliente.trim()) {
      toast({ title: 'Falta o cliente', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const payload = {
      cliente: form.cliente.trim(),
      servico: form.servico.trim() || 'instagram',
      login: form.login.trim() || null,
      senha: form.senha.trim() || null,
      url: form.url.trim() || null,
      obs: form.obs.trim() || null,
      atualizado_em: new Date().toISOString(),
      atualizado_por: profile?.name || null,
    }
    const { error } = editando
      ? await supabase.from('client_credentials').update(payload).eq('id', editando.id)
      : await supabase.from('client_credentials').insert(payload)
    setSalvando(false)
    if (error) {
      toast({ title: 'Não consegui salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editando ? 'Credencial atualizada' : 'Credencial cadastrada' })
    setAberto(false)
    setEditando(null)
    qc.invalidateQueries({ queryKey: ['client-credentials'] })
  }

  const apagar = async () => {
    if (!apagando) return
    const { error } = await supabase.from('client_credentials').delete().eq('id', apagando.id)
    setApagando(null)
    if (error) {
      toast({ title: 'Não consegui excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Credencial excluída' })
    qc.invalidateQueries({ queryKey: ['client-credentials'] })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['client-credentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_credentials')
        .select('*')
        .order('cliente')
      if (error) throw error
      return (data || []) as Cred[]
    },
  })

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return data || []
    return (data || []).filter(c =>
      c.cliente.toLowerCase().includes(t) ||
      (c.login || '').toLowerCase().includes(t) ||
      c.servico.toLowerCase().includes(t),
    )
  }, [data, q])

  const copiar = async (texto: string, id: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(id)
      setTimeout(() => setCopiado(null), 1500)
    } catch {
      toast({ title: 'Não consegui copiar', variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const semSenha = (data || []).filter(c => !c.senha).length

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Senhas dos clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acesso interno da equipe. Cliente nunca enxerga esta página. Também dá pra perguntar pra Sofia no WhatsApp.
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={abrirNova}>
          <Plus className="h-4 w-4" /> Nova senha
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, @ ou serviço…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {semSenha > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {semSenha} cliente(s) ainda sem senha cadastrada.
        </div>
      )}

      <div className="space-y-2">
        {filtrados.map(c => {
          const revelado = !!visivel[c.id]
          return (
            <Card key={c.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{c.cliente}</p>
                    <Badge variant="outline" className="capitalize text-[10px]">{c.servico}</Badge>
                  </div>
                  {c.login && (
                    <a
                      href={c.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-0.5"
                    >
                      {c.login} <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                  {c.obs && <p className="text-[11px] text-amber-600 mt-1">{c.obs}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <code
                    className={cn(
                      'px-3 py-2 rounded-md bg-muted/50 border border-border text-sm font-mono min-w-[150px] text-center select-all',
                      !c.senha && 'text-muted-foreground italic',
                    )}
                  >
                    {c.senha ? (revelado ? c.senha : '•'.repeat(Math.min(c.senha.length, 12))) : 'sem senha'}
                  </code>
                  {c.senha && (
                    <>
                      <button
                        onClick={() => setVisivel(v => ({ ...v, [c.id]: !v[c.id] }))}
                        className="p-2 rounded-md border border-border hover:bg-accent transition-colors"
                        title={revelado ? 'Ocultar' : 'Revelar'}
                      >
                        {revelado ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => copiar(c.senha as string, c.id)}
                        className="p-2 rounded-md border border-border hover:bg-accent transition-colors"
                        title="Copiar"
                      >
                        {copiado === c.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => abrirEdicao(c)}
                    className={cn(
                      'p-2 rounded-md border transition-colors',
                      c.senha
                        ? 'border-border hover:bg-accent'
                        : 'border-primary/40 text-primary hover:bg-primary/10',
                    )}
                    title={c.senha ? 'Editar' : 'Cadastrar senha'}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setApagando(c)}
                    className="p-2 rounded-md border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum resultado para "{q}".</p>
        )}
      </div>

      {/* Cadastrar ou editar credencial */}
      <Dialog open={aberto} onOpenChange={o => { setAberto(o); if (!o) setEditando(null) }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar · ${editando.cliente}` : 'Nova credencial'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sn-cliente">Cliente <span className="text-destructive">*</span></Label>
                <Input
                  id="sn-cliente"
                  value={form.cliente}
                  onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))}
                  placeholder="Nome do cliente"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sn-servico">Serviço</Label>
                <Input
                  id="sn-servico"
                  value={form.servico}
                  onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                  placeholder="instagram, google, meta…"
                  maxLength={40}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sn-login">Login ou @</Label>
              <Input
                id="sn-login"
                value={form.login}
                onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                placeholder="@perfil ou e-mail"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sn-senha">Senha</Label>
              <Input
                id="sn-senha"
                value={form.senha}
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                placeholder="cole ou digite aqui"
                maxLength={200}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio se ainda não tiver. O cliente continua na lista marcado como sem senha.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sn-url">Link de acesso</Label>
              <Input
                id="sn-url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://…"
                maxLength={300}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sn-obs">Observação</Label>
              <Textarea
                id="sn-obs"
                value={form.obs}
                onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
                placeholder="Ex: tem 2FA no celular do cliente, senha rotacionada em 08/26…"
                rows={2}
                maxLength={300}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusao */}
      <AlertDialog open={!!apagando} onOpenChange={o => !o && setApagando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir credencial?</AlertDialogTitle>
            <AlertDialogDescription>
              {apagando && `${apagando.cliente} · ${apagando.servico} será removido do cofre. A conta do cliente não é afetada, some só o registro aqui.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={apagar} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
