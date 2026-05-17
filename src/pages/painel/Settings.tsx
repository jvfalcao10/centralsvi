import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, KeyRound, Loader2, MessageCircle, Plug } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { usePainelContext } from '@/components/PainelLayout'

const PROVIDER_LABEL: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  kommo: 'Kommo CRM',
  whatsapp: 'WhatsApp (UazAPI)',
  google_analytics: 'Google Analytics',
}

export default function PainelSettings() {
  const { client, slug } = usePainelContext()

  const { data: integrations, refetch } = useQuery({
    queryKey: ['painel-integrations', client.id],
    queryFn: async () => {
      const { data } = await supabase.from('painel_integrations')
        .select('id, provider, account_name, status, last_synced_at')
        .eq('client_id', client.id)
      return data ?? []
    },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Configurações</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Integrações</h1>
        <p className="text-muted-foreground mt-1">Conecte suas plataformas para que a IA enxergue tudo em um só lugar.</p>
      </div>

      <WebhookTokenCard slug={slug} />

      <WhatsAppCard slug={slug} integrations={integrations ?? []} onChanged={refetch} />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-8">Em breve</h2>
        {['meta_ads', 'google_ads', 'kommo', 'google_analytics'].map((p) => {
          const conn = integrations?.find((i: any) => i.provider === p)
          return (
            <Card key={p}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Plug className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{PROVIDER_LABEL[p]}</div>
                    <div className="text-xs text-muted-foreground truncate">{conn?.account_name || 'Em breve'}</div>
                  </div>
                </div>
                <Badge variant="secondary">Em breve</Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

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
    toast.success('Token gerado. Salve agora.')
  }

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success('Copiado') }

  const curlExample = token ? `curl -X POST ${baseUrl}/api/painel/leads/inbound \\
  -H "Content-Type: application/json" \\
  -H "X-Org-Slug: ${slug}" \\
  -H "X-Org-Token: ${token}" \\
  -d '{"full_name":"Maria Silva","phone":"+5594...","source":"instagram-ads"}'` : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Webhook de leads</CardTitle>
        <CardDescription>
          Endpoint pra receber leads de Meta Ads, n8n, formulários do site. Token nas requests via header <code className="font-mono text-xs px-1 py-0.5 bg-muted rounded">X-Org-Token</code>.
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
              <div className="text-xs text-foreground mb-2 font-medium">Seu token (só aparece UMA vez):</div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono truncate flex-1 select-all">{token}</code>
                <Button type="button" size="sm" variant="ghost" onClick={() => copy(token)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {curlExample && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">Exemplo de uso (curl)</summary>
                <pre className="mt-2 p-3 rounded-md bg-foreground text-background overflow-x-auto font-mono text-xs">{curlExample}</pre>
              </details>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum token ativo nesta sessão. Gere um.</p>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageCircle className="w-4 h-4" />WhatsApp (UazAPI) — IA SDR</CardTitle>
        <CardDescription>
          {existing
            ? 'IA SDR está respondendo leads WhatsApp automaticamente.'
            : 'Conecte sua instância UazAPI pra que a IA SDR atenda WhatsApp dos seus leads.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {existing && !token ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2"><Badge>Conectado</Badge><span className="text-sm text-muted-foreground">{existing.account_name}</span></div>
            <p className="text-xs text-muted-foreground">Pra reconfigurar ou rotacionar o token, preencha de novo abaixo.</p>
          </div>
        ) : null}
        <form onSubmit={save} className="space-y-3 mt-3">
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
            {existing ? 'Reconfigurar e rotacionar token' : 'Salvar e gerar webhook'}
          </Button>
        </form>

        {token && (
          <div className="mt-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
            <div className="text-xs font-medium">Configure este Webhook URL na UazAPI:</div>
            <code className="block text-xs font-mono break-all select-all">
              {appOrigin}/api/painel/whatsapp/{slug}?token={token}
            </code>
            <p className="text-xs text-muted-foreground">Salve agora — o token não será mostrado de novo.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
