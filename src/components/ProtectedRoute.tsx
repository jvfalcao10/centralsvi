import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth, UserRole } from '@/contexts/AuthContext'
import { ShieldAlert, Home, LogOut, Send, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

interface Props {
  children: React.ReactNode
  requiredRole?: UserRole
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, profile, role, loading, can, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [requested, setRequested] = useState(false)
  const [sending, setSending] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  async function requestAccess() {
    setSending(true)
    const pageName = location.pathname.replace('/', '') || 'página'
    const { error } = await supabase.from('notifications').insert({
      user_id: null, // global — qualquer admin vê
      title: 'Solicitação de acesso',
      message: `${profile?.name || user.email} (${role || 'executor'}) solicitou acesso a /${pageName} (nível necessário: ${requiredRole})`,
      type: 'warning',
      link: '/team',
    })
    setSending(false)
    if (error) {
      toast({ title: 'Erro ao enviar solicitação', description: error.message, variant: 'destructive' })
      return
    }
    setRequested(true)
    toast({ title: 'Solicitação enviada', description: 'Um administrador foi notificado.' })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (requiredRole && !can(requiredRole)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold">Acesso Negado</h2>
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
            {role && (
              <p className="text-xs text-muted-foreground">
                Seu nível atual: <span className="font-medium capitalize text-foreground">{role}</span>
                {' · '}
                Necessário: <span className="font-medium capitalize text-foreground">{requiredRole}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="flex-1">
              <Home className="h-4 w-4 mr-2" /> Voltar
            </Button>

            {!requested ? (
              <Button onClick={requestAccess} disabled={sending} className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Enviando...' : 'Solicitar Acesso'}
              </Button>
            ) : (
              <Button variant="secondary" disabled className="flex-1">
                <Check className="h-4 w-4 mr-2" /> Solicitação Enviada
              </Button>
            )}

            <Button variant="ghost" onClick={handleSignOut} className="flex-1">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-4">
            Logado como <span className="font-medium text-foreground">{profile?.name || user.email}</span>
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
