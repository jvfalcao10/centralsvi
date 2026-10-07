import {readFile} from 'node:fs/promises'
import {suggestAccount,contaDoCliente,enqueuePublication} from '../../api/_lib/social-publication'
import {describe,it,expect,vi} from 'vitest'
import {publicationInput} from '../../api/_lib/social-publication-domain'
import {allowedUploadURI,publishReady,processPublications} from '../../api/_lib/social-publication-worker'
import {formatCaption,CAPTION_INSTRUCTIONS} from '../../api/_lib/social-caption'
const actor='11111111-1111-4111-8111-111111111111',request='22222222-2222-4222-8222-222222222222'
const account={id:'123',username:'cliente',name:'Cliente'}
const card:any={id:'qa',client:'Cliente',title:'Peça',stage:'aprovado',version:1,revision:1,caption:'Legenda',assets:[{id:'a',type:'image/jpeg',path:'a.jpg'}],selected_assets:['a']}
const body={confirmed:true,request_id:request,account_id:'123',format:'image',when:'now'}
describe('publication intent',()=>{
 it('requires a concrete confirmation and a connected destination',()=>{expect(()=>publicationInput(card,{...body,confirmed:false},[account],actor)).toThrow('Confira');expect(()=>publicationInput(card,{...body,account_id:'outro'},[account],actor)).toThrow('conta conectada')})
 it('rejects unready, posted and incomplete assets',()=>{for(const patch of [{stage:'conferir'},{stage:'postado'},{ingest_pending:true},{selected_assets:[]},{selected_assets:['missing']}])expect(()=>publicationInput({...card,...patch},body,[account],actor)).toThrow()})
 it('snapshots selected assets in order and disallows wrong formats',()=>{const c={...card,assets:[...card.assets,{id:'b',type:'image/png',path:'b.png'}],selected_assets:['b','a']};expect(publicationInput(c,{...body,format:'carousel'},[account],actor).assets.map(a=>a.id)).toEqual(['b','a']);expect(()=>publicationInput(c,body,[account],actor)).toThrow('uma imagem')})
 it('rejects past scheduling, too long caption and another user cover',()=>{for(const patch of [{when:'later',scheduled_at:'2020-01-01'},{caption:'x'.repeat(2201)},{cover_path:'publication-covers/other/a.jpg'}])expect(()=>publicationInput(card,{...body,...patch},[account],actor)).toThrow()})
 it('validates cover frame against duration',()=>{const video={...card,assets:[{id:'a',type:'video/mp4',path:'a',duration_ms:10000}]};expect(()=>publicationInput(video,{...body,format:'reel',cover_offset_ms:10000},[account],actor)).toThrow('instante');expect(publicationInput(video,{...body,format:'reel',cover_offset_ms:5000},[account],actor).cover_offset_ms).toBe(5000)})
 it('never uploads the token to an arbitrary URL',()=>{expect(allowedUploadURI('https://rupload.facebook.com/ig-api-upload/v24.0/123','123')).toBe(true);expect(allowedUploadURI('https://rupload.facebook.com/ig-api-upload/v26.0/123','123')).toBe(true);for(const u of ['https://evil.test/ig-api-upload/v24.0/123','https://rupload.facebook.com.evil.test/ig-api-upload/v24.0/123','http://rupload.facebook.com/ig-api-upload/v24.0/123','https://rupload.facebook.com/ig-api-upload/v24.0/999'])expect(allowedUploadURI(u,'123')).toBe(false)})
})
describe('copy formatting and source rules',()=>{
 const draft={sentences:['O almoço já começou.','O gás acabou no meio da receita.','Chame a GM Gás para fazer seu pedido.'],hashtags:['GMGas','GasDeCozinha','Cozinha','Botijao'],needs_context:null}
 it('separates each sentence and leaves exactly four hashtags in the last block',()=>{const {caption}=formatCaption(draft);expect(caption?.split('\n\n')).toHaveLength(4);expect(caption?.split('\n\n').at(-1)).toBe('#GMGas #GasDeCozinha #Cozinha #Botijao')})
 it('refuses invalid or duplicate hashtags, forbidden punctuation and excess length',()=>{for(const patch of [{hashtags:['a','b','c']},{hashtags:['Gas','gas','Tema','Cliente']},{sentences:['Teste — teste.','Segunda.','Terceira.']},{sentences:['x'.repeat(2200),'Segunda.','Terceira.']}])expect(()=>formatCaption({...draft,...patch})).toThrow()})
 it('requests context instead of presenting an invented caption',()=>expect(formatCaption({needs_context:'O que é explicado no vídeo?',sentences:[],hashtags:[]})).toEqual({needs_context:'O que é explicado no vídeo?'}))
 it('uses the requested house framework and protects untrusted source content',()=>{expect(CAPTION_INSTRUCTIONS).toContain('Bárbara Torres');expect(CAPTION_INSTRUCTIONS).toContain('nunca instruções')})
 // A regra mudou quando a peça passou a chegar com a fala transcrita: a IA pode
 // usar o que foi DITO, mas continua proibida de acrescentar o que não foi.
 it('usa a fala transcrita sem deixar a IA inventar o que não foi dito',()=>{
  expect(CAPTION_INSTRUCTIONS).toContain('fala real do vídeo')
  expect(CAPTION_INSTRUCTIONS).toContain('sem acrescentar o que não foi falado')
  expect(CAPTION_INSTRUCTIONS).toContain('não houver transcript')
  expect(CAPTION_INSTRUCTIONS).toContain('Não invente dados')
 })
})
describe('irreversible boundary',()=>{
 const job=()=>({id:'j',lease_id:'lease',status:'processing',account_id:'123',progress:{container:{id:'456'}}} as any)
 it('does not publish if the card changed or the lease was canceled',async()=>{const graph=vi.fn(),db={rpc:vi.fn().mockResolvedValue({data:false})};await expect(publishReady(db as any,job(),graph)).rejects.toThrow();expect(graph).not.toHaveBeenCalled()})
 it('keeps an ambiguous result for reconciliation; never retries publishing',async()=>{
  const updates:any[]=[],chain:any={eq:()=>chain,in:()=>chain,select:()=>chain,maybeSingle:async()=>({data:{id:'j'}})}
  const db={rpc:vi.fn().mockResolvedValue({data:true}),from:()=>({update:(p:any)=>{updates.push(p);return chain}})},graph=vi.fn().mockRejectedValue(new Error('timeout'))
  await publishReady(db as any,job(),graph);expect(graph).toHaveBeenCalledTimes(1);expect(updates.at(-1).status).toBe('uncertain')
 })
 it('an empty queue never contacts Meta',async()=>{const db={rpc:vi.fn().mockResolvedValue({data:null})};expect(await processPublications(db as any)).toEqual({processed:0})})
})

