import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Plus, RefreshCw, Tag, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Quadro do que já foi garimpado, uma coluna por cliente.
 *
 * João, 22/10/2026: "quero no radar ver o que o Arthur já fez, números mesmo,
 * tipo igual a pipeline de postagens com preview do link, por cliente, igual
 * Trello cada etapa ser a do cliente e organizar por tags".
 *
 * A régua dos números é a mesma da coleta: o destaque não é visualização alta
 * em si, e sim o que passou do que aquele perfil costuma fazer. Visualização
 * não é retenção, salvamento nem venda, e isso fica escrito na tela.
 */

interface PostDoRadar {
  url: string
  caption: string | null
  views: number | null
  likes: number | null
  comments: number | null
  thumb_url: string | null
  published_at: string | null
  times_median: number | null
  is_highlight: boolean
  profile_id: string
}

interface SaveRow {
  id: string
  client_id: string
  post_id: string
  status: string
  note: string | null
  tags: string[] | null
  created_at: string
  saved_by: string | null
  radar_posts: PostDoRadar | null
}

interface ClienteRow { id: string; name: string }
interface PerfilRow { id: string; handle: string }
interface PessoaRow { user_id: string; name: string }

const SETE_DIAS = 7 * 86400000

function formatarNumero(valor: number | null): string {
  const numero = Number(valor) || 0
  if (numero >= 1_000_000) return (numero / 1_000_000).toFixed(1).replace('.', ',') + ' mi'
  if (numero >= 1_000) return Math.round(numero / 1_000) + ' mil'
  return String(numero)
}

