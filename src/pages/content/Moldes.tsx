import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, LayoutTemplate, Search, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MOLDES, POSTS, type PostMolde } from '@/data/moldes'

// Moldes de post (07/10/2026). Vitrine dos moldes de carrossel e estático da casa e dos posts feitos em cada um,
// organizada de dois jeitos: por lista (cada molde é uma lista) e por cliente.
// Os dados vêm de src/data/moldes.ts, gerado pelo exportador em conteudo-joao/carrosseis.

const CHAVE_ABA = 'moldes:aba'
/** Os posts do próprio perfil do João; o resto é de cliente. */
const DONO = 'João Falcão'
const NOME_MOLDE = Object.fromEntries(MOLDES.map(m => [m.id, m.nome]))

function contar<T extends string>(itens: T[]) {
  const c = new Map<T, number>()
  for (const i of itens) c.set(i, (c.get(i) || 0) + 1)
  return c
}

function CartaoPost({ post, onAbrir }: { post: PostMolde; onAbrir: (p: PostMolde) => void }) {
  return (
    <button type="button" onClick={() => onAbrir(post)}
      className="group text-left rounded-xl border bg-card overflow-hidden transition hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="relative aspect-[4/5] bg-muted overflow-hidden">
        <img src={post.laminas[0]} alt={post.titulo} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        {post.laminas.length > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-xs font-medium text-white">{post.laminas.length} lâminas</span>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium leading-snug line-clamp-2">{post.titulo}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="font-normal">{post.cliente}</Badge>
          <Badge variant="outline" className="font-normal">{NOME_MOLDE[post.molde] || post.molde}</Badge>
        </div>
      </div>
    </button>
  )
}

function Grade({ posts, onAbrir }: { posts: PostMolde[]; onAbrir: (p: PostMolde) => void }) {
  if (!posts.length) return <p className="text-sm text-muted-foreground py-10 text-center">Nenhum post aqui ainda.</p>
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {posts.map(p => <CartaoPost key={p.id} post={p} onAbrir={onAbrir} />)}
    </div>
  )
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${ativo ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>
      {children}
    </button>
  )
}

export default function Moldes() {
  const [aba, setAba] = useState(() => { try { return localStorage.getItem(CHAVE_ABA) || 'listas' } catch { return 'listas' } })
  const [lista, setLista] = useState<string>(MOLDES[0]?.id ?? '')
  const [cliente, setCliente] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<PostMolde | null>(null)
  const [lamina, setLamina] = useState(0)

  useEffect(() => { try { localStorage.setItem(CHAVE_ABA, aba) } catch { /* sem armazenamento local */ } }, [aba])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return POSTS
    return POSTS.filter(p => [p.titulo, p.cliente, NOME_MOLDE[p.molde] || ''].some(t => t.toLowerCase().includes(q)))
  }, [busca])

  const porMolde = useMemo(() => contar(filtrados.map(p => p.molde)), [filtrados])
  const clientes = useMemo(() => [...contar(filtrados.map(p => p.cliente)).entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')), [filtrados])
  const molde = MOLDES.find(m => m.id === lista)
  const postsDaLista = filtrados.filter(p => p.molde === lista)
  const postsDoCliente = cliente === 'todos' ? filtrados : filtrados.filter(p => p.cliente === cliente)

  function abrir(p: PostMolde) { setAberto(p); setLamina(0) }
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLamina(i => Math.min(aberto.laminas.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setLamina(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto])

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><LayoutTemplate className="h-6 w-6 shrink-0 text-primary" /> Moldes de post</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {MOLDES.length} moldes e {POSTS.length} posts feitos neles. Cada molde é uma lista; os posts também estão separados por cliente.
          </p>
          <Link to="/content/social" className="inline-flex mt-2 text-sm text-primary underline underline-offset-4">Voltar para Social media · Postagens →</Link>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar post, cliente ou molde" className="pl-9" aria-label="Buscar" />
        </div>
      </header>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="listas" className="gap-1.5"><LayoutTemplate className="h-4 w-4" /> Listas</TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5"><Users className="h-4 w-4" /> Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="listas" className="space-y-4 pt-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MOLDES.map(m => (
              <Chip key={m.id} ativo={lista === m.id} onClick={() => setLista(m.id)}>
                {m.nome} <span className="opacity-70">· {porMolde.get(m.id) || 0}</span>
              </Chip>
            ))}
          </div>
          {molde && (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1.5">
              <p className="font-semibold">{molde.nome} {molde.tipo && <span className="font-normal text-muted-foreground">· {molde.tipo}</span>}</p>
              <p className="text-sm text-muted-foreground">{molde.descricao}</p>
              {molde.opcoes && <p className="text-xs text-muted-foreground">{molde.opcoes}</p>}
            </div>
          )}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Seus posts neste molde</h2>
            <Grade posts={postsDaLista.filter(p => p.cliente === DONO)} onAbrir={abrir} />
          </section>
          {postsDaLista.some(p => p.cliente !== DONO) && (
            <section className="space-y-2 pt-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Clientes que usam este molde</h2>
              <Grade posts={postsDaLista.filter(p => p.cliente !== DONO)} onAbrir={abrir} />
            </section>
          )}
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4 pt-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip ativo={cliente === 'todos'} onClick={() => setCliente('todos')}>Todos <span className="opacity-70">· {filtrados.length}</span></Chip>
            {clientes.map(([c, n]) => <Chip key={c} ativo={cliente === c} onClick={() => setCliente(c)}>{c} <span className="opacity-70">· {n}</span></Chip>)}
          </div>
          <Grade posts={postsDoCliente} onAbrir={abrir} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!aberto} onOpenChange={o => { if (!o) setAberto(null) }}>
        <DialogContent className="max-w-3xl">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle>{aberto.titulo}</DialogTitle>
                <DialogDescription>{aberto.cliente} · molde {NOME_MOLDE[aberto.molde] || aberto.molde} · lâmina {lamina + 1} de {aberto.laminas.length}</DialogDescription>
              </DialogHeader>
              <div className="relative mx-auto w-full max-w-md">
                <img src={aberto.laminas[lamina]} alt={`Lâmina ${lamina + 1}`} className="w-full rounded-lg border aspect-[4/5] object-cover" />
                {lamina > 0 && (
                  <button type="button" onClick={() => setLamina(lamina - 1)} aria-label="Lâmina anterior"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><ChevronLeft className="h-5 w-5" /></button>
                )}
                {lamina < aberto.laminas.length - 1 && (
                  <button type="button" onClick={() => setLamina(lamina + 1)} aria-label="Próxima lâmina"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><ChevronRight className="h-5 w-5" /></button>
                )}
              </div>
              {aberto.laminas.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {aberto.laminas.map((src, i) => (
                    <button key={src} type="button" onClick={() => setLamina(i)} aria-label={`Ver lâmina ${i + 1}`}
                      className={`shrink-0 w-16 rounded-md overflow-hidden border-2 ${i === lamina ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                      <img src={src} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
