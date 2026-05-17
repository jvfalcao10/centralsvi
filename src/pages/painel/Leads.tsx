import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bot, Plus, Users, Download, Filter as FilterIcon, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatCurrency } from '@/lib/painel/format'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, type LeadStatus } from '@/lib/painel/types'
import { usePainelContext } from '@/components/PainelLayout'

type DateRange = '7' | '30' | '90' | 'all'

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Tudo' },
]

const STATUS_OPTIONS: LeadStatus[] = ['new', 'contacted', 'qualified', 'meeting', 'proposal', 'won', 'lost', 'nurturing']

export default function PainelLeads() {
  const { client, slug } = usePainelContext()
  const [range, setRange] = useState<DateRange>('30')
  const [statusFilter, setStatusFilter] = useState<Set<LeadStatus>>(new Set())
  const [sourceQ, setSourceQ] = useState('')

  const { data: allLeads, isLoading } = useQuery({
    queryKey: ['painel-leads', client.id, range],
    queryFn: async () => {
      let q = supabase
        .from('painel_leads')
        .select('id, full_name, email, phone, status, source, score, estimated_value_brl, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(500)
      if (range !== 'all') {
        const since = new Date()
        since.setDate(since.getDate() - parseInt(range))
        q = q.gte('created_at', since.toISOString())
      }
      const { data } = await q
      return data || []
    },
  })

  const leads = useMemo(() => {
    return (allLeads || []).filter((l: any) => {
      if (statusFilter.size > 0 && !statusFilter.has(l.status as LeadStatus)) return false
      if (sourceQ && !(l.source || '').toLowerCase().includes(sourceQ.toLowerCase())) return false
      return true
    })
  }, [allLeads, statusFilter, sourceQ])

  function toggleStatus(s: LeadStatus) {
    setStatusFilter(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  function exportCsv() {
    const headers = ['Nome', 'Email', 'Telefone', 'Status', 'Origem', 'Score', 'Valor estimado', 'Criado em']
    const rows = leads.map((l: any) => [
      l.full_name || '',
      l.email || '',
      l.phone || '',
      LEAD_STATUS_LABELS[l.status as LeadStatus] || l.status,
      l.source || '',
      String(l.score || 0),
      l.estimated_value_brl ? String(l.estimated_value_brl) : '',
      new Date(l.created_at).toLocaleDateString('pt-BR'),
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasAnyFilter = statusFilter.size > 0 || sourceQ.length > 0
  const isEmpty = !isLoading && (allLeads || []).length === 0
  const isEmptyFiltered = !isLoading && leads.length === 0 && hasAnyFilter

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">CRM</p>
          <h1 className="text-3xl font-semibold tracking-tighter mt-1">Leads</h1>
          <p className="text-muted-foreground mt-1">Pipeline em tempo real. IA SDR pode atender por você.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link to={`/cliente/${slug}/chat?scope=sdr_agent`}>
              <Bot className="w-4 h-4 mr-2" />IA SDR
            </Link>
          </Button>
          <Button onClick={exportCsv} variant="outline" disabled={leads.length === 0}>
            <Download className="w-4 h-4 mr-2" />Exportar
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />Novo lead
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <FilterIcon className="w-4 h-4 mr-2" />
                Status {statusFilter.size > 0 && <Badge variant="secondary" className="ml-2">{statusFilter.size}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-1">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-sm text-sm hover:bg-accent transition-colors ${
                      statusFilter.has(s) ? 'bg-accent' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-sm border-2 ${statusFilter.has(s) ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`} />
                      {LEAD_STATUS_LABELS[s]}
                    </span>
                  </button>
                ))}
                {statusFilter.size > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setStatusFilter(new Set())}>
                    Limpar
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Input
            placeholder="Origem (ex: instagram)"
            value={sourceQ}
            onChange={(e) => setSourceQ(e.target.value)}
            className="max-w-xs"
          />

          {hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(new Set()); setSourceQ('') }}>
              <X className="w-3.5 h-3.5 mr-1" />Limpar filtros
            </Button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {isLoading ? '…' : `${leads.length} de ${(allLeads || []).length} leads`}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-0">
          <Skeleton className="h-12 w-full rounded-none" />
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-none border-t" />)}
        </CardContent></Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Ainda sem leads</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Conecte uma fonte de tráfego (Meta Ads, Google Ads ou formulário) pra começar a receber leads aqui.
            </p>
            <div className="mt-6"><Link to={`/cliente/${slug}/settings`}><Button>Conectar uma fonte</Button></Link></div>
          </CardContent>
        </Card>
      ) : isEmptyFiltered ? (
        <Card>
          <CardContent className="text-center py-12">
            <FilterIcon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum lead corresponde aos filtros.</p>
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
                {leads.map((l: any) => (
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
