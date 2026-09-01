import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingDown, AlertTriangle, Wallet, Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Linha {
  id: string
  dia: string
  cliente: string
  gasto: number
  msgs: number
  cpmsg: number | null
  freq: number | null
  ctr: number | null
  saldo: number | null
  is_cartao: boolean
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function TrafegoBrief() {
  const [dias, setDias] = useState<string[]>([])
  const [dia, setDia] = useState<string>('')
  const [rows, setRows] = useState<Linha[]>([])
  const [loading, setLoading] = useState(false)

  const carregarDias = useCallback(async () => {
    const { data } = await supabase
      .from('trafego_brief').select('dia').order('dia', { ascending: false }).limit(400)
    const uniq = Array.from(new Set((data ?? []).map((d: { dia: string }) => d.dia)))
    setDias(uniq)
    setDia(prev => prev || uniq[0] || '')
  }, [])

  const carregar = useCallback(async () => {
    if (!dia) return
    setLoading(true)
    const { data } = await supabase
      .from('trafego_brief').select('*').eq('dia', dia).order('gasto', { ascending: false })
    setRows((data ?? []) as Linha[])
    setLoading(false)
  }, [dia])

  useEffect(() => { carregarDias() }, [carregarDias])
  useEffect(() => { carregar() }, [carregar])

  const gastaram = rows.filter(r => r.gasto > 0)
  const totGasto = gastaram.reduce((s, r) => s + r.gasto, 0)
  const totMsg = gastaram.reduce((s, r) => s + r.msgs, 0)
  const cpmMedio = totMsg > 0 ? totGasto / totMsg : 0
  const queimados = gastaram.filter(r => r.gasto >= 15 && r.msgs === 0)
  const fadiga = gastaram.filter(r => (r.freq ?? 0) >= 3.5)
  const saldoBaixo = rows.filter(r => !r.is_cartao && (r.saldo ?? 0) > 0 && (r.saldo ?? 0) < 50)

  const kpis = [
    { icone: Activity, rotulo: 'Gasto', valor: brl(totGasto), tom: '' },
    { icone: TrendingDown, rotulo: 'CPmsg médio', valor: totMsg > 0 ? `R$ ${cpmMedio.toFixed(2)}` : '-', tom: '' },
    { icone: AlertTriangle, rotulo: 'Queimaram sem msg', valor: String(queimados.length), tom: queimados.length ? 'text-amber-600' : '' },
    { icone: Wallet, rotulo: 'Saldo baixo', valor: String(saldoBaixo.length), tom: saldoBaixo.length ? 'text-red-600' : '' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Brief de Tráfego</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O mesmo dado que a Sofia manda às 8h, aqui em tabela que dá pra ler. {totMsg} mensagens no dia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dia} onChange={e => setDia(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {dias.map(d => (
              <option key={d} value={d}>{new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => { carregarDias(); carregar() }} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.rotulo}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <k.icone className="h-4 w-4" /> {k.rotulo}
              </div>
              <p className={cn('text-2xl font-semibold mt-1 tabular-nums whitespace-nowrap', k.tom)}>{k.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium text-right">Gasto</th>
                <th className="px-4 py-2 font-medium text-right">Msgs</th>
                <th className="px-4 py-2 font-medium text-right">CPmsg</th>
                <th className="px-4 py-2 font-medium text-right">Freq</th>
                <th className="px-4 py-2 font-medium text-right">CTR</th>
                <th className="px-4 py-2 font-medium text-right">Saldo</th>
                <th className="px-4 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const queimou = r.gasto >= 15 && r.msgs === 0
                const bom = (r.cpmsg ?? 99) < 15 && r.msgs > 0
                const sat = (r.freq ?? 0) >= 3.5
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{r.cliente}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{brl(r.gasto)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.msgs}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.cpmsg ? `R$ ${r.cpmsg.toFixed(2)}` : '-'}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', sat && 'text-amber-600 font-medium')}>
                      {r.freq?.toFixed(2) ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.ctr ? `${r.ctr.toFixed(2)}%` : '-'}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums',
                      !r.is_cartao && (r.saldo ?? 0) < 50 && (r.saldo ?? 0) > 0 && 'text-red-600 font-medium')}>
                      {r.is_cartao ? 'cartão' : brl(r.saldo ?? 0)}
                    </td>
                    <td className="px-4 py-2">
                      {queimou && <Badge variant="outline" className="text-amber-600 border-amber-300">queimou sem msg</Badge>}
                      {bom && <Badge variant="outline" className="text-emerald-600 border-emerald-300">CPmsg bom</Badge>}
                      {sat && <Badge variant="outline" className="text-amber-600 border-amber-300 ml-1">saturado</Badge>}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && !loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Sem dado nesse dia. O brief das 8h alimenta esta tela.
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {!!fadiga.length && (
        <p className="text-sm text-muted-foreground">
          Saturados (frequência acima de 3,5): {fadiga.map(f => f.cliente).join(', ')}. Duplicar público.
        </p>
      )}
    </div>
  )
}
