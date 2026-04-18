import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Kanban, Lightbulb, Calendar, TrendingUp, Users2, ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

interface Stats {
  posts_total: number
  posts_agendados: number
  posts_publicados_mes: number
  pautas_disponiveis: number
  referencias: number
  trends_semana: number
}

interface ClientInfo {
  id: string
  name: string
  company: string
  segment: string | null
  inicio_contrato: string | null
}

export default function MinhaArea() {
  const { profile, user } = useAuth()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [stats, setStats] = useState<Stats>({
    posts_total: 0, posts_agendados: 0, posts_publicados_mes: 0,
    pautas_disponiveis: 0, referencias: 0, trends_semana: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [user])

  async function load() {
    setLoading(true)
    const { data: cid } = await supabase.rpc('current_client_id')
    if (!cid) { setLoading(false); return }

    const [cliRes, postsRes, agendRes, pubRes, pautasRes, refsRes, trendsRes] = await Promise.all([
      supabase.from('clients').select('id, name, company, segment, inicio_contrato').eq('id', cid).single(),
      supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('client_id', cid),
      supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('client_id', cid).eq('status', 'agendado'),
      supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('client_id', cid).eq('status', 'publicado').gte('published_at', firstDayOfMonth()),
      supabase.from('content_pautas').select('id', { count: 'exact', head: true }).eq('client_id', cid).eq('status', 'disponivel'),
      supabase.from('content_references').select('id', { count: 'exact', head: true }).eq('client_id', cid),
      supabase.from('content_trends').select('id', { count: 'exact', head: true }).or(`client_id.eq.${cid},client_id.is.null`).gte('captured_at', sevenDaysAgo()),
    ])

    if (cliRes.data) setClient(cliRes.data as ClientInfo)
    setStats({
      posts_total: postsRes.count ?? 0,
      posts_agendados: agendRes.count ?? 0,
      posts_publicados_mes: pubRes.count ?? 0,
      pautas_disponiveis: pautasRes.count ?? 0,
      referencias: refsRes.count ?? 0,
      trends_semana: trendsRes.count ?? 0,
    })
    setLoading(false)
  }

  const greeting = getGreeting()

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">
          {greeting}, {profile?.name?.split(' ')[0] || 'por aqui'}
          <Sparkles className="inline h-6 w-6 text-primary ml-2" />
        </h1>
        {client && (
          <p className="text-sm text-muted-foreground">
            Gerenciando <span className="font-medium text-foreground">{client.company}</span>
            {client.segment && <> · {client.segment}</>}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatBlock label="Publicados no mês" value={stats.posts_publicados_mes} tone="success" />
        <StatBlock label="Agendados" value={stats.posts_agendados} tone="warning" />
        <StatBlock label="Total de posts" value={stats.posts_total} tone="default" />
        <StatBlock label="Pautas disponíveis" value={stats.pautas_disponiveis} tone="primary" />
        <StatBlock label="Referências monitoradas" value={stats.referencias} tone="default" />
        <StatBlock label="Tendências (7d)" value={stats.trends_semana} tone="info" />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Atalhos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <ShortcutCard to="/content/posts"    title="Gestor de Posts"   desc="Controle visual dos conteúdos" icon={Kanban} />
          <ShortcutCard to="/content/pautas"   title="Banco de Pautas"   desc="Repositório de ideias"        icon={Lightbulb} />
          <ShortcutCard to="/content/calendar" title="Calendário Editorial" desc="Visão mensal da produção"     icon={Calendar} />
          <ShortcutCard to="/content/radar"    title="Radar de Tendências" desc="Temas em alta do seu nicho"   icon={TrendingUp} />
          <ShortcutCard to="/content/monitor"  title="Referências"       desc="Perfis que você acompanha"    icon={Users2} />
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground text-center">Carregando dados...</p>}
    </div>
  )
}

function StatBlock({ label, value, tone }: { label: string; value: number; tone: 'default' | 'primary' | 'success' | 'warning' | 'info' }) {
  const bgMap = {
    default: 'bg-card border-border',
    primary: 'bg-primary/5 border-primary/20',
    success: 'bg-success/5 border-success/20',
    warning: 'bg-warning/5 border-warning/20',
    info:    'bg-info/5 border-info/20',
  }
  const textMap = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    info:    'text-info',
  }
  return (
    <div className={`border rounded-xl p-5 ${bgMap[tone]}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${textMap[tone]}`}>{value}</div>
    </div>
  )
}

function ShortcutCard({ to, title, desc, icon: Icon }: { to: string; title: string; desc: string; icon: any }) {
  return (
    <Link
      to={to}
      className="group bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:bg-accent/30 transition-colors flex items-center gap-4"
    >
      <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </Link>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function firstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
}
