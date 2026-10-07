import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto'
import sharp from 'sharp'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {VercelRequest,VercelResponse} from '@vercel/node'
import {createAdminClient} from './supabase.js'
import {socialMedia} from './social-media.js'
import {driveVideoRange} from './social-drive.js'
import {videoRange} from './social-playback.js'
import {SocialError,type SocialCard} from './social-domain.js'
import {publicationInput,publicPublication} from './social-publication-domain.js'
import {publicationAccounts} from './social-publication-meta.js'
const signature=(value:string)=>createHmac('sha256',process.env.SOCIAL_SYNC_SECRET||'').update('publication-preview:'+value).digest('base64url')
export function staffPlayback(card:SocialCard,asset:string){const value=Buffer.from(JSON.stringify({id:card.id,asset,revision:card.revision,expires:Date.now()+3600000})).toString('base64url');return `/api/social?publication_stream=${value}.${signature(value)}`}
export async function publicationPlayback(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow')
 if(!['GET','HEAD'].includes(req.method||''))return res.status(405).end()
 try{
  const [raw,sig,...extra]=String(req.query.publication_stream||'').split('.'),expected=signature(raw||'')
  if(extra.length||!process.env.SOCIAL_SYNC_SECRET||!sig||sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return res.status(404).end()
  const access=JSON.parse(Buffer.from(raw,'base64url').toString());if(!(access.expires>Date.now()))return res.status(404).end()
  const db=createAdminClient(),{data:card,error}=await db.from('central_social_cards').select('*').eq('id',access.id).maybeSingle()
  if(error||!card||card.ingest_pending||card.revision!==access.revision||!card.selected_assets.includes(access.asset))return res.status(404).end()
  const asset=card.assets.find((a:any)=>a.id===access.asset);if(!asset||asset.storage!=='drive'||!asset.type.startsWith('video/'))return res.status(404).end()
  const size=Number(asset.bytes),range=videoRange(typeof req.headers.range==='string'?req.headers.range:undefined,size)
  if(!range){res.setHeader('Content-Range',`bytes */${size}`);return res.status(416).end()}
  res.setHeader('Content-Type',asset.type);res.setHeader('Accept-Ranges','bytes')
  if(req.method==='HEAD'){res.setHeader('Content-Length',String(size));return res.status(200).end()}
  const response=await driveVideoRange(asset.drive_id,range.start,range.end),expectedRange=`bytes ${range.start}-${range.end}/${size}`
  if(response.status!==206||response.headers.get('content-range')!==expectedRange){await response.body?.cancel();return res.status(502).end()}
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==range.end-range.start+1)return res.status(502).end()
  res.setHeader('Content-Range',expectedRange);res.setHeader('Content-Length',String(bytes.length));return res.status(206).send(bytes)
 }catch{return res.status(503).end()}
}

const semAcento=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const VAZIAS=new Set(['dr','dra','doutor','doutora','clinica','espaco','colegio','escola','centro','instituto','oficial','br','svi'])

/**
 * Qual conta do Instagram pertence a este cliente.
 *
 * A peça já sabe que é do Espaço Soraia; obrigar a escolher a conta toda vez é
 * um passo repetido que não decide nada. A Graph API não diz a qual cliente a
 * conta pertence, então a ligação é pelo nome, e só vale quando UMA conta
 * serve: havendo dúvida, a pessoa escolhe, porque postar na conta errada é
 * irreversível.
 */
export function suggestAccount(client:string,accounts:{id:string;username:string;name:string}[]) {
 const termos=semAcento(client||'').split(' ').filter(p=>p.length>2&&!VAZIAS.has(p))
 if(!termos.length)return null
 const casa=(a:{username:string;name:string})=>{
  const alvo=' '+semAcento(a.name)+' '+semAcento(a.username).replace(/\s+/g,'')+' '+semAcento(a.username)+' '
  return termos.every(termo=>alvo.includes(termo))
 }
 const achadas=accounts.filter(casa)
 return achadas.length===1?achadas[0].id:null
}

/**
 * A conta que este cliente usa.
 *
 * A conta usada na última publicação deste cliente fica guardada, então a
 * escolha é feita uma vez e vale para sempre. Isso é evidência, não palpite, e
 * resolve casos que o nome nunca resolveria, como a peça da "VANESSA BACK" que
 * publica em @backesteticaa.
 *
 * Casar pelo nome só entra quando o cliente nunca publicou.
 *
 * Postar na conta errada é irreversível, então na dúvida ninguém decide por
 * quem está na tela.
 */
