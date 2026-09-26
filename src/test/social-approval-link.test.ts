import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {approvalLink,newApprovalLink,openApprovalToken,sealApprovalToken} from '../../api/_lib/social-approval-link'
import type {SocialCard} from '../../api/_lib/social-domain'
const db=(data:unknown)=>({from:vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data,error:null})})})}))})
beforeEach(()=>vi.stubEnv('SOCIAL_SYNC_SECRET','only-for-tests-not-a-real-secret-1234567890'))
afterEach(()=>vi.unstubAllEnvs())
describe('persistent private approval links',()=>{
 it('encrypts a token and binds it to the exact card',()=>{const raw='a'.repeat(64),sealed=sealApprovalToken(raw,'card-a');expect(sealed).not.toContain(raw);expect(openApprovalToken(sealed,'card-a')).toBe(raw);expect(()=>openApprovalToken(sealed,'card-b')).toThrow()})
 it('recovers the same active URL after reopening a piece',async()=>{const link=newApprovalLink('card-a');const c={id:'card-a',stage:'aguardando',token_hash:link.hash,token_expires_at:'2099-01-01'} as SocialCard;expect(await approvalLink(db({token_hash:link.hash,ciphertext:link.ciphertext}) as never,c)).toBe(link.url)})
 it('cannot recover a tampered ciphertext',()=>{const sealed=sealApprovalToken('a'.repeat(64),'card-a');const parts=sealed.split('.');parts[2]='ABCD'+parts[2].slice(4);expect(()=>openApprovalToken(parts.join('.'),'card-a')).toThrow()})
 it.each([{stage:'conferir'},{stage:'arquivado'},{token_hash:null},{token_expires_at:'2020-01-01'},{ingest_pending:true}])('never revives a revoked, expired or invalidated link: %o',async patch=>{const link=newApprovalLink('card-a');const c={id:'card-a',stage:'aguardando',token_hash:link.hash,token_expires_at:'2099-01-01',...patch} as SocialCard;const store=db({token_hash:link.hash,ciphertext:link.ciphertext});expect(await approvalLink(store as never,c)).toBeNull();expect(store.from).not.toHaveBeenCalled()})
 it('does not return a previous generation after the link changed',async()=>{const link=newApprovalLink('card-a');const c={id:'card-a',stage:'aguardando',token_hash:'new-hash',token_expires_at:'2099-01-01'} as SocialCard;expect(await approvalLink(db({token_hash:link.hash,ciphertext:link.ciphertext}) as never,c)).toBeNull()})
 it('reports a legacy link as unavailable without rotating it',async()=>{const c={id:'legacy',stage:'aguardando',token_hash:'existing',token_expires_at:'2099-01-01'} as SocialCard;expect(await approvalLink(db(null) as never,c)).toBeNull()})
})
