import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createAdminClient } from './supabase.js'
import { publicCard, type SocialCard } from './social-domain.js'
import { previewPath } from './social-preview.js'

const origin='https://central.svicompany.com.br'
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function socialShareMeta(card:SocialCard,token:string) {
 const c=publicCard(card),asset=c.assets[0]
 const title=(c.client===c.title?c.title:`${c.client} · ${c.title}`).replace(/\s+/g,' ').slice(0,180)
 const video=asset?.type.startsWith('video/')
 const description=`${c.assets.length>1?`${c.assets.length} arquivos`:video?'Vídeo':'Publicação'} para aprovação · versão ${c.revision}. Abra para ${video?'assistir':'conferir'} e aprovar ou pedir ajustes.`
 const url=`${origin}/aprovar/social/${token}`
 return {title,description,url,image:asset&&previewPath(asset)?`${url}/preview.jpg`:undefined,asset}
}
export function socialShareHTML(shell:string,meta:ReturnType<typeof socialShareMeta>) {
 const tags=`<title>${esc(meta.title)} · Aprovação</title>
<meta name="description" content="${esc(meta.description)}">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SVI · Aprovação">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${esc(meta.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
${meta.image?`<meta property="og:image" content="${esc(meta.image)}"><meta property="og:image:secure_url" content="${esc(meta.image)}"><meta property="og:image:alt" content="${esc(`Prévia de ${meta.asset!.name}`)}"><meta name="twitter:image" content="${esc(meta.image)}">`:''}`
 return shell.replace(/<html\s+lang="[^"]*"/i,'<html lang="pt-BR"').replace(/<title>[\s\S]*?<\/title>/gi,'').replace(/<meta\b[^>]*(?:property|name)=["'](?:og:[^"']*|twitter:[^"']*|description|robots|referrer)["'][^>]*>/gi,'').replace('</head>',`${tags}\n</head>`)
}
export async function handleSocialShare(req:VercelRequest,res:VercelResponse) {
 res.setHeader('Cache-Control','private, no-store')
 res.setHeader('X-Robots-Tag','noindex, nofollow')
 res.setHeader('Referrer-Policy','no-referrer')
 res.setHeader('X-Content-Type-Options','nosniff')
 const error=(status:number)=>{res.status(status).setHeader('Content-Type','text/html; charset=utf-8');return req.method==='HEAD'?res.end():res.send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link indisponível</title><h1>Este link não está disponível</h1><p>Peça à equipe o link de aprovação atualizado.</p></html>')}
 if(!['GET','HEAD'].includes(req.method||'')){res.setHeader('Allow','GET, HEAD');return error(405)}
 const token=typeof req.query.token==='string'?req.query.token:''
 if(!/^[a-f0-9]{64}$/.test(token))return error(404)
 try {
  const db=createAdminClient()
  const {data,error:dbError}=await db.from('central_social_cards').select('*').eq('token_hash',createHash('sha256').update(token).digest('hex')).maybeSingle()
  if(dbError)throw new Error('share_unavailable')
  if(!data||!(Date.parse(data.token_expires_at)>Date.now())||data.ingest_pending)return error(404)
  const meta=socialShareMeta(data as SocialCard,token)
  if(!meta.asset)return error(404)
  if(req.query.image==='1'){
   const path=previewPath(meta.asset);if(!path)return error(404)
   const {data:blob,error:storageError}=await db.storage.from('central-social').download(path)
   if(storageError||!blob||!/^image\/(jpeg|png|webp)$/.test(blob.type)||blob.size>5*1024*1024)return error(404)
   res.setHeader('Content-Type',blob.type);res.setHeader('Content-Length',String(blob.size))
   return req.method==='HEAD'?res.status(200).end():res.status(200).send(Buffer.from(await blob.arrayBuffer()))
  }
  const shell=await readFile(join(process.cwd(),'dist/index.html'),'utf8')
  res.setHeader('Content-Type','text/html; charset=utf-8')
  return req.method==='HEAD'?res.status(200).end():res.status(200).send(socialShareHTML(shell,meta))
 } catch {return error(503)}
}
