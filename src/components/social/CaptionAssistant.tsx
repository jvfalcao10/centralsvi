import {useState} from 'react'
import {Sparkles,Loader2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {socialApi,type Card} from '@/lib/social-board'
export default function CaptionAssistant({card,onGenerated,disabled=false}:{card:Card;onGenerated:(caption:string)=>void;disabled?:boolean}){
 const [brief,setBrief]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const generate=async()=>{if(busy||disabled)return;setBusy(true);setMessage('');try{const result=await socialApi('',{action:'caption_generate',id:card.id,version:card.version,brief});if(result.caption){onGenerated(result.caption);setMessage('Legenda gerada. Confira e ajuste antes de salvar ou publicar.')}else setMessage(result.needs_context||'Conte um pouco mais sobre a peça.')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 return <details className="rounded-xl border p-3"><summary className="cursor-pointer min-h-8 text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary"/>Gerar legenda com IA · Copy Bárbara</summary><div className="space-y-3 pt-3"><label className="block text-sm">Resumo, CTA e detalhes confirmados<Textarea className="mt-2 text-base" rows={3} maxLength={5000} value={brief} disabled={busy||disabled} onChange={e=>setBrief(e.target.value)} placeholder="Para vídeo, conte o que é dito ou cole a transcrição. Acrescente público, oferta e CTA quando houver."/></label><p className="text-xs text-muted-foreground">Usa a peça e o briefing. Frases separadas por uma linha em branco e 4 hashtags no final.</p><Button type="button" variant="outline" disabled={busy||disabled} onClick={()=>void generate()}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}{busy?'Escrevendo a legenda…':'Gerar legenda'}</Button>{message&&<p role="status" className="text-sm whitespace-pre-wrap">{message}</p>}</div></details>
}
