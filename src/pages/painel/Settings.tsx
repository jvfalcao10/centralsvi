import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Copy, KeyRound, Loader2, MessageCircle, Plug, Building2, User,
  ShieldCheck, CheckCircle2, XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { usePainelContext } from '@/components/PainelLayout'

const PROVIDER_LABEL: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  kommo: 'Kommo CRM',
  whatsapp: 'WhatsApp (UazAPI)',
  google_analytics: 'Google Analytics',
  custom: 'Webhook personalizado',
}

export default function PainelSettings() {
  const { client, slug } = usePainelContext()
  const { isStaff } = useAuth()

  const { data: integrations, refetch } = useQuery({
    queryKey: ['painel-integrations', client.id],
    queryFn: async () => {
      const { data } = await supabase.from('painel_integrations')
        .select('id, provider, account_name, account_id, status, last_synced_at')
        .eq('client_id', client.id)
      return data ?? []
    },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Configurações</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">
          {isStaff ? 'Configurações do painel' : 'Minha conta'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isStaff
            ? 'Vista completa: cliente NÃO enxerga webhook nem credenciais técnicas.'
            : 'Suas informações e o status das integrações. Configurações técnicas ficam com a equipe SVI.'}
        </p>
      </div>

      <AccountCard />
      <CompanyCard clientId={client.id} />
      <IntegrationsStatusCard integrations={integrations ?? []} isStaff={!!isStaff} />

      {isStaff && (
        <>
          <Separator />
          <div className="flex items-center gap-2 pt-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Área técnica (visível só pra staff SVI)
            </h2>
          </div>
          <WebhookTokenCard slug={slug} />
          <WhatsAppCard slug={slug} integrations={integrations ?? []} onChanged={refetch} />
        </>
      )}
    </div>
  )
}

function AccountCard() {
  const { user, profile, signOut } = useAuth()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><User className="w-4 h-4" />Conta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Nome" value={profile?.name || '—'} />
        <Row label="Email" value={user?.email || '—'} />
        <p className="text-xs text-muted-foreground pt-2">
          Pra trocar senha: faça logout e use "Esqueci minha senha" na tela de login.
        </p>
        <div className="pt-3">
          <Button variant="outline" size="sm" onClick={signOut}>
            Sair da conta
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CompanyCard({ clientId }: { clientId: string }) {
  const { data } = useQuery({
    queryKey: ['painel-company', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('clients')
        .select('name, company, segment, plano, status, inicio_contrato')
        .eq('id', clientId).single()
      return data
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="w-4 h-4" />Empresa</CardTitle>
        <CardDescription>Dados gerenciados pela equipe SVI. Pra alterar, fale com seu gestor pela aba "Falar com SVI".</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Razão / nome" value={data?.name || '—'} />
        <Row label="Empresa" value={data?.company || '—'} />
        <Row label="Segmento" value={data?.segment || '—'} />
        <Row label="Plano" value={data?.plano || '—'} />
        <Row label="Cliente desde" value={data?.inicio_contrato ? new Date(data.inicio_contrato).toLocaleDateString('pt-BR') : '—'} />
        <Row label="Status" value={<Badge variant={data?.status === 'ativo' ? 'default' : 'secondary'}>{data?.status || '—'}</Badge>} />
      </CardContent>
    </Card>
  )
}

function IntegrationsStatusCard({ integrations, isStaff }: { integrations: any[]; isStaff: boolean }) {
  const available = ['meta_ads', 'google_ads', 'whatsapp', 'google_analytics', 'kommo']
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Plug className="w-4 h-4" />Integrações</CardTitle>
        <CardDescription>
          {isStaff
            ? 'Status pra esse cliente. Configure abaixo nas seções técnicas.'
            : 'O que está conectado hoje no seu painel. Quer ativar mais? Peça pra equipe SVI pela aba "Falar com SVI".'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {available.map(p => {
          const c = integrations.find(i => i.provider === p)
          const isConnected = c?.status === 'connected'
          return (
            <div key={p} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                  isConnected ? 'bg-emerald-100 dark:bg-emerald-950/30' : 'bg-muted'
                }`}>
                  {isConnected
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    : <XCircle className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{PROVIDER_LABEL[p]}</div>
                  {c?.account_name && isStaff && (
                    <div className="text-xs text-muted-foreground truncate">{c.account_name}</div>
                  )}
                </div>
              </div>
              <Badge variant={isConnected ? 'default' : 'secondary'} className="shrink-0">
                {isConnected ? 'Conectado' : 'Não conectado'}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

// ============================================================================
// STAFF-ONLY (técnico — esconde do role 'client')
// ============================================================================

function WebhookTokenCard({ slug }: { slug: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function rotate() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/painel/webhook-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ clientSlug: slug }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.message || data.error || 'Falha ao gerar token'); return }
    setToken(data.token)
    toast.success('Token gerado. Salve agora — não aparece de novo.')
  }

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success('Copiado') }

  const curlExample = token ? `curl -X POST ${baseUrl}/api/painel/leads/inbound \\
  -H "Content-Type: application/json" \\
  -H "X-Org-Slug: ${slug}" \\
  -H "X-Org-Token: ${token}" \\
  -d '{"full_name":"Maria Silva","phone":"+5594...","source":"instagram-ads"}'` : null

  return (
    <Card className="border-amber-300/40 dark:border-amber-800/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Webhook de leads</CardTitle>
        <CardDescription>
          Endpoint pra Meta Ads, n8n, formulários do site. Configure n8n/Meta pelo cliente — token aparece UMA vez.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted">
          <code className="text-xs font-mono truncate flex-1">POST {baseUrl}/api/painel/leads/inbound</code>
          <Button type="button" size="sm" variant="ghost" onClick={() => copy(`${baseUrl}/api/painel/leads/inbound`)}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>

        {token ? (
          <>
            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="text-xs text-foreground mb-2 font-medium">Token (só aparece UMA vez):</div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono truncate flex-1 select-all">{token}</code>
                <Button type="button" size="sm" variant="ghost" onClick={() => copy(token)}><Copy className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            {curlExample && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">Exemplo (curl)</summary>
                <pre className="mt-2 p-3 rounded-md bg-foreground text-background overflow-x-auto font-mono text-xs">{curlExample}</pre>
              </details>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum token gerado nesta sessão.</p>
        )}

        <Button type="button" variant="outline" onClick={rotate} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
          {token ? 'Rotacionar token' : 'Gerar token'}
        </Button>
      </CardContent>
    </Card>
  )
}

function WhatsAppCard({ slug, integrations, onChanged }: { slug: string; integrations: any[]; onChanged: () => void }) {
  const existing = integrations.find((i) => i.provider === 'whatsapp')
  const [baseUrl, setBaseUrl] = useState('')
  const [instanceToken, setInstanceToken] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/painel/integrations/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ clientSlug: slug, base_url: baseUrl, instance_token: instanceToken }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.message || data.error || 'Falha ao salvar'); return }
    setToken(data.token)
    toast.success('UazAPI configurada. Webhook token gerado.')
    onChanged()
  }

  return (
    <Card className="border-amber-300/40 dark:border-amber-800/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageCircle className="w-4 h-4" />WhatsApp / UazAPI</CardTitle>
        <CardDescription>
          {existing
            ? `Conectado: ${existing.account_name}. Preencha pra reconfigurar.`
            : 'Configure a instância UazAPI pra IA SDR atender WhatsApp dos leads.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label htmlFor="uaz-url">URL da instância UazAPI</Label>
            <Input id="uaz-url" placeholder="https://api.uazapi.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="uaz-token">Token da instância</Label>
            <Input id="uaz-token" type="password" placeholder="ya29...." value={instanceToken} onChange={(e) => setInstanceToken(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {existing ? 'Reconfigurar' : 'Salvar e gerar webhook'}
          </Button>
        </form>

        {token && (
          <div className="mt-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
            <div className="text-xs font-medium">Configure este Webhook URL na UazAPI:</div>
            <code className="block text-xs font-mono break-all select-all">
              {appOrigin}/api/painel/whatsapp/{slug}?token={token}
            </code>
            <p className="text-xs text-muted-foreground">Salve agora — token não aparece de novo.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
