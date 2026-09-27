import {useCallback,useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import {CheckCircle2,Loader2,RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import ApprovalPiece from '@/components/social/ApprovalPiece'
import type {Card} from '@/lib/social-board'

export default function SocialClientApprove() {
 const {token=''}=useParams(),endpoint='/api/social?bundle='+encodeURIComponent(token)
 const [cards,setCards]=useState<Card[]>([]),[client,setClient]=useState(''),[name,setName]=useState(''),[answered,setAnswered]=useState<string[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{const r=await fetch(endpoint);const d=await r.json();if(!r.ok)throw new Error(d.error);setCards(d.cards);setClient(d.client);setAnswered([])}catch(e){setError((e as Error).message)}finally{setLoading(false)}
 },[endpoint])
 useEffect(()=>{void load()},[load])
 const remaining=cards.filter(c=>!answered.includes(c.id)).length
 return <main className="min-h-svh break-words bg-[#f6f2e9] text-[#26221d] p-3 sm:p-10"><div className="max-w-3xl mx-auto">
  <header className="border-b border-[#d8cbb4] pb-6"><p className="text-[11px] tracking-[.25em] uppercase text-[#8e6c31]">Central SVI · Aprovação</p><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-3">{client||'Seus conteúdos para aprovação'}</h1><p className="text-sm text-[#746a59] mt-3">Confira cada publicação, assista aos vídeos e aprove ou descreva o que deseja alterar.</p></header>
  {error&&<p role="alert" className="my-5 rounded-lg bg-red-50 border border-red-200 text-red-800 p-4 text-sm">{error}</p>}
  <div className="flex items-center justify-between gap-3 py-5"><p role="status" className="text-sm font-medium">{loading?'Carregando conteúdos…':`${remaining} ${remaining===1?'publicação aguardando':'publicações aguardando'} sua resposta`}</p><Button variant="outline" className="bg-white text-[#26221d] border-[#d8cbb4]" size="sm" disabled={loading} onClick={()=>void load()}><RefreshCw className="w-4 h-4 mr-2"/>Atualizar</Button></div>
  {loading?<Loader2 aria-label="Carregando" className="w-6 h-6 animate-spin my-10"/>:<>
   {!error&&remaining===0&&<section className="rounded-xl bg-white border border-[#ded5c5] p-6 my-4"><CheckCircle2 className="w-7 h-7 text-[#52785a] mb-3"/><h2 className="font-semibold text-xl">Tudo conferido por aqui.</h2><p className="text-sm text-[#746a59] mt-2">Não há publicações aguardando sua resposta. Os próximos conteúdos enviados pela equipe aparecerão neste mesmo link.</p></section>}
   <div className="space-y-8">{cards.map((card,i)=><section key={card.id+':'+card.version} className="rounded-2xl border border-[#ded5c5] bg-white/40 px-4 sm:px-7 py-4"><p className="text-[11px] uppercase tracking-widest text-[#8e6c31]">Publicação {i+1} de {cards.length}{answered.includes(card.id)?' · Respondida':''}</p><ApprovalPiece initialCard={card} endpoint={endpoint} name={name} setName={setName} onAnswered={()=>setAnswered(ids=>ids.includes(card.id)?ids:[...ids,card.id])}/></section>)}</div>
  </>}
  <footer className="text-xs text-[#8d806b] mt-12">SVI Company · Conteúdo e aprovação em um só lugar.</footer>
 </div></main>
}
