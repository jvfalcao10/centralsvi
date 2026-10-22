import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, ExternalLink, Trash2, Bookmark, BookmarkCheck, Radar, Flame, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import QuadroPorCliente from '@/components/radar/QuadroPorCliente'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

/**
 * Radar de Reels.
 *
 * Mostra o que saiu acima do que cada perfil vigiado costuma fazer. A régua é a
 * mediana de visualizações do próprio perfil, calculada na coleta. Número
 * absoluto grande não vira destaque sozinho, e visualização não é retenção,
 * salvamento nem venda: isso fica escrito na tela para ninguém confundir
 * sinal com resultado.
 */

interface RadarProfile {
  id: string
  handle: string
  display_name: string | null
  median_views: number | null
  sample_size: number
  last_collected_at: string | null
}

interface WatchRow {
  id: string
  profile_id: string
  reason: string | null
  radar_profiles: RadarProfile | null
}

interface RadarPost {
  id: string
  profile_id: string
  external_id: string
  url: string
  caption: string | null
  views: number | null
  likes: number | null
  comments: number | null
  duration_s: number | null
  published_at: string | null
  thumb_url: string | null
  times_median: number | null
  is_highlight: boolean
}

interface SaveRow {
  id: string
  post_id: string
  status: string
}

interface StaffClient {
  id: string
  name: string
  company: string | null
}

function formatarNumero(valor: number | null): string {
  const numero = Number(valor) || 0
  if (numero >= 1_000_000) return (numero / 1_000_000).toFixed(1).replace('.', ',') + ' mi'
  if (numero >= 1_000) return Math.round(numero / 1_000) + ' mil'
  return String(numero)
}

