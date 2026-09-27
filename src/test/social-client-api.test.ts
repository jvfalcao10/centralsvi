import {beforeEach,describe,it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({rpc:vi.fn(),review:vi.fn(),card:vi.fn(),pending:vi.fn(),stream:vi.fn()}))
vi.mock('../../api/_lib/supabase',()=>({createAdminClient:()=>({rpc:m.rpc,storage:{from:()=>({createSignedUrls:async()=>({data:[],error:null})})}})}))
vi.mock('../../api/_lib/social-client',()=>({clientReview:m.review,clientReviewCard:m.card,pendingClientCards:m.pending,getClientLink:vi.fn()}))
vi.mock('../../api/_lib/social-sync',()=>({handleSocialSync:vi.fn(),socialSyncStatus:vi.fn()}))
vi.mock('../../api/_lib/social-playback',()=>({handleSocialPlayback:m.stream}))
import {handleSocial} from '../../api/_lib/social'
import {SocialError} from '../../api/_lib/social-domain'
const bundle='a'.repeat(64)
const asset={id:'final',name:'Final.mp4',type:'video/mp4',storage:'drive',drive_id:'driveID',path:'p'}
const card={id:'a',client:'Cliente A',title:'Vídeo',stage:'aguardando',version:3,revision:2,assets:[asset,{...asset,id:'secret'}],selected_assets:['final'],note:'Interno',token_hash:'individual-secret',caption:'Legenda'}
function response(){return {code:200,body:null as any,status(n:number){this.code=n;return this},setHeader(){return this},json(data:unknown){this.body=data;return this}}}
const call=async(body?:unknown,query:Record<string,string>={bundle})=>{const res=response();await handleSocial({method:body?'POST':'GET',query,headers:{},body} as never,res as never);return res}
beforeEach(()=>{vi.clearAllMocks();m.review.mockResolvedValue({client:'Cliente A'});m.pending.mockResolvedValue([card]);m.card.mockResolvedValue(card);m.rpc.mockResolvedValue({data:{...card,stage:'aprovado'},error:null})})
describe('bundle API authorization and individual response',()=>{
 it('returns only public selected media with bundle-scoped playback',async()=>{const r=await call();expect(r.code).toBe(200);expect(r.body.cards[0].assets).toHaveLength(1);expect(r.body.cards[0].assets[0].playback_url).toContain('bundle='+bundle+'&id=a&asset=final');expect(r.body.cards[0].note).toBeUndefined();expect(r.body.cards[0].token_hash).toBeUndefined();expect(JSON.stringify(r.body)).not.toContain('individual-secret')})
 it('saves the exact piece/version using the membership-checking transaction',async()=>{const r=await call({id:'a',version:3,action:'cliente_aprovar',name:'Maria'});expect(r.code).toBe(200);expect(m.card).toHaveBeenCalledWith(expect.anything(),bundle,'a');expect(m.rpc).toHaveBeenCalledWith('central_social_client_answer',expect.objectContaining({p_id:'a',p_expected:3,p_action:'cliente_aprovar',p_actor:'Maria'}));expect(r.body.card.note).toBeUndefined()})
 it.each(['editar','solicitar','destino','client_link','arquivar','mover','informacoes'])('cannot use an internal action: %s',async action=>{const r=await call({id:'a',version:3,action,name:'Maria'});expect(r.code).toBe(403);expect(m.rpc).not.toHaveBeenCalled()})
 it('rejects a card belonging to another client before any write',async()=>{m.card.mockRejectedValue(new SocialError(404,'Indisponível'));expect((await call({id:'other',version:3,action:'cliente_aprovar',name:'Maria'})).code).toBe(404);expect(m.rpc).not.toHaveBeenCalled()})
 it('rejects a stale revision without saving a decision',async()=>{expect((await call({id:'a',version:2,action:'cliente_aprovar',name:'Maria'})).code).toBe(409);expect(m.rpc).not.toHaveBeenCalled()})
 it('handles a race after the preliminary read as a conflict',async()=>{m.rpc.mockResolvedValue({data:null,error:{message:'version_conflict'}});expect((await call({id:'a',version:3,action:'cliente_aprovar',name:'Maria'})).code).toBe(409)})
 it('never accepts a rejection without its reason',async()=>{expect((await call({id:'a',version:3,action:'cliente_reprovar',name:'Maria',reason:''})).code).toBe(400);expect(m.rpc).not.toHaveBeenCalled()})
 it('does not treat an individual token as a bundle token',async()=>{expect((await call(undefined,{bundle,token:'b'.repeat(64)})).code).toBe(400);expect(m.review).not.toHaveBeenCalled()})
})
