import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, User, Building2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import logoBranca from '@/assets/logo-branca.png'

export default function ClientSignup() {
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!loading && user && !submitted) return <Navigate to="/pending-approval" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !company.trim() || !email.trim() || password.length < 6) {
      toast({ title: 'Dados incompletos', description: 'Preencha nome, empresa, email e senha (mín. 6 caracteres).', variant: 'destructive' })
      return
    }
    setIsLoading(true)

    // 1. Cria auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim(), signup_type: 'client' },
        emailRedirectTo: `${window.location.origin}/pending-approval`,
      },
    })

    if (signUpError) {
      setIsLoading(false)
      toast({ title: 'Erro ao criar conta', description: signUpError.message, variant: 'destructive' })
      return
    }

    const newUserId = signUpData.user?.id
    if (!newUserId) {
      setIsLoading(false)
      toast({ title: 'Erro inesperado', description: 'Usuário não foi criado.', variant: 'destructive' })
      return
    }

    // 2. Cria signup request (pending)
    const { error: reqError } = await supabase.from('client_signup_requests').insert({
      user_id: newUserId,
      email: email.trim(),
      name: name.trim(),
      company: company.trim(),
    })

    setIsLoading(false)

    if (reqError) {
      toast({ title: 'Erro ao enviar solicitação', description: reqError.message, variant: 'destructive' })
      return
    }

    setSubmitted(true)
    toast({ title: 'Solicitação enviada!', description: 'A equipe SVI analisará seu cadastro em breve.' })

    // Se a sessão já estiver ativa (sem confirmação de email), redireciona
    setTimeout(() => {
      if (signUpData.session) navigate('/pending-approval', { replace: true })
    }, 1500)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6 bg-card border border-border rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Solicitação recebida</h2>
            <p className="text-sm text-muted-foreground">
              Sua conta foi criada e está aguardando aprovação da equipe SVI.Co.
              Você receberá um email quando seu acesso for liberado.
            </p>
          </div>
          <div className="text-xs text-muted-foreground pt-2">
            Se confirmação de email for exigida, verifique sua caixa de entrada antes.
          </div>
          <Button asChild className="w-full">
            <Link to="/login">Ir para login</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-3">
          <img src={logoBranca} alt="SVI.Co" className="h-12 mx-auto object-contain" />
          <div>
            <h1 className="text-2xl font-bold">Solicitar acesso ao painel</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Já é cliente SVI.Co? Crie sua conta — nossa equipe aprova em até 24h úteis.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="pl-9" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Empresa / Marca *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Nome da empresa" className="pl-9" required />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="pl-9" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha * <span className="text-xs text-muted-foreground font-normal">(mín. 6 caracteres)</span></Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password" type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className="pl-9 pr-10" required minLength={6}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Enviando...' : 'Solicitar acesso'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
