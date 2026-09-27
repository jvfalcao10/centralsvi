import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { socialApi, socialDate } from '@/lib/social-board'
export type FeedbackContext={route:{task_id:string;task_name:string;group_id:string;group_label:string};groups:{id:string;author:string;label:string}[];deliveries:{id:number;event_id:number;channel:string;status:string;sent_at:string|null;created_at:string;error:string|null;payload:{revision:number;group_label:string;task_id:string}}[]}
const statusLabel:Record<string,string>={pending:'Na fila de envio',processing:'Enviando',retry:'Nova tentativa agendada',sent:'Enviado',uncertain:'Conferindo recebimento',blocked:'Precisa de conferência'}
export default function FeedbackRouting({cardId,version,context,onSaved,onDirty}:{cardId:string;version:number;context:FeedbackContext;onSaved:()=>Promise<void>;onDirty:(dirty:boolean)=>void}) {
 const initialTask=context.route.task_id?`https://app.clickup.com/t/${context.route.task_id}`:''
 const [task,setTask]=useState(initialTask),[group,setGroup]=useState(context.route.group_id),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const dirty=task!==initialTask||group!==context.route.group_id
 const save=async()=>{setBusy(true);setError('');try{await socialApi('',{id:cardId,version,action:'destino',task_url:task,group_id:group});onDirty(false);await onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="rounded-lg border p-4 space-y-3" aria-label="Destino do retorno do cliente"><div><h3 className="text-sm font-semibold">Quem recebe a resposta do cliente?</h3><p className="text-xs text-muted-foreground mt-1">Aprovações, reprovações e alterações vão para este grupo e para os comentários desta tarefa.</p></div>
  <label className="block text-xs">Grupo do responsável<select aria-label="Grupo do responsável pelo retorno" value={group} disabled={busy} onChange={e=>{setGroup(e.target.value);onDirty(task!==initialTask||e.target.value!==context.route.group_id)}} className="mt-1 h-11 md:h-10 w-full min-w-0 rounded-md border bg-background px-2 text-base md:text-sm"><option value="">Selecione o responsável</option>{context.groups.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
  <label className="block text-xs">Tarefa correspondente no ClickUp<Input aria-label="Tarefa correspondente no ClickUp" value={task} disabled={busy} placeholder="https://app.clickup.com/t/..." className="mt-1" onChange={e=>{setTask(e.target.value);onDirty(e.target.value!==initialTask||group!==context.route.group_id)}}/></label>
  {context.route.task_name&&!dirty&&<p className="text-xs text-muted-foreground">{context.route.task_name}</p>}
  {(!task||!group)&&<p className="text-xs text-orange-400">Defina os dois destinos para encaminhar os retornos ao grupo e ao ClickUp.</p>}
  {dirty&&<Button size="sm" disabled={busy||!task||!group} onClick={()=>void save()}>{busy?'Conferindo tarefa…':'Salvar destino do retorno'}</Button>}
  {error&&<p role="alert" className="text-xs text-red-400">{error}</p>}
  {!!context.deliveries.length&&<div className="border-t pt-3 space-y-2"><h4 className="text-xs font-semibold">Envio dos retornos</h4>{context.deliveries.map(d=><div key={d.id} className="text-xs"><p>{d.channel==='clickup'?'ClickUp':d.payload.group_label||'WhatsApp'} · v{d.payload.revision} · <span className={d.status==='blocked'?'text-orange-400':'text-muted-foreground'}>{statusLabel[d.status]||d.status}</span></p>{d.sent_at&&<p className="text-muted-foreground">{socialDate(d.sent_at)}</p>}{d.status==='blocked'&&<p className="text-orange-400 mt-1">{d.error==='missing_destination'?'O retorno está salvo. Vincule os destinos acima para liberar o envio.':'O retorno está salvo no histórico. Confira o destino; não envie novamente sem verificar se já chegou.'}</p>}</div>)}</div>}
 </section>
}
