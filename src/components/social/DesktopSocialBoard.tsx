import {useRef,useState} from 'react'
import {DragDropContext,Droppable,Draggable} from '@hello-pangea/dnd'
import {ArrowLeft,ArrowRight,GripVertical} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {CardActionsButton,CardContextMenu,StageSelect} from './CardActions'
import {VideoCover} from './VideoPreview'
import {SOCIAL_STAGES,socialDate,type Card} from '@/lib/social-board'

export default function DesktopSocialBoard({cards,columns,busy,onOpen,onMove,onCopy}:{
 cards:Card[];columns:typeof SOCIAL_STAGES;busy:boolean;onOpen:(id:string)=>void;onMove:(id:string,stage:string)=>void;onCopy:(text:string)=>void
}) {
 const board=useRef<HTMLDivElement>(null)
 const [dragging,setDragging]=useState(false)
 const single=columns.length===1
 const scroll=(direction:number)=>board.current?.scrollBy({left:direction*320,behavior:'smooth'})
 const showPosted=()=>{const el=board.current,posted=el?.querySelector<HTMLElement>('[data-stage="postado"]');if(el&&posted)el.scrollTo({left:posted.offsetLeft-el.offsetLeft,behavior:'smooth'})}
 return <div className="space-y-3">
  {!single&&<div className="flex flex-wrap items-center justify-between gap-3">
   <p className="text-xs text-muted-foreground">Arraste pelas bordas para ver outras etapas, ou use o botão direito.</p>
   <div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Etapas à esquerda" onClick={()=>scroll(-1)}><ArrowLeft/></Button><Button size="icon" variant="outline" aria-label="Etapas à direita" onClick={()=>scroll(1)}><ArrowRight/></Button><Button size="sm" variant="outline" onClick={showPosted}>Ir para Postado</Button></div>
  </div>}
  <DragDropContext autoScrollerOptions={{startFromPercentage:0.2,maxScrollAtPercentage:0.1,maxPixelScroll:28,durationDampening:{accelerateAt:80,stopDampeningAt:400}}} onDragStart={()=>setDragging(true)} onDragEnd={result=>{
   setDragging(false)
   if(busy||result.reason!=='DROP'||!result.destination||result.source.droppableId===result.destination.droppableId)return
   onMove(result.draggableId,result.destination.droppableId)
  }}>
   {/* Every droppable shares ONE scroll parent, including both horizontal and vertical axes. */}
   <div ref={board} className={`relative max-h-[70vh] overflow-auto overscroll-contain pb-3 rounded-xl ${dragging?'ring-1 ring-primary/40':''}`} aria-label="Kanban de postagens">
    <div className={`flex items-stretch gap-4 ${single?'':'min-w-max'}`}>
     {columns.map(stage=>{const group=cards.filter(c=>c.stage===stage.id);return <section key={stage.id} data-stage={stage.id} className={`${single?'w-full':'w-[300px] shrink-0'} flex flex-col rounded-xl border bg-muted/20`}>
      <div className="sticky top-0 z-10 rounded-t-xl bg-background"><div className="h-1 rounded-t-xl" style={{background:stage.color}}/><div className="p-4 border-b"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{stage.label}</h2><span className="text-xs rounded-md bg-muted px-2 py-1">{group.length}</span></div><p className="mt-1 text-xs text-muted-foreground">{stage.hint}</p></div></div>
      <Droppable droppableId={stage.id}>{provided=><div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 p-3 min-h-[260px] ${single?'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 content-start items-start gap-3':'space-y-3'}`}>
       {group.map((card,index)=><Draggable key={card.id} draggableId={card.id} index={index} isDragDisabled={busy}>{p=><CardContextMenu card={card} busy={busy} onOpen={onOpen} onMove={onMove} onCopy={onCopy}>
        <article ref={p.innerRef} {...p.draggableProps} className="rounded-lg border bg-card hover:border-primary/60 transition-colors overflow-hidden">
         <div className="flex items-center justify-between border-b pl-3 pr-1"><div {...p.dragHandleProps} aria-label={`Arrastar ${card.title}`} className="flex min-h-9 flex-1 cursor-grab items-center gap-2 text-xs text-muted-foreground"><GripVertical className="h-4 w-4"/>Arrastar peça</div><CardActionsButton card={card} busy={busy} onOpen={onOpen} onMove={onMove} onCopy={onCopy}/></div>
         <button className="block w-full text-left" aria-label={`Abrir ${card.title}`} onClick={e=>{if(!e.defaultPrevented)onOpen(card.id)}}>
          <VideoCover key={`${card.id}:${card.preview||''}`} asset={card.assets.find(a=>a.id===card.selected_assets[0])||card.assets[0]} preview={card.preview}/>
          <div className="p-3 space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{card.client}</p><h3 className="text-sm leading-snug line-clamp-3 font-medium">{card.title}</h3>
           {card.ingest_pending&&<p className="text-xs text-orange-400">Importação pendente</p>}
           {card.stage==='ajustes'&&card.note&&<p className="text-xs line-clamp-2 text-orange-400">{card.note}</p>}
           {card.approved_by&&<p className="text-xs text-emerald-500">Aprovado por {card.approved_by}</p>}
           {card.scheduled_at&&card.stage==='agendado'&&<p className="text-xs text-primary">{socialDate(card.scheduled_at)} · {card.channel}</p>}
           {card.posted_at&&<p className="text-xs text-muted-foreground">Postado {socialDate(card.posted_at)}</p>}
           <div className="pt-2 border-t flex justify-between text-xs text-muted-foreground"><span>{card.author} · {card.assets.length} arquivo{card.assets.length===1?'':'s'}</span><span>v{card.revision}</span></div>
          </div>
         </button>
         <div className="border-t p-2"><StageSelect card={card} busy={busy} onMove={onMove}/></div>
        </article>
       </CardContextMenu>}</Draggable>)}{provided.placeholder}{!group.length&&<p className="text-xs text-muted-foreground p-4 text-center">Nenhuma peça nesta etapa.</p>}
      </div>}</Droppable>
     </section>})}
    </div>
   </div>
  </DragDropContext>
 </div>
}
