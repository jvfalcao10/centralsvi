import { useState } from 'react'
import { ChevronDown, ChevronUp, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TEMPLATES } from '@/data/criador/templates'
import type { TemplateDef, TemplateId } from '@/data/criador/tipos'
import { opcoesPadrao } from '@/lib/criador/doc'
import { novoId } from '@/lib/criador/contrato'
import { PreviewAjustado } from './PreviewAjustado'
import { SlidePreview } from './templates'

function CartaoTemplate({ tpl, aoUsar }: { tpl: TemplateDef; aoUsar: (id: TemplateId) => void }) {
  const [aberto, setAberto] = useState(false)
  const opcoes = opcoesPadrao(tpl.id)
  const exemplo = tpl.exemplo.map((s, i) => ({ ...s, id: `${tpl.id}-${i}` }))
  const total = exemplo.length
  return <article className="rounded-xl border bg-card p-3 sm:p-4 flex flex-col gap-3 min-w-0">
    <div className="flex flex-col sm:flex-row gap-4 min-w-0">
      <PreviewAjustado className="w-full sm:w-[200px] shrink-0" max={200} template={tpl.id} slide={exemplo[0] ?? { id: novoId(), tipo: tpl.slideTypes[0].tipo, campos: {}, fotos: {} }} n={1} total={total} opcoes={opcoes} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">{tpl.codigo}</Badge>
          <h3 className="text-base font-semibold">{tpl.nome}</h3>
        </div>
        <p className="text-xs text-muted-foreground">Modelo que inspirou: <span className="text-foreground">{tpl.origem}</span></p>
        <p className="text-sm">{tpl.quandoUsar}</p>
        {tpl.uso && <p className="text-xs text-primary">{tpl.uso}</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tpl.slideTypes.map(st => <Badge key={st.tipo} variant="secondary" className="text-[11px] font-normal" title={st.descricao}>{st.nome}{st.usaFoto ? ' · foto' : ''}</Badge>)}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={() => aoUsar(tpl.id)}><Wand2 className="h-4 w-4 mr-1.5" />Montar com este template</Button>
          <Button size="sm" variant="outline" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
            {aberto ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <ChevronDown className="h-4 w-4 mr-1.5" />}{aberto ? 'Fechar' : 'Ver lâminas e campos'}
          </Button>
        </div>
      </div>
    </div>
    {aberto && <div className="space-y-4 border-t pt-3">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {exemplo.map((s, i) => <SlidePreview key={s.id} largura={180} template={tpl.id} slide={s} n={i + 1} total={total} opcoes={opcoes} className="rounded-md ring-1 ring-border" />)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tpl.slideTypes.map(st => <div key={st.tipo} className="rounded-lg border p-3 text-sm space-y-1.5">
          <p className="font-medium">{st.nome} <span className="font-mono text-xs text-muted-foreground">"{st.tipo}"</span></p>
          <p className="text-xs text-muted-foreground">{st.descricao}</p>
          <ul className="text-xs space-y-0.5">
            {st.campos.map(c => <li key={c.chave}><span className="font-mono">{c.chave}</span>: {c.rotulo}{c.tipo === 'opcao' ? '' : c.tipo === 'lista' ? ` (até ${c.maxItens} itens de ${c.limite})` : ` (até ${c.limite})`}{c.obrigatorio ? ' *' : ''}</li>)}
            {st.fotos.map(f => <li key={f.chave} className="text-primary">foto <span className="font-mono">{f.chave}</span>: {f.rotulo}, {f.proporcao}{f.obrigatoria ? ' *' : ''}</li>)}
          </ul>
        </div>)}
      </div>
    </div>}
  </article>
}

export function AbaTemplates({ aoUsar }: { aoUsar: (id: TemplateId) => void }) {
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Seis templates do motor de carrossel, recriados aqui em 1080x1350. A prévia usa conteúdo de exemplo. "Montar com este template" abre a aba Montar já com o exemplo, para você trocar texto e fotos.</p>
    <div className="grid gap-3 xl:grid-cols-2">
      {TEMPLATES.map(tpl => <CartaoTemplate key={tpl.id} tpl={tpl} aoUsar={aoUsar} />)}
    </div>
  </div>
}
