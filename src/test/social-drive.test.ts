import {it,expect,vi,afterEach} from 'vitest'
import {driveVideo} from '../../api/_lib/social-drive'
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
it('copies a 53 MiB original in bounded chunks into year / month / client and reuses it on retry',async()=>{
 vi.stubGlobal('AbortSignal',{timeout:()=>new AbortController().signal})
 vi.stubEnv('SOCIAL_GOOGLE_OAUTH',JSON.stringify({client_id:'test',client_secret:'test',refresh_token:'test'}));vi.stubEnv('SOCIAL_UAZ_TOKEN','uaz-test')
 const total=53*1024*1024,cache=new Map<string,string>(),files=new Map<string,any>(),folders:string[]=[],sizes:number[]=[]
 const job={key:'job-test',source_id:'message-test',card_id:'card-test',attempts:1,payload:{bytes:total,type:'video/mp4',name:'Original.mp4',client:'DR. FELIPE BRANCO',year:2026,month:9,at:'2026-09-25T22:00:00Z'} as Record<string,any>}
 let id=0,meta:any,received=0,sourceRequests=0
 const db:any={from:()=>{let key='';return {select(){return this},eq(_k:string,v:string){key=v;return this},async maybeSingle(){return {data:cache.has(key)?{drive_id:cache.get(key)}:null,error:null}},async single(){return {data:{drive_id:cache.get(key)},error:null}},async upsert(v:any){cache.set(v.path,v.drive_id);return {error:null}}}},rpc:async(_n:string,args:any)=>{Object.assign(job.payload,args.p_patch);return {data:job.payload,error:null}}}
 vi.stubGlobal('fetch',vi.fn(async(raw:string,init:RequestInit={})=>{
  const u=new URL(raw),headers=init.headers as Record<string,string>||{}
  if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'google-test',expires_in:3600})
  if(u.hostname==='svicompany.uazapi.com'){
   sourceRequests++;expect(headers.token).toBe('uaz-test');expect(headers.Authorization).toBeUndefined();let remaining=total
   return new Response(new ReadableStream({pull(c){if(!remaining){c.close();return}const n=Math.min(1024*1024,remaining);remaining-=n;c.enqueue(new Uint8Array(n).fill(17))}}),{headers:{'content-length':String(total)}})
  }
  expect(headers.token).toBeUndefined()
  if(u.pathname.endsWith('/generateIds'))return Response.json({ids:['id'+(++id)]})
  if(u.pathname==='/drive/v3/files'&&init.method==='POST'){const body=JSON.parse(String(init.body));folders.push(body.name);files.set(body.id,body);return Response.json({id:body.id})}
  if(u.pathname.startsWith('/drive/v3/files/')){const f=files.get(u.pathname.split('/').pop()!);return f?Response.json(f):new Response(null,{status:404})}
  if(u.pathname==='/upload/drive/v3/files'&&init.method==='POST'){meta=JSON.parse(String(init.body));return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'}})}
  if(u.pathname==='/upload/drive/v3/files'&&init.method==='PUT'){
   const bytes=init.body as Uint8Array;sizes.push(bytes.length);expect(bytes[0]).toBe(17);expect(bytes[bytes.length-1]).toBe(17)
   expect(headers['Content-Range']).toBe(`bytes ${received}-${received+bytes.length-1}/${total}`);received+=bytes.length
   if(received<total)return new Response(null,{status:308,headers:{range:`bytes=0-${received-1}`}})
   const f={...meta,size:String(received)};files.set(meta.id,f);return Response.json(f)
  }
  throw new Error('Unexpected mock request '+u.pathname)
 }))
 const result=await driveVideo(db,job,'https://svicompany.uazapi.com/media/test')
 expect(folders).toEqual(['2026','SETEMBRO','DR. FELIPE BRANCO']);expect(result.bytes).toBe(total);expect(result.storage).toBe('drive');expect(Math.max(...sizes)).toBeLessThanOrEqual(8*1024*1024);expect(received).toBe(total)
 expect(await driveVideo(db,job,'https://svicompany.uazapi.com/media/test')).toEqual(result);expect(sourceRequests).toBe(1)
})
