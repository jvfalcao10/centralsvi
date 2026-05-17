import { useQuery } from '@tanstack/react-query'
import { DollarSign, Calendar, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/painel/format'
import { usePainelContext } from '@/components/PainelLayout'

export default function PainelFinanceiro() {
  const { client } = usePainelContext()

  const { data, isLoading } = useQuery({
    queryKey: ['painel-financeiro', client.id],
    queryFn: async () => {
      const [{ data: clientFull }, { data: invoices }] = await Promise.all([
        supabase.from('clients').select('plano, mrr, status, inicio_contrato').eq('id', client.id).single(),
        supabase.from('invoices').select('id, amount, due_date, paid_at, status, description, created_at')
          .eq('client_id', client.id).order('due_date', { ascending: false }).limit(24),
      ])
      return { clientFull, invoices: invoices || [] }
    },
  })

  const c: any = data?.clientFull
  const invoices = data?.invoices || []
  const next = invoices.find((i: any) => !i.paid_at && new Date(i.due_date) >= new Date())
  const overdue = invoices.filter((i: any) => !i.paid_at && new Date(i.due_date) < new Date())
  const paid = invoices.filter((i: any) => i.paid_at)
  const totalPaid = paid.reduce((s: number, i: any) => s + Number(i.amount || 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Financeiro</p>
        <h1 className="text-3xl font-semibold tracking-tighter mt-1">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Histórico de pagamentos, próxima fatura e detalhes do contrato.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">MRR atual</div>
              <div className="text-3xl font-semibold tracking-tighter mt-2 tabular-nums">
                {c?.mrr ? formatCurrency(Number(c.mrr)) : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-2 capitalize">Plano: {c?.plano || '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Próxima fatura</div>
              {next ? (
                <>
                  <div className="text-3xl font-semibold tracking-tighter mt-2 tabular-nums">{formatCurrency(Number(next.amount || 0))}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Vence em {new Date(next.due_date).toLocaleDateString('pt-BR')}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-semibold tracking-tighter mt-2 text-muted-foreground">—</div>
                  <div className="text-xs text-muted-foreground mt-2">Sem fatura aberta</div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total pago</div>
              <div className="text-3xl font-semibold tracking-tighter mt-2 tabular-nums">{formatCurrency(totalPaid)}</div>
              <div className="text-xs text-muted-foreground mt-2">{paid.length} faturas</div>
            </CardContent>
          </Card>
        </div>
      )}

      {overdue.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-destructive">
                {overdue.length} {overdue.length === 1 ? 'fatura em atraso' : 'faturas em atraso'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {formatCurrency(overdue.reduce((s: number, i: any) => s + Number(i.amount || 0), 0))}.
                Entre em contato com a SVI pra regularizar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de faturas</CardTitle>
          <CardDescription>Últimas 24 faturas do seu contrato.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <DollarSign className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Sem faturas registradas.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="font-medium px-6 py-3">Descrição</th>
                  <th className="font-medium px-6 py-3">Vencimento</th>
                  <th className="font-medium px-6 py-3">Status</th>
                  <th className="font-medium px-6 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const isPaid = !!inv.paid_at
                  const isOverdue = !isPaid && new Date(inv.due_date) < new Date()
                  return (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="px-6 py-4">
                        <div className="font-medium">{inv.description || 'Mensalidade'}</div>
                        {inv.paid_at && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Pago em {new Date(inv.paid_at).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(inv.due_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        {isPaid ? (
                          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" />Pago</Badge>
                        ) : isOverdue ? (
                          <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />Atrasado</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Em aberto</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums font-medium">{formatCurrency(Number(inv.amount || 0))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {c?.inicio_contrato && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div className="text-sm">
              <span className="text-muted-foreground">Cliente desde </span>
              <span className="font-medium">{new Date(c.inicio_contrato).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
