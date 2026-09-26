import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {clientPending,clientReviewCard,clientReview,getClientLink,clientTokenHash,pendingClientCards} from '../../api/_lib/social-client'
import {clientShareMeta,socialShareHTML} from '../../api/_lib/social-share'
import {sealApprovalToken} from '../../api/_lib/social-approval-link'
import type {SocialCard} from '../../api/_lib/social-domain'
const asset={id:'final',name:'Final.mp4',path:'a',type:'video/mp4',thumbnail:'preview.jpg'}
const card={id:'a',client:'Cliente A',stage:'aguardando',assets:[asset,{...asset,id:'draft',name:'Rascunho'}],selected_assets:['final'],revision:1,version:2} as SocialCard
const token='a'.repeat(64)
function database(rows:Record<string,unknown[]>){
 const rpc=vi.fn(async(_name:string,p:Record<string,string>)=>{if(!rows.central_social_client_links?.length)rows.central_social_client_links=[{client:p.p_client,token_hash:p.p_hash,ciphertext:p.p_ciphertext,revoked_at:null}];return {error:null}})
 return {rpc,from:(table:string)=>{let found=rows[table]||[];const q={select:()=>q,eq:(k:string,v:unknown)=>{found=found.filter((x:any)=>x[k]===v);return q},is:(k:string,v:unknown)=>{found=found.filter((x:any)=>x[k]===v);return q},order:()=>q,range:async(a:number,b:number)=>({data:found.slice(a,b+1),error:null}),maybeSingle:async()=>({data:found[0]||null,error:null})};return q}}
}
const rows=()=>({central_social_client_links:[{client:'Cliente A',token_hash:clientTokenHash(token),ciphertext:sealApprovalToken(token,'client:Cliente A'),revoked_at:null}],central_social_cards:[card,{...card,id:'b',client:'Cliente B'},{...card,id:'draft',stage:'conferir'}]})
beforeEach(()=>vi.stubEnv('SOCIAL_SYNC_SECRET','only-for-tests-not-a-real-secret-1234567890'))
afterEach(()=>vi.unstubAllEnvs())
describe('one client, one approval link',()=>{
 it('lists only exact-client ready waiting pieces, never unselected assets in metadata',async()=>{const db=database(rows());expect((await pendingClientCards(db as never,'Cliente A')).map(c=>c.id)).toEqual(['a']);const meta=clientShareMeta('Cliente A',[card],token);expect(meta.asset?.id).toBe('final');expect(meta.description).toContain('1 peça');expect(socialShareHTML('<head></head>',meta)).not.toContain('Rascunho')})
 it.each([{client:'Cliente B'},{stage:'aprovado'},{stage:'conferir'},{stage:'ajustes'},{stage:'arquivado'},{ingest_pending:true},{posted_at:'2026-09-25'},{selected_assets:[]},{selected_assets:['missing']}])('excludes ineligible cards: %o',patch=>expect(clientPending({...card,...patch},'Cliente A')).toBe(false))
 it('rejects another client even if an attacker knows its card id',async()=>{await expect(clientReviewCard(database(rows()) as never,token,'b')).rejects.toMatchObject({status:404})})
 it('rejects a draft of the same client',async()=>{await expect(clientReviewCard(database(rows()) as never,token,'draft')).rejects.toMatchObject({status:404})})
 it('rejects a revoked token',async()=>{const r=rows();r.central_social_client_links[0].revoked_at='2026-09-25' as never;await expect(clientReview(database(r) as never,token)).rejects.toMatchObject({status:404})})
 it('reuses the encrypted link without rotating or changing any card',async()=>{const db=database(rows());const a=await getClientLink(db as never,'Cliente A',true),b=await getClientLink(db as never,'Cliente A',true);expect(a).toBe(b);expect(a).toBe('https://central.svicompany.com.br/aprovar/cliente/'+token);expect(db.rpc).not.toHaveBeenCalled()})
 it('creates a single capability for the client without depending on individual links',async()=>{const r=rows();r.central_social_client_links=[];const db=database(r);const a=await getClientLink(db as never,'Cliente A',true),b=await getClientLink(db as never,'Cliente A',true);expect(a).toBe(b);expect(db.rpc).toHaveBeenCalledTimes(1);expect(r.central_social_cards[0]).toEqual(card)})
 it('keeps an existing link valid when no pieces are pending',async()=>{const r=rows();r.central_social_cards=[];const db=database(r);expect(await clientReview(db as never,token)).toMatchObject({client:'Cliente A'});expect(await pendingClientCards(db as never,'Cliente A')).toEqual([]);expect(await getClientLink(db as never,'Cliente A',true)).toBe('https://central.svicompany.com.br/aprovar/cliente/'+token)})
 it('new waiting pieces join the existing link',async()=>{const r=rows();const db=database(r);r.central_social_cards.push({...card,id:'new'});expect((await pendingClientCards(db as never,'Cliente A')).map(c=>c.id)).toEqual(['a','new']);expect(await getClientLink(db as never,'Cliente A',true)).toBe('https://central.svicompany.com.br/aprovar/cliente/'+token)})
 it('does not create a link for an empty or unidentified client',async()=>{const r=rows();r.central_social_client_links=[];const db=database(r);await expect(getClientLink(db as never,'Missing',true)).rejects.toMatchObject({status:400});await expect(getClientLink(db as never,'Identificar cliente',true)).rejects.toMatchObject({status:400});expect(db.rpc).not.toHaveBeenCalled()})
 it('empty pages have no stale/private thumbnail and preserve the app shell',()=>{const meta=clientShareMeta('Cliente A',[],token),html=socialShareHTML('<head><title>Generic</title></head><script src="/app.js"></script>',meta);expect(meta.image).toBeUndefined();expect(html).not.toContain('og:image');expect(html).toContain('/app.js')})
})