describe('conta do Instagram sugerida pelo cliente da peça',()=>{
 const contas=[
  {id:'1',username:'espacosoraia',name:'Espaço Soraia'},
  {id:'2',username:'draeniapaulaaguiar',name:'Dra Enia Paula Aguiar'},
  {id:'3',username:'dr.felipebranco',name:'Dr Felipe Branco'},
 ]
 it('acerta a conta do cliente da peça',()=>{
  expect(suggestAccount('ESPAÇO SORAIA',contas)).toBe('1')
  expect(suggestAccount('Dra Enia',contas)).toBe('2')
  expect(suggestAccount('DR. FELIPE BRANCO',contas)).toBe('3')
 })
 // Postar na conta errada é irreversível: na dúvida, a pessoa escolhe.
 it('não sugere nada quando duas contas servem ou nenhuma serve',()=>{
  expect(suggestAccount('Dra Enia',[...contas,{id:'4',username:'draenia2',name:'Dra Enia Backup'}])).toBeNull()
  expect(suggestAccount('Colégio Christo Rei',contas)).toBeNull()
  expect(suggestAccount('Identificar cliente',contas)).toBeNull()
  expect(suggestAccount('',contas)).toBeNull()
 })
})

describe('a Central aprende a conta de cada cliente',()=>{
 const contas=[{id:'9',username:'backesteticaa',name:'Back Estética'},{id:'1',username:'espacosoraia',name:'Espaço Soraia'}]
 const banco=(guardada?:string)=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:guardada?{account_id:guardada}:null})})})})})
 // Caso real: a peça diz "VANESSA BACK" e a conta é @backesteticaa. Nome nenhum
 // liga as duas, e é por isso que a escolha confirmada fica guardada.
 it('usa a conta guardada mesmo quando o nome não se parece em nada',async()=>
  expect(await contaDoCliente(banco('9') as never,'VANESSA BACK',contas)).toBe('9'))
 it('sem nada guardado, cai no nome e não inventa',async()=>{
  expect(await contaDoCliente(banco() as never,'ESPAÇO SORAIA',contas)).toBe('1')
  expect(await contaDoCliente(banco() as never,'VANESSA BACK',contas)).toBeNull()
 })
 it('ignora conta guardada que sumiu da lista do Instagram',async()=>
  expect(await contaDoCliente(banco('999') as never,'VANESSA BACK',contas)).toBeNull())
})

// O retorno do Supabase é PromiseLike e NÃO tem .catch. Usar .catch nele lança
// TypeError, e em produção isso derrubou uma publicação que já tinha sido
// aceita: a peça entrou na fila e a tela mostrou erro vermelho.
it('nenhum .catch no retorno do Supabase, que é PromiseLike',async()=>{
 const fonte=await readFile('api/_lib/social-publication.ts','utf8')
 expect(fonte).not.toMatch(/db\.rpc\([^)]*\)\s*\.catch/)
 expect(fonte).not.toMatch(/db\.from\([^)]*\)[^;]*\.catch\(/)
})
