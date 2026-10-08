import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {SocialCard} from './social-domain.js'
import {codigoCurto} from './social-token.js'
const BASE='https://aprovar.svicompany.com.br/p/'
const BASE_ANTIGA='https://central.svicompany.com.br/aprovar/social/'
const digest=(value:string)=>createHash('sha256').update(value).digest('hex')
function key(){const secret=process.env.SOCIAL_SYNC_SECRET;if(!secret||secret.length<32)throw new Error('approval_link_key_missing');return createHash('sha256').update('central-social-approval-link:v1:'+secret).digest()}
export function sealApprovalToken(token:string,cardId:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(cardId))
 const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()])
 return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64url')).join('.')
}
export function openApprovalToken(value:string,cardId:string){
 const parts=value.split('.');if(parts.length!==3)throw new Error('approval_link_invalid')
 const [iv,tag,data]=parts.map(s=>Buffer.from(s,'base64url'));const cipher=createDecipheriv('aes-256-gcm',key(),iv)
 cipher.setAAD(Buffer.from(cardId));cipher.setAuthTag(tag)
 return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8')
}
export async function approvalLink(db:SupabaseClient,card:SocialCard){
 if(!card.token_hash||!(Date.parse(card.token_expires_at||'')>Date.now())||card.ingest_pending||!['aguardando','ajustes','aprovado','agendado'].includes(card.stage))return null
 const {data,error}=await db.from('central_social_approval_links').select('ciphertext,token_hash').eq('card_id',card.id).maybeSingle()
 if(error)throw new Error('approval_link_read_failed')
 if(!data||data.token_hash!==card.token_hash)return null
 // O código antigo, de 64 caracteres, abre pelo endereço de antes: link que já
 // está com o cliente não pode morrer por causa de uma mudança de endereço.
 try{
  const raw=openApprovalToken(data.ciphertext,card.id)
  if(digest(raw)!==card.token_hash)return null
  if(/^[a-f0-9]{64}$/.test(raw))return BASE_ANTIGA+raw
  return /^[23456789abcdefghjkmnpqrstuvwxyz]{12}$/.test(raw)?BASE+raw:null
 }catch{return null}
}
export function newApprovalLink(cardId:string){const token=codigoCurto();return {url:BASE+token,hash:digest(token),ciphertext:sealApprovalToken(token,cardId)}}
