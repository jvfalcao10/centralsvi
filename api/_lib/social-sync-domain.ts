import { createHash } from 'node:crypto'
export const SOCIAL_MATH_GROUP = '120363411761185563@g.us'
export const SOCIAL_MATH_SENDERS = new Set(['554891836693@s.whatsapp.net','5548991836693@s.whatsapp.net','50217076449517@lid'])
export const digest = (s:string|Buffer) => createHash('sha256').update(s).digest('hex')
export const normalized = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export const mediaType = (name:string, mime='') => {
 const ext=name.split('.').pop()?.toLowerCase()
 const types:Record<string,string>={mp4:'video/mp4',mov:'video/quicktime',m4v:'video/mp4',webm:'video/webm',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}
 return types[ext||''] || (/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm))$/.test(mime)?mime:'')
}
export function parseDelivery(caption:string, messageId:string) {
 const parts=caption.split('\n')[0].split('|').map(s=>s.trim())
 const valid=parts.length===3 && parts[0].length>1 && parts[1].length>1 && /^v\d{1,3}$/i.test(parts[2])
 return { client:valid?parts[0].slice(0,120):'Identificar cliente', title:valid?parts[1].slice(0,250):'Vídeo do Math · identificar peça',
  card_id:'wa-'+digest(valid?`${SOCIAL_MATH_GROUP}|${normalized(parts[0])}|${normalized(parts[1])}`:messageId).slice(0,24),
  delivery_version:valid?Number(parts[2].slice(1)):null }
}
export function mathVideo(m:Record<string,any>) {
 if (m.chatid!==SOCIAL_MATH_GROUP || ![m.sender,m.sender_pn,m.sender_lid].some(s=>SOCIAL_MATH_SENDERS.has(s)) || m.wasSentByApi || m.fromMe) return null
 let content=m.content; if(typeof content==='string') {try{content=JSON.parse(content)}catch{content={}}}
 content=content?.videoMessage || content?.documentMessage || content || {}
 const name=String(content.fileName||content.title||'')
 const mime=String(content.mimetype||content.mimeType||m.mimetype||'')
 const kind=String(m.messageType||m.type||'').toLowerCase()
 if(!kind.includes('video') && !mediaType(name,mime).startsWith('video/'))return null
 const id=String(m.id||''); if(!id || !m.messageTimestamp)return null
 const t=Number(m.messageTimestamp);if(!Number.isFinite(t)||t<=0)return null
 const at=new Date(t<1e12?t*1000:t).toISOString()
 const caption=String(m.text||content.caption||'').slice(0,10000)
 return { key:'wa:'+id, provider:'whatsapp', source_id:id, ...parseDelivery(caption,id),
  payload:{ message_id:id, name:name||`video-${String(m.messageid||digest(id).slice(0,12))}.mp4`, type:mediaType(name,mime)||'video/mp4', bytes:Number(content.fileLength||content.size||0), caption, at } }
}
export function allowedMediaURL(raw:string, provider:'clickup'|'whatsapp') {
 try {const u=new URL(raw); if(u.protocol!=='https:' || u.username || u.password || (u.port&&u.port!=='443'))return false
  return provider==='clickup' ? (u.hostname==='t9015595861.p.clickup-attachments.com' || u.hostname==='attachments.clickup.com') : u.hostname==='svicompany.uazapi.com'
 }catch{return false}
}
export function taskClient(t:Record<string,any>) {
 const bracket=String(t.name||'').match(/\[([^\]]+)\]/)?.[1]
 if(bracket)return bracket.slice(0,120)
 const company=t.custom_fields?.find((f:any)=>/^(empresa|cliente)$/i.test(f.name||''))
 if(company?.value!=null){const value=company.type_config?.options?.find((o:any)=>o.id===company.value||o.orderindex===company.value)?.name || (typeof company.value==='string'?company.value:'');if(value)return String(value).slice(0,120)}
 const aliases:Record<string,string>={carlotinha:'Carlotinha',prouro:'Prouro',erika:'Dra. Érika',enia:'Dra. Ênia',brenno:'Dr. Brenno',daniel:'Dr. Daniel',essenc:'Essenc',alpha:'Alpha',exatta:'Exatta',ccr:'CCR',esia:'Ésia',medic:'Médic Fácil','gm gas':'GM Gás','spa nature':'Spa Nature'}
 const n=normalized(String(t.name||''));for(const [alias,value] of Object.entries(aliases))if((' '+n+' ').includes(' '+alias+' '))return value
 return 'Identificar cliente'
}
