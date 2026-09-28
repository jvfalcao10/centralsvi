import {createContext,useContext,useEffect,useRef,useState,type ReactNode,type RefObject} from 'react'
import {createPortal} from 'react-dom'
import {DndContext,DragOverlay,PointerSensor,MeasuringStrategy,pointerWithin,useDraggable,useDroppable,useSensor,useSensors} from '@dnd-kit/core'
import {GripVertical,X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {SOCIAL_STAGES,type Card} from '@/lib/social-board'

const MoveContext=createContext<(id:string)=>void>(()=>{})

/** Only the handle captures a drag. The card body keeps native scrolling in both axes. */
export function TouchMoveCard({card,busy,children,selection,selected}:{card:Card;busy:boolean;children:ReactNode;selection?:ReactNode;selected?:boolean}) {
 const choose=useContext(MoveContext)
 const {setNodeRef,setActivatorNodeRef,listeners,attributes,isDragging}=useDraggable({id:card.id,disabled:busy})
 return <article ref={setNodeRef} className={`overflow-hidden rounded-xl border bg-card ${isDragging?'border-primary ring-2 ring-primary/40 opacity-50':selected?'border-primary ring-1 ring-primary/40':''}`}>
  <div className="flex items-center gap-2 border-b px-2 py-1">{selection}
   <button ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={busy} onClick={()=>choose(card.id)} onContextMenu={e=>e.preventDefault()} aria-label={`Mover ${card.title}`} className="flex min-h-12 min-w-0 flex-1 touch-none select-none items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground active:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50" style={{WebkitTouchCallout:'none'}}>
    <GripVertical className="h-5 w-5 shrink-0"/>Arrastar peça
   </button>
  </div>
  {children}
 </article>
}

export function TouchStageColumn({stage,count,children}:{stage:typeof SOCIAL_STAGES[number];count:number;children:ReactNode}) {
 const {setNodeRef,isOver}=useDroppable({id:stage.id})
 return <section ref={setNodeRef} data-touch-stage={stage.id} aria-label={stage.label} className={`flex h-[min(68dvh,760px)] min-h-[340px] w-[min(300px,calc(100vw-3.5rem))] shrink-0 flex-col overflow-hidden rounded-xl border ${isOver?'border-primary bg-primary/10 ring-2 ring-primary/50':'bg-muted/20'}`}>
  <header className="shrink-0 border-b bg-background"><div className="h-1" style={{background:stage.color}}/><div className="p-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{stage.label}</h2><span className="rounded-md bg-muted px-2 py-1 text-xs tabular-nums">{count}</span></div><p className="mt-1 text-xs text-muted-foreground">{stage.hint}</p></div></header>
  <div data-touch-stage-list={stage.id} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain p-2 pb-4" style={{WebkitOverflowScrolling:'touch'}}>{children}</div>
 </section>
}

/** Native column/board scrolling, with edge scrolling while a handle is held. */
export default function TouchStageMove({cards,busy,onMove,children,boardRef}:{cards:Card[];busy:boolean;onMove:(id:string,stage:string)=>void;children:ReactNode;boardRef:RefObject<HTMLDivElement>}) {
 const [chosen,setChosen]=useState<string|null>(null)
 const [active,setActive]=useState<string|null>(null)
 const pointer=useRef<{x:number;y:number}|null>(null)
 const selected=cards.find(c=>c.id===(active||chosen))
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}))
 const cancel=()=>{setActive(null);setChosen(null);pointer.current=null}
 useEffect(()=>{if(busy)cancel()},[busy])
 useEffect(()=>{if(!selected)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[selected])
 useEffect(()=>{
  if(!active)return
  let frame=0,last=0
  const track=(e:PointerEvent)=>{pointer.current={x:e.clientX,y:e.clientY}}
  const velocity=(p:number,start:number,end:number,edge:number)=>Math.max(0,Math.min(1,(p-end+edge)/edge))-Math.max(0,Math.min(1,(start+edge-p)/edge))
  const tick=(time:number)=>{
   const board=boardRef.current,p=pointer.current,scale=last?Math.min(2,(time-last)/16.67):1;last=time
   if(board&&p){
    const r=board.getBoundingClientRect(),top=Math.max(0,r.top),bottom=Math.min(window.innerHeight,r.bottom)
    if(p.y>=top&&p.y<=bottom&&p.x>=r.left-24&&p.x<=r.right+24){
     board.scrollLeft+=velocity(p.x,Math.max(0,r.left),Math.min(window.innerWidth,r.right),64)*18*scale
     for(const list of board.querySelectorAll<HTMLElement>('[data-touch-stage-list]')){
      const box=list.getBoundingClientRect()
      if(p.x>=box.left&&p.x<=box.right&&p.y>=box.top&&p.y<=box.bottom)list.scrollTop+=velocity(p.y,Math.max(top,box.top),Math.min(bottom,box.bottom),56)*14*scale
     }
    }
   }
   frame=requestAnimationFrame(tick)
  }
  document.addEventListener('pointermove',track,true);frame=requestAnimationFrame(tick)
  return()=>{document.removeEventListener('pointermove',track,true);cancelAnimationFrame(frame)}
 },[active,boardRef])
 const move=(id:string,stage:string)=>{cancel();if(!busy&&SOCIAL_STAGES.some(s=>s.id===stage)&&cards.some(c=>c.id===id&&c.stage!==stage))onMove(id,stage)}
 return <DndContext sensors={sensors} autoScroll={false} collisionDetection={args=>{const p=args.pointerCoordinates,r=boardRef.current?.getBoundingClientRect();return p&&r&&p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom?pointerWithin(args):[]}} measuring={{droppable:{strategy:MeasuringStrategy.Always}}} onDragStart={({active,activatorEvent})=>{setChosen(null);if('clientX' in activatorEvent&&'clientY' in activatorEvent)pointer.current={x:Number(activatorEvent.clientX),y:Number(activatorEvent.clientY)};setActive(String(active.id))}} onDragCancel={cancel} onDragEnd={({active:ended,over})=>{if(active===String(ended.id)&&over)move(String(ended.id),String(over.id));else cancel()}} accessibility={{screenReaderInstructions:{draggable:'Toque para escolher a etapa, ou arraste pela alça até uma coluna. Deslize pelo corpo da peça para rolar.'},announcements:{onDragStart:()=> 'Peça selecionada. Arraste até uma coluna.',onDragOver:({over})=>over?`Solte para mover para ${SOCIAL_STAGES.find(s=>s.id===over.id)?.label}.`:'Solte fora das colunas para cancelar.',onDragEnd:({over})=>over?'Mudança de etapa solicitada.':'Movimento cancelado.',onDragCancel:()=> 'Movimento cancelado.'}}}>
  <MoveContext.Provider value={id=>{if(!busy&&!active)setChosen(id)}}>{children}</MoveContext.Provider>
  {createPortal(<DragOverlay dropAnimation={null}>{active&&selected&&<div role="status" aria-label="Arrastando peça" className="w-64 rounded-xl border border-primary bg-card p-4 shadow-xl pointer-events-none"><p className="text-xs font-semibold text-primary">{selected.client}</p><p className="mt-1 line-clamp-2 text-sm font-semibold">{selected.title}</p><p className="mt-2 text-xs text-muted-foreground">Solte na coluna desejada</p></div>}</DragOverlay>,document.body)}
  {selected&&chosen&&!active&&!busy&&createPortal(<div role="region" aria-label="Mover peça para outra etapa" className="fixed inset-x-2 bottom-2 z-50 mx-auto max-w-2xl rounded-2xl border border-primary/50 bg-background p-3 shadow-2xl pb-[max(.75rem,env(safe-area-inset-bottom))]" style={{maxHeight:'calc(100dvh - 1rem)',overflowY:'auto'}}>
   <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-semibold">Escolha a etapa</p><p className="truncate text-xs text-muted-foreground">{selected.title}</p></div><Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 md:h-11 md:w-11" aria-label="Cancelar mudança de etapa" onClick={cancel}><X/></Button></div>
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{SOCIAL_STAGES.map(stage=><button key={stage.id} type="button" disabled={stage.id===selected.stage} onClick={()=>move(selected.id,stage.id)} className="flex min-h-14 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm font-medium active:bg-accent disabled:opacity-40"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:stage.color}}/>{stage.label}</button>)}</div>
  </div>,document.body)}
 </DndContext>
}
