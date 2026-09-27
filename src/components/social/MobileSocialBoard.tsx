import {useEffect, useState} from 'react'
import {ChevronRight} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {VideoCover} from '@/components/social/VideoPreview'
import {SOCIAL_STAGES, socialDate, type Card} from '@/lib/social-board'

/** One page scroll and explicit stage controls for touch screens. */
export default function MobileSocialBoard({cards, stage, filterKey, busy, onOpen, onMove}: {
 cards: Card[]; stage: string; filterKey: string; busy: boolean
 onOpen: (id: string) => void; onMove: (id: string, stage: string) => void
}) {
 const [limit,setLimit]=useState(12)
 useEffect(()=>setLimit(12),[stage,filterKey])
 const visible=cards.filter(c=>stage==='all'||c.stage===stage)
 const current=SOCIAL_STAGES.find(s=>s.id===stage)
 return <section aria-label="Postagens no celular" className="space-y-3">
  <div className="flex items-center justify-between gap-3">
   <h2 className="font-semibold">{current?.label||'Todas as etapas'}</h2>
   <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm tabular-nums">{visible.length}</span>
  </div>
  {current&&<p className="text-sm text-muted-foreground">{current.hint}</p>}
  {visible.slice(0,limit).map(card=>{
   const status=SOCIAL_STAGES.find(s=>s.id===card.stage)
   return <article key={card.id} className="overflow-hidden rounded-xl border bg-card">
    <button className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={`Abrir ${card.title}`} onClick={()=>onOpen(card.id)}>
     <VideoCover asset={card.assets.find(a=>a.id===card.selected_assets[0])||card.assets[0]} preview={card.preview}/>
     <div className="space-y-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{card.client}</p>
      <h3 className="break-words text-base font-semibold leading-snug">{card.title}</h3>
      <p className="text-sm text-muted-foreground">{card.author} · {card.assets.length} arquivo{card.assets.length===1?'':'s'} · v{card.revision}</p>
      {card.ingest_pending&&<p className="text-sm text-orange-400">Importação pendente</p>}
      {card.stage==='ajustes'&&card.note&&<p className="line-clamp-3 text-sm text-orange-400">{card.note}</p>}
      {card.approved_by&&<p className="text-sm text-emerald-500">Aprovado por {card.approved_by}</p>}
      {card.stage==='agendado'&&card.scheduled_at&&<p className="text-sm text-primary">{socialDate(card.scheduled_at)} · {card.channel}</p>}
      {card.stage==='postado'&&card.posted_at&&<p className="text-sm text-muted-foreground">Postado {socialDate(card.posted_at)}</p>}
      <div className="flex items-center justify-between gap-2 pt-1 text-sm"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{background:status?.color}}/>{status?.label}</span><ChevronRight className="h-5 w-5 shrink-0"/></div>
     </div>
    </button>
    {card.stage!=='postado'&&<div className="border-t px-4 py-3">
     <select aria-label={`Mudar etapa de ${card.title}`} value="" disabled={busy} onChange={e=>{if(e.target.value)onMove(card.id,e.target.value)}} className="h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base disabled:opacity-50">
      <option value="" disabled>Mudar etapa…</option>
      {SOCIAL_STAGES.filter(s=>s.id!==card.stage).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
     </select>
    </div>}
   </article>
  })}
  {!visible.length&&<p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma peça nesta etapa com os filtros escolhidos.</p>}
  {visible.length>limit&&<Button variant="outline" className="w-full" onClick={()=>setLimit(n=>n+12)}>Mostrar mais peças ({visible.length-limit})</Button>}
 </section>
}
