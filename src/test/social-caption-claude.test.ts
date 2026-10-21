import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest'
import {generateSocialCaption,lerJson,modeloClaude,paraClaude} from '../../api/_lib/social-caption'

// Pedido do João, 21/10: legenda passa para o Claude na conta da SVI. A chave
// ANTHROPIC_API_KEY da Central é de outra conta (Exatta) e não pode ser usada.
const card={id:'c1',client:'GM GÁS',title:'Reel do botijão',assets:[{id:'i1',name:'capa.jpg',path:'p/capa.jpg',type:'image/jpeg'}],selected_assets:['i1'],caption:'',source_description:''} as never
const db={storage:{from:()=>({createSignedUrls:async(paths:string[])=>({data:paths.map(path=>({path,signedUrl:'https://sb.test/'+path})),error:null})})}} as never
const legenda={sentences:['Botijão chegando antes do almoço.','A entrega é grátis todos os dias.','Chama no WhatsApp e peça o seu.'],hashtags:['GMGas','GasDeCozinha','Redencao','Entrega'],needs_context:null}

describe('legenda pelo Claude',()=>{
 beforeEach(()=>{
  if(!AbortSignal.timeout)vi.stubGlobal('AbortSignal',{...AbortSignal,timeout:()=>new AbortController().signal})
  delete process.env.SOCIAL_CAPTION_MODEL
 })
 afterEach(()=>{delete process.env.ANTHROPIC_SVI_KEY;delete process.env.ANTHROPIC_API_KEY;delete process.env.OPENAI_API_KEY;vi.unstubAllGlobals()})

 it('com ANTHROPIC_SVI_KEY chama a Anthropic, manda a imagem e lê o JSON mesmo com cerca',async()=>{
  process.env.ANTHROPIC_SVI_KEY='svi';process.env.OPENAI_API_KEY='oa'
  const fetchSpy=vi.fn().mockResolvedValue({ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:'```json\n'+JSON.stringify(legenda)+'\n```'}]})})
  vi.stubGlobal('fetch',fetchSpy)
  const r=await generateSocialCaption(db,card,{},'esteira',{automatic:true})
  expect(r.caption?.split('\n\n').at(-1)).toBe('#GMGas #GasDeCozinha #Redencao #Entrega')
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  const [url,init]=fetchSpy.mock.calls[0]
  expect(url).toBe('https://api.anthropic.com/v1/messages')
  expect(init.headers).toMatchObject({'x-api-key':'svi','anthropic-version':'2023-06-01','content-type':'application/json'})
  const body=JSON.parse(init.body)
  expect(body.model).toBe('claude-haiku-5-5')
  expect(body.system).toContain('Bárbara Torres')
  expect(body.temperature).toBeUndefined()
  const blocos=body.messages[0].content
  expect(blocos[0]).toEqual({type:'image',source:{type:'url',url:'https://sb.test/p/capa.jpg'}})
  expect(blocos.at(-1).type).toBe('text')
 })

 it('sem ANTHROPIC_SVI_KEY segue na OpenAI, mesmo com a chave Anthropic da Exatta no ambiente',async()=>{
  process.env.ANTHROPIC_API_KEY='exatta';process.env.OPENAI_API_KEY='oa'
  const fetchSpy=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(legenda)}]}]})})
  vi.stubGlobal('fetch',fetchSpy)
  const r=await generateSocialCaption(db,card,{},'esteira',{automatic:true})
  expect(r.caption).toContain('#GMGas')
  expect(fetchSpy.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses')
 })

 it('resposta cortada por max_tokens não vira legenda',async()=>{
  process.env.ANTHROPIC_SVI_KEY='svi'
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({stop_reason:'max_tokens',content:[{type:'text',text:'{"sentences":['}]})}))
  await expect(generateSocialCaption(db,card,{},'esteira',{automatic:true})).rejects.toThrow('Não foi possível gerar')
 })

 it('sem nenhuma das duas chaves fica indisponível',async()=>{
  await expect(generateSocialCaption(db,card,{},'esteira',{automatic:true})).rejects.toThrow('indisponível')
 })

 it('converte imagem em data URL para base64 e escolhe o modelo pelo tamanho do antigo',()=>{
  expect(paraClaude([{type:'input_image',image_url:'data:image/png;base64,AAAA',detail:'auto'}])).toEqual([{type:'image',source:{type:'base64',media_type:'image/png',data:'AAAA'}}])
  expect(modeloClaude('')).toBe('claude-haiku-5-5')
  expect(modeloClaude('gpt-5.4-mini')).toBe('claude-haiku-5-5')
  expect(modeloClaude('gpt-5.4')).toBe('claude-sonnet-5-5')
  expect(modeloClaude('claude-opus-5-5')).toBe('claude-opus-5-5')
  expect(lerJson('Segue:\n{"a":{"b":1}} fim')).toEqual({a:{b:1}})
 })
})
