import type {Card} from '@/lib/social-board'

export type CardSelectionProps={selectedIds?:ReadonlySet<string>;onSelect?:(id:string)=>void}
export default function CardSelection({card,checked,busy,onSelect}:{card:Card;checked:boolean;busy:boolean;onSelect:(id:string)=>void}) {
 return <label className="flex h-12 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg active:bg-primary/10" onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
  <input type="checkbox" aria-label={`Selecionar ${card.title}`} checked={checked} disabled={busy} onChange={()=>onSelect(card.id)} className="h-5 w-5 accent-primary disabled:opacity-50"/>
 </label>
}
