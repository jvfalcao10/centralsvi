import {useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {localInput,socialApi,type Card} from '@/lib/social-board'

export default function PublicationDetails({card,disabled,onSaved}:{card:Card;disabled:boolean;onSaved:()=>Promise<void>}) {
 const [scheduled,setScheduled]=useState(card.scheduled_at?localInput(new Date(card.scheduled_at)):'')
 const [posted,setPosted]=useState(card.posted_at?localInput(new Date(card.posted_at)):'')
 const [channel,setChannel]=useState(card.channel||''),[url,setUrl]=useState(card.posted_url||'')
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const saving=useRef(false)
 const save=async()=>{
  if(saving.current||disabled)return;saving.current=true;setBusy(true);setError('')
  try{await socialApi('',{id:card.id,version:card.version,action:'informacoes',channel,posted_url:url,scheduled_at:scheduled?new Date(scheduled).toISOString():null,posted_at:posted?new Date(posted).toISOString():null});await onSaved()}catch(e){setError((e as Error).message)}finally{saving.current=false;setBusy(false)}
 }
 return <details className="rounded-xl border p-3"><summary className="cursor-pointer py-1 text-sm font-medium">Informações da postagem · opcional</summary><div className="mt-4 space-y-3">
  <label className="block text-sm space-y-1"><span>Data planejada</span><Input type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)} disabled={disabled||busy}/></label>
  {card.stage==='postado'&&<label className="block text-sm space-y-1"><span>Data da publicação</span><Input type="datetime-local" value={posted} onChange={e=>setPosted(e.target.value)} disabled={disabled||busy}/></label>}
  <label className="block text-sm space-y-1"><span>Rede e formato</span><Input value={channel} placeholder="Ex.: Instagram · Feed" onChange={e=>setChannel(e.target.value)} disabled={disabled||busy}/></label>
  <label className="block text-sm space-y-1"><span>Link da publicação</span><Input type="url" value={url} onChange={e=>setUrl(e.target.value)} disabled={disabled||busy}/></label>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  <Button size="sm" disabled={disabled||busy} onClick={()=>void save()}>{busy?'Salvando…':'Salvar informações'}</Button>
 </div></details>
}
