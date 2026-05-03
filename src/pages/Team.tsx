import { useEffect, useState, useCallback } from 'react'
import { Users, Shield, Crown, Crosshair, Wrench, UserCog, UserPlus, Mail, Clock, Copy, Check, Trash2, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth, UserRole } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface TeamMember {
  user_id: string
  name: string
  email: string | null
  role: UserRole
  created_at: string
}

interface Invitation {
  id: string
  email: string
  role: UserRole
  accepted: boolean
  accepted_at: string | null
  invited_by_name: string | null
  created_at: string
}

const ROLE_CONFIG: Record<UserRole, { label: string; description: string; icon: any; className: string }> = {
  admin: { label: 'Admin', description: 'Acesso total ao sistema', icon: Crown, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  manager: { label: 'Gestor', description: 'Pipeline + Clientes + Onboarding + Financeiro', icon: Shield, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  seller: { label: 'Vendedor', description: 'Prospecção + Scripts + Pipeline', icon: Crosshair, className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  executor: { label: 'Executor', description: 'Entregas + Scripts (apenas próprias)', icon: Wrench, className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  client: { label: 'Cliente', description: 'Acesso ao painel de conteúdo (cliente externo)', icon: User, className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  user: { label: 'Usuário', description: 'Acesso básico', icon: UserCog, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

const FALLBACK_CONFIG = ROLE_CONFIG.user
const getRoleConfig = (role: UserRole | string | null | undefined) =>
  (role && ROLE_CONFIG[role as UserRole]) || FALLBACK_CONFIG

export default function Team() {
  const { toast } = useToast()
  const { user: currentUser, profile } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('executor')
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Remove member dialog
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [removing, setRemoving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [profilesRes, rolesRes, invitesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, name, created_at').order('created_at', { ascending: true }),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
    ])

    const profiles = profilesRes.data || []
    const roles = rolesRes.data || []
    const invites = invitesRes.data || []

    const roleMap = new Map<string, UserRole>()
    roles.forEach((r: any) => {
      const existing = roleMap.get(r.user_id)
      if (!existing || roleRank(r.role) > roleRank(existing)) {
        roleMap.set(r.user_id, r.role)
      }
    })

    const merged: TeamMember[] = profiles.map((p: any) => ({
      user_id: p.user_id,
      name: p.name || 'Sem nome',
      email: null,
      role: roleMap.get(p.user_id) || 'executor',
      created_at: p.created_at,
    }))

    setMembers(merged)
    setInvitations(invites)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function roleRank(r: UserRole): number {
    return { admin: 4, manager: 3, seller: 2, executor: 1, user: 0 }[r] ?? 0
  }

  async function updateRole(userId: string, newRole: UserRole) {
    await supabase.from('user_roles').delete().eq('user_id', userId)
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole })
    if (error) {
      toast({ title: 'Erro ao atualizar role', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Role atualizada' })
    fetchData()
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)

    const { error } = await supabase.from('invitations').insert({
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: currentUser?.id,
      invited_by_name: profile?.name || currentUser?.email,
    })

    setInviting(false)

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        toast({ title: 'Convite já enviado', description: 'Este email já foi convidado anteriormente.', variant: 'destructive' })
      } else {
        toast({ title: 'Erro ao enviar convite', description: error.message, variant: 'destructive' })
      }
      return
    }

    toast({
      title: 'Convite criado!',
      description: `${inviteEmail} receberá o acesso como ${ROLE_CONFIG[inviteRole].label} quando se cadastrar.`,
    })
    setInviteEmail('')
    setInviteRole('executor')
    fetchData()
  }

  async function deleteInvite(id: string) {
    await supabase.from('invitations').delete().eq('id', id)
    toast({ title: 'Convite removido' })
    fetchData()
  }

  async function removeMember() {
    if (!memberToRemove) return
    if (memberToRemove.user_id === currentUser?.id) {
      toast({ title: 'Não é possível remover você mesmo', variant: 'destructive' })
      setMemberToRemove(null)
      return
    }
    setRemoving(true)

    const { error: rolesError } = await supabase.from('user_roles').delete().eq('user_id', memberToRemove.user_id)
    const { error: profileError } = await supabase.from('profiles').delete().eq('user_id', memberToRemove.user_id)

    setRemoving(false)

    if (rolesError || profileError) {
      toast({
        title: 'Erro ao remover membro',
        description: rolesError?.message || profileError?.message,
        variant: 'destructive',
      })
      return
    }

    toast({
      title: 'Membro removido',
      description: `${memberToRemove.name} perdeu o acesso ao sistema.`,
    })
    setMemberToRemove(null)
    fetchData()
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/login`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast({ title: 'Link copiado!', description: 'Envie este link para a pessoa convidada.' })
    setTimeout(() => setCopied(false), 2000)
  }

  const pendingInvites = invitations.filter(i => !i.accepted)
  const acceptedInvites = invitations.filter(i => i.accepted)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Invite button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-sm text-muted-foreground">Gerencie usuários e envie convites</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Convidar Membro
        </Button>
      </div>

      {/* Role reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(['admin', 'manager', 'seller', 'executor'] as UserRole[]).map(r => {
          const config = ROLE_CONFIG[r]
          const Icon = config.icon
          return (
            <Card key={r} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <Badge variant="outline" className={config.className}>{config.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs: Members / Pending / Accepted */}
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Membros ({members.length})</TabsTrigger>
          <TabsTrigger value="pending">Convites Pendentes ({pendingInvites.length})</TabsTrigger>
          <TabsTrigger value="accepted">Histórico ({acceptedInvites.length})</TabsTrigger>
        </TabsList>

        {/* Members */}
        <TabsContent value="members">
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Role Atual</TableHead>
                    <TableHead>Alterar Role</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-20 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => {
                    const config = getRoleConfig(m.role)
                    const isCurrentUser = m.user_id === currentUser?.id
                    const initials = m.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    return (
                      <TableRow key={m.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{m.name}</p>
                              {isCurrentUser && <p className="text-xs text-muted-foreground">(você)</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={config.className}>{config.label}</Badge></TableCell>
                        <TableCell>
                          <Select value={m.role} onValueChange={(v: UserRole) => updateRole(m.user_id, v)} disabled={isCurrentUser}>
                            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Gestor</SelectItem>
                              <SelectItem value="seller">Vendedor</SelectItem>
                              <SelectItem value="executor">Executor</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive disabled:opacity-30"
                            onClick={() => setMemberToRemove(m)}
                            disabled={isCurrentUser}
                            title={isCurrentUser ? 'Você não pode remover a si mesmo' : 'Remover membro'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Invites */}
        <TabsContent value="pending">
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              {pendingInvites.length === 0 ? (
                <div className="p-8 text-center">
                  <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum convite pendente</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role Atribuída</TableHead>
                      <TableHead>Convidado por</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvites.map(inv => {
                      const config = getRoleConfig(inv.role)
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="text-sm">{inv.email}</TableCell>
                          <TableCell><Badge variant="outline" className={config.className}>{config.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{inv.invited_by_name || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteInvite(inv.id)} title="Remover convite">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accepted History */}
        <TabsContent value="accepted">
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              {acceptedInvites.length === 0 ? (
                <div className="p-8 text-center">
                  <Check className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum convite aceito ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Aceito em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acceptedInvites.map(inv => {
                      const config = getRoleConfig(inv.role)
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="text-sm">{inv.email}</TableCell>
                          <TableCell><Badge variant="outline" className={config.className}>{config.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.accepted_at ? new Date(inv.accepted_at).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Envie um convite. A pessoa se cadastra com o email convidado e automaticamente recebe o nível de acesso que você definiu.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="nome@exemplo.com"
              />
            </div>

            <div>
              <Label>Nível de acesso</Label>
              <Select value={inviteRole} onValueChange={(v: UserRole) => setInviteRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-400" /> Admin — Acesso total
                    </div>
                  </SelectItem>
                  <SelectItem value="manager">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-blue-400" /> Gestor — Pipeline, Clientes, Financeiro
                    </div>
                  </SelectItem>
                  <SelectItem value="seller">
                    <div className="flex items-center gap-2">
                      <Crosshair className="h-3.5 w-3.5 text-purple-400" /> Vendedor — Prospecção, Scripts
                    </div>
                  </SelectItem>
                  <SelectItem value="executor">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 text-green-400" /> Executor — Entregas, Scripts
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Como funciona:
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 ml-5 list-decimal">
                <li>Envie o link abaixo para a pessoa</li>
                <li>Ela se cadastra usando o email convidado</li>
                <li>O sistema aplica automaticamente o nível de acesso</li>
              </ol>

              <div className="flex items-center gap-2 mt-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/login`}
                  className="text-xs h-8 bg-background"
                />
                <Button size="sm" variant="outline" onClick={copyInviteLink}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={sendInvite} disabled={!inviteEmail.trim() || inviting}>
              {inviting ? 'Criando...' : 'Criar Convite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {memberToRemove?.name} da equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação revoga o acesso ao sistema imediatamente. O perfil e a role são apagados — o usuário não conseguirá mais entrar.
              Para reativar, será necessário um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); removeMember() }}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? 'Removendo...' : 'Remover acesso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
