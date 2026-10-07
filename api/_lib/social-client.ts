import {createHash,randomBytes} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {openApprovalToken,sealApprovalToken} from './social-approval-link.js'
import {SocialError,type SocialCard} from './social-domain.js'

const BASE_CURTO='https://aprovar.svicompany.com.br'
const base='https://central.svicompany.com.br/aprovar/cliente/'

// Alfabeto sem 0/O e 1/l/I: o link é lido em voz alta e digitado no celular.
const ALFABETO='23456789abcdefghjkmnpqrstuvwxyz'
export function codigoCurto(bytes=randomBytes(12)) {
 return Array.from(bytes).map(b=>ALFABETO[b%ALFABETO.length]).join('')
}
/** Apelido do cliente no endereço: "DRA. ÉSIA LOPES" vira "dra-esia-lopes". */
export function apelidoDoCliente(client:string) {
 const limpo=client.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'')
 return limpo||'cliente'
}
export const clientTokenHash=(token:string)=>createHash('sha256').update(token).digest('hex')
export function clientPending(card:SocialCard,client:string) {
 return card.client===client && client!=='Identificar cliente' && card.stage==='aguardando' && !card.ingest_pending && !card.posted_at && card.selected_assets.length>0 && card.selected_assets.every(id=>card.assets.some(a=>a.id===id))
}
export async function pendingClientCards(db:SupabaseClient,client:string) {
 const cards:SocialCard[]=[]
 for(let offset=0;;offset+=500){
  const {data,error}=await db.from('central_social_cards').select('*').eq('client',client).eq('stage','aguardando').order('updated_at').order('id').range(offset,offset+499)
  if(error)throw new Error('client_cards_read_failed')
  cards.push(...(data as SocialCard[]).filter(c=>clientPending(c,client)))
  if(data.length<500)return cards
 }
}
const formatoValido=(token:string)=>/^[a-f0-9]{64}$/.test(token)||/^[23456789abcdefghjkmnpqrstuvwxyz]{12}$/.test(token)
export async function clientReview(db:SupabaseClient,token:string) {
 if(!formatoValido(token))throw new SocialError(404,'Este link não está disponível.')
 const {data,error}=await db.from('central_social_client_links').select('client,token_hash,slug').eq('token_hash',clientTokenHash(token)).is('revoked_at',null).maybeSingle()
 if(error)throw new Error('client_link_read_failed')
 if(!data)throw new SocialError(404,'Este link não está disponível. Peça o link atualizado à equipe.')
 return data as {client:string;token_hash:string;slug:string|null}
}
export async function clientReviewCard(db:SupabaseClient,token:string,id:string) {
 const review=await clientReview(db,token)
 const {data,error}=await db.from('central_social_cards').select('*').eq('id',id).eq('client',review.client).maybeSingle()
 if(error)throw new Error('client_card_read_failed')
 if(!data||!clientPending(data as SocialCard,review.client))throw new SocialError(404,'Esta peça não está mais aguardando sua resposta. Atualize a página.')
 return data as SocialCard
}
export async function getClientLink(db:SupabaseClient,client:string,create=false) {
 if(!client||client.length>120||client==='Identificar cliente')throw new SocialError(400,'Selecione um cliente identificado.')
 const read=async()=>{
  const {data,error}=await db.from('central_social_client_links').select('token_hash,ciphertext,revoked_at,slug').eq('client',client).maybeSingle()
  if(error)throw new Error('client_link_read_failed')
  return data
 }
 let saved=await read()
 if(create&&(!saved||saved.revoked_at)){
  const pending=await pendingClientCards(db,client)
  if(!pending.length)throw new SocialError(400,'Este cliente ainda não tem peças prontas em Aguardando cliente.')
  const raw=codigoCurto()
  const {error}=await db.rpc('central_social_client_link',{p_client:client,p_hash:clientTokenHash(raw),p_ciphertext:sealApprovalToken(raw,'client:'+client)})
  if(error)throw new Error('client_link_create_failed')
  saved=await read() // Concurrent requests recover the one winning token; no silent rotation.
 }
 if(!saved||saved.revoked_at)return null
 const raw=openApprovalToken(saved.ciphertext,'client:'+client)
 if(!formatoValido(raw)||clientTokenHash(raw)!==saved.token_hash)throw new Error('client_link_invalid')
 // Endereço curto com o nome do cliente. O código antigo, de 64 caracteres,
 // continua abrindo pelo endereço de antes: ninguém fica com link morto.
 // O apelido só é gerado uma vez; depois vem junto do registro salvo.
 let slug=saved.slug as string|null
 if(!slug){const {data}=await db.rpc('central_social_client_slug',{p_client:client,p_slug:apelidoDoCliente(client)});slug=data as string|null}
 return slug?`${BASE_CURTO}/${slug}/${raw}`:base+raw
}
