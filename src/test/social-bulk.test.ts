import {beforeEach,describe,it,expect,vi} from 'vitest'
const link=vi.hoisted(()=>vi.fn())
vi.mock('../../api/_lib/social-approval-link',()=>({newApprovalLink:link}))
import {moveManyCards} from '../../api/_lib/social-bulk'

const card=(id:string,extra={})=>({id,stage:'conferir',version:2,revision:1,client:'QA',selected_assets:['a'],...extra})
let rows:any[],db:any
beforeEach(()=>{
 rows=[card('a'),card('b')]
 db={from:vi.fn(()=>({select:()=>({in:async()=>({data:rows,error:null})})})),rpc:vi.fn(async(_name,args)=>({data:args.p_moves.map((m:any)=>({id:m.id,ok:true,card:{...rows.find(r=>r.id===m.id),...m.patch,version:3}})),error:null}))}
 link.mockImplementation(id=>({url:'https://review/'+id,hash:'hash-'+id,ciphertext:'sealed-'+id}))
})
describe('bulk stage API',()=>{
 it('moves selected versions in one transaction using the authenticated actor',async()=>{
  const out=await moveManyCards(db,{stage:'para_anuncio',items:[{id:'a',version:2},{id:'b',version:2}]},'João','user-id')
  expect(db.rpc).toHaveBeenCalledTimes(1);expect(db.rpc).toHaveBeenCalledWith('central_social_move_many',expect.objectContaining({p_actor:'João',p_actor_id:'user-id'}))
  expect(out.results.map(r=>[r.id,r.ok,r.card?.stage,r.card?.version])).toEqual([['a',true,'para_anuncio',3],['b',true,'para_anuncio',3]])
  expect(out.results[0].card).not.toHaveProperty('token_hash')
 })
 it('reports stale, missing and incomplete cards without blocking a valid one',async()=>{
  rows=[card('a'),card('b',{client:'Identificar cliente'}),card('c')]
  const out=await moveManyCards(db,{stage:'postado',items:[{id:'a',version:1},{id:'b',version:2},{id:'c',version:2},{id:'missing',version:2}]},'João','user-id')
  expect(db.rpc.mock.calls[0][1].p_moves.map((v:any)=>v.id)).toEqual(['c'])
  expect(out.results.filter(r=>r.ok).map(r=>r.id)).toEqual(['c']);expect(out.results.filter(r=>!r.ok)).toHaveLength(3)
 })
 it('does not write again for an unchanged stage',async()=>{
  rows=[card('a',{stage:'postado'})]
  const out=await moveManyCards(db,{stage:'postado',items:[{id:'a',version:2}]},'João','user-id')
  expect(db.rpc).not.toHaveBeenCalled();expect(out.results[0]).toMatchObject({ok:true,card:{version:2}})
 })
 it('creates separate sealed approval links for each waiting card',async()=>{
  const out=await moveManyCards(db,{stage:'aguardando',items:[{id:'a',version:2},{id:'b',version:2}]},'João','user-id')
  expect(db.rpc.mock.calls[0][1].p_moves.map((v:any)=>v.ciphertext)).toEqual(['sealed-a','sealed-b']);expect(out.results.map(r=>r.approval_url)).toEqual(['https://review/a','https://review/b'])
 })
 it('rejects duplicate or empty batches without reading or writing',async()=>{
  for(const items of [[],[{id:'a',version:2},{id:'a',version:2}]])await expect(moveManyCards(db,{items,stage:'postado'},'João','user-id')).rejects.toThrow('diferentes')
  expect(db.from).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled()
 })
})
