import type {SupabaseClient} from '@supabase/supabase-js'
import type {SocialAsset} from './social-domain.js'
import {previewPath} from './social-preview.js'
export async function socialMedia<T extends {id:string;assets:SocialAsset[]}>(db:SupabaseClient,card:T,access?:{token?:string;bundle?:string}):Promise<T> {
 const paths=card.assets.flatMap(a=>[...(a.storage==='drive'?[]:[a.path]),...(a.thumbnail?[a.thumbnail]:[]),...(a.approval_path?[a.approval_path]:[])])
 const {data,error}=paths.length?await db.storage.from('central-social').createSignedUrls([...new Set(paths)],3600):{data:[],error:null}
 if(error)throw new Error('media_sign_failed')
 const urls=new Map(data?.map(a=>[a.path,a.signedUrl] as const))
 const query=access?.bundle?`bundle=${access.bundle}&id=${encodeURIComponent(card.id)}`:access?.token?`token=${access.token}`:''
 return {...card,assets:card.assets.map(a=>{
  // A cópia leve é servida direto pelo Supabase, sem passar pela função. O
  // proxy entrega 3 MB por requisição, que é o teto de resposta, e isso
  // segurava o vídeo em 6,6 Mbps enquanto o arquivo do editor pedia 20,3.
  // Quem ainda não tem cópia leve continua pelo proxy, que funciona, só é
  // lento.
  const leve=a.approval_path?urls.get(a.approval_path):undefined
  const proxy=query&&a.storage==='drive'&&a.type.startsWith('video/')
   ?`/api/social?stream=1&${query}&asset=${encodeURIComponent(a.id)}`:undefined
  return {...a,
   url:a.storage==='drive'&&/^[A-Za-z0-9_-]+$/.test(a.drive_id||'')?`https://drive.google.com/file/d/${a.drive_id}/view`:urls.get(a.path),
   preview:urls.get(previewPath(a)||''),
   ...(leve||proxy?{playback_url:leve||proxy}:{})}
 })}
}
