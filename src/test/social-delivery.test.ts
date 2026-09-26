import {describe,it,expect} from 'vitest'
import {identifyGroupDelivery} from '../../api/_lib/social-delivery'
import {whatsappVideo,SOCIAL_WHATSAPP_SOURCES,digest} from '../../api/_lib/social-sync-domain'
const source=SOCIAL_WHATSAPP_SOURCES['whatsapp:math']
const catalog=['DR. DANIEL PERALBA','CARLOTINHA','Dra Enia']
const message={id:'new-final',chatid:source.group,sender:'50217076449517@lid',messageTimestamp:1790422759000,messageType:'DocumentMessage',text:''}
const parse=(fileName:string,id=message.id,text='')=>identifyGroupDelivery(whatsappVideo({...message,id,text,content:{fileName,mimetype:'video/mp4',fileLength:1000}},source)!,catalog)
describe('file identity on group deliveries',()=>{
 it('uses an original file name instead of the identical generic card title',()=>{expect(parse('IMG_3594.MOV')).toMatchObject({title:'IMG_3594',client:'Identificar cliente'});expect(parse('Dr Daniel 05.MP4')).toMatchObject({title:'Dr Daniel 05',client:'DR. DANIEL PERALBA'})})
 it('keeps the old message-derived identity when identifying a file',()=>expect(parse('Dr Daniel 05.MP4').card_id).toBe('wa-'+digest(message.id).slice(0,24)))
 it('does not merge an original and an export just because they arrived nearby',()=>expect(parse('IMG_3594.MOV','original').card_id).not.toBe(parse('Dr Daniel 05.MP4','final').card_id))
 it('does not merge separate files based on a repeated filename',()=>expect(parse('Dr Daniel 05.MP4','one').card_id).not.toBe(parse('Dr Daniel 05.MP4','two').card_id))
 it('still groups revisions when the sender explicitly identifies the piece',()=>{const a=parse('old.mp4','one','DR. DANIEL PERALBA | Vídeo 05 | V1'),b=parse('new.mp4','two','DR. DANIEL PERALBA | Vídeo 05 | V2');expect(a.card_id).toBe(b.card_id);expect(b).toMatchObject({title:'Vídeo 05',delivery_version:2})})
 it('uses catalog identities and never extracts clients from arbitrary chat text',()=>{expect(parse('Carlotinha - Onix .MP4')).toMatchObject({client:'CARLOTINHA',title:'Carlotinha - Onix'});expect(parse('IMG_3594.MOV','another','Esse é do Daniel, acho')).toMatchObject({client:'Identificar cliente'});expect(parse('Dra Enia 04.MP4').client).toBe('Dra Enia')})
 it('does not let the filename override an explicit delivery client or title',()=>{expect(parse('Dr Daniel 05.MP4','explicit','CARLOTINHA | Sorteio | V1')).toMatchObject({client:'CARLOTINHA',title:'Sorteio'})})
})
