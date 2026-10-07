import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest'
import {processCaptions,transcribeAsset} from '../../api/_lib/social-caption-worker'

const video=(bytes:number)=>({id:'a1',name:'reel.mp4',path:'p/reel.mp4',type:'video/mp4',bytes} as never)

describe('transcrever a fala do vídeo',()=>{
 beforeEach(()=>{process.env.OPENAI_API_KEY='test'})
 afterEach(()=>{vi.unstubAllGlobals()})
 it('recusa arquivo acima do limite da API em vez de falhar na rede',async()=>{
  const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy)
  await expect(transcribeAsset({} as never,video(40*1024*1024))).rejects.toThrow('video_grande_demais')
  expect(fetchSpy).not.toHaveBeenCalled()
 })
 it('manda o arquivo e devolve a fala',async()=>{
  // jsdom não traz AbortSignal.timeout, que o worker usa para não pendurar a esteira.
  if(!AbortSignal.timeout)vi.stubGlobal('AbortSignal',{...AbortSignal,timeout:()=>new AbortController().signal})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({text:' Bom dia, hoje eu quero falar de joelho. '})}))
  const db={storage:{from:()=>({download:async()=>({data:new Blob(['x']),error:null})})}}
  await expect(transcribeAsset(db as never,video(1000))).resolves.toBe('Bom dia, hoje eu quero falar de joelho.')
 })
})

describe('esteira de legenda',()=>{
 it('não chama IA nenhuma quando a fila está vazia',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:null})
  expect(await processCaptions({rpc} as never,2)).toEqual({captions:0,results:[]})
  expect(rpc).toHaveBeenCalledTimes(1)
 })
 it('uma peça que falha não derruba a volta inteira',async()=>{
  const peca={id:'c1',client:'ALPHA FITNESS',title:'Reel',assets:[video(1000)],selected_assets:['a1'],caption:'',transcript:null}
  let chamadas=0
  const rpc=vi.fn().mockImplementation(async(nome:string)=>{
   if(nome==='central_social_caption_next')return {data:chamadas++===0?peca:null,error:null}
   return {data:null,error:null}
  })
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('rede caiu')))
  const r=await processCaptions({rpc,storage:{from:()=>({download:async()=>({data:new Blob(['x']),error:null})})}} as never,2)
  expect(r.captions).toBe(1)
  expect(r.results[0].status).not.toBe('escrita')
  vi.unstubAllGlobals()
 })
})
