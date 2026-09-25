import { describe,it,expect } from 'vitest'
import { parseDelivery,deliveredByTeam,mathVideo,whatsappVideo,SOCIAL_WHATSAPP_SOURCES,SOCIAL_MATH_GROUP,allowedMediaURL,mediaType,digest } from '../../api/_lib/social-sync-domain'
const m={id:'fixture-video-1',chatid:SOCIAL_MATH_GROUP,sender:'50217076449517@lid',messageTimestamp:1790367000000,messageType:'VideoMessage',text:'CARLOTINHA | Gol 2017 | V1',content:{mimetype:'video/mp4'}}
describe('Social video intake',()=>{
 it('keeps a revision under the same explicitly identified piece',()=>expect(parseDelivery(m.text,m.id).card_id).toBe(parseDelivery('carlotinha | Gol 2017 | V2','other').card_id))
 it('does not merge unidentified videos or infer client from chatter',()=>{expect(parseDelivery('ok aprovado','1').client).toBe('Identificar cliente');expect(parseDelivery('ok','1').card_id).not.toBe(parseDelivery('ok','2').card_id)})
 it('identifies explicit delivery',()=>expect(mathVideo(m)?.payload.type).toBe('video/mp4'))
 it('accepts original video document',()=>expect(mathVideo({...m,messageType:'DocumentMessage',content:{fileName:'original.MOV',mimetype:'video/quicktime'}})?.payload.type).toBe('video/quicktime'))
 it('ignores unrelated chat, other senders, API and own messages',()=>{for(const patch of [{chatid:'other@g.us'},{sender:'someone@s.whatsapp.net'},{wasSentByApi:true},{fromMe:true}])expect(mathVideo({...m,...patch})).toBeNull()})
 it('ignores photos, voices, texts and invalid dates',()=>{for(const patch of [{messageType:'ImageMessage',content:{mimetype:'image/jpeg'}},{messageType:'Conversation',content:{}},{messageTimestamp:'invalid'}])expect(mathVideo({...m,...patch})).toBeNull()})
 it('maps mp4 even when ClickUp calls it octet-stream',()=>expect(mediaType('video.mp4','application/octet-stream')).toBe('video/mp4'))
 it('rejects active or unsupported media types',()=>expect(mediaType('injection.svg','image/svg+xml')).toBe(''))
 it('restricts downloads, redirects and credentials to exact hosts',()=>{
  expect(allowedMediaURL('https://t9015595861.p.clickup-attachments.com/file','clickup')).toBe(true)
  expect(allowedMediaURL('https://svicompany.uazapi.com/media/file','whatsapp')).toBe(true)
  for(const url of ['http://svicompany.uazapi.com/f','https://svicompany.uazapi.com.evil.test/f','https://127.0.0.1/f','https://user:pass@svicompany.uazapi.com/f','https://svicompany.uazapi.com:444/f'])expect(allowedMediaURL(url,'whatsapp')).toBe(false)
 })
})

describe('Sarah group intake',()=>{
 const sarah=SOCIAL_WHATSAPP_SOURCES['whatsapp:sarah']
 const video={...m,id:'fixture-sarah-1',chatid:sarah.group,sender:'13868852076575@lid'}
 it('accepts Sarah by verified LID or phone and carries her source to the worker',()=>{
  for(const sender of ['13868852076575@lid','559492941072@s.whatsapp.net','5594992941072@s.whatsapp.net']){
   expect(whatsappVideo({...video,sender},sarah)?.payload.source).toBe('whatsapp:sarah')
  }
  expect(whatsappVideo({...video,sender:'unresolved@lid',sender_pn:'559492941072@s.whatsapp.net'},sarah)?.client).toBe('CARLOTINHA')
 })
 it('accepts an original video document with stringified content',()=>{
  const result=whatsappVideo({...video,messageType:'DocumentMessage',text:'',content:JSON.stringify({documentMessage:{fileName:'entrega.MOV',mimetype:'video/quicktime',caption:'CCR | Matrículas | V2'}})},sarah)
  expect(result?.delivery_version).toBe(2);expect(result?.payload.type).toBe('video/quicktime')
 })
 it('rejects colleagues, the wrong group, own/API messages and non-video attachments',()=>{
  for(const patch of [{sender:m.sender},{chatid:SOCIAL_MATH_GROUP},{fromMe:true},{wasSentByApi:true},{messageType:'ImageMessage',content:{mimetype:'image/jpeg'}},{messageType:'Conversation',content:{}}])expect(whatsappVideo({...video,...patch},sarah)).toBeNull()
  expect(mathVideo(video)).toBeNull()
 })
 it('groups Sarah revisions without merging identical titles from Math',()=>{
  const original=whatsappVideo(video,sarah)!
  expect(whatsappVideo({...video,id:'revision-2',text:'carlotinha | Gol 2017 | V2'},sarah)?.card_id).toBe(original.card_id)
  expect(original.card_id).not.toBe(mathVideo(m)?.card_id)
 })
 it('keeps unidentified deliveries separate and labels them as Sarah',()=>{
  const first=whatsappVideo({...video,text:'pronto'},sarah)!
  expect(first.client).toBe('Identificar cliente');expect(first.title).toBe('Vídeo da Sarah · identificar peça')
  expect(first.card_id).not.toBe(whatsappVideo({...video,id:'other',text:'pronto'},sarah)?.card_id)
 })
 it('preserves preexisting Math card identities for named and unidentified videos',()=>{
  expect(parseDelivery(m.text,m.id).card_id).toBe('wa-'+digest(`${SOCIAL_MATH_GROUP}|carlotinha|gol 2017`).slice(0,24))
  expect(parseDelivery('pronto',m.id).card_id).toBe('wa-'+digest(m.id).slice(0,24))
 })
})

describe('Final production attachments',()=>{it('includes designer/editor uploads and excludes briefings uploaded by the requester',()=>{expect(deliveredByTeam({user:{id:284506251}})).toBe(true);expect(deliveredByTeam({user:{id:112541047}})).toBe(true);expect(deliveredByTeam({user:{id:302494819}})).toBe(true);expect(deliveredByTeam({user:{id:78754871}})).toBe(false);expect(deliveredByTeam({})).toBe(false)})})
