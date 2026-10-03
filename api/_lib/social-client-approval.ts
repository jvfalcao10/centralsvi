import { normalized, taskClient, SOCIAL_WHATSAPP_SOURCES } from './social-sync-domain.js'
import { socialPatch, type SocialCard } from './social-domain.js'
import type { createAdminClient } from './supabase.js'

// Client approval written in the client's own WhatsApp group (João, 03/10/2026).
// The delivery workflow posts the ClickUp art in the group and leaves the task in
// "com o cliente"; until now someone had to flip it by hand after the client said
// "aprovado". Only the client counts, and the approval covers every piece that was
// sent to the group before the reply (batches of several images are common).
export const CLIENT_GROUPS:Record<string,{client:string;aliases:string[]}> = {
 '120363425181175749@g.us':{client:'Carlotinha Veículos',aliases:['carlotinha']},
 '120363409719869240@g.us':{client:'GM Gás',aliases:['gm gas','gmgas']},
 '120363427113718588@g.us':{client:'Dra. Erika Figueiredo',aliases:['erika']},
 '120363410634078473@g.us':{client:'Pró Uro',aliases:['prouro','pro uro']},
 '120363398993688376@g.us':{client:'A Fórmula',aliases:['formula','aformula']},
 '120363401223133759@g.us':{client:'Alpha Fitness',aliases:['alpha']},
 '120363426095519323@g.us':{client:'Colégio Christo Rei',aliases:['christo rei','cristo rei','ccr']},
 '120363421247209504@g.us':{client:'Dr. Brenno Cangussu',aliases:['brenno']},
 '120363409577489258@g.us':{client:'Dra. Ênia',aliases:['enia']},
 '120363422925949309@g.us':{client:'Dr. Daniel Peralba',aliases:['daniel','peralba']},
 '120363403784001418@g.us':{client:'Dr. Felipe Branco',aliases:['felipe']},
 '120363425888591043@g.us':{client:'Dra. Ésia',aliases:['esia']},
 '120363405081976310@g.us':{client:'Espaço Soraia',aliases:['soraia']},
 '120363301843321040@g.us':{client:'Exatta Solar',aliases:['exatta']},
 '120363422788943235@g.us':{client:'Norte Capital',aliases:['norte capital']},
 '120363402155862408@g.us':{client:'Números Contabilidade',aliases:['numeros']},
 '120363382801025009@g.us':{client:'Spa Nature',aliases:['spa nature']},
 '120363421173501760@g.us':{client:'Vanessa Back',aliases:['vanessa']},
 '120363409807532675@g.us':{client:'TE Mulher',aliases:['te mulher','temulher']},
 '120363412486241905@g.us':{client:'Alice Salazar',aliases:['alice']},
 '120363430603367858@g.us':{client:'Dr. Geraldo',aliases:['geraldo']},
 '120363428466672308@g.us':{client:'Clínica LIV',aliases:['liv']},
 '120363406261232737@g.us':{client:'Aerojet',aliases:['aerojet']},
 '120363408134784827@g.us':{client:'Dra. Luana',aliases:['luana']},
}
// Last 8 digits, the same rule as the Sofia whitelist; 33005199 is Sofia herself.
const TEAM_SUFFIX = ['92404033','92941072','92416107','92446604','96142150','96238835','91836693','96740929','20007880','33005199']
const TEAM_IDS = new Set(Object.values(SOCIAL_WHATSAPP_SOURCES).flatMap(s=>[...s.senders]))
const LISTS = ['901521539717','901524992979','901523658547']
const WAITING = 'com o cliente', APPROVED = 'aprovado pelo cliente'
const EXPLICIT_WINDOW = 10*86400000, PRAISE_WINDOW = 48*3600000

export function isTeamSender(m:Record<string,any>) {
 const ids=[m.sender,m.sender_pn,m.sender_lid].filter(Boolean).map(String)
 return ids.some(id=>TEAM_IDS.has(id)) || ids.some(id=>{const d=id.split('@')[0].replace(/\D/g,'');return id.includes('@lid')?false:TEAM_SUFFIX.some(s=>d.endsWith(s))})
}

export function clientApproval(raw:string):'explicit'|'praise'|'' {
 const t=normalized(raw)
 if(!t||raw.includes('?')||t.length>140)return ''
 if(/\b(nao|ainda|ajust\w*|mud\w*|troc\w*|alter\w*|corrig\w*|refaz\w*|refazer|tira|tirar|falt\w*|errad\w*|errou|menor|maior)\b/.test(t))return ''
 if(/^se\b|\bse (tiver|estiver|for|ficar)\b|\b(sera|semana passada|foi aprovad\w*)\b/.test(t))return ''
 if(/\b(aprovad[oa]s?|aprovo|liberad[oa]s?|pode (postar|publicar|subir|soltar|mandar|rodar))\b/.test(t))return 'explicit'
 if(/\b(perfeit[oa]s?|amei|adorei|gostei|lind[oa]s?|maravilhos[oa]s?|top|show|otim[oa]s?|excelente|incrivel|sensacional|massa|ficou (bom|boa|bonit[oa]))\b/.test(t))return 'praise'
 return ''
}

