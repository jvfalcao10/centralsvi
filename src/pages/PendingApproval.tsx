import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Clock, CheckCircle2, XCircle, LogOut, RefreshCw, Mail, Instagram, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import logoBranca from '@/assets/logo-branca.png'

interface SignupReq {
  name: string
  company: string
  email: string
  phone: string | null
  instagram: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
  reviewed_at: string | null
}

export default function PendingApproval() {
  const { user, role, signupStatus, isClient, isStaff, loading, signOut, refresh } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [req, setReq] = useState<SignupReq | null>(null)
  const [reloading, setReloading] = useState(false)
  const [hasInvitation, setHasInvitation] = useState<boolean | null>(null)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (user) {
      loadRequest()
      checkInvitation()
    }
  }, [user])

  // Auto-tentativa de claim quando o usuário caiu aqui sem role e sem signup_request
  useEffect(() => {
    if (user && !role && !signupStatus && !req && hasInvitation === true) {
      tryClaim(true) // silent
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, signupStatus, req, hasInvitation])

  async function loadRequest() {
    if (!user) return
    const { data } = await supabase
      .from('client_signup_requests')
      .select('name, company, email, phone, instagram, status, rejection_reason, created_at, reviewed_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) setReq(data as SignupReq)
  }

  async function checkInvitation() {
    if (!user?.email) return
    const { data } = await supabase
      .from('invitations')
      .select('id')
      .ilike('email', user.email.trim())
      .eq('accepted', false)
      .maybeSingle()
    setHasInvitation(!!data)
  }

  async function tryClaim(silent = false) {
    setClaiming(true)
    const { data, error } = await supabase.rpc('claim_my_invitation')
    setClaiming(false)
    if (error) {
      if (!silent) toast({ title: 'Erro ao ativar', description: error.message, variant: 'destructive' })
      return
    }
    if (data) {
      toast({ title: 'Conta ativada!', description: `Acesso liberado como ${data}. Redirecionando...` })
      await refresh()
    } else if (!silent) {
      toast({
        title: 'Convite não encontrado',
        description: 'Não há convite pendente para este email. Peça para um admin enviar novo convite ou verificar o email exato cadastrado.',
        variant: 'destructive',
      })
    }
  }

  async function handleRefresh() {
    setReloading(true)
    await refresh()
    await loadRequest()
    setReloading(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (loading) return null

  // Se já é cliente aprovado ou staff, redireciona
  if (isClient) return <Navigate to="/minha-area" replace />
  if (isStaff) return <Navigate to="/dashboard" replace />

  if (!user) return <Navigate to="/login" replace />

  const status = req?.status || signupStatus

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <img src={logoBranca} alt="SVI.Co" className="h-12 mx-auto object-contain" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
          {!status && hasInvitation === true && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Ativando sua conta...</h2>
                <p className="text-sm text-muted-foreground">
                  Você foi convidado pela equipe SVI. Estamos aplicando o seu nível de acesso agora.
                </p>
              </div>
              <Button onClick={() => tryClaim(false)} disabled={claiming} className="w-full">
                {claiming ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Ativando...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Ativar minha conta agora</>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground pt-1">
                Se não funcionar, peça pro admin verificar se o email do convite bate com {user?.email}.
              </p>
            </>
          )}

          {!status && hasInvitation === false && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                <LogOut className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Conta sem acesso configurado</h2>
                <p className="text-sm text-muted-foreground">
                  Você está logado mas não tem convite pendente nem solicitação de acesso de cliente.
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                  Se você é da equipe SVI, peça pro admin enviar um novo convite para <strong>{user?.email}</strong>.
                  Se você é cliente, faça logout e use <strong>Sou cliente SVI.Co</strong> na tela de login.
                </p>
              </div>
              <Button onClick={handleSignOut} className="w-full">
                <LogOut className="h-4 w-4 mr-2" /> Fazer logout
              </Button>
            </>
          )}

          {!status && hasInvitation === null && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}

          {status === 'pending' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-warning/10 flex items-center justify-center animate-pulse">
                <Clock className="h-8 w-8 text-warning" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Aguardando aprovação</h2>
                <p className="text-sm text-muted-foreground">
                  Seu cadastro foi recebido e está sob análise da equipe SVI.Co.
                  Você receberá um email assim que for aprovado.
                </p>
              </div>
            </>
          )}

          {status === 'approved' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Cadastro aprovado!</h2>
                <p className="text-sm text-muted-foreground">
                  Tudo certo. Recarregue a página para acessar seu painel.
                </p>
              </div>
              <Button onClick={handleRefresh} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" /> Entrar no painel
              </Button>
            </>
          )}

          {status === 'rejected' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Cadastro não aprovado</h2>
                <p className="text-sm text-muted-foreground">
                  Seu cadastro não foi aprovado neste momento.
                </p>
                {req?.rejection_reason && (
                  <p className="text-sm bg-destructive/5 border border-destructive/20 rounded-md p-3 text-foreground mt-3">
                    {req.rejection_reason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground pt-2">
                  Entre em contato com a equipe SVI.Co para mais informações.
                </p>
              </div>
            </>
          )}

          {req && (
            <div className="pt-2 border-t border-border space-y-2 text-sm">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Dados da solicitação</div>
              <div className="space-y-1">
                <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{req.name}</span></div>
                <div><span className="text-muted-foreground">Empresa:</span> <span className="font-medium">{req.company}</span></div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" /> {req.email}
                </div>
                {req.instagram && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Instagram className="h-3 w-3" /> {req.instagram}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleRefresh} disabled={reloading} className="flex-1">
              <RefreshCw className={`h-4 w-4 mr-2 ${reloading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Button variant="ghost" onClick={handleSignOut} className="flex-1">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Precisa de ajuda?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">Voltar ao login</Link>
        </p>
      </div>
    </div>
  )
}
