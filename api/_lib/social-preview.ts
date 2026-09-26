import type { createAdminClient } from './supabase.js'
import type { SocialAsset } from './social-domain.js'
import { digest } from './social-sync-domain.js'
import { driveThumbnail } from './social-drive.js'
type DB=ReturnType<typeof createAdminClient>
export const previewPath=(asset:SocialAsset,videoFallback=false)=>asset.thumbnail||((asset.type.startsWith('image/')||(videoFallback&&asset.storage!=='drive'))?asset.path:undefined)
export async function refreshVideoPreviews(db:DB,limit=3) {
 const todo:{card:string;asset:SocialAsset}[]=[]
 for(let offset=0;todo.length<limit;offset+=500){
  const {data,error}=await db.from('central_social_cards').select('id,assets').order('id').range(offset,offset+499)
  if(error)throw new Error('preview_database_failed')
  for(const c of data||[])for(const a of c.assets as SocialAsset[]){
   if(todo.length>=limit)break
   if(a.storage==='drive'&&a.type.startsWith('video/')&&!a.thumbnail&&(!a.preview_retry_at||Date.parse(a.preview_retry_at)<=Date.now()))todo.push({card:c.id,asset:a})
  }
  if(!data||data.length<500)break
 }
 let ready=0,pending=0
 for(const {card,asset} of todo){
  let patch:Record<string,unknown>
  try{
   const thumbnail=await driveThumbnail(asset.drive_id||'');if(!thumbnail)throw new Error('preview_processing')
   const path=`previews/${digest(asset.path)}.jpg`
   const {error}=await db.storage.from('central-social').upload(path,new Uint8Array(thumbnail.bytes),{contentType:'image/jpeg',cacheControl:'31536000',upsert:false})
   if(error&&!/already exists|duplicate/i.test(error.message))throw new Error('preview_storage_failed')
   patch={thumbnail:path,duration_ms:thumbnail.duration_ms,width:thumbnail.width,height:thumbnail.height}
  }catch{patch={preview_retry_at:new Date(Date.now()+120000).toISOString()};pending++}
  const {data,error}=await db.rpc('central_social_asset_preview',{p_card_id:card,p_asset_id:asset.id,p_asset_path:asset.path,p_preview:patch})
  if(error)throw new Error('preview_database_failed')
  if(data&&patch.thumbnail)ready++
 }
 return {ready,pending}
}
