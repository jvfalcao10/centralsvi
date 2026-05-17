import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bot, Plus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/painel/format'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, type LeadStatus } from '@/lib/painel/types'
import { usePainelContext } from '@/components/PainelLayout'

export default function PainelLeads() {
  const { client, slug } = usePainelContext()

  const { data: leads, isLoading } = useQuery({
    queryKey: ['painel-leads', client.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('painel_leads')
        .select('id, full_name, email, phone, status, source, score, estimated_value_brl, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(100)
      return data ?? []
    },
  })

  const isEmpty = !isLoading && (leads ?? []).length === 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">CRM</p>
          <h1 className="text-3xl font-semibold tracking-tighter mt-1">Leads</h1>
          <p className="text-muted-foreground mt-1">Pipeline em tempo real. IA SDR pode atender por você.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/cliente/${slug}/chat?scope=sdr_agent`}>
              <Bot className="w-4 h-4 mr-2" />IA SDR
            </Link>
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />Novo lead
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-0">
          <Skeleton className="h-12 w-full rounded-none" />
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-none border-t" />)}
        </CardContent></Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Ainda sem leads</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Conecte uma fonte de tráfego (Meta Ads, Google Ads ou formulário no site) pra começar a receber leads aqui.
            </p>
            <div className="mt-6">
              <Link to={`/cliente/${slug}/settings`}><Button>Conectar uma fonte</Button></Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="font-medium px-6 py-3">Lead</th>
                  <th className="font-medium px-6 py-3">Status</th>
                  <th className="font-medium px-6 py-3">Origem</th>
                  <th className="font-medium px-6 py-3 text-right">Valor estimado</th>
                  <th className="font-medium px-6 py-3 text-right">Score</th>
                  <th className="font-medium px-6 py-3 text-right">Criado</th>
                </tr>
              </thead>
              <tbody>
                {leads?.map((l: any) => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">{l.full_name}</div>
                      <div className="text-xs text-muted-foreground">{l.email || l.phone || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={LEAD_STATUS_COLORS[l.status as LeadStatus] || ''} variant="outline">
                        {LEAD_STATUS_LABELS[l.status as LeadStatus] || l.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{l.source || '—'}</td>
                    <td className="px-6 py-4 text-right tabular-nums">{l.estimated_value_brl ? formatCurrency(Number(l.estimated_value_brl)) : '—'}</td>
                    <td className="px-6 py-4 text-right tabular-nums">{l.score ?? 0}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground text-xs">{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
