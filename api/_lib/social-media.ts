import type {SupabaseClient} from '@supabase/supabase-js'
import type {SocialAsset} from './social-domain.js'
import {previewPath} from './social-preview.js'
export async function socialMedia<T extends {id:string;assets:SocialAsset[]}>(db:SupabaseClient,card:T,access?:{token?:string;bundle?:string}):Promise<T> {
 const paths=card.assets.flatMap(a=>[...(a.storage==='drive'?[]:[a.path]),...(a.thumbnail?[a.thumbnail]:[])])
 const {data,error}=paths.length?await db.storage.from('central-social').createSignedUrls([...new Set(paths)],3600):{data:[],error:null}
 if(error)throw new Error('media_sign_failed')
 const urls=new Map(data?.map(a=>[a.path,a.signedUrl] as const))
 const query=access?.bundle?`bundle=${access.bundle}&id=${encodeURIComponent(card.id)}`:access?.token?`token=${access.token}`:''
 return {...card,assets:card.assets.map(a=>({...a,
  url:a.storage==='drive'&&/^[A-Za-z0-9_-]+$/.test(a.drive_id||'')?`https://drive.google.com/file/d/${a.drive_id}/view`:urls.get(a.path),
  preview:urls.get(previewPath(a)||''),
  ...(query&&a.storage==='drive'&&a.type.startsWith('video/')?{playback_url:`/api/social?stream=1&${query}&asset=${encodeURIComponent(a.id)}`}:{})
 }))}
}
