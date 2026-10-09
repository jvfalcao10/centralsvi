import type { SupabaseClient } from '@supabase/supabase-js'
import type { SocialCard } from './social-domain.js'
import { SocialError } from './social-domain.js'
type DB=SupabaseClient
export type FeedbackGroup={id:string;author:string;label:string;jid:string;enabled:boolean}
export type FeedbackJob={id:number;event_id:number;card_id:string;channel:'clickup'|'whatsapp';destination:string;attempts:number;dispatched_at:string|null;created_at:string;payload:{client:string;title:string;revision:number;actor:string;action:string;comment:string;created_at:string;files:string[];task_id:string|null;group_label:string|null}}
export function taskId(input:unknown) {
 if(typeof input!=='string')return null
 const s=input.trim();if(/^[A-Za-z0-9]{5,40}$/.test(s))return s
 return /^https:\/\/app\.clickup\.com\/t\/([A-Za-z0-9]{5,40})\/?(?:[?#][^\s]*)?$/.exec(s)?.[1]||null
}
function checked<T extends {error:unknown}>(result:T):T {if(result.error)throw new Error('feedback_database_error');return result}
export async function feedbackContext(db:DB,card:SocialCard) {
 const [{data:groups},{data:stored},{data:deliveries}]=await Promise.all([
  db.from('central_social_feedback_groups').select('*').eq('enabled',true).order('author').then(checked),
  db.from('central_social_feedback_routes').select('*').eq('card_id',card.id).maybeSingle().then(checked),
  db.from('central_social_feedback_outbox').select('id,event_id,channel,status,attempts,sent_at,error,created_at,payload').eq('card_id',card.id).order('id',{ascending:false}).limit(20).then(checked)
 ])
 const group=(groups as FeedbackGroup[]).find(g=>stored?g.id===stored.group_id:g.author===card.author)
 return {route:{task_id:stored?.task_id||taskId(card.source_url)||'',task_name:stored?.task_name||'',group_id:group?.id||'',group_label:group?.label||''},groups:(groups as FeedbackGroup[]).map(({id,author,label})=>({id,author,label})),deliveries}
}
class DeliveryError extends Error {constructor(public code:string,public status:number,public ambiguous=false){super(code)}}
// Atualizar tarefa no ClickUp é PUT; comentar é POST. Sem o método explícito,
// o pedido de prazo virava um POST em /task/{id} e o ClickUp recusava.
async function request(channel:'clickup'|'whatsapp',path:string,body?:Record<string,unknown>,metodo?:'POST'|'PUT') {
 const token=channel==='clickup'?process.env.SOCIAL_CLICKUP_TOKEN:process.env.SOCIAL_UAZ_TOKEN
 if(!token)throw new DeliveryError('configuration_missing',0)
 let r:Response
 try{r=await fetch((channel==='clickup'?'https://api.clickup.com/api/v2':'https://svicompany.uazapi.com')+path,{method:metodo||(body?'POST':'GET'),headers:channel==='clickup'?{Authorization:token,'Content-Type':'application/json'}:{token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)})}catch{throw new DeliveryError('provider_timeout',0,!!body)}
 if(!r.ok)throw new DeliveryError(`provider_${r.status}`,r.status,!!body&&r.status>=500)
 try{return await r.json()}catch{throw new DeliveryError('provider_response_invalid',0,!!body)}
}
export async function verifyFeedbackTask(id:string){
 let task
 try{task=await request('clickup','/task/'+id)}catch{throw new SocialError(400,'Não foi possível conferir essa tarefa no ClickUp. Verifique o link e tente novamente.')}
 if(task.id!==id||String(task.team_id)!=='9015595861'||task.archived)throw new SocialError(400,'Escolha uma tarefa ativa do ClickUp da SVI.')
 return {id:task.id as string,name:String(task.name).slice(0,500)}
}
export async function saveFeedbackRoute(db:DB,card:SocialCard,body:Record<string,unknown>,actor:string,actorId:string|null) {
 const id=taskId(body.task_url);if(!id)throw new SocialError(400,'Cole o link da tarefa correspondente no ClickUp.')
 const context=await feedbackContext(db,card)
 if(!context.groups.some(g=>g.id===body.group_id))throw new SocialError(400,'Selecione o grupo do responsável pela peça.')
 const task=await verifyFeedbackTask(id)
 const {error}=await db.rpc('central_social_feedback_route',{p_id:card.id,p_expected:body.version,p_task:task.id,p_task_name:task.name,p_group:body.group_id,p_actor:actor,p_actor_id:actorId})
 if(error){if(error.message.includes('version_conflict'))throw new SocialError(409,'Esta peça mudou. Reabra e confira.');throw error}
}
export function feedbackText(job:FeedbackJob) {
 const p=job.payload as FeedbackJob['payload']&{texto_pronto?:string}
 // O convite que a Sofia leva ao cliente é escrito na hora do pedido, com a
 // legenda e o link daquela versão. Não cabe no molde de retorno interno.
 if(p.texto_pronto)return job.channel==='clickup'?`${p.texto_pronto}\n[SVI retorno ${job.event_id}]`:p.texto_pronto
 const decision=({cliente_aprovar:'APROVADO',cliente_ajustes:'ALTERAÇÃO SOLICITADA',cliente_reprovar:'REPROVADO',ajustes:'AJUSTE PEDIDO PELA EQUIPE'} as Record<string,string>)[p.action]||'RETORNO DO CLIENTE'
 const date=new Date(p.created_at).toLocaleString('pt-BR',{timeZone:'America/Belem'})
 // Pedido da equipe não é retorno de cliente: quem lê precisa saber de quem
 // veio e que a tarefa voltou para hoje.
 const interno=p.action==='ajustes'
 return [`${decision} · ${p.client}`,`${p.title} · versão ${p.revision}`,
  interno?`Pedido por ${p.actor}, em ${date}. A tarefa voltou para hoje.`:`Resposta de ${p.actor}, em ${date}.`,
  p.comment?`\n${interno?'O que ajustar':'Comentário do cliente'}:\n${p.comment}`:'',
  p.files?.length?`\nArquivos desta versão:\n${p.files.join('\n')}`:'',
  `\nCentral: https://central.svicompany.com.br/content/social?peca=${encodeURIComponent(job.card_id)}`,
  p.task_id?`ClickUp: https://app.clickup.com/t/${p.task_id}`:'',`[SVI retorno ${job.event_id}]`].filter(Boolean).join('\n')
}
/**
 * O vídeo vai no WhatsApp mesmo, antes do link.
 *
 * O cliente já está no WhatsApp e assiste ali, sem abrir página nenhuma. Sai a
 * cópia leve (7,4 MB no vídeo medido), nunca o arquivo do editor.
 *
 * Nada aqui pode derrubar o envio do link: se a mídia falhar, o cliente ainda
 * recebe o endereço para aprovar, que é o que não pode faltar.
 */
async function enviarVideo(job:FeedbackJob):Promise<boolean> {
 const p=job.payload as {midia_url?:string}
 if(job.channel!=='whatsapp'||!p.midia_url)return false
 const track=`midia-${job.event_id}`
 try{
  // Uma tentativa anterior pode ter chegado ao provedor antes de estourar o
  // tempo. Conferir evita o cliente receber o mesmo vídeo duas vezes.
  const d=await request('whatsapp','/message/find',{chatid:job.destination,track_source:'central-social',track_id:track,limit:50,offset:0})
  // Já está lá: devolve true para a prévia do link continuar desligada.
  if(Array.isArray(d.messages)&&d.messages.some((m:{track_id?:string})=>m.track_id===track))return true
 }catch{/* não conseguir conferir não pode impedir o envio */}
 try{
  await request('whatsapp','/send/media',{number:job.destination,type:'video',file:p.midia_url,text:'',
   readchat:false,readmessages:false,track_source:'central-social',track_id:track,async:false})
  return true
 }catch{/* o link é o que não pode faltar */}
 return false
}
export const feedbackProvider={
 async find(job:FeedbackJob):Promise<string|null> {
  if(job.channel==='whatsapp'){
   const d=await request('whatsapp','/message/find',{chatid:job.destination,track_source:'central-social',track_id:`feedback-${job.event_id}`,limit:100,offset:0})
   if(!Array.isArray(d.messages))throw new DeliveryError('provider_response_invalid',0)
   const match=d.messages.find((m:{track_id?:string;chatid?:string;id?:string;messageid?:string})=>m.track_id===`feedback-${job.event_id}`&&m.chatid===job.destination)
   return match?String(match.id||match.messageid):null
  }
  let query='';const marker=`[SVI retorno ${job.event_id}]`
  for(let page=0;page<10;page++){
   const d=await request('clickup',`/task/${job.destination}/comment${query}`)
   if(!Array.isArray(d.comments))throw new DeliveryError('provider_response_invalid',0)
   const match=d.comments.find((c:{comment_text?:string})=>c.comment_text?.includes(marker))
   if(match)return String(match.id)
   const last=d.comments.at(-1)
   if(d.comments.length<25||!last||Number(last.date)<Date.parse(job.created_at)-60000)return null
   query=`?start=${encodeURIComponent(last.date)}&start_id=${encodeURIComponent(last.id)}`
  }
  throw new DeliveryError('history_needs_review',0)
 },
 async send(job:FeedbackJob):Promise<string> {
  const text=feedbackText(job)
  const mandouVideo=await enviarVideo(job)
  // Pedido de ajuste devolve a tarefa para a bancada e para o dia de hoje, que
  // é o que faz ela subir na lista de quem vai executar. Falhar aqui não pode
  // impedir o comentário: o aviso vale mais que o prazo.
  if(job.channel==='clickup'&&job.destination&&(job.payload as {retomar_tarefa?:boolean}).retomar_tarefa){
   const hoje=new Date();hoje.setHours(23,59,0,0)
   const status=(job.payload as {status_tarefa?:string}).status_tarefa||'fazendo'
   try{await request('clickup',`/task/${job.destination}`,{status,due_date:hoje.getTime(),due_date_time:true},'PUT')}catch{/* o comentário é o que não pode faltar */}
  }
  const d=job.channel==='clickup'?await request('clickup',`/task/${job.destination}/comment`,{comment_text:text,notify_all:true}):await request('whatsapp','/send/text',{number:job.destination,text,// Com o vídeo no grupo, a prévia do link vira um segundo bloco com o MESMO
   // quadro de capa, e na tela do cliente parece que a peça foi mandada duas
   // vezes. Sem vídeo, a prévia continua ajudando a reconhecer a peça.
   linkPreview:!mandouVideo&&!!(job.payload as {texto_pronto?:string}).texto_pronto,readchat:false,readmessages:false,track_source:'central-social',track_id:`feedback-${job.event_id}`,async:false})
  const id=d.id||d.messageid
  if(!id)throw new DeliveryError('provider_response_invalid',0,true)
  return String(id)
 }
}
export async function deliverFeedback(job:FeedbackJob,markDispatched:()=>Promise<void>,provider=feedbackProvider) {
 try {
  if(!job.destination)return {status:'blocked',error:'missing_destination'}
  const existing=await provider.find(job)
  if(existing)return {status:'sent',remote_id:existing,sent_at:new Date().toISOString(),error:null}
  // A timed-out or interrupted POST may already have reached the provider. Reconcile only; never blind resend.
  if(job.dispatched_at)return {status:job.attempts>=8?'blocked':'uncertain',error:'delivery_needs_review'}
  await markDispatched()
  try {const id=await provider.send(job);return {status:'sent',remote_id:id,sent_at:new Date().toISOString(),error:null}}
  catch(e){if(e instanceof DeliveryError&&!e.ambiguous&&e.status>=400&&e.status<500)return {status:e.status===429?'retry':'blocked',error:e.code,dispatched_at:null};return {status:'uncertain',error:'delivery_needs_review'}}
 } catch(e){return {status:job.attempts>=8?'blocked':'retry',error:e instanceof DeliveryError?e.code:'delivery_unavailable'}}
}
export async function processFeedback(db:DB,limit=4) {
 const results=[],start=Date.now()
 for(let i=0;i<limit&&Date.now()-start<30000;i++){
  const {data:job}=checked(await db.rpc('central_social_feedback_claim',{}));if(!job)break
  const j=job as FeedbackJob
  // Assinar aqui, e não na hora de enfileirar: uma tentativa que acontece
  // horas depois precisa de um endereço vivo.
  const caminho=(j.payload as {midia_path?:string}).midia_path
  if(j.channel==='whatsapp'&&caminho){
   const {data:assinado}=await db.storage.from('central-social').createSignedUrl(caminho,21600)
   if(assinado?.signedUrl)(j.payload as {midia_url?:string}).midia_url=assinado.signedUrl
  }
  const result=await deliverFeedback(j,async()=>{
   const {data}=checked(await db.from('central_social_feedback_outbox').update({dispatched_at:new Date().toISOString()}).eq('id',j.id).eq('status','processing').eq('attempts',j.attempts).gt('lease_until',new Date().toISOString()).select('id').maybeSingle())
   if(!data)throw new Error('lease_expired')
  })
  checked(await db.from('central_social_feedback_outbox').update({...result,lease_until:null,next_attempt_at:new Date(Date.now()+Math.min(60,2**j.attempts)*60000).toISOString(),updated_at:new Date().toISOString()}).eq('id',j.id).eq('attempts',j.attempts).eq('status','processing'))
  results.push({id:j.id,channel:j.channel,status:result.status})
 }
 return {processed:results.length,results}
}
