import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {DndContext,PointerSensor,MeasuringStrategy,pointerWithin,useDraggable,useDroppable,useSensor,useSensors} from '@dnd-kit/core'
import {GripVertical,X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {SOCIAL_STAGES,type Card} from '@/lib/social-board'

const MoveContext=createContext<(id:string)=>void>(()=>{})

/** Only the handle captures a drag. The card body keeps native page scrolling. */
export function TouchMoveCard({card,busy,children}:{card:Card;busy:boolean;children:ReactNode}) {
 const choose=useContext(MoveContext)
 const {setNodeRef,setActivatorNodeRef,listeners,attributes,isDragging}=useDraggable({id:card.id,disabled:busy})
 return <article ref={setNodeRef} className={`overflow-hidden rounded-xl border bg-card ${isDragging?'border-primary ring-2 ring-primary/40 opacity-60':''}`}>
  <div className="border-b px-3 py-2">
   <button ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={busy} onClick={()=>choose(card.id)} onContextMenu={e=>e.preventDefault()} aria-label={`Mover ${card.title}`} className="flex min-h-12 w-full touch-none select-none items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-sm font-medium text-muted-foreground active:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50" style={{WebkitTouchCallout:'none'}}>
    <GripVertical className="h-5 w-5"/>Arrastar para outra etapa
   </button>
  </div>
  {children}
 </article>
}

function StageTarget({stage,current,dragging,onChoose}:{stage:typeof SOCIAL_STAGES[number];current:string;dragging:boolean;onChoose:()=>void}) {
 const disabled=stage.id===current
 const {setNodeRef,isOver}=useDroppable({id:stage.id,disabled})
 return <button ref={setNodeRef} type="button" data-touch-stage={stage.id} disabled={disabled} onClick={()=>{if(!dragging)onChoose()}} className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 ${isOver?'border-primary bg-primary text-primary-foreground ring-2 ring-primary':'bg-card active:bg-accent'}`}>
  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:stage.color}}/>{stage.label}
 </button>
}

/** All destinations stay within reach; no horizontal or nested scrolling during a touch drag. */
export default function TouchStageMove({cards,busy,onMove,children}:{cards:Card[];busy:boolean;onMove:(id:string,stage:string)=>void;children:ReactNode}) {
 const [chosen,setChosen]=useState<string|null>(null)
 const [active,setActive]=useState<string|null>(null)
 const [dockAtTop,setDockAtTop]=useState(false)
 const selected=cards.find(c=>c.id===(active||chosen))
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}))
 const cancel=()=>{setActive(null);setChosen(null)}
 useEffect(()=>{if(busy)cancel()},[busy])
 useEffect(()=>{if(!selected)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[selected])
 const move=(id:string,stage:string)=>{cancel();if(!busy&&SOCIAL_STAGES.some(s=>s.id===stage)&&cards.some(c=>c.id===id&&c.stage!==stage))onMove(id,stage)}
 return <DndContext sensors={sensors} autoScroll={false} collisionDetection={pointerWithin} measuring={{droppable:{strategy:MeasuringStrategy.Always}}} onDragStart={({active,activatorEvent})=>{setChosen(null);setDockAtTop('clientY' in activatorEvent&&Number(activatorEvent.clientY)>window.innerHeight/2);setActive(String(active.id))}} onDragCancel={cancel} onDragEnd={({active:ended,over})=>{if(active===String(ended.id)&&over)move(String(ended.id),String(over.id));else cancel()}} accessibility={{screenReaderInstructions:{draggable:'Toque para escolher a etapa, ou arraste pela alça. Deslize pelo corpo da peça para rolar a página.'},announcements:{onDragStart:()=> 'Peça selecionada. Arraste até uma etapa.',onDragOver:({over})=>over?`Solte para mover para ${SOCIAL_STAGES.find(s=>s.id===over.id)?.label}.`:'Solte fora das etapas para cancelar.',onDragEnd:({over})=>over?'Mudança de etapa solicitada.':'Movimento cancelado.',onDragCancel:()=> 'Movimento cancelado.'}}}>
  <MoveContext.Provider value={id=>{if(!busy){setDockAtTop(false);setChosen(id)}}}>{children}</MoveContext.Provider>
  {selected&&!busy&&createPortal(<div role="region" aria-label="Mover peça para outra etapa" className={`fixed inset-x-2 ${dockAtTop?'top-[max(.5rem,env(safe-area-inset-top))]':'bottom-2'} z-50 mx-auto max-w-2xl rounded-2xl border border-primary/50 bg-background p-3 shadow-2xl pb-[max(.75rem,env(safe-area-inset-bottom))]`} style={{maxHeight:'calc(100dvh - 1rem)',overflowY:'auto'}}>
   <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-semibold" aria-live="polite">{active?'Solte na etapa desejada':'Escolha a etapa'}</p><p className="truncate text-xs text-muted-foreground">{selected.title}</p></div><Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 md:h-11 md:w-11" aria-label="Cancelar mudança de etapa" onClick={cancel}><X/></Button></div>
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{SOCIAL_STAGES.map(stage=><StageTarget key={stage.id} stage={stage} current={selected.stage} dragging={!!active} onChoose={()=>move(selected.id,stage.id)}/>)}</div>
   <p className="mt-2 text-xs text-muted-foreground">{active?'Solte fora das etapas para cancelar.':'Você também pode mudar a etapa pelo seletor da peça.'}</p>
  </div>,document.body)}
 </DndContext>
}