function diasAtras(iso: string | null): string {
  if (!iso) return 'data a conferir'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function RadarReels() {
  const { isClient, isStaff, user } = useAuth()
  const { toast } = useToast()

  const [clientId, setClientId] = useState<string | null>(null)
  const [staffClients, setStaffClients] = useState<StaffClient[]>([])
  const [selectedStaffClientId, setSelectedStaffClientId] = useState<string>('')
  const [watch, setWatch] = useState<WatchRow[]>([])
  const [posts, setPosts] = useState<RadarPost[]>([])
  const [saves, setSaves] = useState<SaveRow[]>([])
  const [novoPerfil, setNovoPerfil] = useState('')
  const [filtro, setFiltro] = useState<'destaques' | 'todos' | 'salvos'>('destaques')
  const [aba, setAba] = useState<'garimpo' | 'quadro'>('garimpo')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [coletando, setColetando] = useState(false)

  useEffect(() => {
    (async () => {
      if (isClient) {
        const { data } = await supabase.rpc('current_client_id')
        if (data) setClientId(data as string)
      } else if (isStaff) {
        const { data } = await supabase
          .from('clientes_operacional')
          .select('id, name, company')
          .order('name')
        setStaffClients((data || []) as StaffClient[])
      }
    })()
  }, [isClient, isStaff])

  const activeClientId = isClient ? clientId : (selectedStaffClientId || null)

  const carregar = useCallback(async () => {
    if (!activeClientId) { setLoading(false); return }
    setLoading(true)

    const { data: lista } = await supabase
      .from('radar_watchlist')
      .select('id, profile_id, reason, radar_profiles(id, handle, display_name, median_views, sample_size, last_collected_at)')
      .eq('client_id', activeClientId)

    const perfis = (lista || []) as unknown as WatchRow[]
    setWatch(perfis)

    const ids = perfis.map(item => item.profile_id)
    if (ids.length) {
      const { data: reels } = await supabase
        .from('radar_posts')
        .select('*')
        .in('profile_id', ids)
        .order('published_at', { ascending: false })
        .limit(120)
      setPosts((reels || []) as RadarPost[])
    } else {
      setPosts([])
    }

    const { data: marcados } = await supabase
      .from('radar_saves')
      .select('id, post_id, status')
      .eq('client_id', activeClientId)
    setSaves((marcados || []) as SaveRow[])

    setLoading(false)
  }, [activeClientId])

  useEffect(() => { carregar() }, [carregar])

  // De dez em dez minutos, como o João pediu: quem colar um link em outra
  // máquina aparece aqui sem ninguém apertar nada.
  useEffect(() => {
    const relogio = setInterval(() => { carregar() }, 10 * 60 * 1000)
    return () => clearInterval(relogio)
  }, [carregar])

  const perfilPorId = useMemo(() => {
    const mapa = new Map<string, RadarProfile>()
    watch.forEach(item => { if (item.radar_profiles) mapa.set(item.profile_id, item.radar_profiles) })
    return mapa
  }, [watch])

  const idsSalvos = useMemo(() => new Set(saves.map(item => item.post_id)), [saves])

  /**
   * O que "deu certo" para aquele perfil.
   *
   * João, 22/10/2026: "só é pra puxar os posts que deu certo e não todos.
   * Muitas curtidas, views, compartilhamento, salvamentos". Compartilhamento e
   * salvamento o Instagram só mostra para o dono do perfil, então a régua
   * possível tem duas pernas, e basta uma delas:
   *  1. visualização acima do dobro da mediana do próprio perfil, que é o que
   *     a coleta já marca;
   *  2. reação acima do dobro da mediana do perfil, contando curtida mais
   *     comentário por mil visualizações. Pega o post de alcance normal que
   *     mexeu com quem viu, que é onde mora o gancho bom.
   */
  const reacao = (post: RadarPost) =>
    post.views && post.views > 0 ? ((post.likes || 0) + (post.comments || 0)) * 1000 / post.views : 0

  const medianaDaReacao = useMemo(() => {
    const porPerfil = new Map<string, number[]>()
    posts.forEach(post => {
      const taxa = reacao(post)
      if (!taxa) return
      if (!porPerfil.has(post.profile_id)) porPerfil.set(post.profile_id, [])
      porPerfil.get(post.profile_id)!.push(taxa)
    })
    const mapa = new Map<string, number>()
    porPerfil.forEach((valores, perfil) => {
      if (valores.length < 6) return
      const ordenado = [...valores].sort((a, b) => a - b)
      const meio = Math.floor(ordenado.length / 2)
      mapa.set(perfil, ordenado.length % 2 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2)
    })
    return mapa
  }, [posts])

  const deuCerto = useCallback((post: RadarPost) => {
    if (post.is_highlight) return true
    const base = medianaDaReacao.get(post.profile_id)
    return !!base && base > 0 && reacao(post) >= base * 2
  }, [medianaDaReacao])

  const visiveis = useMemo(() => {
    if (filtro === 'destaques') {
      return posts.filter(deuCerto).sort((a, b) =>
        (b.times_median || 0) - (a.times_median || 0) || reacao(b) - reacao(a))
    }
    if (filtro === 'salvos') return posts.filter(post => idsSalvos.has(post.id))
    return posts
  }, [posts, filtro, idsSalvos, deuCerto])

  /**
   * O campo aceita as duas coisas. João, 22/10/2026: "não quero por perfil e
   * sim link de conteúdo que deu bom". Link de post vai pro caminho que lê
   * aquele post e pendura no cliente; @perfil continua virando perfil vigiado.
   */
  const ehLinkDePost = (texto: string) =>
    /instagram\.com\/(?:[A-Za-z0-9._]+\/)?(reel|reels|p|tv)\//i.test(texto)

  const salvarLink = async (endereco: string) => {
    const { data: sessao } = await supabase.auth.getSession()
    const token = sessao.session?.access_token
    if (!token) {
      toast({ title: 'Sua sessão expirou', description: 'Entre de novo na Central.', variant: 'destructive' })
      return
    }
    const resposta = await fetch('/api/radar-salvar-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: endereco, client_id: activeClientId }),
    })
    const corpo = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
      toast({ title: 'Não deu pra guardar', description: corpo.error || 'tenta de novo', variant: 'destructive' })
      return
    }
    setNovoPerfil('')
    toast({
      title: `Guardado de @${corpo.handle}`,
      description: corpo.leitura?.o_que_fazer
        || (corpo.views
          ? `${formatarNumero(corpo.views)} visualizações, ${formatarNumero(corpo.likes)} curtidas`
          : `${formatarNumero(corpo.likes)} curtidas, ${formatarNumero(corpo.comments)} comentários`),
    })
    // O card nasce no quadro, não na lista de garimpo: a lista só mostra post de
    // perfil vigiado, e referência colada por link quase nunca é de perfil vigiado.
    if (isStaff) setAba('quadro')
    carregar()
  }

  /**
   * Rodar a coleta na hora. O cron passa às 9h, e quem acabou de pôr um perfil
   * não tem por que esperar o dia seguinte pra saber se ele presta. A rodada
   * pega até oito perfis, os que estão há mais tempo sem coleta primeiro, então
   * com mais de oito perfis vale clicar de novo.
   */
  const coletarAgora = async () => {
    setColetando(true)
    const { data: sessao } = await supabase.auth.getSession()
    const token = sessao.session?.access_token
    if (!token) {
      setColetando(false)
      toast({ title: 'Sua sessão expirou', description: 'Entre de novo na Central.', variant: 'destructive' })
      return
    }
    const desde = Date.now()
    // Dispara e solta. João, 22/10/2026: "se eu saio e vou pra outra aba, ele
    // para de pesquisar". A coleta roda no servidor e grava no banco; o
    // navegador não precisa ficar segurando a resposta pra ela terminar.
    fetch('/api/radar-coletar', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .catch(() => { /* o resultado vem do banco, não daqui */ })
    toast({
      title: 'Coleta rodando',
      description: 'Leva alguns minutos. Pode sair desta tela, que ela continua.',
    })

    // O resultado é lido do banco, então vale mesmo que esta tela seja fechada.
    let voltas = 0
    const olho = setInterval(async () => {
      voltas += 1
      const { data } = await supabase
        .from('radar_collections')
        .select('started_at, profiles_count, posts_new, highlights')
        .order('started_at', { ascending: false })
        .limit(1)
      const ultima = data?.[0]
      if (ultima && new Date(ultima.started_at).getTime() >= desde - 60000) {
        clearInterval(olho)
        setColetando(false)
        toast({
          title: `Coleta feita em ${ultima.profiles_count ?? 0} perfis`,
          description: `${ultima.posts_new ?? 0} conteúdos novos, ${ultima.highlights ?? 0} acima da média`,
        })
        carregar()
        return
      }
      if (voltas >= 30) {
        clearInterval(olho)
        setColetando(false)
        carregar()
      }
    }, 15000)
  }

  const adicionarPerfil = async () => {
    const entrada = novoPerfil.trim()
    if (!entrada) return
    setSalvando(true)
    if (ehLinkDePost(entrada)) {
      await salvarLink(entrada)
      setSalvando(false)
      return
    }
    // O cliente não escreve direto na tabela de perfis: a função cuida disso.
    const { error } = await supabase.rpc('radar_add_profile',
      { p_handle: entrada, p_reason: null, p_client_id: isClient ? null : activeClientId })
    setSalvando(false)
    if (error) {
      const limite = error.message?.includes('limite')
      toast({
        title: limite ? 'Limite de perfis atingido' : 'Não foi possível adicionar',
        description: limite
          ? 'São até oito perfis por cliente. Tire um antes de colocar outro.'
          : 'Confira se o perfil está escrito certo, no formato @perfil.',
        variant: 'destructive',
      })
      return
    }
    setNovoPerfil('')
    toast({
      title: 'Perfil no radar',
      description: 'Ele entra na próxima coleta, amanhã de manhã.',
    })
    carregar()
  }

  const removerPerfil = async (profileId: string) => {
    const { error } = await supabase.rpc('radar_remove_profile',
      { p_profile_id: profileId, p_client_id: isClient ? null : activeClientId })
    if (error) {
      toast({ title: 'Não foi possível remover', variant: 'destructive' })
      return
    }
    carregar()
  }

  const alternarSalvo = async (post: RadarPost) => {
    if (!activeClientId) return
    const existente = saves.find(item => item.post_id === post.id)
    if (existente) {
      await supabase.from('radar_saves').delete().eq('id', existente.id)
      setSaves(saves.filter(item => item.id !== existente.id))
      return
    }
    const { data, error } = await supabase
      .from('radar_saves')
      .insert({ client_id: activeClientId, post_id: post.id, saved_by: user?.id ?? null })
      .select('id, post_id, status')
      .single()
    if (error) {
      toast({ title: 'Não foi possível salvar', variant: 'destructive' })
      return
    }
    setSaves([...saves, data as SaveRow])
    toast({ title: 'Salvo', description: 'A equipe vê o que você marcou.' })
  }

  const destaques = posts.filter(deuCerto).length

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Radar de Reels</h1>
          <p className="text-sm text-muted-foreground">
            O que saiu acima do padrão de cada perfil que você acompanha
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && aba === 'garimpo' && (
            <Select value={selectedStaffClientId} onValueChange={setSelectedStaffClientId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
              <SelectContent>
                {staffClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={coletarAgora} disabled={coletando} className="gap-2">
            <Radar className="w-4 h-4" /> {coletando ? 'Coletando, pode demorar...' : 'Coletar agora'}
          </Button>
          <Button size="sm" variant="outline" onClick={carregar} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>
      </div>

      {isStaff && (
        <div className="flex gap-1 border-b border-border">
          {([['garimpo', 'Garimpo do cliente'], ['quadro', 'Quadro por cliente']] as const).map(([chave, titulo]) => (
            <button
              key={chave}
              onClick={() => setAba(chave)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                aba === chave ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'
              }`}
            >
              {titulo}
            </button>
          ))}
        </div>
      )}

      {isStaff && aba === 'quadro' ? (
        <QuadroPorCliente />
      ) : isStaff && !selectedStaffClientId ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          Selecione um cliente para ver o radar dele.
        </div>
      ) : (
        <>
          {/* Quem está no radar */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Guardar referência</h2>
              <span className="text-xs text-muted-foreground">link do post, ou @perfil pra vigiar todo dia (até 8)</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Input
                value={novoPerfil}
                onChange={e => setNovoPerfil(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') adicionarPerfil() }}
                placeholder="cole o link do conteúdo que deu bom, ou @perfil"
                className="flex-1 min-w-[260px]"
                maxLength={600}
              />
              <Button onClick={adicionarPerfil} disabled={salvando || !novoPerfil.trim()} className="gap-2">
                <Plus className="w-4 h-4" /> Guardar
              </Button>
            </div>

            {watch.length ? (
              <div className="flex flex-wrap gap-2">
                {watch.map(item => {
                  const perfil = item.radar_profiles
                  if (!perfil) return null
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 bg-muted/50 border border-border rounded-full pl-3 pr-1 py-1"
                    >
                      <span className="text-sm">@{perfil.handle}</span>
                      <span className="text-xs text-muted-foreground">
                        {perfil.median_views
                          ? `mediana ${formatarNumero(perfil.median_views)}`
                          : 'sem coleta ainda'}
                      </span>
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => removerPerfil(item.profile_id)}
                        aria-label={`Tirar @${perfil.handle} do radar`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Coloque os perfis que você quer acompanhar. Podem ser concorrentes, referências do seu
                mercado ou perfis de outro mercado que você acha que fazem conteúdo bom.
              </p>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['destaques', `Deu certo (${destaques})`],
              ['todos', `Tudo que entrou (${posts.length})`],
              ['salvos', `Salvos (${saves.length})`],
            ] as const).map(([id, texto]) => (
              <Button
                key={id}
                size="sm"
                variant={filtro === id ? 'default' : 'outline'}
                onClick={() => setFiltro(id)}
              >
                {texto}
              </Button>
            ))}
          </div>

          {/* Grade */}
          {loading ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : visiveis.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
              <h3 className="font-semibold mb-1">
                {watch.length ? 'Nada por aqui ainda' : 'Seu radar está vazio'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {watch.length
                  ? 'A coleta roda toda manhã. Perfil novo aparece aqui na próxima rodada.'
                  : 'Coloque ao menos um perfil no radar para a coleta começar.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visiveis.map(post => {
                const perfil = perfilPorId.get(post.profile_id)
                const salvo = idsSalvos.has(post.id)
                return (
                  <article
                    key={post.id}
                    className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/40 transition-colors"
                  >
                    <div className="relative aspect-[4/5] bg-muted">
                      {post.thumb_url ? (
                        <img
                          src={post.thumb_url}
                          alt={`Capa do reel de @${perfil?.handle || ''}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                          sem capa
                        </div>
                      )}
                      {post.is_highlight && (
                        <Badge className="absolute top-2 left-2 gap-1 bg-primary text-primary-foreground">
                          <Flame className="w-3 h-3" />
                          {String(post.times_median).replace('.', ',')}x a mediana
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => alternarSalvo(post)}
                        aria-label={salvo ? 'Tirar dos salvos' : 'Salvar'}
                      >
                        {salvo ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
                      </Button>
                    </div>

                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>@{perfil?.handle || 'perfil'}</span>
                        <span>{diasAtras(post.published_at)}</span>
                      </div>

                      <div className="text-lg font-semibold">
                        {formatarNumero(post.views)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">reproduções</span>
                      </div>

                      {post.caption && (
                        <p className="text-sm text-muted-foreground line-clamp-3">{post.caption}</p>
                      )}

                      <div className="mt-auto pt-2 flex items-center gap-2">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Ver no Instagram <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            A comparação é com a mediana do próprio perfil, na mesma métrica e na janela recente.
            Reprodução não é retenção, salvamento nem venda: serve para escolher o que vale estudar,
            não para medir resultado.
          </p>
        </>
      )}
    </div>
  )
}
