import { normalized, taskClient, SOCIAL_WHATSAPP_SOURCES } from './social-sync-domain.js'
import { socialPatch, type SocialCard } from './social-domain.js'
import type { createAdminClient } from './supabase.js'

// Client approval written in the client's own WhatsApp group (João, 03/10/2026).
// Every delivery already lands in Central at the first stage; a group often gets
// several pieces at once and one of them comes back corrected (v2, v3). So an
// approval only reaches the exact piece the client answered, or the batch sent
// before an unquoted "aprovado" minus the pieces the client asked to change.
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

const CHANGE=/\b(nao|ainda|ajust\w*|mud\w*|troc\w*|alter\w*|corrig\w*|refaz\w*|tira|tirar|falt\w*|errad\w*|errou|menor|maior|coloc\w*|aument\w*|diminu\w*|deix\w*|tir\w*)\b/
export function clientVerdict(raw:string):'explicit'|'praise'|'change'|'' {
 const t=normalized(raw)
 if(!t||t.length>300)return ''
 if(CHANGE.test(t))return 'change'
 if(raw.includes('?')||t.length>140)return ''
 if(/^se\b|\bse (tiver|estiver|for|ficar)\b|\b(sera|semana passada|foi aprovad\w*)\b/.test(t))return ''
 if(/\b(aprovad[oa]s?|aprovo|liberad[oa]s?|pode (postar|publicar|subir|soltar|mandar|rodar)|esse ok|ok pode)\b/.test(t))return 'explicit'
 if(/\b(perfeit[oa]s?|amei|adorei|gostei|lind[oa]s?|maravilhos[oa]s?|top|show|otim[oa]s?|excelente|incrivel|sensacional|massa|ficou (bom|boa|bonit[oa]))\b/.test(t))return 'praise'
 return ''
}
export const clientApproval=(raw:string)=>{const v=clientVerdict(raw);return v==='change'?'':v}
const plural=(raw:string)=>/\b(aprovad[oa]s|todos|todas|tudo|ambos|ambas|os dois|as duas|os tres|as tres)\b/.test(normalized(raw))

export function matchesClient(task:Record<string,any>, aliases:string[]) {
 const hay=' '+normalized(String(task.name||'')+' '+taskClient(task))+' '
 return aliases.some(a=>hay.includes(' '+normalized(a)+' '))
}
const stanza=(id:unknown)=>String(id||'').split(':').pop()||''
const baseTitle=(file:string)=>normalized(file.replace(/\.[a-z0-9]{2,5}$/i,'').replace(/\s+v\d{1,3}\s*$/i,''))
const brasilia=(ms:number)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ms))
const isMedia=(m:Record<string,any>)=>/document|video|image/i.test(String(m.messageType||''))||String(m.type||'')==='media'

