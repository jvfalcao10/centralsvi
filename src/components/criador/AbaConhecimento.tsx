import { useMemo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CONHECIMENTO } from '@/data/criador/conhecimento'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const MD: Components = {
  h1: ({ children }) => <h1 className="text-xl font-semibold mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold mt-6 mb-2 text-primary">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-1.5">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed my-2">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-sm leading-relaxed">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-sm leading-relaxed">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/60 pl-3 my-3 text-sm text-muted-foreground">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-[12px]">{children}</code>,
  pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 text-xs my-3 whitespace-pre-wrap">{children}</pre>,
  table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-xs border-collapse">{children}</table></div>,
  th: ({ children }) => <th className="border px-2 py-1 text-left font-medium bg-muted/50">{children}</th>,
  td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{children}</a>,
}

/** A busca filtra a lista de documentos e conta as ocorrências no documento aberto. */
export function AbaConhecimento() {
  const [busca, setBusca] = useState('')
  const [atual, setAtual] = useState(CONHECIMENTO[0]?.slug ?? '')
  const filtrados = useMemo(() => {
    const q = norm(busca.trim())
    if (!q) return CONHECIMENTO
    return CONHECIMENTO.filter(d => norm(d.titulo + ' ' + d.resumo + ' ' + d.corpo).includes(q))
  }, [busca])
  const doc = filtrados.find(d => d.slug === atual) ?? filtrados[0]
  const ocorrencias = useMemo(() => {
    const q = norm(busca.trim())
    if (!q || !doc) return 0
    return norm(doc.corpo).split(q).length - 1
  }, [busca, doc])

  return <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
    <aside className="space-y-3 min-w-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar na base (ex.: rosto, legenda, CFM)" className="pl-8" aria-label="Buscar na base de conhecimento" />
      </div>
      <p className="text-xs text-muted-foreground">{filtrados.length} de {CONHECIMENTO.length} documentos. É esta base que vai dentro dos prompts da aba Agentes.</p>
      {/* celular: seletor no topo com a mesma lista do trilho */}
      <div className="lg:hidden">
        <Select value={doc?.slug} onValueChange={setAtual}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Escolha um documento" /></SelectTrigger>
          <SelectContent>{filtrados.map(d => <SelectItem key={d.slug} value={d.slug}>{d.titulo}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <nav aria-label="Documentos da base" className="hidden lg:block max-h-[70vh] overflow-y-auto rounded-xl border bg-card p-1.5">
        {filtrados.map(d => <button key={d.slug} onClick={() => setAtual(d.slug)}
          className={`w-full text-left rounded-md px-2.5 py-2 text-sm transition-colors ${doc?.slug === d.slug ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}>
          {d.titulo}
        </button>)}
        {!filtrados.length && <p className="p-3 text-sm text-muted-foreground">Nada encontrado.</p>}
      </nav>
    </aside>
    <article className="rounded-xl border bg-card p-4 sm:p-6 min-w-0">
      {doc ? <>
        {busca.trim() && <p className="mb-3 text-xs text-muted-foreground">"{busca.trim()}" aparece {ocorrencias} {ocorrencias === 1 ? 'vez' : 'vezes'} neste documento.</p>}
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{doc.corpo}</ReactMarkdown>
      </> : <p className="text-sm text-muted-foreground">Nenhum documento com "{busca}".</p>}
    </article>
  </div>
}
