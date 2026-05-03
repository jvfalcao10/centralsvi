import { useEffect, useState, useCallback } from 'react'
import { Users, Shield, Crown, Crosshair, Wrench, UserCog, UserPlus, Mail, Clock, Copy, Check, Trash2, User, Search, Activity, X } from 'lucide-react'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'

interface TeamMember {
  user_id: string
  name: string
  email: string | null
  role: UserRole
  created_at: string
  last_activity_at: string | null
}

interface ActivityEntry {
  action: string
  entity_type: string
  entity_name: string | null
  created_at: string
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'Sem atividade'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days < 0) return 'Agora'
  if (days === 0) {
    const hours = Math.floor(diffMs / 3600000)
    if (hours === 0) return 'Há minutos'
    return `Há ${hours}h`
  }
  if (days === 1) return 'Ontem'
  if (days < 7) return `Há ${days} dias`
  if (days < 30) return `Há ${Math.floor(days / 7)} sem`
  if (days < 365) return `Há ${Math.floor(days / 30)} mês`
  const years = Math.floor(days / 365)
  return `Há ${years} ano${years > 1 ? 's' : ''}`
}

function activityStaleness(dateStr: string | null): 'active' | 'recent' | 'stale' | 'inactive' {
  if (!dateStr) return 'inactive'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days <= 1) return 'active'
  if (days <= 7) return 'recent'
  if (days <= 30) return 'stale'
  return 'inactive'
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

  // Search + filter
  const [searchStaff, setSearchStaff] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [searchClients, setSearchClients] = useState('')

  // Member detail drawer
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [memberActivities, setMemberActivities] = useState<ActivityEntry[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [profilesRes, rolesRes, invitesRes, activityRes] = await Promise.all([
      supabase.from('profiles').select('user_id, name, created_at').order('created_at', { ascending: true }),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('activity_log').select('user_id, created_at').order('created_at', { ascending: false }).limit(500),
    ])

    const profiles = profilesRes.data || []
    const roles = rolesRes.data || []
    const invites = invitesRes.data || []
    const activities = activityRes.data || []

    const roleMap = new Map<string, UserRole>()
    roles.forEach((r: any) => {
      const existing = roleMap.get(r.user_id)
      if (!existing || roleRank(r.role) > roleRank(existing)) {
        roleMap.set(r.user_id, r.role)
      }
    })

    // Já vem ordenado desc, primeiro hit por user_id é a última atividade
    const lastActivityMap = new Map<string, string>()
    activities.forEach((a: any) => {
      if (a.user_id && !lastActivityMap.has(a.user_id)) {
        lastActivityMap.set(a.user_id, a.created_at)
      }
    })

    // Filtra perfis órfãos (sem role) — usuários cujas roles foram revogadas
    // permanecem em profiles (RLS de profiles não permite DELETE), mas não devem
    // aparecer na Equipe pois não têm acesso real ao sistema.
    const merged: TeamMember[] = profiles
      .filter((p: any) => roleMap.has(p.user_id))
      .map((p: any) => ({
        user_id: p.user_id,
        name: p.name || 'Sem nome',
        email: null,
        role: roleMap.get(p.user_id) || 'user',
        created_at: p.created_at,
        last_activity_at: lastActivityMap.get(p.user_id) || null,
      }))

    setMembers(merged)
    setInvitations(invites)
    setLoading(false)
  }, [])

  async function openMemberDetail(member: TeamMember) {
    setSelectedMember(member)
    setActivitiesLoading(true)
    const { data } = await supabase
      .from('activity_log')
      .select('action, entity_type, entity_name, created_at')
      .eq('user_id', member.user_id)
      .order('created_at', { ascending: false })
      .limit(15)
    setMemberActivities(data || [])
    setActivitiesLoading(false)
  }

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

    setRemoving(false)

    if (rolesError) {
      toast({
        title: 'Erro ao remover membro',
        description: rolesError.message,
        variant: 'destructive',
      })
      return
    }

    toast({
      title: 'Acesso revogado',
      description: `${memberToRemove.name} não tem mais permissão para acessar o sistema.`,
    })
    setMemberToRemove(null)
    fetchData()
  }

  function copyInviteLink() {
    const url = inviteEmail.trim() ? buildSignupLink(inviteEmail.trim()) : `${window.location.origin}/login`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast({ title: 'Link copiado!', description: 'Envie este link para a pessoa convidada.' })
    setTimeout(() => setCopied(false), 2000)
  }

  const STAFF_ROLES: UserRole[] = ['admin', 'manager', 'seller', 'executor', 'user']
  const staffMembersAll = members.filter(m => STAFF_ROLES.includes(m.role))
  const clientMembersAll = members.filter(m => m.role === 'client')

  const staffMembers = staffMembersAll.filter(m => {
    if (roleFilter !== 'all' && m.role !== roleFilter) return false
    if (searchStaff.trim()) {
      return m.name.toLowerCase().includes(searchStaff.trim().toLowerCase())
    }
    return true
  })
  const clientMembers = clientMembersAll.filter(c => {
    if (searchClients.trim()) {
      return c.name.toLowerCase().includes(searchClients.trim().toLowerCase())
    }
    return true
  })
  const pendingInvites = invitations.filter(i => !i.accepted)
  const acceptedInvites = invitations.filter(i => i.accepted)

  function buildSignupLink(email: string) {
    return `${window.location.origin}/login?mode=signup&email=${encodeURIComponent(email)}`
  }

  async function copyInviteLinkFor(email: string, inviteId: string) {
    await navigator.clipboard.writeText(buildSignupLink(email))
    toast({
      title: 'Link copiado!',
      description: `Envie para ${email}. O email já vai pré-preenchido na tela de cadastro.`,
    })
  }

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

      {/* Tabs: Staff / Clients / Pending / Accepted */}
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Time SVI ({staffMembersAll.length})</TabsTrigger>
          <TabsTrigger value="clients">Clientes ({clientMembersAll.length})</TabsTrigger>
          <TabsTrigger value="pending">Convites Pendentes ({pendingInvites.length})</TabsTrigger>
          <TabsTrigger value="accepted">Histórico ({acceptedInvites.length})</TabsTrigger>
        </TabsList>

        {/* Members */}
        <TabsContent value="members">
          {/* Search + role filter */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchStaff}
                onChange={e => setSearchStaff(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | 'all')}>
              <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="Todas as roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="seller">Vendedor</SelectItem>
                <SelectItem value="executor">Executor</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border bg-card">
            <CardContent className="p-0">
              {staffMembers.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum membro encontrado com esses filtros</p>
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Role Atual</TableHead>
                    <TableHead>Alterar Role</TableHead>
                    <TableHead>Última atividade</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-20 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffMembers.map(m => {
                    const config = getRoleConfig(m.role)
                    const isCurrentUser = m.user_id === currentUser?.id
                    const initials = m.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    const staleness = activityStaleness(m.last_activity_at)
                    const stalenessClass = {
                      active: 'text-success',
                      recent: 'text-foreground',
                      stale: 'text-warning',
                      inactive: 'text-muted-foreground italic',
                    }[staleness]
                    return (
                      <TableRow key={m.user_id} className="cursor-pointer hover:bg-accent/30" onClick={() => openMemberDetail(m)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm hover:text-primary transition-colors">{m.name}</p>
                              {isCurrentUser && <p className="text-xs text-muted-foreground">(você)</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={config.className}>{config.label}</Badge></TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
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
                        <TableCell className={`text-xs ${stalenessClass}`}>
                          {formatRelative(m.last_activity_at)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clients */}
        <TabsContent value="clients">
          {clientMembersAll.length > 0 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={searchClients}
                onChange={e => setSearchClients(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          <Card className="border-border bg-card">
            <CardContent className="p-0">
              {clientMembersAll.length === 0 ? (
                <div className="p-8 text-center">
                  <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum cliente externo aprovado ainda</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clientes que solicitam acesso aparecem em <span className="font-medium">Aprovações</span> antes de chegar aqui.
                  </p>
                </div>
              ) : clientMembers.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Última atividade</TableHead>
                      <TableHead>Aprovado em</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientMembers.map(c => {
                      const initials = c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                      const staleness = activityStaleness(c.last_activity_at)
                      const stalenessClass = {
                        active: 'text-success',
                        recent: 'text-foreground',
                        stale: 'text-warning',
                        inactive: 'text-muted-foreground italic',
                      }[staleness]
                      return (
                        <TableRow key={c.user_id} className="cursor-pointer hover:bg-accent/30" onClick={() => openMemberDetail(c)}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-xs font-bold">{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm hover:text-primary transition-colors">{c.name}</p>
                                <Badge variant="outline" className={getRoleConfig('client').className + ' mt-0.5'}>
                                  Cliente externo
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={`text-xs ${stalenessClass}`}>
                            {formatRelative(c.last_activity_at)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setMemberToRemove(c)}
                              title="Revogar acesso do cliente"
                            >
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
                      <TableHead className="w-32 text-right">Ações</TableHead>
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
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => copyInviteLinkFor(inv.email, inv.id)}
                                title="Copiar link de cadastro (email pré-preenchido)"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteInvite(inv.id)}
                                title="Remover convite"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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
                  value={inviteEmail.trim() ? buildSignupLink(inviteEmail.trim()) : `${window.location.origin}/login`}
                  className="text-xs h-8 bg-background"
                />
                <Button size="sm" variant="outline" onClick={copyInviteLink} disabled={!inviteEmail.trim()}>
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

      {/* Member detail drawer */}
      <Sheet open={!!selectedMember} onOpenChange={(open) => { if (!open) { setSelectedMember(null); setMemberActivities([]) } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedMember && (() => {
            const config = getRoleConfig(selectedMember.role)
            const Icon = config.icon
            const initials = selectedMember.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
            const isClient = selectedMember.role === 'client'
            return (
              <>
                <SheetHeader className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className={isClient ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'bg-primary/20 text-primary font-bold'}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <SheetTitle className="text-left">{selectedMember.name}</SheetTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={config.className}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <SheetDescription className="text-left">
                    {config.description}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Última atividade
                      </p>
                      <p className="text-sm font-medium">{formatRelative(selectedMember.last_activity_at)}</p>
                    </div>
                    <div className="bg-muted/30 border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Cadastrado em
                      </p>
                      <p className="text-sm font-medium">{new Date(selectedMember.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" /> Atividade recente
                    </h3>
                    {activitiesLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </div>
                    ) : memberActivities.length === 0 ? (
                      <div className="bg-muted/20 border border-dashed border-border rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">Sem registros de atividade</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {memberActivities.map((a, i) => (
                          <div key={i} className="flex items-start gap-3 text-xs border-l-2 border-primary/30 pl-3 py-1">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">
                                <span className="text-primary">{a.action}</span>
                                {' · '}
                                <span className="text-muted-foreground">{a.entity_type}</span>
                              </p>
                              {a.entity_name && <p className="text-muted-foreground truncate">{a.entity_name}</p>}
                            </div>
                            <p className="text-muted-foreground shrink-0">{formatRelative(a.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {selectedMember.user_id !== currentUser?.id && (
                    <div className="pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => {
                          setMemberToRemove(selectedMember)
                          setSelectedMember(null)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revogar acesso
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* Remove member confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar acesso de {memberToRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a role do usuário imediatamente. Ele deixa de aparecer na Equipe e perde acesso ao sistema.
              O perfil em si fica preservado para auditoria. Para reativar, basta atribuir uma nova role via convite.
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