type Fetcher=(path:string,init?:{method?:string;body?:unknown})=>Promise<any>
const clickupFetch:Fetcher=async(path,init)=>{
 const r=await fetch('https://api.clickup.com/api/v2'+path,{method:init?.method||'GET',headers:{Authorization:process.env.SOCIAL_CLICKUP_TOKEN||'','Content-Type':'application/json'},...(init?.body?{body:JSON.stringify(init.body)}:{}),signal:AbortSignal.timeout(12000)})
 if(!r.ok)throw new Error('clickup_'+r.status)
 return r.json()
}
export type GroupMedia={id:string;name:string;at:number;change?:boolean;done?:boolean}
export type Store={
 claim(id:string,chat:string,result:Record<string,unknown>):Promise<boolean>
 save(id:string,result:Record<string,unknown>):Promise<void>
 media(chat:string,since:number):Promise<GroupMedia[]>
 lastApproval(chat:string,before:number):Promise<number>
 changes(chat:string,since:number):Promise<number>
 cardByFile(name:string,aliases:string[]):Promise<SocialCard|null>
 card(id:string):Promise<SocialCard|null>
 approve(c:SocialCard,patch:Record<string,unknown>):Promise<string>
 markSent(c:SocialCard):Promise<string>
}
// Group events live in central_social_intake_receipts (service role only) under
// "cg-media:", "cg-change:" and "client-approval:" ids, so no schema change.
export function receiptStore(db:ReturnType<typeof createAdminClient>):Store {
 const rows=async(chat:string,prefix:string,since:number)=>{const {data,error}=await db.from('central_social_intake_receipts').select('id,result').eq('chat_id',chat).like('id',prefix+'%').gte('created_at',new Date(since).toISOString()).limit(500);if(error)throw new Error('database_failed');return data||[]}
 return {
  async claim(id,chat,result){const {error}=await db.from('central_social_intake_receipts').insert({id,chat_id:chat,result});return !error},
  async save(id,result){await db.from('central_social_intake_receipts').update({result}).eq('id',id)},
  async media(chat,since){
   const [media,changes,done]=await Promise.all([rows(chat,'cg-media:',since),rows(chat,'cg-change:',since),rows(chat,'client-approval:',since)])
   const changed=new Set(changes.map((r:any)=>String(r.result?.media||''))),approved=new Set(done.flatMap((r:any)=>r.result?.client_approval?.media||[]))
   return media.map((r:any)=>({id:String(r.id).slice(9),name:String(r.result?.name||''),at:Number(r.result?.at||0),change:changed.has(String(r.id).slice(9)),done:approved.has(String(r.id).slice(9))}))
  },
  async lastApproval(chat,before){const {data}=await db.from('central_social_intake_receipts').select('result').eq('chat_id',chat).like('id','client-approval:%').order('created_at',{ascending:false}).limit(10);return Math.max(0,...(data||[]).map((r:any)=>Number(r.result?.at||0)).filter(t=>t<before))},
  async changes(chat,since){return (await rows(chat,'cg-change:',since)).filter((r:any)=>Number(r.result?.at||0)>=since).length},
  async cardByFile(name,aliases){
   const {data}=await db.from('central_social_cards').select('*').contains('assets',JSON.stringify([{name}])).limit(5)
   const exact=(data||[]) as SocialCard[]
   if(exact.length)return exact.sort((a,b)=>b.revision-a.revision)[0]
   const base=baseTitle(name);if(base.length<4)return null
   const {data:recent}=await db.from('central_social_cards').select('*').not('stage','in','(postado,arquivado)').order('source_updated',{ascending:false}).limit(300)
   const hit=((recent||[]) as SocialCard[]).filter(c=>normalized(c.title)===base&&aliases.some(a=>(' '+normalized(c.client)+' ').includes(' '+normalized(a)+' ')))
   return hit.length===1?hit[0]:null
  },
  async card(id){const {data}=await db.from('central_social_cards').select('*').eq('id',id).maybeSingle();return (data as SocialCard)||null},
  async approve(c,patch){const {error}=await db.rpc('central_social_apply',{p_id:c.id,p_expected:c.version,p_patch:patch,p_action:'aprovar',p_actor:'Sofia · grupo do cliente',p_actor_id:null});return error?(error.message.includes('version_conflict')?'central_conflito':'central_erro'):''},
  // A peça já está na mão do cliente: o time acabou de mandar o arquivo no grupo dele.
  // "Conferir" passa a ser mentira, e enquanto for, a aprovação que vier depois não
  // encontra a peça, porque só vale para quem está aguardando o cliente.
  async markSent(c){
   if(c.stage!=='conferir'||c.ingest_pending||!c.selected_assets.length)return ''
   const {error}=await db.rpc('central_social_apply',{p_id:c.id,p_expected:c.version,p_patch:socialPatch(c,{action:'solicitar'}),p_action:'solicitar',p_actor:'Sofia · entregue no grupo do cliente',p_actor_id:null})
   return error?(error.message.includes('version_conflict')?'central_conflito':'central_erro'):''
  },
 }
}

