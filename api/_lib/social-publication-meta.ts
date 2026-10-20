import type {PublicationAccount} from './social-publication-domain.js'
const GRAPH='https://graph.facebook.com/v24.0'
export class MetaPublicationError extends Error {constructor(public code:number,message:string){super(message)}}
export function publicationToken(){const token=process.env.SOCIAL_IG_ACCESS_TOKEN;if(!token)throw new Error('Instagram indisponível. Avise o João para conferir a conexão.');return token}
export async function publicationGraph(method:'GET'|'POST',edge:string,params:Record<string,string>={}) {
 const query=new URLSearchParams(params)
 const response=await fetch(`${GRAPH}/${edge}${method==='GET'?'?'+query:''}`,{method,headers:{Authorization:`Bearer ${publicationToken()}`,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(method==='POST'?{body:query}:{}),signal:AbortSignal.timeout(25000)})
 const data=await response.json()
 if(!response.ok||data.error)throw new MetaPublicationError(data.error?.code||response.status,String(data.error?.message||'Instagram não respondeu.').slice(0,400))
 return data
}
let cache:{until:number;rows:PublicationAccount[]}|undefined
export async function publicationAccounts(){
 if(cache&&cache.until>Date.now())return cache.rows
 const rows:PublicationAccount[]=[];let after=''
 for(let page=0;page<10;page++){
  const data=await publicationGraph('GET','me/accounts',{fields:'id,name,instagram_business_account{id,username}',limit:'100',...(after?{after}:{})})
  for(const p of data.data||[]){const ig=p.instagram_business_account;if(ig?.id&&ig?.username)rows.push({id:ig.id,username:ig.username,name:p.name})}
  if(!data.paging?.next)break
  after=data.paging?.cursors?.after;if(!after)throw new Error('Não foi possível conferir todas as contas do Instagram.')
  if(page===9)throw new Error('Não foi possível conferir todas as contas do Instagram.')
 }
 // Página de CLIENTE não entra em /me/accounts, só as próprias da casa.
 // 20/10/2026: o Instagram do Rafael Melo (@rafaelmelo.advogadoss) entrou no
 // Business Manager como página de cliente, respondia pela API e mesmo assim a
 // tela dizia "escolha uma conta conectada", porque a lista vinha só de
 // /me/accounts. Sem isto, cliente que compartilha a página com a SVI nunca
 // aparece para ser programado, e alguém tem que postar na mão.
 for(const p of await paginasDeCliente()){
  // A página de cliente às vezes devolve só connected_instagram_account, que é
  // a mesma conta vista por outro campo. Publicar nela funciona: provado com o
  // carrossel do Rafael em 20/10.
  const ig=p.instagram_business_account||p.connected_instagram_account
  if(ig?.id&&ig?.username&&!rows.some(r=>r.id===ig.id))rows.push({id:ig.id,username:ig.username,name:p.name})
 }
 cache={until:Date.now()+300000,rows:rows.sort((a,b)=>a.username.localeCompare(b.username))};return cache.rows
}

/** O Business Manager da SVI, onde as páginas de cliente ficam compartilhadas. */
const NEGOCIO='3597385227141196'

type PaginaDeCliente={name:string;instagram_business_account?:{id:string;username:string};connected_instagram_account?:{id:string;username:string}}
async function paginasDeCliente():Promise<PaginaDeCliente[]>{
 // Uma falha aqui não pode derrubar a lista inteira: sem isto, um tropeço no
 // Business Manager tiraria da tela as contas próprias, que estão em ordem.
 try{
  const d=await publicationGraph('GET',`${NEGOCIO}/client_pages`,{fields:'name,instagram_business_account{id,username},connected_instagram_account{id,username}',limit:'200'})
  return (d.data||[]) as PaginaDeCliente[]
 }catch{return []}
}
export const friendlyPublicationError=(e:unknown)=>e instanceof MetaPublicationError?e.code===190?'A conexão com o Instagram expirou. Reconecte antes de tentar novamente.':e.code===10||e.code===200?'O Instagram não permitiu publicar nesta conta. Confira a conexão e as permissões.':`O Instagram recusou o arquivo ou a publicação: ${e.message}`:e instanceof Error&&e.message.startsWith('Mídia:')?e.message:'Não foi possível concluir esta etapa. Confira os arquivos e tente novamente.'
