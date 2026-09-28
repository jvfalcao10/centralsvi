import sharp from 'sharp'
import {Readable} from 'node:stream'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {SocialAsset} from './social-domain.js'
import type {PublicationJob} from './social-publication-domain.js'
import {publicationGraph,publicationToken,friendlyPublicationError} from './social-publication-meta.js'
import {driveVideoRange} from './social-drive.js'
class LostLease extends Error {}
export function allowedUploadURI(raw:string,id:string){try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='rupload.facebook.com'&&new RegExp(`^/ig-api-upload/v[0-9]{1,2}\\.[0-9]{1,2}/${id}$`).test(u.pathname)&&!u.username&&!u.password}catch{return false}}
async function persist(db:SupabaseClient,j:PublicationJob,patch:Record<string,unknown>){
 const {data,error}=await db.from('central_social_publications').update({...patch,updated_at:new Date().toISOString()}).eq('id',j.id).eq('lease_id',j.lease_id).in('status',['preparing','processing','publishing','uncertain']).select('id').maybeSingle()
 if(error)throw error;if(!data)throw new LostLease();Object.assign(j,patch)
}
const later=(seconds=25)=>({lease_id:null,lease_until:null,next_attempt_at:new Date(Date.now()+seconds*1000).toISOString()})
async function signed(db:SupabaseClient,path:string){const {data,error}=await db.storage.from('central-social').createSignedUrl(path,86400);if(error||!data?.signedUrl)throw new Error('Mídia: arquivo indisponível. Confira a peça.');return data.signedUrl}
async function imageURL(db:SupabaseClient,j:PublicationJob,a:SocialAsset,index:number){
 const path=`publications/${j.id}/image-${index}.jpg`
 const {data:source,error}=await db.storage.from('central-social').download(a.path);if(error||!source)throw new Error('Mídia: não foi possível ler a imagem.')
 const bytes=await sharp(Buffer.from(await source.arrayBuffer()),{limitInputPixels:50000000}).rotate().resize({width:1440,height:1920,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:92}).toBuffer()
 const {error:uploadError}=await db.storage.from('central-social').upload(path,new Uint8Array(bytes),{contentType:'image/jpeg',upsert:true});if(uploadError)throw uploadError
 return signed(db,path)
}
async function uploadDrive(a:SocialAsset,uri:string,id:string){
 if(!allowedUploadURI(uri,id)||!a.drive_id||!a.bytes||a.bytes>500*1024*1024)throw new Error('Mídia: vídeo do Drive inválido para publicação.')
 const total=a.bytes,driveId=a.drive_id
 async function* chunks(){for(let start=0;start<total;start+=4*1024*1024){const end=Math.min(total-1,start+4*1024*1024-1),r=await driveVideoRange(driveId,start,end);if(r.status!==206||r.headers.get('content-range')!==`bytes ${start}-${end}/${total}`){await r.body?.cancel();throw new Error('Mídia: o download do vídeo foi interrompido.')}const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length!==end-start+1)throw new Error('Mídia: vídeo incompleto.');yield bytes}}
 const response=await fetch(uri,{method:'POST',headers:{Authorization:`OAuth ${publicationToken()}`,offset:'0',file_size:String(total),'Content-Type':'application/octet-stream','Content-Length':String(total)},body:Readable.from(chunks()) as any,duplex:'half',signal:AbortSignal.timeout(210000)} as RequestInit)
 const result=await response.json();if(!response.ok||result.success!==true)throw new Error('Mídia: o Instagram não recebeu o vídeo completo. Tente novamente.')
}
async function container(db:SupabaseClient,j:PublicationJob,a:SocialAsset,index:number,child:boolean){
 const video=a.type.startsWith('video/'),drive=video&&a.storage==='drive'
 const params:Record<string,string>={...(child?{is_carousel_item:'true'}:{caption:j.format==='story'?'':j.caption})}
 if(video)params.media_type=child?'VIDEO':j.format==='story'?'STORIES':'REELS'
 else if(j.format==='story')params.media_type='STORIES'
 if(drive)params.upload_type='resumable'
 else if(video)params.video_url=await signed(db,a.path)
 else params.image_url=await imageURL(db,j,a,index)
 if(!child&&j.format==='reel'){
  params.share_to_feed='true'
  if(j.cover_path)params.cover_url=await signed(db,j.cover_path)
  else params.thumb_offset=String(j.cover_offset_ms||0)
 }
 const created=await publicationGraph('POST',`${j.account_id}/media`,params)
 if(!/^\d+$/.test(created.id||''))throw new Error('Mídia: o Instagram não criou a publicação.')
 return {id:String(created.id),uri:drive?String(created.uri||''):null,uploaded:!drive}
}
async function finish(db:SupabaseClient,j:PublicationJob,media:string|null){
 let permalink:string|null=null
 if(media)try{permalink=(await publicationGraph('GET',media,{fields:'permalink'})).permalink||null}catch{/* Confirmation is independent of permalink availability. */}
 const {data,error}=await db.rpc('central_social_publication_finish',{p_job:j.id,p_lease:j.lease_id,p_media:media,p_permalink:permalink});if(error)throw error;if(!data)throw new LostLease()
}
// Dependency injection keeps the irreversible boundary testable without publishing a real post.
export async function publishReady(db:SupabaseClient,j:PublicationJob,graph=publicationGraph){
 const {data:began,error}=await db.rpc('central_social_publication_begin',{p_job:j.id,p_lease:j.lease_id});if(error)throw error;if(!began)throw new LostLease()
 j.status='publishing'
 try{
  const result=await graph('POST',`${j.account_id}/media_publish`,{creation_id:j.progress.container.id})
  if(!result.id)throw new Error('ambiguous_publish')
  // Save the media id before looking up the permalink. A resumed worker can finish safely.
  await persist(db,j,{media_id:String(result.id)})
  await finish(db,j,String(result.id))
 }catch(e){
  if(e instanceof LostLease)throw e
  // Even a definite API error can follow a lost prior response: never repeat media_publish.
  await persist(db,j,{status:'uncertain',error:'Aguardando confirmação do Instagram. Não envie a peça novamente.',...later(60)})
 }
}
export async function processPublications(db:SupabaseClient){
 const {data,error}=await db.rpc('central_social_publication_claim');if(error)throw error;if(!data)return {processed:0}
 const j=data as PublicationJob
 try{
  if(['publishing','uncertain'].includes(j.status)){
   if(j.media_id){await finish(db,j,j.media_id);return {processed:1,status:'published'}}
   const check=await publicationGraph('GET',j.progress.container.id,{fields:'status_code'})
   if(check.status_code==='PUBLISHED'){await finish(db,j,null);return {processed:1,status:'published'}}
   await persist(db,j,{status:'uncertain',error:'O envio precisa ser conferido no Instagram. Não repita a publicação.',...later(300)})
   return {processed:1,status:'uncertain'}
  }
  if(j.attempts>90)throw new Error('Mídia: o Instagram demorou para processar. Confira o arquivo antes de tentar novamente.')
  const progress={...j.progress}
  if(j.format==='carousel'){
   const children=[...(progress.children||[])]
   const start=Date.now();let created=0
   while(children.length<j.assets.length&&created<3&&Date.now()-start<90000){children.push(await container(db,j,j.assets[children.length],children.length,true));await persist(db,j,{progress:{...progress,children}});created++}
   if(children.length<j.assets.length){await persist(db,j,later());return {processed:1,status:'preparing'}}
   for(const child of children){const status=await publicationGraph('GET',child.id,{fields:'status_code'});if(['ERROR','EXPIRED'].includes(status.status_code))throw new Error('Mídia: um arquivo do carrossel foi recusado pelo Instagram.');if(status.status_code!=='FINISHED'){await persist(db,j,later());return {processed:1,status:'processing'}}}
   if(!progress.container){const c=await publicationGraph('POST',`${j.account_id}/media`,{media_type:'CAROUSEL',children:children.map(c=>c.id).join(','),caption:j.caption});if(!c.id)throw new Error('Mídia: carrossel não foi criado.');progress.container={id:String(c.id),uploaded:true};await persist(db,j,{status:'processing',progress,...later()});return {processed:1,status:'processing'}}
  }else{
   if(!progress.container){progress.container=await container(db,j,j.assets[0],0,false);await persist(db,j,{progress})}
   if(!progress.container.uploaded){await uploadDrive(j.assets[0],progress.container.uri,progress.container.id);progress.container={...progress.container,uploaded:true};await persist(db,j,{progress,status:'processing',...later()});return {processed:1,status:'processing'}}
  }
  if(j.status!=='processing')await persist(db,j,{status:'processing'})
  const state=await publicationGraph('GET',j.progress.container.id,{fields:'status_code'})
  if(['ERROR','EXPIRED'].includes(state.status_code))throw new Error('Mídia: o Instagram recusou o arquivo ou o prazo de processamento expirou.')
  if(state.status_code!=='FINISHED'){await persist(db,j,later());return {processed:1,status:'processing'}}
  if(Date.parse(j.scheduled_at)>Date.now()){await persist(db,j,{...later(),next_attempt_at:j.scheduled_at});return {processed:1,status:'ready_for_schedule'}}
  await publishReady(db,j)
  return {processed:1,status:'submitted'}
 }catch(e){
  if(e instanceof LostLease)return {processed:1,status:'canceled_or_changed'}
  if(['publishing','uncertain'].includes(j.status)){await persist(db,j,{status:'uncertain',error:'O envio precisa ser conferido no Instagram. Não repita a publicação.',...later(300)})}
  else await persist(db,j,{status:'failed',error:friendlyPublicationError(e),lease_id:null,lease_until:null})
  return {processed:1,status:j.status}
 }
}
