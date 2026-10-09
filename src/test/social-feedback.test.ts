import { describe,it,expect,vi } from 'vitest'
import {taskId,feedbackText,deliverFeedback,type FeedbackJob,feedbackProvider} from '../../api/_lib/social-feedback'
import {socialPatch,type SocialCard} from '../../api/_lib/social-domain'
const job:FeedbackJob={id:1,event_id:20,card_id:'qa',channel:'clickup',destination:'task123',attempts:1,dispatched_at:null,created_at:'2026-09-25T12:00:00Z',payload:{client:'Cliente',title:'Vídeo',revision:3,actor:'Maria',action:'cliente_ajustes',comment:'Trocar a legenda aos 10 segundos.',created_at:'2026-09-25T12:00:00Z',files:['final.mp4'],task_id:'task123',group_label:'MATH | EDITOR | SVI'}}
describe('feedback routing and safe delivery',()=>{
 it.each(['https://evil.example/t/abc123','https://app.clickup.com.evil.example/t/abc123','http://app.clickup.com/t/abc123','https://app.clickup.com/t/abc/../12345','','../../secret'])('rejects unrelated task URLs: %s',s=>expect(taskId(s)).toBeNull())
 it('accepts canonical ClickUp links and IDs',()=>{expect(taskId('https://app.clickup.com/t/abc123?source=share')).toBe('abc123');expect(taskId('abc123')).toBe('abc123')})
 it('includes decision, version, name, exact comment, task and trace marker',()=>{const s=feedbackText(job);expect(s).toContain('ALTERAÇÃO SOLICITADA');expect(s).toContain('versão 3');expect(s).toContain('Maria');expect(s).toContain(job.payload.comment);expect(s).toContain('/t/task123');expect(s).toContain('[SVI retorno 20]')})
 it('records rejection separately and requires its reason',()=>{const c={stage:'aguardando',assets:[],selected_assets:[]} as unknown as SocialCard;expect(()=>socialPatch(c,{action:'cliente_reprovar',reason:''})).toThrow('motivo');expect(socialPatch(c,{action:'cliente_reprovar',reason:'A abordagem não está correta.'})).toMatchObject({stage:'ajustes',note:'A abordagem não está correta.',approved_at:null})})
 it('marks the attempt before sending to the provider',async()=>{const order:string[]=[];const p={find:vi.fn(async()=>null),send:vi.fn(async()=>{order.push('send');return 'remote1'})};const result=await deliverFeedback(job,async()=>{order.push('mark')},p);expect(result.status).toBe('sent');expect(order).toEqual(['mark','send'])})
 it('deduplicates against provider history without sending again',async()=>{const p={find:vi.fn(async()=>'exists'),send:vi.fn()},mark=vi.fn();const r=await deliverFeedback(job,mark,p);expect(r).toMatchObject({status:'sent',remote_id:'exists'});expect(mark).not.toHaveBeenCalled();expect(p.send).not.toHaveBeenCalled()})
 it('reconciles an interrupted POST instead of resending blindly',async()=>{const p={find:vi.fn(async()=>null),send:vi.fn()},mark=vi.fn();const r=await deliverFeedback({...job,dispatched_at:new Date().toISOString(),attempts:2},mark,p);expect(r.status).toBe('uncertain');expect(p.send).not.toHaveBeenCalled();expect(mark).not.toHaveBeenCalled()})
 it('surfaces unresolved deliveries for review after bounded reconciliation',async()=>{const p={find:vi.fn(async()=>null),send:vi.fn()};expect((await deliverFeedback({...job,attempts:8,dispatched_at:'2026-09-25'},vi.fn(),p)).status).toBe('blocked');expect(p.send).not.toHaveBeenCalled()})
 it('keeps ambiguous sends for reconciliation',async()=>{const p={find:vi.fn(async()=>null),send:vi.fn(async()=>{throw new Error('network disconnected')})};expect((await deliverFeedback(job,vi.fn(),p)).status).toBe('uncertain')})
 it('does not send when provider history cannot be verified',async()=>{const p={find:vi.fn(async()=>{throw new Error('timeout')}),send:vi.fn()};expect((await deliverFeedback(job,vi.fn(),p)).status).toBe('retry');expect(p.send).not.toHaveBeenCalled()})
 it('does not send after losing the database lease',async()=>{const p={find:vi.fn(async()=>null),send:vi.fn()};await deliverFeedback(job,async()=>{throw new Error('lease lost')},p);expect(p.send).not.toHaveBeenCalled()})
 it('never substitutes a missing destination',async()=>{const p={find:vi.fn(),send:vi.fn()};expect((await deliverFeedback({...job,destination:''},vi.fn(),p)).status).toBe('blocked');expect(p.find).not.toHaveBeenCalled();expect(p.send).not.toHaveBeenCalled()})
})