// Returns null when the message is not from a client group, so the regular intake runs.
export async function clientGroupApproval(db:ReturnType<typeof createAdminClient>, m:Record<string,any>, clickup:Fetcher=clickupFetch, now=Date.now(), store:Store=receiptStore(db)) {
 const group=CLIENT_GROUPS[String(m.chatid||'')]
 if(!group)return null
 if(m.fromMe||m.wasSentByApi||!m.id)return {route:'pass'}
 const chat=String(m.chatid), own=stanza(m.messageid||m.id)
 const at=Number(m.messageTimestamp)>1e12?Number(m.messageTimestamp):Number(m.messageTimestamp)*1000||now
 const text=String(m.text||m.content?.caption||'').slice(0,500)
 const quoted=stanza(m.quoted||m.content?.contextInfo?.stanzaId)
 if(isTeamSender(m)){
  // The team's deliveries to the client are remembered so a later reply can point at them.
  if(isMedia(m)){
   const name=String(m.content?.fileName||m.content?.title||'')
   await store.claim(`cg-media:${own}`,chat,{name,at,by:String(m.sender_pn||m.sender||'')})
   // Casa com a peça que já existe, achada pelo nome do arquivo. Não cria card novo:
   // no grupo do cliente também trafega referência e print, e isso viraria lixo no quadro.
   if(name)try{
    const c=await store.cardByFile(name,group.aliases)
    if(c)await store.markSent(c)
   }catch{/* registrar a entrega vale mais que mover a peça; a aprovação dirá o que faltou */}
  }
  return {route:'pass'}
 }
 const verdict=clientVerdict(text)
 if(verdict==='change'){await store.claim(`cg-change:${own}`,chat,{media:quoted,at,text});return {route:'pass'}}
 if(verdict!=='explicit'&&verdict!=='praise')return {route:'pass'}
 const receipt=`client-approval:${own}`
 if(!await store.claim(receipt,chat,{route:'pass',state:'claimed',at}))return {route:'pass',client_approval:{duplicate:true}}
 const window=verdict==='explicit'?EXPLICIT_WINDOW:PRAISE_WINDOW
 const since=Math.max(at-window,await store.lastApproval(chat,at))
 const recorded=await store.media(chat,at-window)
 const quotedMedia=quoted?recorded.find(r=>r.id===quoted):undefined
 const targets=quoted?(quotedMedia?[quotedMedia]:[]):recorded.filter(r=>r.at>=since&&r.at<=at&&!r.change&&!r.done)
 const phone=String(m.sender_pn||m.sender||'').split('@')[0].replace(/\D/g,'')
 const who=`${group.client} · WhatsApp ${phone||'sem número'}`
 const evidence=`Aprovação do cliente no grupo do WhatsApp em ${brasilia(at)} (Brasília): "${text}"${quotedMedia?.name?`, respondendo ao arquivo ${quotedMedia.name}`:''}. Enviado por ${phone||'número oculto'}. Registrado automaticamente pela Sofia.`
 const approved:string[]=[],clickupDone:string[]=[],skipped:Record<string,string>={},media:string[]=[]
 const toClickup:string[]=[]
 const approveCard=async(c:SocialCard,key:string,assetName?:string)=>{
  if(assetName){const asset=c.assets.find(a=>a.name===assetName);if(asset&&!c.selected_assets.includes(asset.id)){skipped[key]='versao_antiga';return}}
  if(c.approved_revision===c.revision&&c.approved_at){skipped[key]='ja_aprovado';if(!c.id.startsWith('wa-'))toClickup.push(c.id);return}
  try{const fail=await store.approve(c,socialPatch(c,{action:'aprovar',name:who,evidence},new Date(now)));if(fail)skipped[key]=fail;else{approved.push(c.id);if(!c.id.startsWith('wa-'))toClickup.push(c.id)}}
  catch(e:any){skipped[key]=String(e?.message||'central_recusou').slice(0,120)}
 }
 for(const t of targets){
  media.push(t.id)
  if(!t.name){skipped[t.id]='arquivo_sem_nome';continue}
  const c=await store.cardByFile(t.name,group.aliases)
  if(!c){skipped[t.id]='sem_card_na_central';continue}
  await approveCard(c,t.id,t.name)
 }
 // Sofia's own deliveries (ClickUp art, "Imagem 1 de 3") never reach this intake,
 // so they are only approved when nothing can be confused: one waiting art, or a
 // plural approval, and no change request from the client since it was sent.
 if(!quotedMedia&&!targets.length){
  const waiting:any[]=[]
  for(const list of LISTS){
   const data=await clickup(`/list/${list}/task?${new URLSearchParams({'statuses[]':WAITING,subtasks:'true',include_closed:'false'})}`)
   for(const t of data.tasks||[]){const sent=Number(t.date_updated);if(normalized(String(t.status?.status||''))===normalized(WAITING)&&matchesClient(t,group.aliases)&&sent<=at+60000&&at-sent<=window)waiting.push(t)}
  }
  const firstSent=Math.min(...waiting.map(t=>Number(t.date_updated)))
  const changes=waiting.length?await store.changes(chat,firstSent):0
  if(waiting.length===1||(waiting.length>1&&plural(text))){
   if(changes)for(const t of waiting)skipped[t.id]='cliente_pediu_ajuste'
   else for(const t of waiting){const c=await store.card(String(t.id));if(c)await approveCard(c,String(t.id));else{skipped[t.id]='sem_card_na_central';toClickup.push(String(t.id))}}
  }else for(const t of waiting)skipped[t.id]=waiting.length>1?'varias_artes_conferir':'nada'
 }
 for(const id of [...new Set(toClickup)]){
  try{
   await clickup(`/task/${id}`,{method:'PUT',body:{status:APPROVED}})
   await clickup(`/task/${id}/comment`,{method:'POST',body:{comment_text:`[svi-aprovacao] ${evidence}`,notify_all:false}})
   clickupDone.push(id)
  }catch{skipped[id]=(skipped[id]?skipped[id]+'; ':'')+'clickup_falhou'}
 }
 const result={route:'pass',client_approval:{client:group.client,kind:verdict,at,quoted:quoted||null,media,approved,clickup:clickupDone,skipped}}
 await store.save(receipt,result)
 return result
}
