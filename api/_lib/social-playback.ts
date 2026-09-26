import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { createAdminClient } from './supabase.js'
import { publicCard,type SocialCard } from './social-domain.js'
import { driveVideoRange } from './social-drive.js'
import {clientReviewCard} from './social-client.js'
import {SocialError} from './social-domain.js'
export const VIDEO_CHUNK=3*1024*1024
export function videoRange(raw:string|undefined,size:number) {
 if(!Number.isSafeInteger(size)||size<=0)return null
 if(!raw)return {start:0,end:Math.min(size,VIDEO_CHUNK)-1}
 const m=/^bytes=(\d*)-(\d*)$/.exec(raw);if(!m||(!m[1]&&!m[2]))return null
 const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]))
 const end=m[1]&&m[2]?Math.min(size-1,Number(m[2])):size-1
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null
 return {start,end:Math.min(end,start+VIDEO_CHUNK-1)}
}
export async function handleSocialPlayback(req:VercelRequest,res:VercelResponse) {
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff')
 if(!['GET','HEAD'].includes(req.method||''))return res.status(405).end()
 const token=typeof req.query.token==='string'?req.query.token:'',bundle=typeof req.query.bundle==='string'?req.query.bundle:'',id=typeof req.query.asset==='string'?req.query.asset:''
 if((token&&bundle)||!/^[a-f0-9]{64}$/.test(token||bundle)||!id)return res.status(404).end()
 try {
  const db=createAdminClient()
  let card:SocialCard
  if(bundle){card=await clientReviewCard(db,bundle,typeof req.query.id==='string'?req.query.id:'')}
  else {const {data,error}=await db.from('central_social_cards').select('*').eq('token_hash',createHash('sha256').update(token).digest('hex')).maybeSingle()
   if(error)throw new Error('database_error')
   if(!data||!(Date.parse(data.token_expires_at)>Date.now())||data.ingest_pending)return res.status(404).end()
   card=data as SocialCard
  }
  const asset=publicCard(card).assets.find(a=>a.id===id)
  if(!asset||asset.storage!=='drive'||!asset.type.startsWith('video/'))return res.status(404).end()
  const size=Number(asset.bytes),range=videoRange(typeof req.headers.range==='string'?req.headers.range:undefined,size)
  res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type',asset.type)
  if(!range){res.setHeader('Content-Range',`bytes */${size}`);return res.status(416).end()}
  if(req.method==='HEAD'){res.setHeader('Content-Length',String(size));return res.status(200).end()}
  const response=await driveVideoRange(asset.drive_id||'',range.start,range.end)
  const expected=`bytes ${range.start}-${range.end}/${size}`
  if(response.status!==206||response.headers.get('content-range')!==expected){await response.body?.cancel();return res.status(502).end()}
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==range.end-range.start+1||bytes.length>VIDEO_CHUNK)return res.status(502).end()
  res.setHeader('Content-Range',expected);res.setHeader('Content-Length',String(bytes.length))
  return res.status(206).send(bytes)
 }catch(e){return res.status(e instanceof SocialError?e.status:503).end()}
}
