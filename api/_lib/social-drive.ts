import type { createAdminClient } from './supabase.js'
import { allowedMediaURL, digest } from './social-sync-domain.js'
import { MONTHS } from './social-intake.js'
type DB=ReturnType<typeof createAdminClient>
type Job={key:string;source_id:string;card_id:string;attempts:number;payload:Record<string,any>}
const ROOT='1NW77Tge2SOZ57r7Gfdg0wQ7zhE69bXDb',API='https://www.googleapis.com/drive/v3',LIMIT=500*1024*1024,CHUNK=8*1024*1024
let cached:{token:string;until:number}|undefined
async function access() {
 if(cached&&cached.until>Date.now())return cached.token
 const config=JSON.parse(process.env.SOCIAL_GOOGLE_OAUTH||'{}')
 if(!config.refresh_token)throw new Error('drive_configuration_missing')
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({...config,grant_type:'refresh_token'}),signal:AbortSignal.timeout(20000)})
 if(!r.ok)throw new Error('drive_auth_failed')
 const d=await r.json();cached={token:d.access_token,until:Date.now()+Math.max(60,Number(d.expires_in)-120)*1000};return cached.token
}
async function google(path:string,init:RequestInit={}) {
 return fetch(API+path,{...init,headers:{Authorization:`Bearer ${await access()}`,...init.headers},signal:AbortSignal.timeout(30000)})
}
async function generatedID(){const r=await google('/files/generateIds?count=1&space=drive');if(!r.ok)throw new Error('drive_id_failed');return (await r.json()).ids[0] as string}
async function folder(db:DB,parent:string,name:string) {
 const key=digest(`${parent}|${name}`)
 let {data,error}=await db.from('central_social_drive_folders').select('drive_id').eq('path',key).maybeSingle();if(error)throw new Error('database_failed')
 if(!data){const id=await generatedID();const add=await db.from('central_social_drive_folders').upsert({path:key,drive_id:id},{onConflict:'path',ignoreDuplicates:true});if(add.error)throw new Error('database_failed');const read=await db.from('central_social_drive_folders').select('drive_id').eq('path',key).single();if(read.error)throw new Error('database_failed');data=read.data}
 const id=data!.drive_id
 const exists=await google(`/files/${id}?fields=id,name,parents,trashed`)
 if(exists.ok){const d=await exists.json();if(d.trashed||d.name!==name||!d.parents?.includes(parent))throw new Error('drive_folder_changed');return id}
 if(exists.status!==404)throw new Error('drive_folder_failed')
 const create=await google('/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,name,parents:[parent],mimeType:'application/vnd.google-apps.folder'})})
 if(!create.ok&&create.status!==409)throw new Error('drive_folder_failed')
 return id
}
export function validDriveSession(raw:string){try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='www.googleapis.com'&&!u.username&&!u.password&&!u.port&&u.pathname==='/upload/drive/v3/files'&&u.searchParams.has('upload_id')}catch{return false}}
export async function driveVideo(db:DB,job:Job,url:string) {
 const p=job.payload,total=Number(p.bytes),type=String(p.type||'video/mp4')
 if(!Number.isSafeInteger(total)||total<=0||total>LIMIT)throw new Error('drive_size_limit')
 if(!allowedMediaURL(url,'whatsapp'))throw new Error('media_host_review')
 const patch=async(value:Record<string,any>)=>{const r=await db.rpc('central_social_job_data',{p_key:job.key,p_attempt:job.attempts,p_patch:value});if(r.error)throw new Error('job_lease_lost');Object.assign(p,r.data)}
 const date=new Date(p.at),year=Number(p.year)||date.getUTCFullYear(),month=Number(p.month)||date.getUTCMonth()+1
 if(month<1||month>12||year<2020||year>2100)throw new Error('drive_date_invalid')
 const client=String(p.client||'Identificar cliente').replace(/[\x00-\x1f/\\]/g,' ').slice(0,120)
 let parent=await folder(db,ROOT,String(year));parent=await folder(db,parent,MONTHS[month-1]);parent=await folder(db,parent,client)
 if(!p.drive_id)await patch({drive_id:await generatedID()})
 const asset=(d:Record<string,any>)=>{
  if(Number(d.size)!==total||d.trashed||!d.parents?.includes(parent))throw new Error('drive_file_invalid')
  return {id:job.source_id,name:p.name,path:`drive:${d.id}`,storage:'drive',drive_id:d.id,type,bytes:Number(d.size),date:p.at,folder_url:`https://drive.google.com/drive/folders/${parent}`,folder_label:`${year} / ${MONTHS[month-1]} / ${client}`}
 }
 const existing=await google(`/files/${p.drive_id}?fields=id,size,parents,trashed`)
 if(existing.ok)return asset(await existing.json())
 if(existing.status!==404)throw new Error('drive_file_failed')
 let session=String(p.drive_session||''),offset=0
 if(session&&validDriveSession(session)){
  const status=await fetch(session,{method:'PUT',headers:{Authorization:`Bearer ${await access()}`,'Content-Range':`bytes */${total}`,'Content-Length':'0'},signal:AbortSignal.timeout(20000),redirect:'manual'})
  if(status.ok){const r=await google(`/files/${p.drive_id}?fields=id,size,parents,trashed`);if(!r.ok)throw new Error('drive_file_failed');return asset(await r.json())}
  if(status.status===308)offset=Number(status.headers.get('range')?.match(/-(\d+)$/)?.[1]??-1)+1
  else if([404,410].includes(status.status))session='';else throw new Error('drive_resume_failed')
 }else session=''
 if(!session){
  const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,parents,trashed',{method:'POST',headers:{Authorization:`Bearer ${await access()}`,'Content-Type':'application/json','X-Upload-Content-Type':type,'X-Upload-Content-Length':String(total)},body:JSON.stringify({id:p.drive_id,name:p.name,mimeType:type,parents:[parent],description:`Original recebido pela Central SVI. Mensagem ${job.source_id}.`,appProperties:{social_job:digest(job.key)}}),signal:AbortSignal.timeout(25000),redirect:'manual'})
  session=r.headers.get('location')||'';if(!r.ok||!validDriveSession(session))throw new Error('drive_start_failed')
  await patch({drive_session:session})
 }
 // Copy in bounded chunks; the source credential is never sent to Google.
 const source=await fetch(url,{headers:{token:process.env.SOCIAL_UAZ_TOKEN||'',...(offset?{Range:`bytes=${offset}-`}:{})},redirect:'manual',signal:AbortSignal.timeout(220000)})
 if(!source.ok||!source.body)throw new Error('drive_source_failed')
 if(source.status===206&&Number(source.headers.get('content-range')?.match(/^bytes (\d+)-/)?.[1])!==offset){await source.body.cancel();throw new Error('drive_source_range')}
 const reader=source.body.getReader();let skip=source.status===206?0:offset,buffer=Buffer.alloc(0),read=offset,finished:any,deadline=Date.now()+180000
 try{
  while(true){
   const {value,done}=await reader.read()
   if(value){let v:Uint8Array=value;if(skip){const n=Math.min(skip,v.length);skip-=n;v=v.subarray(n)}read+=v.length;if(read>total)throw new Error('drive_source_size');buffer=Buffer.concat([buffer,v])}
   while(buffer.length>=CHUNK||(done&&buffer.length)){
    const size=Math.min(CHUNK,buffer.length),chunk=buffer.subarray(0,size),end=offset+size-1
    const r=await fetch(session,{method:'PUT',headers:{Authorization:`Bearer ${await access()}`,'Content-Type':type,'Content-Length':String(size),'Content-Range':`bytes ${offset}-${end}/${total}`},body:new Uint8Array(chunk),redirect:'manual',signal:AbortSignal.timeout(45000)})
    if(r.status===308){const last=Number(r.headers.get('range')?.match(/-(\d+)$/)?.[1]);if(last!==end)throw new Error('drive_offset_mismatch')}
    else if(r.ok)finished=await r.json();else throw new Error('drive_upload_failed')
    offset=end+1;buffer=buffer.subarray(size)
    if(Date.now()>deadline&&offset<total)throw new Error('drive_resume_pending')
   }
   if(done)break
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 if(read!==total||offset!==total||!finished)throw new Error('drive_source_size')
 return asset(finished)
}

export function validDriveThumbnailURL(raw:string) {
 try {const u=new URL(raw);return u.protocol==='https:'&&/^lh\d+\.googleusercontent\.com$/.test(u.hostname)&&!u.username&&!u.password&&!u.port}catch{return false}
}
export async function driveThumbnail(id:string) {
 if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('drive_id_invalid')
 const r=await google(`/files/${id}?fields=id,trashed,thumbnailLink,videoMediaMetadata`)
 if(!r.ok)throw new Error('drive_preview_unavailable')
 const data=await r.json();if(data.trashed||!data.thumbnailLink)return null
 const url=String(data.thumbnailLink).replace(/=s\d+$/,'=s640')
 if(!validDriveThumbnailURL(url))throw new Error('drive_preview_host')
 const response=await fetch(url,{headers:{Authorization:`Bearer ${await access()}`},redirect:'manual',signal:AbortSignal.timeout(15000)})
 if(!response.ok||!response.body||response.headers.get('content-type')?.split(';')[0]!=='image/jpeg')throw new Error('drive_preview_failed')
 const max=2*1024*1024;if(Number(response.headers.get('content-length')||0)>max){await response.body.cancel();throw new Error('drive_preview_size')}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error('drive_preview_size');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const bytes=Buffer.concat(chunks);if(bytes.length<3||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)throw new Error('drive_preview_type')
 const m=data.videoMediaMetadata||{}
 return {bytes,duration_ms:Number(m.durationMillis)||undefined,width:Number(m.width)||undefined,height:Number(m.height)||undefined}
}
