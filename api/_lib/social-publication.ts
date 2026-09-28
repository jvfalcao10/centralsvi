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
export async function publicationContext(db:SupabaseClient,card:SocialCard){
 const [accounts,media,{data:jobs,error}]=await Promise.all([publicationAccounts(),socialMedia(db,card),db.from('central_social_publications').select('*').eq('card_id',card.id).order('created_at',{ascending:false}).limit(1)])
 if(error)throw error
 const {token_hash:_hash,token_expires_at:_expires,source_description:_description,...safe}=media
 return {accounts,card:{...safe,assets:media.assets.map(a=>({...a,...(a.storage==='drive'&&a.type.startsWith('video/')&&card.selected_assets.includes(a.id)?{playback_url:staffPlayback(card,a.id)}:{})}))},publication:publicPublication(jobs?.[0]||null)}
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
 return {ok:true,publication:publicPublication(job)}
}
export function publicationDatabaseError(message:string){return new SocialError(409,/publication_active/.test(message)?'Esta peça já tem uma publicação na fila. Abra a programação para conferir.':/publication_in_progress/.test(message)?'A publicação já está sendo enviada ao Instagram. Aguarde a confirmação.':/already_published/.test(message)?'Esta versão já foi publicada.':/version_conflict/.test(message)?'Esta peça mudou em outra tela. Reabra e confira.':'Não foi possível salvar a programação. Atualize a peça e tente novamente.')}
