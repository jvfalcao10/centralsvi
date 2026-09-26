import VideoPreview from '@/components/social/VideoPreview'
import {useState} from 'react'
import {CheckCircle2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import type {Card} from '@/lib/social-board'

export default function ApprovalPiece({initialCard,endpoint,name,setName,onAnswered}:{initialCard:Card;endpoint:string;name:string;setName:(value:string)=>void;onAnswered?:()=>void}) {
 const [card,setCard]=useState(initialCard),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reason,setReason]=useState(''),[decision,setDecision]=useState<'ajustes'|'reprovar'|null>(null),[done,setDone]=useState('')
 const answer=async(action:string)=>{
  if(busy)return;setBusy(true);setError('')
  try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:card.id,action,version:card.version,name,reason})});const d=await r.json();if(!r.ok)throw new Error(d.error);setDone(action);setCard(c=>({...c,...d.card,assets:c.assets}));onAnswered?.()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <article aria-label={card.title} className="py-1">
  {error&&<p role="alert" className="my-5 rounded-lg bg-red-50 border border-red-200 text-red-800 p-4 text-sm">{error}</p>}
<p className="text-xs uppercase tracking-widest text-[#8e6c31] mt-7">{card.client} · Versão {card.revision}</p><h2 className="mt-2 text-xl font-semibold">{card.title}</h2>
   {!done&&<section className="mt-6 space-y-5" aria-label="Arquivos para aprovação">{card.assets.map((a,i)=><figure key={a.id} className="border border-[#ded5c5] rounded-xl overflow-hidden bg-white">
    {a.type.startsWith('video/')?<VideoPreview asset={a}/>:a.type.startsWith('image/')&&a.type!=='image/vnd.adobe.photoshop'?<img src={a.url} alt={`${i+1}. ${a.name}`} className="w-full max-h-[80vh] object-contain"/>:<p className="p-6">Arquivo disponível no link abaixo.</p>}
    <figcaption className="flex justify-between items-center gap-3 text-xs p-3 text-[#746a59]"><span>Arquivo {i+1} de {card.assets.length}</span>{!a.playback_url&&<a className="underline" href={a.url} target="_blank" rel="noreferrer">Abrir original</a>}</figcaption>
   </figure>)}</section>}
   <section className="mt-7 border-y border-[#ded5c5] py-6"><h3 className="text-xs tracking-widest uppercase text-[#8e6c31]">Legenda</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{card.caption||'Aprovação dos arquivos visuais. A legenda ainda não foi definida pela equipe.'}</p></section>
   {done||card.stage!=='aguardando'?<div className="my-7 p-6 rounded-xl bg-white border border-[#ded5c5]"><CheckCircle2 className="text-[#52785a] w-7 h-7 mb-3"/><h3 className="font-semibold text-lg">{done==='cliente_reprovar'?'Reprovação registrada.':done==='cliente_ajustes'?'Pedido de alteração registrado.':card.stage==='aprovado'?'Aprovação registrada.':'Resposta registrada.'}</h3><p className="text-sm text-[#746a59] mt-2">Sua resposta foi salva. A equipe receberá o retorno no grupo responsável e na tarefa desta peça.</p></div>:<section className="my-7 space-y-4"><h3 className="font-semibold text-lg">Está tudo certo com esta versão?</h3><p className="text-sm text-[#746a59]">Confira os arquivos e a legenda antes de responder.</p><Input aria-label="Seu nome" placeholder="Seu nome" value={name} onChange={e=>setName(e.target.value)} className="bg-white border-[#d8cbb4] text-[#26221d]"/>
    <div className="flex flex-wrap gap-3"><Button disabled={busy||name.trim().length<2} onClick={()=>void answer('cliente_aprovar')} className="bg-[#355b41] text-white hover:bg-[#284632]">{busy?'Registrando…':'Aprovar esta versão'}</Button><Button disabled={busy} variant="outline" onClick={()=>setDecision('ajustes')} aria-pressed={decision==='ajustes'} className="bg-white text-[#26221d] border-[#d8cbb4]">Pedir alteração</Button><Button disabled={busy} variant="outline" onClick={()=>setDecision('reprovar')} aria-pressed={decision==='reprovar'} className="bg-white text-[#943d32] border-[#d8cbb4]">Reprovar</Button></div>
    {decision&&<div className="space-y-3 rounded-xl border border-[#d8cbb4] p-4 bg-white"><label htmlFor={`client-feedback-${card.id}`} className="font-medium text-sm">{decision==='reprovar'?'Por que esta versão não foi aprovada?':'O que você deseja alterar?'}</label><Textarea id={`client-feedback-${card.id}`} maxLength={2000} placeholder="Descreva sua orientação. Se for um vídeo, indique também o trecho ou o tempo." value={reason} onChange={e=>setReason(e.target.value)} className="bg-white border-[#d8cbb4] text-[#26221d] min-h-32"/><Button disabled={busy||name.trim().length<2||reason.trim().length<5} onClick={()=>void answer(decision==='reprovar'?'cliente_reprovar':'cliente_ajustes')} className="bg-[#26221d] text-white hover:bg-[#443c33]">{busy?'Registrando…':decision==='reprovar'?'Enviar reprovação e motivo':'Enviar pedido de alteração'}</Button></div>}
   </section>}
 </article>
}
