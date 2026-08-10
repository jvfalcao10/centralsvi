import { useEffect, useState, useCallback } from 'react'
import {
  Gauge, AlertTriangle, TrendingUp, DollarSign, Users, Activity,
  RefreshCw, Handshake, CircleSlash, Clock,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, emPermutaNoMes } from '@/types'
import { monthKeyOfDate, monthLabel, firstBillingMonth } from '@/lib/months'
import { useUsdRate, mrrBRL } from '@/hooks/useUsdRate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Diretoria — Raio-X da Operação.
 *
 * Antes isto era um <iframe> pro site avulso diretoria-svi.vercel.app, o que
 * obrigava a um SEGUNDO login dentro da Central e servia um `data.js` estático
 * congelado em 13/07/2026. Ou seja: a diretoria olhava o mês passado e achava
 * que era hoje.
 *
 * Agora lê direto do banco da Central, ao vivo, sem iframe e sem senha extra.
 */

type Cliente = {
  id: string
  name: string
  mrr: number
  currency: string
  status: string
  dia_vencimento: number | null
  inicio_contrato: string | null
  permuta: boolean
  permuta_ate: string | null
}

type Fatura = { client_id: string; valor: number; vencimento: string; status: string }

type Relatorio = {
  account_id: string
  account_name: string | null
  cliente_label: string | null
  period_end: string
  spend_cents: number | null
  conv_count: number | null
  leads_count: number | null
  cpmsg_cents: number | null
  status: string
}

const DIAS_SEM_RELATORIO_ALERTA = 14

