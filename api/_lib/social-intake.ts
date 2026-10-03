import { digest, normalized, taskClient, whatsappVideo, SOCIAL_WHATSAPP_SOURCES } from './social-sync-domain.js'
import type { createAdminClient } from './supabase.js'
import { clientGroupApproval } from './social-client-approval.js'
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
// Palavras que nao distinguem um cliente do outro: casar por elas acerta o cliente errado.
const GENERIC=new Set(['dr','dra','doutor','doutora','colegio','escola','clinica','hospital','instituto','espaco','centro','video','videos','final','corte','cortes','reels','reel','story','stories','feed','post','edit','bruto','svi'])

export function intakeClient(raw:string,catalog:string[],fuzzy=false) {
 const clean=normalized(raw).replace(/\s+(?:v)?\d{1,3}$/, '').replace(/^doutora /,'dra ').replace(/^doutor /,'dr ')
 const candidate=taskClient({name:`[${clean==='enia'?'dra enia':clean}]`})
 const exact=catalog.find(c=>normalized(c)===normalized(candidate))
 if(exact)return exact
 // Nome parcial so vale pro NOME DO ARQUIVO, nunca pra conversa solta: "Christo Rei"
 // identifica "COLÉGIO CHRISTO REI", mas "esse e do Daniel, acho" nao vira entrega.
 if(!fuzzy)return 'Identificar cliente'
 const words=(s:string)=>normalized(s).split(' ').filter(t=>t.length>2&&!GENERIC.has(t))
 const tokens=words(candidate)
 if(!tokens.length)return 'Identificar cliente'
 const text=' '+normalized(candidate)+' '
 const hits=catalog.filter(c=>{
  const n=' '+normalized(c)+' '
  if(tokens.every(t=>n.includes(' '+t)))return true
  // Caminho inverso: o cliente aparece no MEIO do titulo ("Editar reel Alice Salazar: Outubro Rosa").
  // Exige dois termos proprios do cliente, senao uma palavra comum arrastaria a peca errada.
  const seus=words(c)
  return seus.length>1&&seus.every(t=>text.includes(' '+t))
 })
 // Dois clientes possiveis e um chute: quem decide e a pessoa, nao o palpite.
 return hits.length===1?hits[0]:'Identificar cliente'
}

/** Catalogo do quadro primeiro, cadastro depois: cliente novo e reconhecido na 1a peca. */
export function resolveClient(raw:string,catalog:string[],roster:string[]) {
 const fromBoard=intakeClient(raw,catalog,true)
 return fromBoard!=='Identificar cliente'?fromBoard:intakeClient(raw,roster,true)
}

// Entrega e afirmacao. Pergunta e duvida, e duvida nao vira postagem sozinha.
const DUVIDA=/\b(?:ficou bom|ficou legal|ficou assim|ficou ruim|ta bom|esta bom|pode ser|pode usar|posso usar|que ach\w*|qual (?:e )?(?:a )?melhor|da uma olhada|de uma olhada|olha ai|olha so|ve se|veja se|vc ach\w*|voce ach\w*|duvida|sera que|me diz\w*|nao sei se|assim mesmo|certo assim|ta certo|prefere)\b/
export const asksSomething=(text:string)=>DUVIDA.test(normalized(text))||/\?/.test(text)
export async function socialIntake(db:ReturnType<typeof createAdminClient>,m:Record<string,any>) {
 const clientApproval=await clientGroupApproval(db,m)
 if(clientApproval)return clientApproval
 const source=intakeSource(m)
 if(!source||m.fromMe||m.wasSentByApi||!m.id)return {route:'pass'}
 const text=String(m.text||m.content?.caption||'').slice(0,3000),cmd=intakeCommand(text)
 const delivery=whatsappVideo({...m,chatid:source.group},source)
 const now=new Date();const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'numeric'}).formatToParts(now)
 const year=Number(parts.find(p=>p.type==='year')?.value),month=Number(parts.find(p=>p.type==='month')?.value)
 const event:Record<string,any>={id:String(m.id),chat_id:m.chatid,actor:source.author,at:now.toISOString(),text,command:cmd.command,approved:cmd.approved,can_approve:['direct:joao','direct:leticia'].includes(source.id),quoted:String(m.quoted||m.content?.contextInfo?.stanzaId||'')}
 if(delivery||cmd.client||(!cmd.command&&text.length<100)){

  const {data,error}=await db.from('central_social_cards').select('client').limit(1000);if(error)throw new Error('database_failed')
  const catalog=[...new Set((data||[]).map(c=>c.client))].filter(c=>c&&c!=='Identificar cliente')
  const {data:rows}=await db.from('clients').select('name').limit(1000)
  const roster=[...new Set((rows||[]).map((c:Record<string,any>)=>String(c.name||'')))].filter(Boolean)
  if(!delivery&&!cmd.command&&intakeClient(text,catalog)!=='Identificar cliente'){cmd.command='post';cmd.client=text;event.command='post'}
  if(delivery){
   const name=delivery.payload.name.replace(/\.[^.]+$/,'').trim(),prefix=name.split(/\s+-\s+/)[0]
   const client=resolveClient(delivery.client==='Identificar cliente'?prefix:delivery.client,catalog,roster)
   delivery.client=client;delivery.title=delivery.title===source.unidentifiedTitle?name.replace(/\s+v\d{1,3}$/i,'').trim():delivery.title
   if(client!=='Identificar cliente')delivery.card_id='wa-'+digest(`${source.group}|${normalized(client)}|${normalized(delivery.title)}`).slice(0,24)
   delivery.delivery_version=delivery.delivery_version??Number(name.match(/\s+v(\d{1,3})$/i)?.[1]||1)
   event.delivery={...delivery,payload:{...delivery.payload,wa_message_id:m.messageid,year,month,client,title:delivery.title}}
   // João's explicit routing rule: a video document is a Central delivery; native video is transcription.
   const explicit=['post','transcribe','cancel','other'].includes(cmd.command)
   // Arquivo de video era postagem automatica. Quando vem com pergunta junto, nao e
   // entrega: e duvida, e virava card sozinho. Agora a Sofia pergunta o destino.
   event.command=explicit?cmd.command:asksSomething(text)?'unknown':String(m.messageType||'').toLowerCase().includes('document')?'post':'transcribe'
   event.quoted=String(m.id) // The new file never acts on other pending deliveries in this chat.
   event.at=delivery.payload.at
  }
  const client=cmd.client?intakeClient(cmd.client,catalog):''
  if(client&&client!=='Identificar cliente')event.client=client
 }
 if(cmd.month){event.month=cmd.month;event.year=Number(text.match(/\b(20\d{2})\b/)?.[1]||year)}
 const {data,error}=await db.rpc('central_social_intake',{p_event:event});if(error)throw new Error('intake_failed')
 return data
}