// João, 08/10: botão de ajuste que num clique muda a etapa, bota a tarefa no
// dia e manda o que ajustar para quem entregou.
describe('pedido de ajuste da equipe',()=>{
 const job=(extra:Record<string,unknown>={})=>({id:1,event_id:7,card_id:'c1',channel:'clickup',destination:'t1',attempts:0,dispatched_at:null,created_at:new Date().toISOString(),
  payload:{client:'Cliente','title':'Peça',revision:2,actor:'João',action:'ajustes',comment:'Trocar a foto da lâmina 3',created_at:new Date().toISOString(),files:[],task_id:'t1',group_label:'José',...extra}} as never)

 it('o texto diz que é pedido da equipe e que a tarefa voltou para hoje',()=>{
  const texto=feedbackText(job())
  expect(texto).toContain('AJUSTE PEDIDO PELA EQUIPE')
  expect(texto).toContain('Pedido por João')
  expect(texto).toContain('A tarefa voltou para hoje')
  expect(texto).toContain('O que ajustar:')
  expect(texto,'não é retorno de cliente').not.toContain('Comentário do cliente')
 })
 it('retorno de cliente continua com o texto de antes',()=>{
  const texto=feedbackText(job({action:'cliente_ajustes'}))
  expect(texto).toContain('ALTERAÇÃO SOLICITADA')
  expect(texto).toContain('Comentário do cliente')
  expect(texto).not.toContain('A tarefa voltou para hoje')
 })
})

// João, 08/10: o convite chegou no grupo do Dr. Brenno sem prévia do link e com
// "[SVI retorno 513]" no fim, que é marcador interno que o cliente não devia ler.
describe('convite que vai para o cliente',()=>{
 const convite=(channel:'clickup'|'whatsapp')=>({id:1,event_id:513,card_id:'c1',channel,destination:'d',attempts:0,
  dispatched_at:null,created_at:new Date().toISOString(),
  payload:{client:'Cliente',title:'Peça',revision:1,actor:'João',action:'enviar_cliente',comment:'',
   created_at:new Date().toISOString(),files:[],task_id:null,group_label:'Grupo',
   texto_pronto:'Cliente · Peça\n\nPara aprovar, é só abrir:\nhttps://aprovar.svicompany.com.br/p/abc'}} as never)

 it('não leva código interno para o grupo do cliente',()=>{
  const texto=feedbackText(convite('whatsapp'))
  expect(texto).not.toContain('SVI retorno')
  expect(texto).toContain('Para aprovar')
 })
 it('no ClickUp o marcador fica, porque é como o comentário é reencontrado',()=>
  expect(feedbackText(convite('clickup'))).toContain('[SVI retorno 513]'))
})

// João, 08/10: "o status devia ser alteração do cliente". Mandar tudo para
// "fazendo" apaga de onde veio o retrabalho, e a fila do designer precisa
// separar o que o cliente pediu do que a casa pediu.
describe('status da tarefa carrega a origem do ajuste',()=>{
 const job=(status_tarefa:string)=>({id:1,event_id:9,card_id:'c1',channel:'clickup',destination:'t1',attempts:0,
  dispatched_at:null,created_at:new Date().toISOString(),
  payload:{client:'C',title:'P',revision:1,actor:'João',action:'ajustes',comment:'x',
   created_at:new Date().toISOString(),files:[],task_id:'t1',group_label:'José',
   retomar_tarefa:true,status_tarefa}} as never)

 it('o worker usa o status que veio no pedido, não um fixo',async()=>{
  const chamadas:{url:string;body:unknown}[]=[]
  // jsdom não traz AbortSignal.timeout, que o envio usa para não pendurar.
  if(!AbortSignal.timeout)vi.stubGlobal('AbortSignal',{...AbortSignal,timeout:()=>new AbortController().signal})
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
   chamadas.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null})
   return {ok:true,json:async()=>({id:'x'})}
  }))
  vi.stubEnv('SOCIAL_CLICKUP_TOKEN','t')
  await feedbackProvider.send(job('alteração do cliente'))
  const put=chamadas.find(c=>!c.url.endsWith('/comment'))
  expect((put?.body as {status?:string})?.status).toBe('alteração do cliente')
  vi.unstubAllGlobals();vi.unstubAllEnvs()
 })
})

