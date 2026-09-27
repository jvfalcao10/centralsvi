import ApprovalPiece from '@/components/social/ApprovalPiece'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import type { Card } from '@/lib/social-board'

export default function SocialApprove() {
 const {token=''}=useParams();const [card,setCard]=useState<Card|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [name,setName]=useState('')
 useEffect(()=>{let active=true;void fetch('/api/social?token='+encodeURIComponent(token)).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setCard(d.card)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[token])
 return <main className="min-h-svh break-words bg-[#f6f2e9] text-[#26221d] p-3 sm:p-10"><div className="max-w-3xl mx-auto">
  <header className="border-b border-[#d8cbb4] pb-6 flex items-start justify-between gap-4"><div><p className="text-[11px] tracking-[.25em] uppercase text-[#8e6c31]">Central SVI · Aprovação</p><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-3">Vamos conferir sua publicação?</h1></div><span className="font-semibold text-xl tracking-tighter">SVI<span className="text-[#ae853d]">.</span></span></header>
  {loading&&<p className="py-12 flex gap-2 items-center"><Loader2 className="w-5 h-5 animate-spin"/>Carregando a peça…</p>}
  {error&&<p role="alert" className="my-5 rounded-lg bg-red-50 border border-red-200 text-red-800 p-4 text-sm">{error}</p>}
  {card&&<ApprovalPiece key={card.id+':'+card.version} initialCard={card} endpoint={'/api/social?token='+encodeURIComponent(token)} name={name} setName={setName}/>}
  <footer className="text-xs text-[#8d806b] mt-12">SVI Company · Conteúdo e aprovação em um só lugar.</footer>
 </div></main>
}