export async function contaDoCliente(db:SupabaseClient,client:string,accounts:{id:string;username:string;name:string}[]) {
 const {data}=await db.from('central_social_client_accounts').select('account_id').eq('client',client).maybeSingle()
 const guardada=data?.account_id
 if(guardada&&accounts.some(a=>a.id===guardada))return guardada
 return suggestAccount(client,accounts)
}

export async function publicationContext(db:SupabaseClient,card:SocialCard){
 const [accounts,media,{data:jobs,error}]=await Promise.all([publicationAccounts(),socialMedia(db,card),db.from('central_social_publications').select('*').eq('card_id',card.id).order('created_at',{ascending:false}).limit(1)])
 if(error)throw error
 const {token_hash:_hash,token_expires_at:_expires,source_description:_description,...safe}=media
 return {accounts,suggested_account:await contaDoCliente(db,card.client,accounts),card:{...safe,assets:media.assets.map(a=>({...a,...(a.storage==='drive'&&a.type.startsWith('video/')&&card.selected_assets.includes(a.id)?{playback_url:staffPlayback(card,a.id)}:{})}))},publication:publicPublication(jobs?.[0]||null)}
}
export async function uploadPublicationCover(db:SupabaseClient,body:Record<string,any>,actorId:string){
 if(typeof body.image!=='string'||body.image.length>3*1024*1024||!/^data:image\/(jpeg|png|webp);base64,/.test(body.image))throw new SocialError(400,'Envie uma imagem JPG, PNG ou WebP de até 2 MB.')
 let bytes:Buffer
 try{bytes=await sharp(Buffer.from(body.image.split(',')[1],'base64'),{limitInputPixels:40000000}).rotate().resize({width:1080,height:1920,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer()}catch{throw new SocialError(400,'Não foi possível ler a imagem da capa.')}
 const path=`publication-covers/${actorId}/${randomUUID()}.jpg`
 const {error}=await db.storage.from('central-social').upload(path,new Uint8Array(bytes),{contentType:'image/jpeg',upsert:false});if(error)throw error
 const {data}=await db.storage.from('central-social').createSignedUrl(path,3600)
 return {path,preview:data?.signedUrl}
}
export async function enqueuePublication(db:SupabaseClient,card:SocialCard,body:Record<string,any>,actor:string,actorId:string){
 const {data:existing,error:existingError}=await db.from('central_social_publications').select('*').eq('request_id',body.request_id).eq('card_id',card.id).eq('actor_id',actorId).maybeSingle()
 if(existingError)throw existingError
 if(existing)return {ok:true,publication:publicPublication(existing)}
 const data=publicationInput(card,body,await publicationAccounts(),actorId)
 if(data.cover_path){const {data:object,error}=await db.storage.from('central-social').info(data.cover_path);if(error||!object)throw new SocialError(400,'A capa não foi encontrada. Envie novamente.')}
 const {data:job,error}=await db.rpc('central_social_publication_enqueue',{p_id:card.id,p_expected:body.version,p_request:body.request_id,p_data:data,p_actor:actor,p_actor_id:actorId})
 if(error)throw publicationDatabaseError(error.message)
 // Guarda a conta que a pessoa confirmou, para a próxima peça deste cliente já
 // vir pronta. Falhar aqui não pode derrubar uma publicação que já foi aceita.
 await db.rpc('central_social_client_account_set',{p_client:card.client,p_account_id:data.account_id,p_username:data.account_username,p_actor:actor}).catch(()=>{})
 return {ok:true,publication:publicPublication(job)}
}
export function publicationDatabaseError(message:string){return new SocialError(409,/publication_active/.test(message)?'Esta peça já tem uma publicação na fila. Abra a programação para conferir.':/publication_in_progress/.test(message)?'A publicação já está sendo enviada ao Instagram. Aguarde a confirmação.':/already_published/.test(message)?'Esta versão já foi publicada.':/version_conflict/.test(message)?'Esta peça mudou em outra tela. Reabra e confira.':'Não foi possível salvar a programação. Atualize a peça e tente novamente.')}
