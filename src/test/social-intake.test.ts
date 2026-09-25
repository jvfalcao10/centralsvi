import { describe,it,expect } from 'vitest'
import { intakeCommand,intakeClient,intakeSource } from '../../api/_lib/social-intake'
import { validDriveSession } from '../../api/_lib/social-drive'
describe('Sofia destination confirmation',()=>{
 it('does not route bare approval into publishing',()=>expect(intakeCommand('Aprovado')).toMatchObject({command:'approve',approved:true}))
 it('accepts explicit destination, client and month independently of approval',()=>expect(intakeCommand('POSTAR | Dr Felipe | SETEMBRO')).toMatchObject({command:'post',month:9,approved:false}))
 it('accepts explicit approval for the selected batch',()=>expect(intakeCommand('APROVADO PARA POSTAR | Dr Felipe | OUTUBRO')).toMatchObject({command:'post',month:10,approved:true}))
 it('keeps transcription and cancellation out of posting',()=>{expect(intakeCommand('transcrever').command).toBe('transcribe');expect(intakeCommand('não postar').command).toBe('cancel')})
 it('does not accept negation, a question, speculation, or a prior approval reference',()=>{for(const t of ['não é para postar','será que é para postar?','se estiver bom pode postar','foi aprovado semana passada'])expect(intakeCommand(t).command).toBe('')})
 it('keeps a generic yes ambiguous',()=>expect(intakeCommand('sim').command).toBe('unknown'))
 it('resolves filename client only against the known client catalog',()=>{expect(intakeClient('Dr Felipe',['DR. FELIPE BRANCO'])).toBe('DR. FELIPE BRANCO');expect(intakeClient('arquivo 1',['DR. FELIPE BRANCO'])).toBe('Identificar cliente')})
 it('requires an authorized private chat and actual sender identity',()=>{expect(intakeSource({chatid:'559492404033@s.whatsapp.net',sender:'43229013668067@lid'})?.id).toBe('direct:joao');expect(intakeSource({chatid:'120363411761185563@g.us',sender:'43229013668067@lid'})).toBeUndefined();expect(intakeSource({chatid:'559492404033@s.whatsapp.net',sender:'unknown'})).toBeUndefined()})
 it('accepts verified phone alias without widening the sender set',()=>expect(intakeSource({chatid:'5594992941072@s.whatsapp.net',sender:'13868852076575@lid'})?.id).toBe('direct:sarah'))
 it('restricts resumable upload credentials to the Google upload endpoint',()=>{expect(validDriveSession('https://www.googleapis.com/upload/drive/v3/files?upload_id=test')).toBe(true);for(const u of ['https://evil.test/upload/drive/v3/files?upload_id=a','https://www.googleapis.com.evil.test/upload/drive/v3/files?upload_id=a','https://user:pass@www.googleapis.com/upload/drive/v3/files?upload_id=a','http://www.googleapis.com/upload/drive/v3/files?upload_id=a'])expect(validDriveSession(u)).toBe(false)})
})
