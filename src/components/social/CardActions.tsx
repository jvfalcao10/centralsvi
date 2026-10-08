import type {ReactElement} from 'react'
import {Copy, Eye, Link2, MoreHorizontal,Send,Undo2,UserCheck} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {ContextMenu,ContextMenuTrigger,ContextMenuContent,ContextMenuItem,ContextMenuLabel,ContextMenuSeparator} from '@/components/ui/context-menu'
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator} from '@/components/ui/dropdown-menu'
import {SOCIAL_STAGES,type Card} from '@/lib/social-board'

type Actions={card:Card;busy:boolean;onOpen:(id:string)=>void;onMove:(id:string,stage:string)=>void;onCopy:(value:string)=>void;onPublish?:(id:string)=>void;onEnviarCliente?:(id:string)=>void;onPedirAjuste?:(id:string)=>void}
function Items({kind,card,busy,onOpen,onMove,onCopy,onPublish,onEnviarCliente,onPedirAjuste}:Actions&{kind:'context'|'dropdown'}) {
 const Item=kind==='context'?ContextMenuItem:DropdownMenuItem
 const Label=kind==='context'?ContextMenuLabel:DropdownMenuLabel
 const Separator=kind==='context'?ContextMenuSeparator:DropdownMenuSeparator
 return <>
  <Item className="min-h-11 gap-2" disabled={busy} onSelect={()=>onOpen(card.id)}><Eye className="h-4 w-4"/>Abrir peça</Item>
  {onEnviarCliente&&<Item className="min-h-11 gap-2" disabled={busy||['postado','arquivado'].includes(card.stage)||!card.selected_assets.length||card.client==='Identificar cliente'} onSelect={()=>onEnviarCliente(card.id)}><UserCheck className="h-4 w-4"/>Mandar para o cliente aprovar</Item>}
  {onPedirAjuste&&<Item className="min-h-11 gap-2" disabled={busy||['postado','arquivado'].includes(card.stage)} onSelect={()=>onPedirAjuste(card.id)}><Undo2 className="h-4 w-4"/>Pedir ajuste para {card.author||'quem entregou'}</Item>}
  {onPublish&&<Item className="min-h-11 gap-2" disabled={busy||!['aprovado','agendado','para_anuncio','postado'].includes(card.stage)} onSelect={()=>onPublish(card.id)}><Send className="h-4 w-4"/>Publicar / programar</Item>}
  <Item className="min-h-11 gap-2" disabled={!card.caption} onSelect={()=>onCopy(card.caption)}><Copy className="h-4 w-4"/>Copiar legenda</Item>
  <Item className="min-h-11 gap-2" onSelect={()=>onCopy(`${window.location.origin}/content/social?peca=${encodeURIComponent(card.id)}`)}><Link2 className="h-4 w-4"/>Copiar link interno</Item>
  <Separator/><Label className="text-xs text-muted-foreground">Mover para</Label>
  {SOCIAL_STAGES.map(stage=><Item key={stage.id} className="min-h-11 gap-2" disabled={busy||stage.id===card.stage} onSelect={()=>onMove(card.id,stage.id)}><span className="h-2 w-2 rounded-full" style={{background:stage.color}}/>{stage.label}{stage.id===card.stage&&<span className="ml-auto text-xs">Atual</span>}</Item>)}
 </>
}
export function CardContextMenu({children,...props}:Actions&{children:ReactElement}) {
 return <ContextMenu><ContextMenuTrigger asChild>{children}</ContextMenuTrigger><ContextMenuContent collisionPadding={12} className="w-64 max-h-[var(--radix-context-menu-content-available-height)] overflow-y-auto overscroll-contain" onClick={e=>e.stopPropagation()}><Items kind="context" {...props}/></ContextMenuContent></ContextMenu>
}
export function CardActionsButton(props:Actions) {
 return <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-11 w-11 min-w-11 md:h-11 md:w-11 md:min-w-11" disabled={props.busy} aria-label={`Opções de ${props.card.title}`} onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}><MoreHorizontal className="h-5 w-5"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" collisionPadding={12} className="w-64 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto overscroll-contain" onClick={e=>e.stopPropagation()}><Items kind="dropdown" {...props}/></DropdownMenuContent></DropdownMenu>
}
export function StageSelect({card,busy,onMove}:{card:Card;busy:boolean;onMove:Actions['onMove']}) {
 return <select aria-label={`Mudar etapa de ${card.title}`} value={card.stage} disabled={busy} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onChange={e=>onMove(card.id,e.target.value)} className="h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base md:text-sm disabled:opacity-50">
  {SOCIAL_STAGES.map(stage=><option key={stage.id} value={stage.id}>{stage.label}</option>)}
 </select>
}
