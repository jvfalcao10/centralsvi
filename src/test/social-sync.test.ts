import { describe,it,expect } from 'vitest'
import { parseDelivery,mathVideo,SOCIAL_MATH_GROUP,allowedMediaURL,mediaType } from '../../api/_lib/social-sync-domain'
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
