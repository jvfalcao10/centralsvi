import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lightbulb, Clock, CheckCircle2, Wrench, ExternalLink, Calendar, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Link } from 'react-router-dom'
import { usePainelContext } from '@/components/PainelLayout'

const STATUS_LABEL: Record<string, string> = {
  ideia: 'Ideia',
  producao: 'Em produção',
  agendado: 'Agendado',
  publicado: 'Publicado',
}
const STATUS_ICON: Record<string, any> = {
  ideia: Lightbulb, producao: Wrench, agendado: Clock, publicado: CheckCircle2,
}
const STATUS_COLOR: Record<string, string> = {
  ideia: 'text-muted-foreground',
  producao: 'text-blue-600 dark:text-blue-400',
  agendado: 'text-amber-600 dark:text-amber-400',
  publicado: 'text-emerald-600 dark:text-emerald-400',
}

export default function PainelConteudo() {
  const { client, slug } = usePainelContext()
  const [tab, setTab] = useState<'posts' | 'pautas' | 'calendario'>('posts')

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground font-medium">Conteúdo</p>
          <h1 className="text-3xl font-semibold tracking-tighter mt-1">Conteúdo</h1>
          <p className="text-muted-foreground mt-1">
            Pautas, posts e calendário editorial — tudo que a equipe SVI produz pra você.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/cliente/${slug}/aprovacoes`}>
            <CheckCircle2 className="w-4 h-4 mr-2" />Aprovações
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="pautas">Pautas</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          <PostsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="pautas" className="mt-4">
          <PautasTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="calendario" className="mt-4">
          <CalendarTab clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PostsTab({ clientId }: { clientId: string }) {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['painel-conteudo-posts', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_posts')
        .select('id, title, format, status, scheduled_date, published_at, caption, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50)
      return data || []
    },
  })

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>

  if ((posts || []).length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sem posts ainda. Time SVI vai começar a popular aqui.</p>
        </CardContent>
      </Card>
    )
  }

  const byStatus = (posts || []).reduce<Record<string, any[]>>((acc, p: any) => {
    (acc[p.status] = acc[p.status] || []).push(p)
    return acc
  }, {})

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {['ideia', 'producao', 'agendado', 'publicado'].map(st => {
        const Icon = STATUS_ICON[st]
        const arr = byStatus[st] || []
        return (
          <Card key={st}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Icon className={`w-4 h-4 ${STATUS_COLOR[st]}`} />
                {STATUS_LABEL[st]} <Badge variant="secondary" className="ml-auto">{arr.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {arr.slice(0, 8).map((p: any) => (
                <div key={p.id} className="p-2.5 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors">
                  <div className="text-xs font-medium truncate">{p.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                    {p.format}{p.scheduled_date ? ` · ${new Date(p.scheduled_date).toLocaleDateString('pt-BR')}` : ''}
                  </div>
                </div>
              ))}
              {arr.length === 0 && <div className="text-xs text-muted-foreground py-2">Vazio.</div>}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function PautasTab({ clientId }: { clientId: string }) {
  const { data: pautas, isLoading } = useQuery({
    queryKey: ['painel-conteudo-pautas', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_pautas')
        .select('id, title, category, urgency, status, format_suggestion')
        .eq('client_id', clientId)
        .eq('status', 'disponivel')
        .order('created_at', { ascending: false })
        .limit(30)
      return data || []
    },
  })

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
  if ((pautas || []).length === 0) return (
    <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
      <Lightbulb className="w-6 h-6 mx-auto mb-2" />Sem pautas disponíveis no momento.
    </CardContent></Card>
  )

  return (
    <div className="grid gap-2">
      {pautas?.map((p: any) => (
        <Card key={p.id}>
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {p.category}{p.format_suggestion ? ` · ${p.format_suggestion}` : ''}
              </div>
            </div>
            <Badge variant={p.urgency === 'tendencia' ? 'default' : p.urgency === 'sazonal' ? 'secondary' : 'outline'}>
              {p.urgency}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CalendarTab({ clientId }: { clientId: string }) {
  const { data: scheduled, isLoading } = useQuery({
    queryKey: ['painel-conteudo-calendar', clientId],
    queryFn: async () => {
      const since = new Date()
      since.setDate(since.getDate() - 7)
      const until = new Date()
      until.setDate(until.getDate() + 60)
      const { data } = await supabase
        .from('content_posts')
        .select('id, title, format, status, scheduled_date, published_at')
        .eq('client_id', clientId)
        .or(`scheduled_date.gte.${since.toISOString()},published_at.gte.${since.toISOString()}`)
        .lte('scheduled_date', until.toISOString())
        .order('scheduled_date', { ascending: true })
      return data || []
    },
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if ((scheduled || []).length === 0) return (
    <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
      <Calendar className="w-6 h-6 mx-auto mb-2" />Sem agendamentos no calendário.
    </CardContent></Card>
  )

  const byDate: Record<string, any[]> = {}
  scheduled?.forEach((p: any) => {
    const date = (p.scheduled_date || p.published_at || '').slice(0, 10)
    if (!date) return
    ;(byDate[date] = byDate[date] || []).push(p)
  })

  return (
    <div className="space-y-3">
      {Object.entries(byDate).slice(0, 30).map(([date, posts]) => (
        <Card key={date}>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {new Date(date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="space-y-2">
              {posts.map((p: any) => {
                const Icon = STATUS_ICON[p.status] || Clock
                return (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <Icon className={`w-3.5 h-3.5 ${STATUS_COLOR[p.status]}`} />
                    <span className="font-medium">{p.title}</span>
                    <Badge variant="outline" className="ml-auto capitalize text-[10px]">{p.format}</Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
