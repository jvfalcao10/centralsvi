import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, ExternalLink, Loader2, Power, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminPaineis() {
  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ['admin-paineis-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, slug, company, status, plano, mrr, painel_active, brand_color')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const [activatingId, setActivatingId] = useState<string | null>(null)

  async function activate(clientId: string) {
    setActivatingId(clientId)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/painel/clients/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ clientId }),
    })
    const data = await res.json()
    setActivatingId(null)
    if (!res.ok) {
      toast.error(data.message || data.error || 'Falha ao ativar painel')
      return
    }
    toast.success('Painel ativado. Convide o cliente abaixo.', { duration: 4500 })
    await refetch()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">SVI · Interno</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Painéis de Cliente</h1>
        <p className="text-muted-foreground mt-1">Ative o painel SVI OS pra cada cliente. Convide membros pra cada painel.</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="font-medium px-6 py-3">Cliente</th>
                <th className="font-medium px-6 py-3">Slug</th>
                <th className="font-medium px-6 py-3">Plano</th>
                <th className="font-medium px-6 py-3">Status</th>
                <th className="font-medium px-6 py-3 text-right">MRR</th>
                <th className="font-medium px-6 py-3 text-right">Painel</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="p-6"><Skeleton className="h-10 w-full" /></td></tr>
              )}
              {!isLoading && (clients ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Sem clientes cadastrados.</td></tr>
              )}
              {clients?.map((c: any) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-6 py-4">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.company}</div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">/{c.slug}</td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">{c.plano}</td>
                  <td className="px-6 py-4"><Badge variant={c.status === 'ativo' ? 'default' : 'secondary'}>{c.status}</Badge></td>
                  <td className="px-6 py-4 text-right tabular-nums">{Number(c.mrr).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-6 py-4 text-right">
                    {c.painel_active ? (
                      <div className="inline-flex items-center gap-2">
                        <InviteMemberDialog clientId={c.id} clientName={c.name} />
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/cliente/${c.slug}`}>Abrir <ExternalLink className="w-3 h-3 ml-1" /></Link>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => activate(c.id)}
                        disabled={activatingId === c.id}
                      >
                        {activatingId === c.id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Power className="w-3 h-3 mr-1" />
                        )}
                        {activatingId === c.id ? 'Ativando…' : 'Ativar painel'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function InviteMemberDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'client_admin' | 'client_user'>('client_admin')
  const [loading, setLoading] = useState(false)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/painel/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ clientId, email, role }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.message || data.error || 'Falha'); return }
    toast.success(`Convite enviado pra ${email}`)
    setEmail(''); setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><UserPlus className="w-3 h-3 mr-1" />Convidar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro do painel</DialogTitle>
          <DialogDescription>Vincula um email ao painel de {clientName}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={invite} className="space-y-3">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="dono@empresa.com" />
          </div>
          <div>
            <Label htmlFor="invite-role">Permissão</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client_admin">Admin do cliente</SelectItem>
                <SelectItem value="client_user">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !email}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
