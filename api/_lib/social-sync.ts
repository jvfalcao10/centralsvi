import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from './supabase.js'
import { allowedMediaURL, digest, mathVideo, mediaType, normalized, SOCIAL_MATH_GROUP, taskClient } from './social-sync-domain.js'
const MAX_BYTES=50*1024*1024
const CLICKUP='https://api.clickup.com/api/v2'
const UAZ='https://svicompany.uazapi.com'
const LISTS:Record<string,{id:string;author:string}>={jose:{id:'901521539717',author:'José'},lais:{id:'901524992979',author:'Laís'},math:{id:'901523658547',author:'Math'}}
type DB=ReturnType<typeof createAdminClient>
type Job={key:string;provider:'clickup'|'whatsapp';source_id:string;card_id:string;attempts:number;payload:Record<string,any>}
const checked=<T extends {error:any}>(r:T):T=>{if(r.error)throw new Error('database_failed');return r}
class SyncError extends Error {constructor(public code:string,public manual=false){super(code)}}
async function json(url:string,init:RequestInit={}) {
 const r=await fetch(url,{...init,signal:AbortSignal.timeout(25000)})
 if(!r.ok)throw new SyncError(`source_http_${r.status}`)
 return r.json()
}
const clickup=(path:string)=>json(CLICKUP+path,{headers:{Authorization:process.env.SOCIAL_CLICKUP_TOKEN||''}})
const uaz=(path:string,body:Record<string,unknown>)=>json(UAZ+path,{method:'POST',headers:{token:process.env.SOCIAL_UAZ_TOKEN||'','Content-Type':'application/json'},body:JSON.stringify(body)})
async function queue(db:DB,rows:Record<string,unknown>[]) {
 if(rows.length)checked(await db.from('central_social_inbox').upsert(rows,{onConflict:'key',ignoreDuplicates:true}))
}
async function discover(db:DB,source:string) {
 const {data:state}=checked(await db.rpc('central_social_claim',{p_source:source}));if(!state)return {source,busy:true}
 let count=0
 const until=Date.now()-1000,since=Number(state.cursor_ms)-300000
 try {
  if(source==='whatsapp:math') {
   if(!process.env.SOCIAL_UAZ_TOKEN)throw new SyncError('configuration_missing')
   // Full pagination to the saved watermark. No cursor advance on an incomplete scan.
   let ended=false
   for(let offset=0;offset<2000;offset+=100){
    const data=await uaz('/message/find',{chatid:SOCIAL_MATH_GROUP,limit:100,offset})
    if(!Array.isArray(data.messages))throw new SyncError('source_shape_invalid')
    const rows=[]
    for(const message of data.messages){
     const raw=Number(message.messageTimestamp),timestamp=raw<1e12?raw*1000:raw
     if(timestamp<since)continue
     const delivery=mathVideo(message)
     if(delivery){rows.push({key:delivery.key,provider:delivery.provider,source_id:delivery.source_id,card_id:delivery.card_id,payload:{...delivery.payload,client:delivery.client,title:delivery.title,delivery_version:delivery.delivery_version}});count++}
    }
    await queue(db,rows)
    // Do not assume API message sort order; scan all available pages (bounded at 2000).
    if(!data.hasMore){ended=true;break}
   }
   if(!ended)throw new SyncError('message_scan_limit')
  } else {
   if(!process.env.SOCIAL_CLICKUP_TOKEN)throw new SyncError('configuration_missing')
   const list=LISTS[source.split(':')[1]];if(!list)throw new SyncError('source_invalid')
   let ended=false
   for(let page=0;page<10;page++){
    const params=new URLSearchParams({include_closed:'true',subtasks:'true',include_timl:'true',page:String(page),order_by:'updated',date_updated_gt:String(since),date_updated_lt:String(until)})
    const data=await clickup(`/list/${list.id}/task?${params}`)
    if(!Array.isArray(data.tasks))throw new SyncError('source_shape_invalid')
    await queue(db,data.tasks.map((t:any)=>({key:`cu:${t.id}:${t.date_updated}`,provider:'clickup',source_id:String(t.id),card_id:String(t.id),payload:{author:list.author,title:String(t.name).slice(0,250),list_id:list.id,updated:t.date_updated}})))
    count+=data.tasks.length
    if(data.last_page===true||data.tasks.length<100){ended=true;break}
   }
   if(!ended)throw new SyncError('task_scan_limit')
  }
  checked(await db.from('central_social_sync_sources').update({cursor_ms:until,lease_until:null,last_success_at:new Date().toISOString(),error:null,updated_at:new Date().toISOString()}).eq('id',source))
  return {source,observed:count}
 }catch(e){
  const code=e instanceof SyncError?e.code:'source_unavailable'
  checked(await db.from('central_social_sync_sources').update({lease_until:null,error:code,updated_at:new Date().toISOString()}).eq('id',source))
  return {source,error:code}
 }
}
async function binary(raw:string,provider:'clickup'|'whatsapp',limit=MAX_BYTES,timeout=35000):Promise<{buffer:Buffer;type:string}> {
 let url=raw
 for(let i=0;i<4;i++){
  if(!allowedMediaURL(url,provider))throw new SyncError('media_host_review',true)
  const headers:Record<string,string>={}
  // Only the fixed UazAPI host may receive its credential. ClickUp's signed files need none.
  if(provider==='whatsapp')headers.token=process.env.SOCIAL_UAZ_TOKEN||''
  const response=await fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(timeout)})
  if([301,302,303,307,308].includes(response.status)){await response.body?.cancel();url=new URL(response.headers.get('location')||'',url).toString();continue}
  if(!response.ok)throw new SyncError(`media_http_${response.status}`)
  if(Number(response.headers.get('content-length')||0)>limit){await response.body?.cancel();throw new SyncError('media_over_50mb',true)}
  const reader=response.body?.getReader();if(!reader)throw new SyncError('media_empty')
  let size=0;const chunks:Uint8Array[]=[]
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new SyncError('media_over_50mb',true)}chunks.push(value)}}finally{reader.releaseLock()}
  if(!size)throw new SyncError('media_empty')
  return {buffer:Buffer.concat(chunks),type:response.headers.get('content-type')?.split(';')[0]||''}
 }
 throw new SyncError('media_redirect_limit')
}
async function upload(_db:DB,path:string,data:Buffer,type:string) {
 const base=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||''
 const r=await fetch(`${base}/storage/v1/object/central-social/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':type,'Cache-Control':'max-age=31536000','x-upsert':'false'},body:new Uint8Array(data),signal:AbortSignal.timeout(30000)})
 if(r.ok)return
 const info=await r.json().catch(()=>({}))
 if(String(info.statusCode)==='409'||/already exists|duplicate/i.test(info.message||''))return
 throw new SyncError('storage_failed')
}
async function asset(db:DB,job:Job,a:Record<string,any>) {
 if(Number(a.size||a.bytes||0)>MAX_BYTES)throw new SyncError('media_over_50mb',true)
 const name=String(a.title||a.name||'arquivo').slice(0,250),type=mediaType(name,String(a.mimetype||a.type||''))
 if(!type)return null
 const file=await binary(String(a.url),job.provider)
 if(/text\/html|application\/json/.test(file.type))throw new SyncError('media_not_file')
 const ext=type.split('/')[1].replace('quicktime','mov').replace('jpeg','jpg')
 const path=`sync/${digest(job.card_id).slice(0,24)}/${digest(file.buffer)}.${ext}`
 await upload(db,path,file.buffer,type)
 let thumbnail:string|undefined
 if(a.thumbnail_medium){try{const thumb=await binary(a.thumbnail_medium,job.provider,2*1024*1024,7000);if(thumb.type.startsWith('image/')){thumbnail=path+'.preview';await upload(db,thumbnail,thumb.buffer,thumb.type)}}catch{/* Original remains available even if a preview cannot be fetched. */}}
 return {id:String(a.id),name,path,type,bytes:file.buffer.length,date:a.date?new Date(Number(a.date)).toISOString():job.payload.at, ...(thumbnail?{thumbnail}:{})}
}
async function processJob(db:DB,job:Job) {
 try {
  const {data:existing}=checked(await db.from('central_social_cards').select('assets,client').eq('id',job.card_id).maybeSingle())
  let metadata:Record<string,unknown>,files:Record<string,any>[]
  if(job.provider==='clickup') {
   const t=await clickup('/task/'+encodeURIComponent(job.source_id))
   // Only configured production lists can enter through this collector.
   if(!Object.values(LISTS).some(l=>l.id===String(t.list?.id)))throw new SyncError('task_moved_review',true)
   let client=existing?.client||taskClient(t)
   const {data:catalog}=checked(await db.from('central_social_cards').select('client').limit(1000))
   client=catalog?.find(c=>normalized(c.client)===normalized(client))?.client||client
   metadata={client,title:String(t.name).slice(0,250),author:job.payload.author,source_url:`https://app.clickup.com/t/${t.id}`,source_status:t.status?.status||'',source_description:String(t.description||'').slice(0,10000),source_updated:new Date(Number(t.date_updated)).toISOString()}
   files=(t.attachments||[]).filter((a:any)=>!a.deleted&&!a.hidden&&Number(a.date)>=Date.parse('2026-09-01T00:00:00-03:00')&&mediaType(a.title||'',a.mimetype||''))
  }else{
   const p=job.payload
   metadata={client:p.client,title:p.title,author:'Math',source_url:'https://web.whatsapp.com/',source_status:'Entregue no grupo',source_description:`Grupo: MATH | EDITOR | SVI\nEnviado por Math em ${p.at}\nMensagem: ${job.source_id}\nVersão informada: ${p.delivery_version??'não informada'}\n\n${p.caption}`,source_updated:p.at}
   files=[{id:job.source_id,title:p.name,mimetype:p.type,size:p.bytes,date:Date.parse(p.at)}]
  }
  files=files.filter(a=>!existing?.assets?.some((old:any)=>old.id===String(a.id)))
  if(files.length)checked(await db.rpc('central_social_notice',{p_key:job.key,p_card:metadata}))
  const current=files.slice(0,2),assets=[]
  for(const a of current){
   if(job.provider==='whatsapp'){
    const result=await uaz('/message/download',{id:job.source_id})
    a.url=result.fileURL
    if(!a.url)throw new SyncError('media_unavailable')
   }
   const value=await asset(db,job,a);if(value)assets.push(value)
  }
  const {data}=checked(await db.rpc('central_social_ingest',{p_key:job.key,p_card:metadata,p_assets:assets,p_complete:files.length<=2}))
  return {key:job.key,...data}
 }catch(e){
  const code=e instanceof SyncError?e.code:'processing_unavailable'
  const manual=(e instanceof SyncError&&e.manual)||job.attempts>=8
  checked(await db.from('central_social_inbox').update({status:manual?'manual':'error',error:code,lease_until:null,next_attempt_at:new Date(Date.now()+Math.min(60,2**job.attempts)*60000).toISOString(),updated_at:new Date().toISOString()}).eq('key',job.key))
  return {key:job.key,error:code,manual}
 }
}
export async function socialSyncStatus(db:DB) {
 const {data:sources}=checked(await db.from('central_social_sync_sources').select('id,label,enabled,last_checked_at,last_success_at,error').order('id'))
 const {count:pending}=checked(await db.from('central_social_inbox').select('key',{head:true,count:'exact'}).in('status',['pending','processing','error']))
 const {data:issues}=checked(await db.from('central_social_inbox').select('key,provider,source_id,payload,error,updated_at').in('status',['error','manual']).order('updated_at',{ascending:false}).limit(20))
 const labels:Record<string,string>={media_over_50mb:'Arquivo acima de 50 MB. Disponibilize uma versão menor ou um link do original.',media_host_review:'O endereço do arquivo precisa ser conferido.',media_unavailable:'O WhatsApp ainda não disponibilizou o arquivo.',task_moved_review:'A tarefa mudou de lista. Confira a origem.'}
 return {sources,pending,issues:issues?.map(i=>({key:i.key,provider:i.provider,title:i.payload?.title||i.payload?.name||'Arquivo para conferir',source_url:i.provider==='clickup'?`https://app.clickup.com/t/${i.source_id}`:'https://web.whatsapp.com/',reason:labels[i.error]||'A importação precisa de conferência. A peça ainda não entrou no quadro.',updated_at:i.updated_at}))}
}
export async function handleSocialSync(req:VercelRequest,res:VercelResponse) {
 res.setHeader('Cache-Control','private, no-store')
 const configured=process.env.SOCIAL_SYNC_SECRET||'',provided=String(req.headers['x-social-sync-key']||'')
 if(!configured || Buffer.byteLength(provided)!==Buffer.byteLength(configured) || !timingSafeEqual(Buffer.from(provided),Buffer.from(configured)))return res.status(401).json({error:'Unauthorized'})
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'})
 try {
  const db=createAdminClient(),mode=req.body?.mode
  if(mode==='collect'){
   const source=String(req.body?.source||'');if(!['clickup:jose','clickup:lais','clickup:math','whatsapp:math'].includes(source))return res.status(400).json({error:'Invalid source'})
   return res.json(await discover(db,source))
  }
  if(mode==='process'){
   const results=[],start=Date.now()
   for(let i=0;i<1&&Date.now()-start<90000;i++){
    const {data:job}=checked(await db.rpc('central_social_claim',{}));if(!job)break
    results.push(await processJob(db,job as Job))
   }
   return res.json({processed:results.length,results})
  }
  return res.status(400).json({error:'Invalid mode'})
 }catch{return res.status(500).json({error:'sync_failed'})}
}