function diasAtras(iso: string | null): string {
  if (!iso) return 'sem data'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function QuadroPorCliente() {
  const { toast } = useToast()
  const [saves, setSaves] = useState<SaveRow[]>([])
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [perfis, setPerfis] = useState<PerfilRow[]>([])
  const [pessoas, setPessoas] = useState<PessoaRow[]>([])
  const [vigiados, setVigiados] = useState<{ client_id: string; profile_id: string }[]>([])
  const [tagAtiva, setTagAtiva] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [novaTag, setNovaTag] = useState('')
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [marcados, carteira, vigia, catalogo, time] = await Promise.all([
      supabase
        .from('radar_saves')
        .select('id, client_id, post_id, status, note, tags, created_at, saved_by, radar_posts(url, caption, views, likes, comments, thumb_url, published_at, times_median, is_highlight, profile_id)')
        .order('created_at', { ascending: false }),
      supabase.from('clientes_operacional').select('id, name').order('name'),
      supabase.from('radar_watchlist').select('client_id, profile_id'),
      supabase.from('radar_profiles').select('id, handle'),
      supabase.from('profiles').select('user_id, name'),
    ])
    setSaves((marcados.data || []) as unknown as SaveRow[])
    setClientes((carteira.data || []) as ClienteRow[])
    setVigiados((vigia.data || []) as { client_id: string; profile_id: string }[])
    setPerfis((catalogo.data || []) as PerfilRow[])
    setPessoas((time.data || []) as PessoaRow[])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const nomeDoCliente = useMemo(() => new Map(clientes.map(c => [c.id, c.name])), [clientes])
  const handlePorPerfil = useMemo(() => new Map(perfis.map(p => [p.id, p.handle])), [perfis])
  const nomeDaPessoa = useMemo(() => new Map(pessoas.map(p => [p.user_id, p.name])), [pessoas])

  const todasAsTags = useMemo(() => {
    const conta = new Map<string, number>()
    saves.forEach(s => (s.tags || []).forEach(t => conta.set(t, (conta.get(t) || 0) + 1)))
    return [...conta.entries()].sort((a, b) => b[1] - a[1])
  }, [saves])

  const filtrados = useMemo(
    () => (tagAtiva ? saves.filter(s => (s.tags || []).includes(tagAtiva)) : saves),
    [saves, tagAtiva],
  )

  /** Uma coluna por cliente que tem alguma coisa: salvo ou perfil vigiado. */
  const colunas = useMemo(() => {
    const perfilPorCliente = new Map<string, number>()
    vigiados.forEach(v => perfilPorCliente.set(v.client_id, (perfilPorCliente.get(v.client_id) || 0) + 1))
    const ids = new Set<string>([...filtrados.map(s => s.client_id), ...(tagAtiva ? [] : perfilPorCliente.keys())])
    return [...ids]
      .map(id => ({
        id,
        nome: nomeDoCliente.get(id) || 'cliente fora da carteira',
        perfis: perfilPorCliente.get(id) || 0,
        itens: filtrados.filter(s => s.client_id === id),
      }))
      .sort((a, b) => b.itens.length - a.itens.length || a.nome.localeCompare(b.nome))
  }, [filtrados, vigiados, nomeDoCliente, tagAtiva])

  const recentes = useMemo(
    () => saves.filter(s => Date.now() - new Date(s.created_at).getTime() < SETE_DIAS).length,
    [saves],
  )

  /** Quem garimpou. Sem isso não dá pra medir o trabalho de ninguém. */
  const porPessoa = useMemo(() => {
    const conta = new Map<string, number>()
    saves.forEach(s => {
      const quem = s.saved_by ? nomeDaPessoa.get(s.saved_by) || 'alguém da equipe' : 'antes do registro'
      conta.set(quem, (conta.get(quem) || 0) + 1)
    })
    return [...conta.entries()].sort((a, b) => b[1] - a[1])
  }, [saves, nomeDaPessoa])

  const gravarTags = async (save: SaveRow, tags: string[]) => {
    const { error } = await supabase.from('radar_saves').update({ tags }).eq('id', save.id)
    if (error) {
      toast({ title: 'Não consegui gravar a tag', description: error.message, variant: 'destructive' })
      return
    }
    setSaves(atual => atual.map(s => (s.id === save.id ? { ...s, tags } : s)))
  }

  const adicionarTag = async (save: SaveRow) => {
    const limpa = novaTag.trim().toLowerCase().slice(0, 24)
    if (!limpa) return
    const tags = [...new Set([...(save.tags || []), limpa])]
    setNovaTag('')
    setEditando(null)
    await gravarTags(save, tags)
  }

  const totalPerfis = new Set(vigiados.map(v => v.profile_id)).size

  return (
    <div className="space-y-4">
      {/* Os números do garimpo, que é o que o João pediu para enxergar. */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-bold">{saves.length}</p>
              <p className="text-xs text-muted-foreground">referências salvas</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{recentes}</p>
              <p className="text-xs text-muted-foreground">salvas nos últimos 7 dias</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPerfis}</p>
              <p className="text-xs text-muted-foreground">perfis vigiados</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{new Set(vigiados.map(v => v.client_id)).size}</p>
              <p className="text-xs text-muted-foreground">clientes com radar montado</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={carregar} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>
        {porPessoa.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Quem garimpou: {porPessoa.map(([quem, quanto]) => `${quem} (${quanto})`).join(' · ')}
          </p>
        )}
      </div>

      {todasAsTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <Button
            size="sm"
            variant={tagAtiva ? 'ghost' : 'secondary'}
            onClick={() => setTagAtiva(null)}
          >
            tudo
          </Button>
          {todasAsTags.map(([tag, quanto]) => (
            <Button
              key={tag}
              size="sm"
              variant={tagAtiva === tag ? 'secondary' : 'ghost'}
              onClick={() => setTagAtiva(tagAtiva === tag ? null : tag)}
            >
              {tag} <span className="text-muted-foreground ml-1">{quanto}</span>
            </Button>
          ))}
        </div>
      )}

      {carregando ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          Carregando o quadro...
        </div>
      ) : colunas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          Ninguém salvou referência ainda. Monte o radar de um cliente na aba ao lado e marque o que presta.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map(coluna => (
            <div key={coluna.id} className="w-[300px] shrink-0 bg-muted/30 border border-border rounded-xl p-3 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-sm truncate" title={coluna.nome}>{coluna.nome}</h3>
                <Badge variant="secondary">{coluna.itens.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {coluna.perfis === 0 ? 'nenhum perfil no radar'
                  : coluna.perfis === 1 ? '1 perfil no radar'
                  : `${coluna.perfis} perfis no radar`}
              </p>

              {coluna.itens.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">nada salvo ainda</p>
              ) : coluna.itens.map(save => {
                const post = save.radar_posts
                return (
                  <div key={save.id} className="bg-card border border-border rounded-lg overflow-hidden">
                    {post?.thumb_url && (
                      <a href={post.url} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={post.thumb_url}
                          alt={`capa do post de @${handlePorPerfil.get(post.profile_id) || 'perfil'}`}
                          loading="lazy"
                          className="w-full h-40 object-cover"
                        />
                      </a>
                    )}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">
                          @{(post && handlePorPerfil.get(post.profile_id)) || 'perfil'}
                        </span>
                        {post?.is_highlight && <Badge className="text-[10px]">acima da média</Badge>}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {post?.caption || 'sem legenda'}
                      </p>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span title="visualizações">{formatarNumero(post?.views ?? null)} views</span>
                        <span title="curtidas">{formatarNumero(post?.likes ?? null)} curt.</span>
                        <span title="comentários">{formatarNumero(post?.comments ?? null)} com.</span>
                        {post?.times_median ? (
                          <span className="text-primary">{post.times_median.toFixed(1).replace('.', ',')}x a mediana</span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {(save.tags || []).map(tag => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-[10px] gap-1 cursor-pointer"
                            onClick={() => gravarTags(save, (save.tags || []).filter(t => t !== tag))}
                          >
                            {tag} <X className="w-2.5 h-2.5" />
                          </Badge>
                        ))}
                        {editando === save.id ? (
                          <Input
                            autoFocus
                            value={novaTag}
                            onChange={e => setNovaTag(e.target.value)}
                            onBlur={() => { setEditando(null); setNovaTag('') }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') adicionarTag(save)
                              if (e.key === 'Escape') { setEditando(null); setNovaTag('') }
                            }}
                            placeholder="tag"
                            className="h-6 w-24 text-xs"
                            maxLength={24}
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => { setEditando(save.id); setNovaTag('') }}
                          >
                            <Plus className="w-3 h-3" /> tag
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>salvo {diasAtras(save.created_at)}</span>
                        {post?.url && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            abrir <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Visualização não é retenção, salvamento nem venda. A régua do destaque é a mediana do próprio
        perfil, calculada na coleta de cada manhã.
      </p>
    </div>
  )
}
