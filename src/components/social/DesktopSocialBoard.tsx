import {memo,useEffect,useMemo,useRef,useState} from 'react'
import {DragDropContext,Droppable,Draggable} from '@hello-pangea/dnd'
import {ArrowLeft,ArrowRight,GripVertical} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {CardActionsButton,CardContextMenu,StageSelect} from './CardActions'
import CardSelection,{type CardSelectionProps} from './CardSelection'
import {VideoCover} from './VideoPreview'
import {SOCIAL_STAGES,socialDate,clientTone,type Card} from '@/lib/social-board'

function DesktopSocialBoard({cards,columns,busy,onOpen,onMove,onCopy,selectedIds,onSelect,onPublish}:CardSelectionProps&{
 onPublish?:(id:string)=>void;cards:Card[];columns:typeof SOCIAL_STAGES;busy:boolean;onOpen:(id:string)=>void;onMove:(id:string,stage:string)=>void;onCopy:(text:string)=>void
}) {
 const board=useRef<HTMLDivElement>(null)
 const [dragging,setDragging]=useState(false)
 const pointer=useRef<{x:number;y:number}|null>(null)
 // The DnD library follows the card center; follow the pointer near the board edge as well.
 useEffect(()=>{
  if(!dragging)return
  let frame=0
  const track=(event:MouseEvent)=>{pointer.current={x:event.clientX,y:event.clientY}}
  const tick=()=>{
   const el=board.current,p=pointer.current
   if(el&&p){
    const r=el.getBoundingClientRect(),edge=90
    if(p.y>=r.top&&p.y<=r.bottom&&p.x>=r.left-40&&p.x<=r.right+40){
     const left=Math.max(0,Math.min(1,(r.left+edge-p.x)/edge)),right=Math.max(0,Math.min(1,(p.x-r.right+edge)/edge))
     if(left||right)el.scrollLeft+=(right-left)*24
    }
   }
   frame=requestAnimationFrame(tick)
  }
  window.addEventListener('mousemove',track,true);frame=requestAnimationFrame(tick)
  return()=>{window.removeEventListener('mousemove',track,true);cancelAnimationFrame(frame);pointer.current=null}
 },[dragging])
 // Uma passada em vez de uma por coluna: com 8 etapas eram 8 varreduras nas peças a cada render.
 const byStage=useMemo(()=>{
  const map=new Map<string,Card[]>(columns.map(s=>[s.id,[]]))
  for(const card of cards)map.get(card.stage)?.push(card)
  return map
 },[cards,columns])
 const single=columns.length===1
 const scroll=(direction:number)=>board.current?.scrollBy({left:direction*320,behavior:'smooth'})
 const showPosted=()=>{const el=board.current,posted=el?.querySelector<HTMLElement>('[data-stage="postado"]');if(el&&posted)el.scrollTo({left:posted.offsetLeft-el.offsetLeft,behavior:'smooth'})}
 return <div className="space-y-3">
  {!single&&<div className="flex flex-wrap items-center justify-between gap-3">
   <p className="text-xs text-muted-foreground">Arraste pelas bordas para ver outras etapas, ou use o botão direito.</p>
   <div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Etapas à esquerda" onClick={()=>scroll(-1)}><ArrowLeft/></Button><Button size="icon" variant="outline" aria-label="Etapas à direita" onClick={()=>scroll(1)}><ArrowRight/></Button><Button size="sm" variant="outline" onClick={showPosted}>Ir para Postado</Button></div>
  </div>}
  <DragDropContext autoScrollerOptions={{startFromPercentage:0.2,maxScrollAtPercentage:0.1,maxPixelScroll:28,durationDampening:{accelerateAt:80,stopDampeningAt:400}}} onDragStart={start=>{if(start?.mode==='SNAP')pointer.current=null;setDragging(true)}} onDragEnd={result=>{
   setDragging(false)
   if(busy||result.reason!=='DROP'||!result.destination||result.source.droppableId===result.destination.droppableId)return
   onMove(result.draggableId,result.destination.droppableId)
  }}>
   {/* Every droppable shares ONE scroll parent, including both horizontal and vertical axes. */}
   <div ref={board} onMouseDownCapture={e=>{pointer.current={x:e.clientX,y:e.clientY}}} className={`relative max-h-[70vh] overflow-auto overscroll-contain pb-3 rounded-xl ${dragging?'ring-1 ring-primary/40':''}`} aria-label="Kanban de postagens">
    <div className={`flex items-stretch gap-4 ${single?'':'min-w-max'}`}>
     {columns.map(stage=>{const group=byStage.get(stage.id)||[];return <section key={stage.id} data-stage={stage.id} className={`${single?'w-full':'w-[300px] shrink-0'} flex flex-col rounded-xl border bg-muted/20`}>
      <div className="sticky top-0 z-10 rounded-t-xl bg-background"><div className="h-1 rounded-t-xl" style={{background:stage.color}}/><div className="p-4 border-b"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{stage.label}</h2><span className="text-xs rounded-md bg-muted px-2 py-1">{group.length}</span></div><p className="mt-1 text-xs text-muted-foreground">{stage.hint}</p></div></div>
      <Droppable droppableId={stage.id}>{provided=><div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 p-3 min-h-[260px] ${single?'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 content-start items-start gap-3':'space-y-3'}`}>
       {group.map((card,index)=><Draggable key={card.id} draggableId={card.id} index={index} isDragDisabled={busy}>{p=><CardContextMenu card={card} busy={busy} onOpen={onOpen} onMove={onMove} onCopy={onCopy} onPublish={onPublish}>
        <article ref={p.innerRef} {...p.draggableProps} className={`rounded-lg border bg-card hover:border-primary/60 transition-colors overflow-hidden ${selectedIds?.has(card.id)?'border-primary ring-1 ring-primary/40':''}`}>
         <div className="flex items-center justify-between border-b pl-2 pr-1">{onSelect&&<CardSelection card={card} checked={!!selectedIds?.has(card.id)} busy={busy} onSelect={onSelect}/>}<div {...p.dragHandleProps} aria-label={`Arrastar ${card.title}`} className="flex min-h-9 flex-1 cursor-grab items-center gap-2 text-xs text-muted-foreground"><GripVertical className="h-4 w-4"/>Arrastar peça</div><CardActionsButton card={card} busy={busy} onOpen={onOpen} onMove={onMove} onCopy={onCopy} onPublish={onPublish}/></div>
         <button className="block w-full text-left" aria-label={`Abrir ${card.title}`} onClick={e=>{if(!e.defaultPrevented)onOpen(card.id)}}>
          <VideoCover key={`${card.id}:${card.preview||''}`} asset={card.assets.find(a=>a.id===card.selected_assets[0])||card.assets[0]} preview={card.preview}/>
          <div className="p-3 space-y-2"><span className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{color:clientTone(card.client),backgroundColor:clientTone(card.client)+'1f'}}><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:clientTone(card.client)}}/><span className="truncate">{card.client}</span></span><h3 className="text-sm leading-snug line-clamp-3 font-medium">{card.title}</h3>
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

// O quadro só redesenha quando as peças mudam. Digitar na legenda, no título ou
// na nota não mexe em nenhuma destas props, então os cards ficam parados.
export default memo(DesktopSocialBoard)
