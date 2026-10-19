import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Palette, Sparkles, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BANCO, type FormatoBanco } from '@/data/banco-carrosseis'
import { VisorLaminas, type Laminas } from '@/components/content/VisorLaminas'

/**
 * Banco de Carrosséis Best-Sellers (Vick Machado).
 *
 * João, 15/10/2026: "era para ter os moldes a mais lá, né, não tem do curso que
 * compramos". O curso estava parado em ~/Dev/cursos desde 04/10 e a Central só
 * mostrava os moldes visuais da casa.
 *
 * A diferença dos dois: o molde da casa é a arte pronta, o formato daqui é o
 * roteiro do carrossel. Por isso o cartão abre com a estrutura slide a slide e
 * o "por que funciona", e os exemplos são carrosséis reais que performaram.
 * Dados em src/data/banco-carrosseis.ts, gerado por scripts/exportar_banco_carrosseis.py.
 */

/** Pra que serve a peça. É o primeiro corte de quem está montando pauta. */
const INTENCOES = [
  { id: 'CONEXÃO', rotulo: 'Conexão', ajuda: 'aproxima e faz o seguidor se ver na peça' },
  { id: 'CONVERSÃO', rotulo: 'Conversão', ajuda: 'empurra pra ação, termina em CTA' },
  { id: 'CRESCIMENTO', rotulo: 'Crescimento', ajuda: 'alcance e compartilhamento' },
]

const COR_INTENCAO: Record<string, string> = {
  'CONEXÃO': 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  'CONVERSÃO': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  'CRESCIMENTO': 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
}

