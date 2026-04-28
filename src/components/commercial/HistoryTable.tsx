import { CommercialPersonaKey, CommercialDailyReport } from '@/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { personaMetrics } from './personaConfig'

interface Props {
  persona: CommercialPersonaKey
  reports: CommercialDailyReport[]
}

export default function HistoryTable({ persona, reports }: Props) {
  const metrics = personaMetrics[persona]

  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Nenhum relatório registrado neste mês.</p>
  }

  const formatDate = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${d}/${m}`
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-20">Dia</TableHead>
            {metrics.map((m) => (
              <TableHead key={m.key} className="text-xs">{m.label}</TableHead>
            ))}
            <TableHead className="text-xs">Anotações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((r) => (
            <TableRow key={r.id} className="border-border hover:bg-muted/20">
              <TableCell className="text-sm font-medium">{formatDate(r.data)}</TableCell>
              {metrics.map((m) => (
                <TableCell key={m.key} className="text-sm">{(r as any)[m.key] ?? 0}</TableCell>
              ))}
              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.observacoes ?? ''}>
                {r.observacoes || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
