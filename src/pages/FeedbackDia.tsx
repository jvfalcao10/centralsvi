import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle2, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Linha {
  id: string
  dia: string
  pessoa: string
  papel: string | null
  resumo: string | null
  detalhe: string | null
  ok: boolean | null
}

const ORDEM: Record<string, number> = { Aleilson: 1, 'Letícia': 2, 'Laís': 3 }

export default function FeedbackDia() {
  const [dias, setDias] = useState<string[]>([])
  const [dia, setDia] = useState('')
  const [rows, setRows] = useState<Linha[]>([])
  const [loading, setLoading] = useState(false)

  const carregarDias = useCallback(async () => {
    const { data } = await supabase
      .from('feedback_dia').select('dia').order('dia', { ascending: false }).limit(300)
    const uniq = Array.from(new Set((data ?? []).map((d: { dia: string }) => d.dia)))
    setDias(uniq)
    setDia(prev => prev || uniq[0] || '')
  }, [])

  const carregar = useCallback(async () => {
    if (!dia) return
    setLoading(true)
    const { data } = await supabase.from('feedback_dia').select('*').eq('dia', dia)
    const arr = ((data ?? []) as Linha[]).sort((a, b) => (ORDEM[a.pessoa] ?? 9) - (ORDEM[b.pessoa] ?? 9))
    setRows(arr)
    setLoading(false)
  }, [dia])

  useEffect(() => { carregarDias() }, [carregarDias])
  useEffect(() => { carregar() }, [carregar])

  const fecharam = rows.filter(r => r.ok).length

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Fechamento do Dia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Como Aleilson, Letícia e Laís fecharam o dia. {rows.length > 0 && `${fecharam} de ${rows.length} fecharam completo.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dia} onChange={e => setDia(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm">
            {dias.map(d => (
              <option key={d} value={d}>{new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => { carregarDias(); carregar() }} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Atualizar
          </Button>
        </div>
      </div>

      {rows.map(r => (
        <Card key={r.id}>
          <CardHeader className="pb-3 flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <p className="font-medium flex items-center gap-2">
                {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
                {r.pessoa}
                {r.papel && <span className="text-xs font-normal text-muted-foreground">· {r.papel}</span>}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{r.resumo}</p>
            </div>
            <Badge variant="outline" className={cn('shrink-0',
              r.ok ? 'text-emerald-600 border-emerald-300' : 'text-amber-600 border-amber-300')}>
              {r.ok ? 'fechou' : 'incompleto'}
            </Badge>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground bg-muted/40 rounded-md p-3 overflow-x-auto">
              {r.detalhe}
            </pre>
          </CardContent>
        </Card>
      ))}

      {!rows.length && !loading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Sem fechamento nesse dia. Os três rodam de segunda a sexta às 19h.
        </CardContent></Card>
      )}
    </div>
  )
}
