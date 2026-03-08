import { useEffect, useState, useCallback } from 'react'
import { CheckSquare, Square, AlertTriangle, Clock, CheckCircle2, ListChecks } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Delivery, Client, DELIVERY_TYPE_CONFIG, DELIVERY_STATUS_CONFIG, formatDate, getDeadlineColor } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

type DeliveryWithClient = Delivery & { clients?: { name: string; company: string } }

export default function Deliveries() {
  const { toast } = useToast()
  const [deliveries, setDeliveries] = useState<DeliveryWithClient[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [clientFilter, setClientFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deadlineFilter, setDeadlineFilter] = useState('all')

  const fetchDeliveries = useCallback(async () => {
    const { data } = await supabase
      .from('deliveries')
      .select('*, clients(name, company)')
      .order('prazo', { ascending: true })
    setDeliveries(data || [])
  }, [])

  useEffect(() => {
    async function load() {
      await fetchDeliveries()
      const { data: clientsData } = await supabase.from('clients').select('id, name, company, plano, mrr, status, health_score, inicio_contrato, phone, email, segment, notes').order('name')
      setClients(clientsData || [])
      setLoading(false)
    }
    load()
  }, [fetchDeliveries])

  const toggleComplete = async (delivery: DeliveryWithClient) => {
    const newStatus = delivery.status === 'entregue' ? 'pendente' : 'entregue'
    const update: Partial<DeliveryWithClient> = {
      status: newStatus,
      data_entrega: newStatus === 'entregue' ? new Date().toISOString().split('T')[0] : null
    }
    const { error } = await supabase.from('deliveries').update(update).eq('id', delivery.id)
    if (!error) {
      toast({ title: newStatus === 'entregue' ? '✅ Entrega concluída!' : 'Entrega reaberta', description: delivery.titulo })
      fetchDeliveries()
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const monthEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const filtered = deliveries.filter(d => {
    if (clientFilter !== 'all' && d.client_id !== clientFilter) return false
    if (typeFilter !== 'all' && d.tipo !== typeFilter) return false
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (deadlineFilter === 'today' && d.prazo !== today) return false
    if (deadlineFilter === 'week' && (d.prazo < today || d.prazo > weekEnd)) return false
    if (deadlineFilter === 'month' && (d.prazo < today || d.prazo > monthEnd)) return false
    if (deadlineFilter === 'late' && (d.prazo >= today || d.status === 'entregue')) return false
    return true
  })

  const total = deliveries.length
  const pending = deliveries.filter(d => d.status !== 'entregue').length
  const late = deliveries.filter(d => d.status !== 'entregue' && d.prazo < today).length
  const delivered = deliveries.filter(d => d.status === 'entregue').length
  const onTimeRate = total > 0 ? Math.round((delivered / total) * 100) : 0

  // Group by client
  const grouped: Record<string, DeliveryWithClient[]> = {}
  filtered.forEach(d => {
    const key = d.clients?.name || d.client_id
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(d)
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, icon: ListChecks, color: 'text-foreground' },
          { label: 'Pendentes', value: pending, icon: Clock, color: 'text-warning' },
          { label: 'Atrasadas', value: late, icon: AlertTriangle, color: 'text-danger' },
          { label: 'No Prazo', value: `${onTimeRate}%`, icon: CheckCircle2, color: 'text-success' },
        ].map(kpi => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${kpi.color}`} />
                <div>
                  <p className="text-lg font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {Object.entries(DELIVERY_TYPE_CONFIG).map(([key, val]) => <SelectItem key={key} value={key}>{val.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(DELIVERY_STATUS_CONFIG).map(([key, val]) => <SelectItem key={key} value={key}>{val.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deadlineFilter} onValueChange={setDeadlineFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos prazos</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="late">Atrasadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grouped deliveries */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhuma entrega encontrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([clientName, items]) => (
            <div key={clientName} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b border-border">
                <p className="font-semibold text-sm">{clientName}</p>
                <p className="text-xs text-muted-foreground">{items.length} entrega(s)</p>
              </div>
              <div className="divide-y divide-border">
                {items.map(delivery => {
                  const isComplete = delivery.status === 'entregue'
                  const typeConf = DELIVERY_TYPE_CONFIG[delivery.tipo]
                  const statusConf = DELIVERY_STATUS_CONFIG[delivery.status]
                  const deadlineColor = isComplete ? 'text-muted-foreground' : getDeadlineColor(delivery.prazo)

                  return (
                    <div key={delivery.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors ${isComplete ? 'opacity-60' : ''}`}>
                      <button onClick={() => toggleComplete(delivery)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                        {isComplete ? <CheckSquare className="h-5 w-5 text-success" /> : <Square className="h-5 w-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isComplete ? 'line-through text-muted-foreground' : ''}`}>{delivery.titulo}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {typeConf && <Badge variant="outline" className={`text-xs ${typeConf.className}`}>{typeConf.label}</Badge>}
                        {statusConf && <Badge variant="outline" className={`text-xs ${statusConf.className}`}>{statusConf.label}</Badge>}
                        <span className={`text-xs font-medium ${deadlineColor}`}>{formatDate(delivery.prazo)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