export function matchesClient(task:Record<string,any>, aliases:string[]) {
 const hay=' '+normalized(String(task.name||'')+' '+taskClient(task))+' '
 return aliases.some(a=>hay.includes(' '+normalized(a)+' '))
}

const brasilia=(ms:number)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ms))

type Fetcher=(path:string,init?:{method?:string;body?:unknown})=>Promise<any>
const clickupFetch:Fetcher=async(path,init)=>{
 const r=await fetch('https://api.clickup.com/api/v2'+path,{method:init?.method||'GET',headers:{Authorization:process.env.SOCIAL_CLICKUP_TOKEN||'','Content-Type':'application/json'},...(init?.body?{body:JSON.stringify(init.body)}:{}),signal:AbortSignal.timeout(12000)})
 if(!r.ok)throw new Error('clickup_'+r.status)
 return r.json()
}

// Returns null when the message is not from a client group, so the regular intake runs.
export async function clientGroupApproval(db:ReturnType<typeof createAdminClient>, m:Record<string,any>, clickup:Fetcher=clickupFetch, now=Date.now()) {
 const group=CLIENT_GROUPS[String(m.chatid||'')]
 if(!group)return null
 if(m.fromMe||m.wasSentByApi||!m.id||isTeamSender(m))return {route:'pass'}
 const text=String(m.text||'').slice(0,500), kind=clientApproval(text)
 if(!kind)return {route:'pass'}
 const at=Number(m.messageTimestamp)>1e12?Number(m.messageTimestamp):Number(m.messageTimestamp)*1000||now
 const receipt=`client-approval:${m.id}`
 const {error:claimError}=await db.from('central_social_intake_receipts').insert({id:receipt,chat_id:String(m.chatid),result:{route:'pass',state:'claimed'}})
 if(claimError)return {route:'pass',client_approval:{duplicate:true}}
 const window=kind==='explicit'?EXPLICIT_WINDOW:PRAISE_WINDOW
 const tasks:any[]=[]
 for(const list of LISTS){
  const data=await clickup(`/list/${list}/task?${new URLSearchParams({'statuses[]':WAITING,subtasks:'true',include_closed:'false'})}`)
  for(const t of data.tasks||[]){
   const sent=Number(t.date_updated)
   if(normalized(String(t.status?.status||''))===normalized(WAITING)&&matchesClient(t,group.aliases)&&sent<=at+60000&&at-sent<=window)tasks.push(t)
  }
 }
 const phone=String(m.sender_pn||m.sender||'').split('@')[0].replace(/\D/g,'')
 const who=`${group.client} · WhatsApp ${phone||'sem número'}`
 const evidence=`Aprovação do cliente no grupo do WhatsApp em ${brasilia(at)} (Brasília): "${text}". Enviado por ${phone||'número oculto'}. Registrado automaticamente pela Sofia.`
 const approved:string[]=[],clickupDone:string[]=[],skipped:Record<string,string>={}
 for(const t of tasks){
  const {data:card}=await db.from('central_social_cards').select('*').eq('id',String(t.id)).maybeSingle()
  if(card){
   const c=card as SocialCard
   if(c.approved_revision===c.revision&&c.approved_at)skipped[t.id]='ja_aprovado'
   else{
    try{
     const patch=socialPatch(c,{action:'aprovar',name:who,evidence},new Date(now))
     const {error}=await db.rpc('central_social_apply',{p_id:c.id,p_expected:c.version,p_patch:patch,p_action:'aprovar',p_actor:'Sofia · grupo do cliente',p_actor_id:null})
     if(error)skipped[t.id]='central_'+(error.message.includes('version_conflict')?'conflito':'erro');else approved.push(c.id)
    }catch(e:any){skipped[t.id]=String(e?.message||'central_recusou').slice(0,120)}
   }
  }else skipped[t.id]='sem_card_na_central'
  try{
   await clickup(`/task/${t.id}`,{method:'PUT',body:{status:APPROVED}})
   await clickup(`/task/${t.id}/comment`,{method:'POST',body:{comment_text:`[svi-aprovacao] ${evidence}`,notify_all:false}})
   clickupDone.push(String(t.id))
  }catch{skipped[t.id]=(skipped[t.id]?skipped[t.id]+'; ':'')+'clickup_falhou'}
 }
 const result={route:'pass',client_approval:{client:group.client,kind,tasks:tasks.map(t=>String(t.id)),approved,clickup:clickupDone,skipped}}
 await db.from('central_social_intake_receipts').update({result}).eq('id',receipt)
 return result
}
