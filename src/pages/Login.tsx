import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, User, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import logoBranca from '@/assets/logo-branca.png'

type Mode = 'login' | 'signup' | 'forgot'

export default function Login() {
  const { user, loading, isClient, isStaff, signupStatus } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const initialMode = (searchParams.get('mode') === 'signup' ? 'signup' : 'login') as Mode
  const initialEmail = searchParams.get('email') || ''
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<Mode>(initialMode)

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail)
    if (searchParams.get('mode') === 'signup') setMode('signup')
  }, [initialEmail, searchParams])

  if (!loading && user) {
    if (isClient) return <Navigate to="/minha-area" replace />
    if (isStaff) return <Navigate to="/dashboard" replace />
    if (signupStatus) return <Navigate to="/pending-approval" replace />
    // usuário autenticado sem role e sem signup_request — caso residual
    return <Navigate to="/pending-approval" replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Tradução amigável + dica para quem foi convidado mas ainda não criou conta
      const isInvalidCreds = (error.message || '').toLowerCase().includes('invalid login')
      if (isInvalidCreds && email.trim()) {
        // Verifica se há invitation pendente para este email — se sim, oferece criar conta
        const { data: invite } = await supabase
          .from('invitations')
          .select('id, role')
          .eq('email', email.trim().toLowerCase())
          .eq('accepted', false)
          .maybeSingle()

        if (invite) {
          toast({
            title: 'Você foi convidado, mas ainda não criou sua conta',
            description: 'Clique em "Criar conta" acima — seu email já está pré-preenchido. Defina uma senha e seu acesso é liberado automaticamente.',
            variant: 'destructive',
          })
          setMode('signup')
          setIsLoading(false)
          return
        }

        toast({
          title: 'Email ou senha incorretos',
          description: 'Confira seus dados. Se esqueceu a senha, use "Esqueci minha senha" abaixo.',
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' })
      }
    }
    setIsLoading(false)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) {
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' })
      setIsLoading(false)
      return
    }

    // Se sessão já está ativa (sem confirmação de email), tenta aplicar invitation
    // imediatamente — fallback caso o trigger Postgres não tenha rodado.
    if (data.session) {
      const { data: claimedRole } = await supabase.rpc('claim_my_invitation')
      if (claimedRole) {
        toast({
          title: 'Conta ativada!',
          description: `Acesso liberado como ${claimedRole}. Redirecionando...`,
        })
        // AuthContext detecta a sessão e faz hydrate; redirect acontece via Navigate
        return
      }
    }

    toast({
      title: 'Conta criada!',
      description: 'Verifique seu email para confirmar o cadastro.',
    })
    setMode('login')
    setIsLoading(false)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada.' })
      setMode('login')
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted opacity-80" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img src={logoBranca} alt="SVI Command Center" className="h-14 mb-4 dark:block hidden" />
            <img src={logoBranca} alt="SVI Command Center" className="h-14 mb-4 dark:hidden block" style={{ filter: 'invert(1) sepia(1) saturate(2) hue-rotate(5deg)' }} />
            <h1 className="text-xl font-bold text-foreground">Command Center</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === 'forgot' ? 'Recupere sua senha' : mode === 'signup' ? 'Crie sua conta' : 'Acesse sua conta'}
            </p>
          </div>

          {/* Login / Signup tabs */}
          {mode !== 'forgot' && (
            <div className="flex rounded-lg bg-muted p-1 mb-6">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  mode === 'login'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  mode === 'signup'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Criar conta
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Voltar ao login
              </button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Criando conta...' : 'Criar conta'}
              </Button>
            </form>
          )}
        </div>

        {mode === 'login' && (
          <Link
            to="/client-signup"
            className="mt-4 block bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl p-4 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Sou cliente SVI.Co</div>
                <div className="text-xs text-muted-foreground">Solicitar acesso ao painel de conteúdo</div>
              </div>
              <div className="text-primary group-hover:translate-x-0.5 transition-transform">→</div>
            </div>
          </Link>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          SVI Command Center © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