// João, 08/10: "O melhor é enviar o vídeo do whats app mesmo". O cliente já
// está no WhatsApp; abrir página só para assistir é passo a mais.
describe('vídeo vai no WhatsApp antes do link',()=>{
 const job=(midia_url?:string)=>({id:2,event_id:77,card_id:'c2',channel:'whatsapp',destination:'5594@g.us',
  attempts:0,dispatched_at:null,created_at:new Date().toISOString(),
  payload:{client:'GM GAS',title:'vídeo 04',revision:1,actor:'João',action:'enviar_cliente',comment:'',
   created_at:new Date().toISOString(),files:[],task_id:null,texto_pronto:'abra para aprovar',midia_url}} as never)

 const gravar=()=>{
  const chamadas:{url:string;body:Record<string,unknown>|null}[]=[]
  if(!AbortSignal.timeout)vi.stubGlobal('AbortSignal',{...AbortSignal,timeout:()=>new AbortController().signal})
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
   const body=init?.body?JSON.parse(String(init.body)):null
   chamadas.push({url:String(url),body})
   if(String(url).endsWith('/message/find'))return {ok:true,json:async()=>({messages:[]})}
   return {ok:true,json:async()=>({id:'m1'})}
  }))
  vi.stubEnv('SOCIAL_UAZ_TOKEN','t')
  return chamadas
 }

 it('manda a cópia leve como vídeo e só depois o link',async()=>{
  const chamadas=gravar()
  await feedbackProvider.send(job('https://exemplo/leve.mp4'))
  const media=chamadas.find(c=>c.url.endsWith('/send/media'))
  const texto=chamadas.find(c=>c.url.endsWith('/send/text'))
  expect(media?.body).toMatchObject({type:'video',file:'https://exemplo/leve.mp4',number:'5594@g.us'})
  expect(texto).toBeTruthy()
  // o vídeo vem antes do link
  expect(chamadas.findIndex(c=>c.url.endsWith('/send/media')))
   .toBeLessThan(chamadas.findIndex(c=>c.url.endsWith('/send/text')))
  vi.unstubAllGlobals();vi.unstubAllEnvs()
 })

 it('com vídeo no grupo, o link vai sem prévia para não parecer peça dobrada',async()=>{
  const chamadas=gravar()
  await feedbackProvider.send(job('https://exemplo/leve.mp4'))
  const texto=chamadas.find(c=>c.url.endsWith('/send/text'))
  expect(texto?.body).toMatchObject({linkPreview:false})
  vi.unstubAllGlobals();vi.unstubAllEnvs()
 })

 it('sem vídeo, a prévia continua ligada para reconhecer a peça',async()=>{
  const chamadas=gravar()
  await feedbackProvider.send(job())
  const texto=chamadas.find(c=>c.url.endsWith('/send/text'))
  expect(texto?.body).toMatchObject({linkPreview:true})
  vi.unstubAllGlobals();vi.unstubAllEnvs()
 })

 it('peça sem vídeo segue só com o link',async()=>{
  const chamadas=gravar()
  await feedbackProvider.send(job())
  expect(chamadas.some(c=>c.url.endsWith('/send/media'))).toBe(false)
  expect(chamadas.some(c=>c.url.endsWith('/send/text'))).toBe(true)
  vi.unstubAllGlobals();vi.unstubAllEnvs()
 })

 it('mídia recusada não impede o cliente de receber o link',async()=>{
  const chamadas:{url:string}[]=[]
  if(!AbortSignal.timeout)vi.stubGlobal('AbortSignal',{...AbortSignal,timeout:()=>new AbortController().signal})
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
   chamadas.push({url:String(url)})
   if(String(url).endsWith('/message/find'))return {ok:true,json:async()=>({messages:[]})}
   if(String(url).endsWith('/send/media'))return {ok:false,status:415,json:async()=>({error:'formato'})}
   return {ok:true,json:async()=>({id:'m1'})}
  }))
  vi.stubEnv('SOCIAL_UAZ_TOKEN','t')
  await expect(feedbackProvider.send(job('https://exemplo/leve.mp4'))).resolves.toBe('m1')
  expect(chamadas.some(c=>c.url.endsWith('/send/text'))).toBe(true)
  vi.unstubAllGlobals();vi.unstubAllEnvs()
 })

 it('não manda o mesmo vídeo duas vezes se a tentativa anterior chegou',async()=>{
  const chamadas:{url:string}[]=[]
  if(!AbortSignal.timeout)vi.stubGlobal('AbortSignal',{...AbortSignal,timeout:()=>new AbortController().signal})
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
   chamadas.push({url:String(url)})
   if(String(url).endsWith('/message/find'))return {ok:true,json:async()=>({messages:[{track_id:'midia-77'}]})}
   return {ok:true,json:async()=>({id:'m1'})}
  }))
  vi.stubEnv('SOCIAL_UAZ_TOKEN','t')
  await feedbackProvider.send(job('https://exemplo/leve.mp4'))
  expect(chamadas.some(c=>c.url.endsWith('/send/media'))).toBe(false)
  vi.unstubAllGlobals();vi.unstubAllEnvs()
 })
})