export default function Diretoria() {
  const usdRate = useUsdRate()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [relatorios, setRelatorios] = useState<Relatorio[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)

  const buscar = useCallback(async () => {
    setLoading(true)
    const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
    const [{ data: cli }, { data: inv }, { data: rel }] = await Promise.all([
      supabase.from('clients')
        .select('id, name, mrr, currency, status, dia_vencimento, inicio_contrato, permuta, permuta_ate')
        .eq('status', 'ativo'),
      supabase.from('invoices').select('client_id, valor, vencimento, status'),
      supabase.from('weekly_traffic_reports')
        .select('account_id, account_name, cliente_label, period_end, spend_cents, conv_count, leads_count, cpmsg_cents, status')
        .gte('period_end', desde)
        .order('period_end', { ascending: false }),
    ])
    setClientes((cli || []) as Cliente[])
    setFaturas((inv || []) as Fatura[])
    setRelatorios((rel || []) as Relatorio[])
    setAtualizadoEm(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { buscar() }, [buscar])

  const hoje = new Date()
  const mesAtual = monthKeyOfDate(hoje)

  // ---- Carteira e dinheiro ----
  const emPermuta = clientes.filter(c => emPermutaNoMes(c, mesAtual))
  const pagantes = clientes.filter(c => !emPermutaNoMes(c, mesAtual))
  const mrrContratado = clientes.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)
  const mrrPermuta = emPermuta.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)

  const pagouNoMes = (id: string) =>
    faturas.some(f => f.client_id === id && f.status === 'pago' && f.vencimento.startsWith(mesAtual))

  const devendo = pagantes.filter(c =>
    c.dia_vencimento !== null &&
    (!c.inicio_contrato || firstBillingMonth(c.inicio_contrato, c.dia_vencimento) <= mesAtual) &&
    !pagouNoMes(c.id)
  )
  const recebidoMes = faturas
    .filter(f => f.status === 'pago' && f.vencimento.startsWith(mesAtual))
    .reduce((s, f) => s + f.valor, 0)
  const emAberto = devendo.reduce((s, c) => s + mrrBRL(c.mrr, c.currency, usdRate), 0)

  // ---- Tráfego (últimos 30 dias) ----
  const investido = relatorios.reduce((s, r) => s + (r.spend_cents || 0), 0) / 100
  const resultados = relatorios.reduce((s, r) => s + (r.conv_count || 0) + (r.leads_count || 0), 0)
  const cplMedio = resultados > 0 ? investido / resultados : 0
  const aguardandoAprovacao = relatorios.filter(r => r.status === 'pending')

  // Última leitura por conta, pra achar quem parou de anunciar
  const porConta = new Map<string, Relatorio>()
  for (const r of relatorios) if (!porConta.has(r.account_id)) porConta.set(r.account_id, r)
  const contas = Array.from(porConta.values())
    .map(r => {
      const dias = Math.floor((hoje.getTime() - new Date(r.period_end + 'T12:00:00').getTime()) / 864e5)
      const gasto30 = relatorios.filter(x => x.account_id === r.account_id)
        .reduce((s, x) => s + (x.spend_cents || 0), 0) / 100
      const res30 = relatorios.filter(x => x.account_id === r.account_id)
        .reduce((s, x) => s + (x.conv_count || 0) + (x.leads_count || 0), 0)
      return { ...r, dias, gasto30, res30, cpl: res30 > 0 ? gasto30 / res30 : null }
    })
    .sort((a, b) => b.gasto30 - a.gasto30)

  const paradas = contas.filter(c => c.dias > DIAS_SEM_RELATORIO_ALERTA)

  // ---- Alertas: só o que exige decisão ----
  const alertas: { icone: typeof AlertTriangle; cor: string; texto: string }[] = []
  if (devendo.length > 0) {
    alertas.push({
      icone: DollarSign, cor: 'text-danger',
      texto: `${devendo.length} cliente${devendo.length > 1 ? 's' : ''} sem pagamento registrado em ${monthLabel(mesAtual)}: ${devendo.map(c => c.name).join(', ')} (${formatCurrency(emAberto)})`,
    })
  }
  if (paradas.length > 0) {
    alertas.push({
      icone: CircleSlash, cor: 'text-danger',
      texto: `${paradas.length} conta${paradas.length > 1 ? 's' : ''} sem relatório há mais de ${DIAS_SEM_RELATORIO_ALERTA} dias: ${paradas.map(c => c.cliente_label || c.account_name).join(', ')}`,
    })
  }
  if (aguardandoAprovacao.length > 0) {
    alertas.push({
      icone: Clock, cor: 'text-warning',
      texto: `${aguardandoAprovacao.length} relatório${aguardandoAprovacao.length > 1 ? 's' : ''} de tráfego esperando aprovação do cliente`,
    })
  }
  const semDiaVenc = clientes.filter(c => c.dia_vencimento === null)
  if (semDiaVenc.length > 0) {
    alertas.push({
      icone: AlertTriangle, cor: 'text-warning',
      texto: `${semDiaVenc.length} cliente${semDiaVenc.length > 1 ? 's' : ''} sem dia de vencimento no cadastro, então ${semDiaVenc.length > 1 ? 'ficam' : 'fica'} fora da cobrança: ${semDiaVenc.map(c => c.name).join(', ')}`,
    })
  }

  const kpis = [
    { label: 'MRR contratado', valor: formatCurrency(mrrContratado), icone: DollarSign, cor: 'text-primary',
      nota: mrrPermuta > 0 ? `inclui ${formatCurrency(mrrPermuta)} em permuta` : `${clientes.length} clientes ativos` },
    { label: `Recebido em ${monthLabel(mesAtual)}`, valor: formatCurrency(recebidoMes), icone: TrendingUp, cor: 'text-success',
      nota: `${faturas.filter(f => f.status === 'pago' && f.vencimento.startsWith(mesAtual)).length} faturas baixadas` },
    { label: 'Em aberto no mês', valor: formatCurrency(emAberto), icone: AlertTriangle, cor: devendo.length ? 'text-danger' : 'text-muted-foreground',
      nota: devendo.length ? `${devendo.length} sem registro` : 'ninguém devendo' },
    { label: 'Investido em ads (30d)', valor: formatCurrency(investido), icone: Activity, cor: 'text-info',
      nota: `${contas.length} contas com relatório` },
    { label: 'Resultados (30d)', valor: String(resultados), icone: Gauge, cor: 'text-primary',
      nota: 'conversas + leads' },
    { label: 'Custo por resultado', valor: cplMedio > 0 ? formatCurrency(cplMedio) : '—', icone: TrendingUp, cor: 'text-warning',
      nota: 'média da carteira' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" /> Diretoria
          </h1>
          <p className="text-sm text-muted-foreground">
            Raio-X da operação, lido ao vivo do banco
            {atualizadoEm && ` · atualizado ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={buscar}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => {
          const Icone = k.icone
          return (
            <Card key={k.label} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icone className={`h-4 w-4 ${k.cor}`} />
                  <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                </div>
                <p className="text-lg font-bold">{k.valor}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{k.nota}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Alertas */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">O que precisa de decisão</p>
          {alertas.length === 0 ? (
            <p className="text-sm text-success">Nada pendente. Cobrança em dia, nenhuma conta parada.</p>
          ) : (
            <div className="space-y-2.5">
              {alertas.map((a, i) => {
                const Icone = a.icone
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <Icone className={`h-4 w-4 shrink-0 mt-0.5 ${a.cor}`} />
                    <p className="text-sm text-muted-foreground leading-snug">{a.texto}</p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tráfego por conta */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
          <Activity className="h-4 w-4 text-info" />
          <span className="text-sm font-semibold">Tráfego por conta, últimos 30 dias</span>
          <Badge variant="outline" className="ml-auto text-xs">{contas.length} contas</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Conta</TableHead>
                <TableHead>Investido</TableHead>
                <TableHead>Resultados</TableHead>
                <TableHead>Custo/result.</TableHead>
                <TableHead className="text-right">Último relatório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map(c => (
                <TableRow key={c.account_id} className="border-border hover:bg-muted/20">
                  <TableCell className="text-sm font-medium">{c.cliente_label || c.account_name || c.account_id}</TableCell>
                  <TableCell className="text-sm">{formatCurrency(c.gasto30)}</TableCell>
                  <TableCell className="text-sm">{c.res30 || '—'}</TableCell>
                  <TableCell className="text-sm">{c.cpl ? formatCurrency(c.cpl) : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={`text-xs ${
                      c.dias > DIAS_SEM_RELATORIO_ALERTA ? 'bg-danger/15 text-danger border-danger/30'
                      : c.dias > 7 ? 'bg-warning/15 text-warning border-warning/30'
                      : 'bg-success/15 text-success border-success/30'}`}>
                      {c.dias === 0 ? 'hoje' : `há ${c.dias}d`}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {contas.length === 0 && (
                <TableRow className="border-border hover:bg-transparent">
                  <TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                    Nenhum relatório de tráfego nos últimos 30 dias.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Carteira */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Carteira</p>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Clientes ativos</span><span className="font-medium">{clientes.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pagantes</span><span className="font-medium">{pagantes.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Em permuta</span><span className="font-medium">{emPermuta.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ticket médio</span>
                <span className="font-medium">{pagantes.length ? formatCurrency((mrrContratado - mrrPermuta) / pagantes.length) : '—'}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Handshake className="h-4 w-4 text-info" />
              <p className="text-sm font-semibold">Em permuta</p>
            </div>
            {emPermuta.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente em permuta este mês.</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {emPermuta.map(c => (
                  <div key={c.id} className="flex justify-between">
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="text-xs text-info">
                      {c.permuta_ate ? `até ${c.permuta_ate.slice(0, 10).split('-').reverse().join('/')}` : 'sem prazo'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
