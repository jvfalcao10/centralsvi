import { digest, normalized, taskClient, whatsappVideo, SOCIAL_WHATSAPP_SOURCES } from './social-sync-domain.js'
import type { createAdminClient } from './supabase.js'
export const MONTHS=['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO']
export function intakeCommand(raw:string) {
 const parts=raw.split('|').map(s=>s.trim()),text=normalized(parts[0])
 const command=/^(postar|central|colocar na central|jogar na central|para postar|e para postar|e pra postar|pode postar|postar na central|aprovado para postar)$/.test(text)?'post':/^(transcrever|transcreve|transcricao|2)$/.test(text)?'transcribe':/^(outra coisa|outro|3)$/.test(text)?'other':/^(cancelar|cancela|nao postar)$/.test(text)?'cancel':/^(aprovado|aprovados)$/.test(text)?'approve':MONTHS.some(m=>normalized(m)===text)?'month':/^(sim|ok|nao)$/.test(text)?'unknown':''
 const month=MONTHS.findIndex(m=>parts.some(p=>normalized(p)===normalized(m)))+1
 const approved=(command==='approve'||text==='aprovado para postar'||parts.slice(1).some(p=>normalized(p)==='aprovado'))
 return {command,approved,month,client:parts.length>1?parts[1]:''}
}
export function intakeSource(m:Record<string,any>) {
 return Object.values(SOCIAL_WHATSAPP_SOURCES).find(s=>s.id.startsWith('direct:')&&(s.group===m.chatid||s.senders.has(m.chatid))&&[m.sender,m.sender_pn,m.sender_lid].some(v=>s.senders.has(v)))
}
export function intakeClient(raw:string,catalog:string[]) {
 const candidate=taskClient({name:`[${raw.trim()}]`})
 return catalog.find(c=>normalized(c)===normalized(candidate))||'Identificar cliente'
}
export async function socialIntake(db:ReturnType<typeof createAdminClient>,m:Record<string,any>) {
 const source=intakeSource(m)
 if(!source||m.fromMe||m.wasSentByApi||!m.id)return {route:'pass'}
 const text=String(m.text||m.content?.caption||'').slice(0,3000),cmd=intakeCommand(text)
 const delivery=whatsappVideo({...m,chatid:source.group},source)
 const now=new Date();const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'numeric'}).formatToParts(now)
 const year=Number(parts.find(p=>p.type==='year')?.value),month=Number(parts.find(p=>p.type==='month')?.value)
 const event:Record<string,any>={id:String(m.id),chat_id:m.chatid,actor:source.author,at:now.toISOString(),text,command:cmd.command,approved:cmd.approved,can_approve:['direct:joao','direct:leticia'].includes(source.id),quoted:String(m.quoted||m.content?.contextInfo?.stanzaId||'')}
 if(delivery||cmd.client){
  const {data,error}=await db.from('central_social_cards').select('client').limit(1000);if(error)throw new Error('database_failed')
  const catalog=[...new Set((data||[]).map(c=>c.client))]
  if(delivery){
   const name=delivery.payload.name.replace(/\.[^.]+$/,'').trim(),prefix=name.split(/\s+-\s+/)[0]
   const client=intakeClient(delivery.client==='Identificar cliente'?prefix:delivery.client,catalog)
   delivery.client=client;delivery.title=delivery.title===source.unidentifiedTitle?name.replace(/\s+v\d{1,3}$/i,'').trim():delivery.title
   if(client!=='Identificar cliente')delivery.card_id='wa-'+digest(`${source.group}|${normalized(client)}|${normalized(delivery.title)}`).slice(0,24)
   delivery.delivery_version=delivery.delivery_version??Number(name.match(/\s+v(\d{1,3})$/i)?.[1]||1)
   event.delivery={...delivery,payload:{...delivery.payload,wa_message_id:m.messageid,year,month,client,title:delivery.title}}
  }
  const client=cmd.client?intakeClient(cmd.client,catalog):''
  if(client&&client!=='Identificar cliente')event.client=client
 }
 if(cmd.month){event.month=cmd.month;event.year=Number(text.match(/\b(20\d{2})\b/)?.[1]||year)}
 const {data,error}=await db.rpc('central_social_intake',{p_event:event});if(error)throw new Error('intake_failed')
 return data
}
