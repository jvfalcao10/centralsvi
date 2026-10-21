import sharp from 'sharp'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {SocialAsset} from './social-domain.js'
import type {PublicationJob} from './social-publication-domain.js'
import {ordemDasLaminas} from './social-publication-domain.js'
import {publicationGraph,publicationToken,friendlyPublicationError,MetaPublicationError} from './social-publication-meta.js'
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
/**
 * Quanto do arquivo o Instagram já tem.
 *
 * O endereço de upload é resumível: ele responde o offset atual, então uma
 * tentativa nova continua de onde a anterior parou em vez de recomeçar.
 * Se a consulta falhar, começa do zero, que é o comportamento antigo.
 */
async function offsetNoInstagram(uri:string){
 try{
  const r=await fetch(uri,{method:'GET',headers:{Authorization:`OAuth ${publicationToken()}`},signal:AbortSignal.timeout(30000)})
  if(!r.ok)return 0
  const d=await r.json() as {offset?:number|string}
  const n=Number(d?.offset)
  return Number.isFinite(n)&&n>=0?n:0
 }catch{return 0}
}

/** Pedaço de envio. Grande o bastante para ser rápido, pequeno o bastante para caber no tempo. */
const PEDACO=8*1024*1024

/**
 * Manda o vídeo do Drive para o Instagram em pedaços, retomando de onde parou.
 *
 * João, 19/10/2026: "qualidade péssima, todos os vídeos estão com qualidade
 * baixa". A causa não era o vídeo: em 17/10 publicações grandes falhavam com
 * "o Instagram não recebeu o vídeo completo", e a saída foi comprimir os
 * arquivos antes de publicar, de ~20 Mbps para 4,4. A compressão resolveu o
 * sintoma e estragou a imagem.
 *
 * A falha vinha daqui: o arquivo inteiro ia num POST só, com 210 segundos para
 * terminar. Um vídeo de 120 MB precisa de upload sustentado o caminho todo, e
 * qualquer soluço derrubava tudo, do primeiro byte ao último. Por isso o
 * tamanho não explicava nada: 85 MB falhava e 151 MB passava.
 *
 * Agora cada pedaço é uma requisição com o seu offset. Um soluço custa 8 MB,
 * não o arquivo inteiro, e a tentativa seguinte pergunta ao Instagram onde
 * parou.
 */
