import {beforeEach,describe,it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({rpc:vi.fn(),auth:vi.fn(),from:vi.fn(),link:vi.fn()}))
vi.mock('../../api/_lib/supabase',()=>({createAdminClient:()=>({rpc:m.rpc,from:m.from,auth:{getUser:m.auth}})}))
vi.mock('../../api/_lib/social-approval-link',()=>({approvalLink:vi.fn(),newApprovalLink:m.link}))
vi.mock('../../api/_lib/social-sync',()=>({handleSocialSync:vi.fn(),socialSyncStatus:vi.fn()}))
vi.mock('../../api/_lib/social-playback',()=>({handleSocialPlayback:vi.fn()}))
import {handleSocial} from '../../api/_lib/social'
let role:string,card:any
const call=async(body:unknown,bearer='session')=>{const res={code:200,body:null as any,status(n:number){this.code=n;return this},setHeader(){return this},json(d:unknown){this.body=d;return this}};await handleSocial({method:'POST',query:{},headers:{authorization:bearer?'Bearer '+bearer:''},body} as never,res as never);return res}
beforeEach(()=>{
 vi.clearAllMocks();role='admin';card={id:'qa',client:'Cliente',title:'Peça',stage:'conferir',version:4,revision:1,assets:[{id:'a'}],selected_assets:['a'],note:''}
 m.auth.mockResolvedValue({data:{user:{id:'authenticated-user',email:'qa@example.com'}},error:null})
 m.from.mockImplementation((table:string)=>({select:()=>({eq:()=>table==='user_roles'?Promise.resolve({data:[{role}],error:null}):{maybeSingle:async()=>({data:table==='profiles'?{name:'Pessoa autenticada'}:card,error:null})}})}))
 m.rpc.mockImplementation(async(_name,args)=>({data:{...card,...args.p_patch,version:5,token_hash:'private-hash',source_description:'internal briefing'},error:null}));m.link.mockReturnValue({url:'https://example.com/review',hash:'hash',ciphertext:'sealed'})
})
describe('authenticated direct staff stage changes',()=>{
 it('uses the authenticated actor, ignoring a supplied name and approval',async()=>{const r=await call({id:'qa',version:4,action:'mover',stage:'aprovado',name:'Cliente falso',approved_by:'Cliente falso'});expect(r.code).toBe(200);expect(m.rpc).toHaveBeenCalledWith('central_social_apply',expect.objectContaining({p_action:'mover',p_actor:'Pessoa autenticada',p_actor_id:'authenticated-user',p_patch:expect.objectContaining({stage:'aprovado',approved_by:'Pessoa autenticada'})}))})
 it('posts directly without an evidence, channel or supplied date',async()=>{expect((await call({id:'qa',version:4,action:'mover',stage:'postado'})).code).toBe(200);expect(m.rpc.mock.calls[0][1].p_patch.posted_at).toMatch(/^\d{4}-/);expect(m.rpc.mock.calls[0][1].p_patch.approved_by).toBeUndefined()})
 it('uses the sealed approval transaction when moved to waiting',async()=>{expect((await call({id:'qa',version:4,action:'mover',stage:'aguardando'})).code).toBe(200);expect(m.rpc.mock.calls[0][0]).toBe('central_social_request_link')})
 it('rejects missing login',async()=>{expect((await call({id:'qa',version:4,action:'mover',stage:'postado'},'')).code).toBe(401);expect(m.rpc).not.toHaveBeenCalled()})
 it('rejects users outside the team',async()=>{role='client';expect((await call({id:'qa',version:4,action:'mover',stage:'postado'})).code).toBe(403);expect(m.rpc).not.toHaveBeenCalled()})
 it('requires team authentication for bulk moves too',async()=>{const body={action:'mover_lote',stage:'postado',items:[{id:'qa',version:4}]};expect((await call(body,'')).code).toBe(401);role='client';expect((await call(body)).code).toBe(403);expect(m.rpc).not.toHaveBeenCalled()})
 it('rejects a stale card version',async()=>{expect((await call({id:'qa',version:3,action:'mover',stage:'postado'})).code).toBe(409);expect(m.rpc).not.toHaveBeenCalled()})
 it('ignores same-stage movement without a second history entry',async()=>{expect((await call({id:'qa',version:4,action:'mover',stage:'conferir'})).code).toBe(200);expect(m.rpc).not.toHaveBeenCalled()})
})

it('returns persisted movement fields without another media request or private data',async()=>{const r=await call({id:'qa',version:4,action:'mover',stage:'para_anuncio'});expect(r.body.card).toMatchObject({id:'qa',stage:'para_anuncio',version:5});expect(r.body.card).not.toHaveProperty('token_hash');expect(r.body.card).not.toHaveProperty('source_description');expect(r.body.card).not.toHaveProperty('assets')})
