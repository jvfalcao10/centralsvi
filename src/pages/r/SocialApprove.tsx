import VideoPreview from '@/components/social/VideoPreview'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Card } from '@/lib/social-board'

export default function SocialApprove() {
 const {token=''}=useParams();const [card,setCard]=useState<Card|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [name,setName]=useState('');const [reason,setReason]=useState('');const [adjust,setAdjust]=useState(false);const [done,setDone]=useState('')
 useEffect(()=>{let active=true;void fetch('/api/social?token='+encodeURIComponent(token)).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setCard(d.card)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[token])
 const answer=async(action:string)=>{
  if(!card)return;setBusy(true);setError('')
  try{const r=await fetch('/api/social?token='+encodeURIComponent(token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,version:card.version,name,reason})});const d=await r.json();if(!r.ok)throw new Error(d.error);setDone(action);setCard(c=>c?{...c,...d.card,assets:c.assets}:c)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <main className="min-h-screen bg-[#f6f2e9] text-[#26221d] p-5 sm:p-10"><div className="max-w-3xl mx-auto">
  <header className="border-b border-[#d8cbb4] pb-6 flex items-start justify-between gap-4"><div><p className="text-[11px] tracking-[.25em] uppercase text-[#8e6c31]">Central SVI · Aprovação</p><h1 className="text-3xl font-semibold tracking-tight mt-3">Vamos conferir sua publicação?</h1></div><span className="font-semibold text-xl tracking-tighter">SVI<span className="text-[#ae853d]">.</span></span></header>
  {loading&&<p className="py-12 flex gap-2 items-center"><Loader2 className="w-5 h-5 animate-spin"/>Carregando a peça…</p>}
  {error&&<p role="alert" className="my-5 rounded-lg bg-red-50 border border-red-200 text-red-800 p-4 text-sm">{error}</p>}
  {card&&<><p className="text-xs uppercase tracking-widest text-[#8e6c31] mt-7">{card.client} · Versão {card.revision}</p><h2 className="mt-2 text-xl font-semibold">{card.title}</h2>
   <section className="mt-6 space-y-5" aria-label="Arquivos para aprovação">{card.assets.map((a,i)=><figure key={a.id} className="border border-[#ded5c5] rounded-xl overflow-hidden bg-white">
    {a.type.startsWith('video/')?<VideoPreview asset={a}/>:a.type.startsWith('image/')&&a.type!=='image/vnd.adobe.photoshop'?<img src={a.url} alt={`${i+1}. ${a.name}`} className="w-full max-h-[80vh] object-contain"/>:<p className="p-6">Arquivo disponível no link abaixo.</p>}
    <figcaption className="flex justify-between items-center gap-3 text-xs p-3 text-[#746a59]"><span>Arquivo {i+1} de {card.assets.length}</span><a className="underline" href={a.url} target="_blank" rel="noreferrer">Abrir original</a></figcaption>
   </figure>)}</section>
   <section className="mt-7 border-y border-[#ded5c5] py-6"><h3 className="text-xs tracking-widest uppercase text-[#8e6c31]">Legenda</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{card.caption||'Aprovação dos arquivos visuais. A legenda ainda não foi definida pela equipe.'}</p></section>
   {done||card.stage!=='aguardando'?<div className="my-7 p-6 rounded-xl bg-white border border-[#ded5c5]"><CheckCircle2 className="text-[#52785a] w-7 h-7 mb-3"/><h3 className="font-semibold text-lg">{done==='cliente_ajustes'||card.stage==='ajustes'?'Pedido de ajuste registrado.':'Resposta registrada.'}</h3><p className="text-sm text-[#746a59] mt-2">A equipe acompanha o retorno na Central SVI.</p></div>:<section className="my-7 space-y-4"><h3 className="font-semibold text-lg">Está tudo certo com esta versão?</h3><p className="text-sm text-[#746a59]">Confira os arquivos e a legenda antes de responder.</p><Input aria-label="Seu nome" placeholder="Seu nome" value={name} onChange={e=>setName(e.target.value)} className="bg-white border-[#d8cbb4] text-[#26221d]"/>
    {adjust&&<Textarea aria-label="O que precisa mudar" placeholder="Conte o que precisa mudar nesta peça." value={reason} onChange={e=>setReason(e.target.value)} className="bg-white border-[#d8cbb4] text-[#26221d] min-h-32"/>}
    <div className="flex flex-wrap gap-3"><Button disabled={busy||name.trim().length<2} onClick={()=>void answer('cliente_aprovar')} className="bg-[#355b41] text-white hover:bg-[#284632]">{busy?'Registrando…':'Aprovar esta versão'}</Button>{adjust?<Button disabled={busy||name.trim().length<2||reason.trim().length<5} onClick={()=>void answer('cliente_ajustes')} variant="outline" className="bg-white text-[#26221d] border-[#d8cbb4]">Enviar pedido de ajuste</Button>:<Button disabled={busy} variant="outline" onClick={()=>setAdjust(true)} className="bg-white text-[#26221d] border-[#d8cbb4]">Preciso de um ajuste</Button>}</div>
   </section>}
  </>}
  <footer className="text-xs text-[#8d806b] mt-12">SVI Company · Conteúdo e aprovação em um só lugar.</footer>
 </div></main>
}
