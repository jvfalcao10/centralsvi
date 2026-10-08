import {useState} from 'react'
import {Loader2,Undo2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {socialApi,type Card} from '@/lib/social-board'

/**
 * Devolve a peça para quem a produziu.
 *
 * Num clique a peça volta para "Ajustes", a tarefa no ClickUp volta para
 * "fazendo" com prazo de hoje, e o que precisa mudar chega em comentário na
 * tarefa e no grupo do responsável.
 *
 * Quem recebe não se escolhe aqui: sai de onde a peça veio, pelo autor da
 * entrega e pela tarefa de origem. Escolher de novo a cada ajuste seria repetir
 * uma informação que o sistema já tem.
 */
export default function PedirAjuste({card,disabled=false,abrirJa=false,onPedido}:{card:Card;disabled?:boolean;abrirJa?:boolean;onPedido:()=>Promise<void>}) {
 // Veio pelo menu do card: já abre escrevendo, sem um clique a mais.
 const [aberto,setAberto]=useState(abrirJa),[texto,setTexto]=useState(''),[busy,setBusy]=useState(false),[erro,setErro]=useState('')
 const encerrada=['postado','arquivado'].includes(card.stage)

 const enviar=async()=>{
  if(busy||texto.trim().length<5)return
  setBusy(true);setErro('')
  try{
   await socialApi('',{id:card.id,version:card.version,action:'ajustes',reason:texto.trim()})
   setTexto('');setAberto(false);await onPedido()
  }catch(e){setErro((e as Error).message)}finally{setBusy(false)}
 }

 if(encerrada)return null
 if(!aberto)return <Button variant="outline" className="w-full" disabled={disabled} onClick={()=>setAberto(true)}>
  <Undo2 className="h-4 w-4 mr-2"/>Pedir ajuste para {card.author||'quem entregou'}
 </Button>

 return <section className="rounded-xl border border-orange-400/40 bg-orange-400/5 p-3 space-y-3" aria-label="Pedir ajuste">
  <div>
   <h3 className="text-sm font-semibold">O que precisa mudar?</h3>
   <p className="mt-1 text-xs text-muted-foreground">
    Vai para {card.author||'quem entregou'} em comentário na tarefa e no grupo dele. A tarefa volta para hoje e a peça entra em Ajustes.
   </p>
  </div>
  <Textarea aria-label="O que precisa mudar" className="text-base" rows={3} maxLength={2000} value={texto} disabled={busy}
   onChange={e=>setTexto(e.target.value)} placeholder="Trocar a foto da lâmina 3 pela do consultório. O texto do último slide está cortando."/>
  <div className="flex flex-wrap gap-2">
   <Button size="sm" disabled={busy||texto.trim().length<5} onClick={()=>void enviar()}>
    {busy?<Loader2 className="h-4 w-4 mr-2 animate-spin"/>:null}{busy?'Enviando…':'Enviar ajuste'}
   </Button>
   <Button size="sm" variant="ghost" disabled={busy} onClick={()=>{setAberto(false);setErro('')}}>Cancelar</Button>
  </div>
  {texto.trim().length>0&&texto.trim().length<5&&<p className="text-xs text-muted-foreground">Descreva o ajuste: quem recebe precisa saber o que fazer sem perguntar.</p>}
  {erro&&<p role="alert" className="text-xs text-destructive">{erro}</p>}
 </section>
}
