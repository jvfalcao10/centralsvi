import {describe,it,expect,vi,beforeEach} from 'vitest'

// 21/10/2026: o envio direto do Meta (rupload) passou a recusar todo vídeo
// acima de uns 50 s, com ProcessingFailedError no último pedaço. A prova é que
// o arquivo do GM Gás que publicou em 20/10 falhou igual ao ser reenviado.
// Pela porta de URL o mesmo arquivo processa, então o vídeo do Drive passa a
// ser espelhado no storage e o Instagram busca de lá.
const graph=vi.fn()
vi.mock('../../api/_lib/social-publication-meta.js',async()=>{
 const real=await vi.importActual<any>('../../api/_lib/social-publication-meta.js')
 return {...real,publicationGraph:(...a:any[])=>graph(...a),publicationToken:()=>'tk'}
})
const driveFull=vi.fn()
vi.mock('../../api/_lib/social-drive.js',()=>({
 driveVideoRange:vi.fn(),
 driveVideoFull:(...a:any[])=>driveFull(...a),
}))

const {processPublications,caminhoDoEspelho,faxinaDosEspelhos}=await import('../../api/_lib/social-publication-worker')

const ARQUIVO={id:'a1',name:'Dra Esia - sala de parto .MP4',type:'video/mp4',path:'drive:xyz',
 storage:'drive',drive_id:'xyz',bytes:12,duration_ms:75700,width:1080,height:1920}

function fakeDb(job:any,subidos:string[],listados:any[]=[]) {
 const linha={...job}
 const chain:any={update:(p:any)=>{Object.assign(linha,p);return chain},eq:()=>chain,in:()=>chain,
  select:()=>chain,maybeSingle:async()=>({data:{id:linha.id},error:null})}
 return {linha,db:{
  rpc:vi.fn(async(nome:string)=>nome==='central_social_publication_claim'?{data:linha,error:null}:{data:true,error:null}),
  from:()=>chain,
  storage:{from:()=>({
   info:async()=>({data:null,error:{message:'not found'}}),
   upload:async(caminho:string)=>{subidos.push(caminho);return {error:null}},
   createSignedUrl:async(caminho:string)=>({data:{signedUrl:`https://sb/${caminho}?t=1`},error:null}),
   list:async()=>({data:listados,error:null}),
   remove:async(paths:string[])=>{subidos.push('remove:'+paths.join(',')); return {error:null}},
  })},
 } as any}
}

const tarefa=(progress:any={})=>({id:'job1',card_id:'c1',revision:1,actor:'Joao',actor_id:'u',
 account_id:'17841404551618439',account_username:'draesialopes',format:'reel',caption:'legenda',
 assets:[ARQUIVO],cover_path:null,cover_offset_ms:0,scheduled_at:new Date(Date.now()-60000).toISOString(),
 status:'queued',progress,lease_id:'l1',attempts:0,error:null,media_id:null,permalink:null,published_at:null})

describe('vídeo do Drive sobe pelo storage e o Instagram busca por URL',()=>{
 beforeEach(()=>{graph.mockReset();driveFull.mockReset()})

 it('o primeiro passo é só espelhar o arquivo, sem falar com o Instagram',async()=>{
  const subidos:string[]=[]
  const {db,linha}=fakeDb(tarefa(),subidos)
  driveFull.mockResolvedValue({ok:true,arrayBuffer:async()=>new ArrayBuffer(12)})
  const r=await processPublications(db)
  expect(r).toEqual({processed:1,status:'preparing'})
  expect(subidos).toEqual(['publicacao/xyz.mp4'])
  expect(graph).not.toHaveBeenCalled()
  expect(linha.progress.espelho).toBe('publicacao/xyz.mp4')
 })

 it('o container nasce com video_url e NUNCA com upload_type',async()=>{
  const subidos:string[]=[]
  const {db}=fakeDb(tarefa({espelho:'publicacao/xyz.mp4'}),subidos)
  graph.mockImplementation(async(metodo:string,edge:string)=>
   edge.endsWith('/media')?{id:'111'}:{status_code:'IN_PROGRESS'})
  await processPublications(db)
  const [,edge,params]=graph.mock.calls[0]
  expect(edge).toBe('17841404551618439/media')
  expect(params.media_type).toBe('REELS')
  expect(params.video_url).toBe('https://sb/publicacao/xyz.mp4?t=1')
  expect(params.upload_type).toBeUndefined()
  expect(subidos).toEqual([])
 })

 it('arquivo que não é do Drive segue pelo caminho dele',async()=>{
  const subidos:string[]=[]
  const proprio={...ARQUIVO,storage:undefined,drive_id:undefined,path:'manual/abc.mp4'}
  const t=tarefa();t.assets=[proprio as any]
  const {db}=fakeDb(t,subidos)
  graph.mockImplementation(async(metodo:string,edge:string)=>
   edge.endsWith('/media')?{id:'222'}:{status_code:'IN_PROGRESS'})
  await processPublications(db)
  expect(subidos).toEqual([])
  expect(graph.mock.calls[0][2].video_url).toBe('https://sb/manual/abc.mp4?t=1')
 })

 it('o espelho tem o nome do arquivo no Drive, então reel e story reaproveitam',()=>{
  expect(caminhoDoEspelho(ARQUIVO as any)).toBe('publicacao/xyz.mp4')
 })
})

describe('faxina dos espelhos',()=>{
 const agora=Date.parse('2026-10-22T15:00:00Z')
 const arquivo=(name:string,dias:number)=>({name,created_at:new Date(agora-dias*86400000).toISOString()})

 it('leva o que passou de três dias e deixa o resto',async()=>{
  const subidos:string[]=[]
  const {db}=fakeDb(tarefa(),subidos,[arquivo('velho.mp4',5),arquivo('novo.mp4',1),arquivo('limite.mp4',4)])
  expect(await faxinaDosEspelhos(db,agora)).toBe(2)
  expect(subidos).toEqual(['remove:publicacao/velho.mp4,publicacao/limite.mp4'])
 })

 it('pasta vazia não apaga nada',async()=>{
  const subidos:string[]=[]
  const {db}=fakeDb(tarefa(),subidos,[])
  expect(await faxinaDosEspelhos(db,agora)).toBe(0)
  expect(subidos).toEqual([])
 })
})