function Selo({ intencao }: { intencao: string }) {
  const rotulo = INTENCOES.find(i => i.id === intencao)?.rotulo || intencao
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_INTENCAO[intencao] || 'bg-muted'}`}>{rotulo}</span>
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${ativo ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>
      {children}
    </button>
  )
}

/** A estrutura é a parte que a social copia pro roteiro, então vem antes de tudo. */
function Estrutura({ formato }: { formato: FormatoBanco }) {
  return (
    <ol className="space-y-1.5">
      {formato.estrutura.map((passo, i) => {
        const [posicao, ...resto] = passo.split(/\s+-\s+/)
        const texto = resto.join(' - ')
        return (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{posicao}</span>
            <span className="leading-snug">{texto || passo}</span>
          </li>
        )
      })}
    </ol>
  )
}

function CartaoExemplo({ formato, exemplo, onAbrir }: {
  formato: FormatoBanco
  exemplo: FormatoBanco['exemplos'][number]
  onAbrir: (l: Laminas) => void
}) {
  return (
    <button type="button"
      onClick={() => onAbrir({
        titulo: `${formato.nome} · exemplo ${exemplo.numero}`,
        subtitulo: formato.intencoes.map(i => INTENCOES.find(x => x.id === i)?.rotulo || i).join(' e '),
        laminas: exemplo.laminas,
        fonte: exemplo.url,
        rotuloFonte: 'Ver o carrossel no Instagram',
      })}
      className="group text-left rounded-xl border bg-card overflow-hidden transition hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="relative aspect-[4/5] bg-muted overflow-hidden">
        <img src={exemplo.laminas[0]} alt={`${formato.nome}, exemplo ${exemplo.numero}`} loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-xs font-medium text-white">
          {exemplo.laminas.length} lâminas
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium">Exemplo {exemplo.numero}</p>
        <p className="text-xs text-muted-foreground">carrossel real, do Instagram</p>
      </div>
    </button>
  )
}

/**
 * Molde pronto da SVI (18/10/2026). O desenho do curso refeito no motor da casa
 * (skill design-carrossel-svi), com as medidas tiradas dos templates do Canva.
 * A Central mostra a amostra e o pedido; quem gera a peça é o motor, que já aplica
 * a identidade do cliente e tira o texto de cima de rosto sozinho.
 */
function MoldePronto({ formato, onAbrir }: { formato: FormatoBanco; onAbrir: (l: Laminas) => void }) {
  const [copiado, setCopiado] = useState(false)
  const svi = formato.svi
  if (!svi) return null
  const pedido = `Carrossel ${formato.nome} pro cliente [nome], sobre [tema]`
  async function copiar() {
    try { await navigator.clipboard.writeText(pedido); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* sem área de transferência */ }
  }
  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold"><Wand2 className="h-4 w-4 text-primary" /> Molde pronto da SVI</h3>
        <span className="text-xs text-muted-foreground">base do Canva: {svi.molde}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <button type="button"
          onClick={() => onAbrir({ titulo: `${formato.nome} · molde SVI`, subtitulo: `Amostra no molde ${svi.molde}`, laminas: svi.laminas })}
          className="flex gap-2 overflow-x-auto pb-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
          {svi.laminas.map((l, i) => (
            <img key={l} src={l} alt={`${formato.nome}, amostra lâmina ${i + 1}`} loading="lazy"
              className="aspect-[4/5] w-28 shrink-0 rounded-md border object-cover sm:w-32" />
          ))}
        </button>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Como pedir</p>
          <div className="flex items-start gap-2 rounded-lg border bg-background p-2">
            <code className="flex-1 text-xs leading-snug break-words">{pedido}</code>
            <button type="button" onClick={copiar} aria-label="Copiar pedido"
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            A peça sai na fonte e na cor do cliente, com o texto fora de rosto, e cai no quadro de Postagens pra aprovação interna.
            Texto entre colchetes na amostra é dado real a trocar.
          </p>
        </div>
      </div>
    </section>
  )
}

export function BancoCarrosseis({ busca }: { busca: string }) {
  const [intencao, setIntencao] = useState('todas')
  const [escolhido, setEscolhido] = useState(BANCO[0]?.id ?? '')
  const [aberto, setAberto] = useState<Laminas | null>(null)
  const [detalhar, setDetalhar] = useState(false)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return BANCO.filter(f => {
      if (intencao !== 'todas' && !f.intencoes.includes(intencao)) return false
      if (!q) return true
      return [f.nome, f.intencoes.join(' '), f.estrutura.join(' '), f.porqueFunciona].some(t => t.toLowerCase().includes(q))
    })
  }, [busca, intencao])

  // Se o filtro tirou da lista o formato aberto, mostra o primeiro que sobrou:
  // melhor do que deixar o painel vazio sem explicar por quê.
  const formato = filtrados.find(f => f.id === escolhido) || filtrados[0]

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-sm">
          <strong>{BANCO.length} formatos de carrossel</strong> do Banco de Carrosséis Best-Sellers, com a estrutura slide a slide,
          o template no Canva e {BANCO.reduce((n, f) => n + f.exemplos.length, 0)} carrosséis reais de exemplo.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Escolha o formato pela intenção. Cada um traz o roteiro do curso e o molde pronto da SVI, igual ao template original, já com amostra.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Chip ativo={intencao === 'todas'} onClick={() => setIntencao('todas')}>
          Todas <span className="opacity-70">· {BANCO.length}</span>
        </Chip>
        {INTENCOES.map(i => (
          <Chip key={i.id} ativo={intencao === i.id} onClick={() => setIntencao(i.id)}>
            {i.rotulo} <span className="opacity-70">· {BANCO.filter(f => f.intencoes.includes(i.id)).length}</span>
          </Chip>
        ))}
      </div>
      {intencao !== 'todas' && (
        <p className="text-xs text-muted-foreground">{INTENCOES.find(i => i.id === intencao)?.ajuda}</p>
      )}

      {!filtrados.length && <p className="text-sm text-muted-foreground py-10 text-center">Nenhum formato com esse filtro.</p>}

      {filtrados.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filtrados.map(f => (
            <Chip key={f.id} ativo={formato?.id === f.id} onClick={() => setEscolhido(f.id)}>{f.nome}</Chip>
          ))}
        </div>
      )}

      {formato && (
        <>
          <section className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold">{formato.nome}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {formato.intencoes.map(i => <Selo key={i} intencao={i} />)}
                  <Badge variant="outline" className="font-normal">{formato.estrutura.length} blocos</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {formato.canva.map((link, i) => (
                  <a key={link} href={link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted">
                    <Palette className="h-4 w-4 text-primary" />
                    {formato.canva.length > 1 ? `Template ${i + 1} no Canva` : 'Abrir template no Canva'}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>

            {formato.prancha && (
              <div className="overflow-x-auto rounded-lg border bg-muted/30 p-2">
                <img src={formato.prancha} alt={`Tira de referência do formato ${formato.nome}`} loading="lazy"
                  className="h-28 max-w-none rounded" />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Estrutura do carrossel</h3>
                <Estrutura formato={formato} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Por que funciona</h3>
                <div className="space-y-1.5 text-sm leading-snug text-muted-foreground">
                  {formato.porqueFunciona.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            </div>

            {formato.detalhamento.length > 0 && (
              <div className="rounded-lg border bg-muted/20">
                <button type="button" onClick={() => setDetalhar(v => !v)} aria-expanded={detalhar}
                  className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium">
                  <span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Como montar cada slide</span>
                  <span className="text-xs text-muted-foreground">{detalhar ? 'esconder' : `ver ${formato.detalhamento.length} slides`}</span>
                </button>
                {detalhar && (
                  <div className="space-y-3 border-t p-3">
                    {formato.detalhamento.map(passo => (
                      <div key={passo.slide} className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{passo.slide}</p>
                        {passo.como.split('\n').map((linha, i) => <p key={i} className="text-sm leading-snug">{linha}</p>)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <MoldePronto formato={formato} onAbrir={setAberto} />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Carrosséis reais neste formato</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {formato.exemplos.map(e => (
                <CartaoExemplo key={e.id} formato={formato} exemplo={e} onAbrir={setAberto} />
              ))}
            </div>
          </section>
        </>
      )}

      <VisorLaminas item={aberto} onFechar={() => setAberto(null)} />
    </div>
  )
}
