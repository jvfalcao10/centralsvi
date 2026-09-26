import {useRef,useState,type FormEvent} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {localInput,socialApi,type Card} from '@/lib/social-board'

export type StageMoveAction='aprovar'|'ajustes'|'agendar'|'postar'
const titles:Record<StageMoveAction,string>={aprovar:'Registrar aprovação',ajustes:'Mover para Ajustes',agendar:'Agendar postagem',postar:'Marcar como postado'}

export default function StageMoveDialog({card,action,onClose,onSaved}:{card:Card;action:StageMoveAction;onClose:()=>void;onSaved:()=>Promise<void>}) {
 const [name,setName]=useState(''),[evidence,setEvidence]=useState(''),[reason,setReason]=useState('')
 const [date,setDate]=useState(localInput()),[channel,setChannel]=useState(card.channel||'Instagram · Feed'),[url,setUrl]=useState(''),[confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const submitting=useRef(false)
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError('')
  try{
   await socialApi('',{id:card.id,version:card.version,action,name,evidence,reason,channel,posted_url:url,confirmed,
    ...(action==='agendar'?{scheduled_at:new Date(date).toISOString()}:action==='postar'?{posted_at:new Date(date).toISOString()}:{})})
   await onSaved()
  }catch(e){setError((e as Error).message)}finally{submitting.current=false;setBusy(false)}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!submitting.current)onClose()}}>
  <DialogContent className="sm:max-w-md">
   <DialogHeader><DialogTitle>{titles[action]}</DialogTitle><DialogDescription>{card.client} · {card.title}</DialogDescription></DialogHeader>
   <form onSubmit={submit} className="space-y-4">
    {action==='aprovar'&&<><p className="text-sm text-muted-foreground">Registre a aprovação recebida para esta versão.</p><label className="block text-sm space-y-1"><span>Quem aprovou?</span><Input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><label className="block text-sm space-y-1"><span>Onde e quando foi aprovado?</span><Textarea required minLength={8} maxLength={2000} placeholder="Ex.: Maria aprovou no grupo da clínica, hoje às 10h." value={evidence} onChange={e=>setEvidence(e.target.value)} disabled={busy}/></label></>}
    {action==='ajustes'&&<label className="block text-sm space-y-1"><span>O que precisa mudar?</span><Textarea required minLength={5} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label>}
    {['agendar','postar'].includes(action)&&<><label className="block text-sm space-y-1"><span>{action==='agendar'?'Data planejada':'Quando foi publicado?'}</span><Input type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/></label><label className="block text-sm space-y-1"><span>Rede e formato</span><Input required maxLength={100} value={channel} onChange={e=>setChannel(e.target.value)} disabled={busy}/></label><p className="text-xs text-muted-foreground">Este registro organiza o trabalho. A publicação na rede é feita pela equipe.</p></>}
    {action==='postar'&&<><label className="block text-sm space-y-1"><span>Link da publicação (opcional para stories)</span><Input type="url" value={url} onChange={e=>setUrl(e.target.value)} disabled={busy}/></label><label className="flex gap-2 text-sm items-start"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/>Confirmo que já publiquei esta peça.</label></>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>{busy?'Salvando…':'Salvar etapa'}</Button></DialogFooter>
   </form>
  </DialogContent>
 </Dialog>
}