async function uploadDrive(a:SocialAsset,uri:string,id:string){
 if(!allowedUploadURI(uri,id)||!a.drive_id||!a.bytes||a.bytes>500*1024*1024)throw new Error('Mídia: vídeo do Drive inválido para publicação.')
 const total=a.bytes,driveId=a.drive_id
 let enviado=await offsetNoInstagram(uri)
 if(enviado>=total)return
 while(enviado<total){
  const fim=Math.min(total-1,enviado+PEDACO-1)
  const r=await driveVideoRange(driveId,enviado,fim)
  if(r.status!==206||r.headers.get('content-range')!==`bytes ${enviado}-${fim}/${total}`){await r.body?.cancel();throw new Error('Mídia: o download do vídeo foi interrompido.')}
  const bytes=new Uint8Array(await r.arrayBuffer())
  if(bytes.length!==fim-enviado+1)throw new Error('Mídia: vídeo incompleto.')
  const resposta=await fetch(uri,{method:'POST',headers:{
   Authorization:`OAuth ${publicationToken()}`,offset:String(enviado),file_size:String(total),
   'Content-Type':'application/octet-stream','Content-Length':String(bytes.length),
  },body:bytes,signal:AbortSignal.timeout(120000)})
  if(!resposta.ok)throw new Error('Mídia: o Instagram não recebeu o vídeo completo. Tente novamente.')
  // A resposta só traz success quando o último pedaço fecha o arquivo.
  const d=await resposta.json().catch(()=>({})) as {success?:boolean;offset?:number|string}
  const confirmado=Number(d?.offset)
  enviado=Number.isFinite(confirmado)&&confirmado>enviado?confirmado:fim+1
  if(d?.success===true)return
 }
 // Fechou o arquivo sem o Instagram dizer success: confere o offset antes de
 // dar por bom, para não seguir com um vídeo pela metade.
 if(await offsetNoInstagram(uri)<total)throw new Error('Mídia: o Instagram não recebeu o vídeo completo. Tente novamente.')
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
/**
 * Vale tentar de novo, ou o Instagram já disse não?
 *
 * Até 19/10/2026 qualquer erro de envio marcava a publicação como `failed`
 * para sempre, e nenhuma das quatro falhas medidas passou de uma tentativa.
 * Um soluço de rede no meio de um vídeo de 120 MB matava o post, e a saída
 * encontrada na mão foi comprimir o arquivo, o que estragou a qualidade.
 *
 * Arquivo recusado, conta sem permissão e token vencido continuam parando de
 * primeira: repetir não muda o resultado e só enche o Instagram de tentativa.
 */
export function valeTentarDeNovo(e:unknown){
 if(e instanceof MetaPublicationError)return false
 const m=e instanceof Error?e.message:''
 if(/recusou|recusado|expirou|inválido para publicação|demorou para processar/i.test(m))return false
 // Transporte: download do Drive cortado, upload incompleto, tempo esgotado.
 return true
}

/** Tentativas de transporte antes de desistir e chamar gente. */
const TENTATIVAS_DE_ENVIO=6
/** Três horas perguntando ao Instagram, de 5 em 5 minutos, já é resposta. */
const TENTATIVAS_INCERTAS=36

export async function processPublications(db:SupabaseClient){
 const {data,error}=await db.rpc('central_social_publication_claim');if(error)throw error;if(!data)return {processed:0}
 const j=data as PublicationJob
 try{
  if(['publishing','uncertain'].includes(j.status)){
   if(j.media_id){await finish(db,j,j.media_id);return {processed:1,status:'published'}}
   const check=await publicationGraph('GET',j.progress.container.id,{fields:'status_code'})
   if(check.status_code==='PUBLISHED'){await finish(db,j,null);return {processed:1,status:'published'}}
   // O Instagram dizendo ERROR ou EXPIRED encerra a dúvida: não publicou nada.
   // Sem isto a peça fica em `uncertain` perguntando de 5 em 5 minutos para
   // sempre. Medido em 21/10/2026: o story do vídeo 05 da GM Gás, com o
   // container em ERROR desde 20/10 12h, estava na **261ª tentativa**, e no
   // quadro a peça aparecia como postada porque o reel do mesmo card saiu.
   if(['ERROR','EXPIRED'].includes(check.status_code)){
    await persist(db,j,{status:'failed',error:'O Instagram recusou o arquivo e nada foi publicado. Dá para reenviar a peça.',lease_id:null,lease_until:null})
    return {processed:1,status:'failed'}
   }
   // Dúvida de verdade também não dura para sempre: depois de três horas
   // perguntando, quem decide é gente. Aqui a mensagem NÃO diz que nada foi
   // publicado, porque ninguém sabe, e reenviar sem olhar pode duplicar.
   if(j.attempts>TENTATIVAS_INCERTAS){
    await persist(db,j,{status:'failed',error:'Não deu para confirmar esta publicação no Instagram. Confira a conta ANTES de reenviar.',lease_id:null,lease_until:null})
    return {processed:1,status:'failed'}
   }
   await persist(db,j,{status:'uncertain',error:'O envio precisa ser conferido no Instagram. Não repita a publicação.',...later(300)})
   return {processed:1,status:'uncertain'}
  }
  if(j.attempts>90)throw new Error('Mídia: o Instagram demorou para processar. Confira o arquivo antes de tentar novamente.')
  const progress={...j.progress}
  if(j.format==='carousel'){
   // A trava da tela não alcança peça enfileirada por script, e carrossel fora
   // de ordem não tem conserto depois de publicado: só apagando. Aqui é o
   // último ponto antes de o Instagram receber qualquer coisa.
   const foraDeOrdem=ordemDasLaminas(j.assets)
   if(foraDeOrdem)throw new MetaPublicationError(0,foraDeOrdem)
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
  else if(valeTentarDeNovo(e)&&j.attempts<TENTATIVAS_DE_ENVIO){
   // O progresso já gravado fica: o upload retoma do offset que o Instagram
   // confirmou, então repetir não recomeça o arquivo do zero.
   await persist(db,j,{status:'queued',error:`${friendlyPublicationError(e)} Tentando de novo.`,...later(60*(j.attempts+1))})
   return {processed:1,status:'retry'}
  }
  else await persist(db,j,{status:'failed',error:friendlyPublicationError(e),lease_id:null,lease_until:null})
  return {processed:1,status:j.status}
 }
}
