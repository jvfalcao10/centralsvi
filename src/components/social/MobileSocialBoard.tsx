import {CardActionsButton,StageSelect} from './CardActions'
import TouchStageMove,{TouchMoveCard,TouchStageColumn} from './TouchStageMove'
import CardSelection,{type CardSelectionProps} from './CardSelection'
import {useEffect, useRef, useState} from 'react'
import {ArrowLeft,ArrowRight} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {VideoCover} from '@/components/social/VideoPreview'
import {SOCIAL_STAGES, socialDate, type Card} from '@/lib/social-board'

/** Trello-style columns on phones and tablets; scrolling never starts a card drag. */
export default function MobileSocialBoard({cards, columns, filterKey, busy, onOpen, onMove, onCopy,selectedIds,onSelect}: CardSelectionProps&{
 cards: Card[]; columns:typeof SOCIAL_STAGES; filterKey: string; busy: boolean
 onCopy: (value: string) => void; onOpen: (id: string) => void; onMove: (id: string, stage: string) => void
}) {
 const board=useRef<HTMLDivElement>(null)
 const [limits,setLimits]=useState<Record<string,number>>({})
 const stageKey=columns.map(s=>s.id).join('|')
 useEffect(()=>setLimits({}),[stageKey,filterKey])
 const behavior=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto' as const:'smooth' as const
 const scroll=(direction:number)=>board.current?.scrollBy({left:direction*312,behavior:behavior()})
 const showPosted=()=>{const el=board.current,posted=el?.querySelector<HTMLElement>('[data-touch-stage="postado"]');if(el&&posted)el.scrollTo({left:posted.offsetLeft-el.offsetLeft,behavior:behavior()})}
 return <TouchStageMove cards={cards} busy={busy} onMove={onMove} boardRef={board}><section aria-label="Kanban de postagens no toque" className="min-w-0 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <p className="text-xs text-muted-foreground">Deslize entre colunas. Role dentro de cada etapa. Arraste pela alça.</p>
   <div className="flex gap-2"><Button size="icon" variant="outline" className="h-11 w-11" aria-label="Etapas à esquerda" onClick={()=>scroll(-1)}><ArrowLeft/></Button><Button size="icon" variant="outline" className="h-11 w-11" aria-label="Etapas à direita" onClick={()=>scroll(1)}><ArrowRight/></Button>{columns.some(s=>s.id==='postado')&&<Button variant="outline" className="h-11" onClick={showPosted}>Ir para Postado</Button>}</div>
  </div>
  <div ref={board} aria-label="Colunas de postagens" className="relative flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain p-1 pb-3" style={{WebkitOverflowScrolling:'touch'}}>
  {columns.map(stage=>{const visible=cards.filter(c=>c.stage===stage.id),limit=limits[stage.id]||12;return <TouchStageColumn key={stage.id} stage={stage} count={visible.length}>
  {visible.slice(0,limit).map(card=>{
   return <TouchMoveCard key={card.id} card={card} busy={busy} selected={selectedIds?.has(card.id)} selection={onSelect&&<CardSelection card={card} checked={!!selectedIds?.has(card.id)} busy={busy} onSelect={onSelect}/>}>
    <button className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={`Abrir ${card.title}`} onClick={()=>onOpen(card.id)}>
     <VideoCover asset={card.assets.find(a=>a.id===card.selected_assets[0])||card.assets[0]} preview={card.preview}/>
     <div className="space-y-2 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{card.client}</p>
      <h3 className="line-clamp-3 break-words text-sm font-semibold leading-snug">{card.title}</h3>
      <p className="text-sm text-muted-foreground">{card.author} · {card.assets.length} arquivo{card.assets.length===1?'':'s'} · v{card.revision}</p>
      {card.ingest_pending&&<p className="text-sm text-orange-400">Importação pendente</p>}
      {card.stage==='ajustes'&&card.note&&<p className="line-clamp-3 text-sm text-orange-400">{card.note}</p>}
      {card.approved_by&&<p className="text-sm text-emerald-500">Aprovado por {card.approved_by}</p>}
      {card.stage==='agendado'&&card.scheduled_at&&<p className="text-sm text-primary">{socialDate(card.scheduled_at)} · {card.channel}</p>}
      {card.stage==='postado'&&card.posted_at&&<p className="text-sm text-muted-foreground">Postado {socialDate(card.posted_at)}</p>}

     </div>
    </button>
    <div className="flex items-center gap-2 border-t px-2 py-2">
     <StageSelect card={card} busy={busy} onMove={onMove}/><CardActionsButton card={card} busy={busy} onOpen={onOpen} onMove={onMove} onCopy={onCopy}/>
    </div>
   </TouchMoveCard>
  })}
  {!visible.length&&<p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma peça nesta etapa com os filtros escolhidos.</p>}
  {visible.length>limit&&<Button variant="outline" className="w-full" onClick={()=>setLimits(previous=>({...previous,[stage.id]:limit+12}))}>Mostrar mais peças ({visible.length-limit})</Button>}
  </TouchStageColumn>})}
  </div>
 </section></TouchStageMove>
}
