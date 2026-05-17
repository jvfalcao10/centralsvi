import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserPlus, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/painel/format'

type Member = {
  user_id: string
  role: 'client_admin' | 'client_user'
  profile?: { name: string | null; email: string | null } | null
}

export function TeamCard({ clientId, slug, isAdmin }: {
  clientId: string; slug: string; isAdmin: boolean
}) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const { data: members, isLoading } = useQuery({
    queryKey: ['painel-team', clientId],
    queryFn: async (): Promise<Member[]> => {
      const { data } = await supabase
        .from('painel_members')
        .select('user_id, role, profile:user_id(name, email)')
        .eq('client_id', clientId)
      return (data as any) || []
    },
  })

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/painel/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ clientId, email: email.trim(), role: 'client_user' }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) {
      toast.error(data.message || data.error || 'Falha ao convidar')
      return
    }
    toast.success(`Convite enviado pra ${email}`)
    setEmail('')
    qc.invalidateQueries({ queryKey: ['painel-team', clientId] })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Sua equipe</CardTitle>
        <CardDescription>
          Quem tem acesso ao painel da sua empresa.
          {isAdmin ? ' Você pode convidar mais pessoas.' : ' Pra adicionar alguém, peça pro admin do seu painel.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (members ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Você é a única pessoa com acesso.</p>
        ) : (
          <div className="space-y-2">
            {members?.map((m) => {
              const name = m.profile?.name || m.profile?.email || '—'
              return (
                <div key={m.user_id} className="flex items-center gap-3 py-1.5">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.profile?.name || '—'}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.profile?.email}</div>
                  </div>
                  <Badge variant={m.role === 'client_admin' ? 'default' : 'secondary'}>
                    {m.role === 'client_admin' ? 'Admin' : 'Usuário'}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={invite} className="border-t pt-4 space-y-3">
            <div>
              <Label htmlFor="invite-email" className="flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" />Convidar nova pessoa
              </Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Vai receber email da Supabase pra definir senha. Acesso é só como usuário (não admin).
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pessoa@empresa.com"
                  className="flex-1"
                />
                <Button type="submit" disabled={sending || !email.trim()}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
