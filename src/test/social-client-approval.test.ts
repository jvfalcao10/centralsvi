import { describe,it,expect } from 'vitest'
import {clientVerdict,isTeamSender,matchesClient,clientGroupApproval,type Store,receiptStore} from '../../api/_lib/social-client-approval'
import { socialIntake } from '../../api/_lib/social-intake'

const SORAIA='120363405081976310@g.us'
const T0=Date.parse('2026-10-02T20:00:00Z'), MIN=60000
const LETICIA={sender:'188695110004740@lid',sender_pn:'559492416107@s.whatsapp.net'}
const CLIENTE={sender:'14890701959294@lid',sender_pn:'5594991234567@s.whatsapp.net'}

describe('client wording (real replies from the client groups)',()=>{
 it('reads explicit approval',()=>{for(const t of ['Aprovado ✅','aprovados','Mais que aprovado hehehe','Pode postar ta ok','Top aprovado','Esse ok','Blz pode rodar'])expect(clientVerdict(t)).toBe('explicit')})
 it('reads praise',()=>{for(const t of ['Amei','Bom dia Perfeito','Ficou ótimo','Amei todossssss'])expect(clientVerdict(t)).toBe('praise')})
 it('reads change requests, including mixed messages',()=>{for(const t of ['Bom dia Ainda não pode postar','muda a cor e pode postar','o 1 troca a música, o resto aprovado','João, deixa as legendas mais finas, se possível.'])expect(clientVerdict(t)).toBe('change')})
 it('ignores questions and conditions',()=>{for(const t of ['Se tiver aprovado sim','Material está aprovado?','Já pode postar ?','foi aprovado semana passada','Bom dia','ok'])expect(clientVerdict(t)).toBe('')})
 it('separates team from client',()=>{expect(isTeamSender(LETICIA)).toBe(true);expect(isTeamSender({sender_pn:'5594933005199@s.whatsapp.net'})).toBe(true);expect(isTeamSender(CLIENTE)).toBe(false)})
 it('matches ClickUp tasks by client',()=>{expect(matchesClient({name:'[ESPAÇO SORAIA] Post'},['soraia'])).toBe(true);expect(matchesClient({name:'[GM GÁS] Post'},['soraia'])).toBe(false)})
})

const card=(id:string,assets:string[],selected:string[],extra:any={})=>({id,client:'Espaço Soraia',title:id,author:'Math',assets:assets.map(n=>({id:'a-'+n,name:n,path:'x',type:'video/mp4'})),selected_assets:selected.map(n=>'a-'+n),caption:'',note:'',stage:'conferir',revision:1,version:2,approved_revision:null,approved_by:null,approved_at:null,approval_evidence:null,ingest_pending:false,posted_at:null,...extra})
function world(cards:any[],tasks:any[]=[]){
 const receipts:Record<string,{chat:string;result:any;at:number}>={}
 const approved:string[]=[],clickup:any[]=[],sent:string[]=[],changed:any[]=[]
 const store:Store={
  async claim(id,chat,result){if(receipts[id])return false;receipts[id]={chat,result,at:Number((result as any).at||0)};return true},
  async save(id,result){receipts[id].result=result},
  async media(chat,since){
   const rows=Object.entries(receipts).filter(([,r])=>r.chat===chat&&r.at>=since)
   const changed=new Set(rows.filter(([k])=>k.startsWith('cg-change:')).map(([,r])=>r.result.media))
   const done=new Set(rows.filter(([k])=>k.startsWith('client-approval:')).flatMap(([,r])=>r.result.client_approval?.media||[]))
   return rows.filter(([k])=>k.startsWith('cg-media:')).map(([k,r])=>({id:k.slice(9),name:r.result.name,at:r.at,change:changed.has(k.slice(9)),done:done.has(k.slice(9))}))
  },
  async lastApproval(chat,before){return Math.max(0,...Object.entries(receipts).filter(([k,r])=>k.startsWith('client-approval:')&&r.chat===chat&&r.at<before).map(([,r])=>r.at))},
  async changes(chat,since){return Object.entries(receipts).filter(([k,r])=>k.startsWith('cg-change:')&&r.chat===chat&&r.at>=since).length},
  async cardByFile(name){return cards.find(c=>c.assets.some((a:any)=>a.name===name))||null},
  async card(id){return cards.find(c=>c.id===id)||null},
  async approve(c,patch){approved.push(c.id);Object.assign(c,patch);return ''},
  async markSent(c){if(c.stage!=='conferir'||c.ingest_pending||!c.selected_assets.length)return '';sent.push(c.id);c.stage='aguardando';return ''},
  async askChanges(c,reason){if(c.stage==='postado'||c.stage==='arquivado')return '';changed.push({id:c.id,reason});c.stage='ajustes';c.note=reason;return ''},
 }
 const fetcher=async(path:string,init?:any)=>{clickup.push({path,method:init?.method||'GET',body:init?.body});return path.startsWith('/list/901521539717')?{tasks}:{tasks:[]}}
 let n=0
 const send=(who:any,extra:any)=>clientGroupApproval({} as any,{id:'m'+(++n),messageid:'m'+n,chatid:SORAIA,fromMe:false,...who,...extra},fetcher,T0+60*MIN*24,store)
 return {store,approved,clickup,receipts,sent,changed,team:(file:string,minute:number)=>send(LETICIA,{messageType:'DocumentMessage',content:{fileName:file},messageTimestamp:T0+minute*MIN}).then(()=>'m'+n),client:(text:string,minute:number,quoted='')=>send(CLIENTE,{text,quoted,messageTimestamp:T0+minute*MIN})}
}

describe('João: three videos go out, video 1 comes back corrected',()=>{
 it('a reply on top of one video approves only that video',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov']),card('v2',['soraia 2.mov'],['soraia 2.mov']),card('v3',['soraia 3.mov'],['soraia 3.mov'])]
  const w=world(cards);await w.team('soraia 1.mov',0);const m2=await w.team('soraia 2.mov',1);await w.team('soraia 3.mov',2)
  const r:any=await w.client('Aprovado',10,m2)
  expect(r.route).toBe('pass');expect(w.approved).toEqual(['v2']);expect(cards[1].stage).toBe('aprovado');expect(cards[1].approval_evidence).toContain('soraia 2.mov')
 })
 it('a loose approval covers the batch minus the video the client asked to change',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov']),card('v2',['soraia 2.mov'],['soraia 2.mov']),card('v3',['soraia 3.mov'],['soraia 3.mov'])]
  const w=world(cards);const m1=await w.team('soraia 1.mov',0);await w.team('soraia 2.mov',1);await w.team('soraia 3.mov',2)
  await w.client('Esse troca a música',5,m1);await w.client('Os outros aprovados',6)
  // O v1 ficava em "conferir" só porque a peça nunca saía de lá. Agora ela é marcada
  // como entregue quando o time manda o arquivo, e o que importa aqui segue valendo:
  // o vídeo em que o cliente pediu mudança não entra na aprovação solta.
  expect(w.approved).toEqual(['v2','v3']);expect(cards[0].stage).not.toBe('aprovado')
 })
 it('the corrected v2 is approved on its own; an answer on the old v1 is ignored',async()=>{
  const cards=[card('v1',['soraia 1.mov','soraia 1 v2.mov'],['soraia 1 v2.mov'],{revision:2})]
  const w=world(cards);const old=await w.team('soraia 1.mov',0);const v2=await w.team('soraia 1 v2.mov',100)
  const a:any=await w.client('Aprovado',101,old);expect(a.client_approval.skipped[old]).toBe('versao_antiga');expect(w.approved).toEqual([])
  await w.client('Agora sim, aprovado',102,v2);expect(w.approved).toEqual(['v1'])
 })
 it('a mixed message approves nothing',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov']),card('v2',['soraia 2.mov'],['soraia 2.mov'])]
  const w=world(cards);await w.team('soraia 1.mov',0);await w.team('soraia 2.mov',1)
  await w.client('o 1 muda a cor, o 2 aprovado',5);expect(w.approved).toEqual([])
 })
 it('an earlier approval closes the batch: later loose approvals only see new pieces',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov']),card('v2',['soraia 2.mov'],['soraia 2.mov'])]
  const w=world(cards);await w.team('soraia 1.mov',0);await w.client('Aprovado',5)
  await w.team('soraia 2.mov',60);await w.client('Amei',61)
  expect(w.approved).toEqual(['v1','v2'])
 })
 it('raw material sent by the client is never approved',async()=>{
  const cards=[card('raw',['IMG_7826.MOV'],['IMG_7826.MOV'])]
  const w=world(cards);await clientGroupApproval({} as any,{id:'x',chatid:SORAIA,...CLIENTE,messageType:'DocumentMessage',content:{fileName:'IMG_7826.MOV'},messageTimestamp:T0},async()=>({tasks:[]}),T0,w.store)
  await w.client('Aprovado',5);expect(w.approved).toEqual([])
 })
})

const task=(id:string,minute:number)=>({id,name:'[ESPAÇO SORAIA] Arte '+id,status:{status:'com o cliente'},date_updated:String(T0+minute*MIN)})
describe('Sofia art from ClickUp ("Imagem 1 de 3"), which has no file name',()=>{
 it('one waiting art is approved in Central and ClickUp',async()=>{
  const cards=[card('86a1',['arte.png'],['arte.png'])];const w=world(cards,[task('86a1',0)])
  await w.client('Aprovado',5);expect(w.approved).toEqual(['86a1'])
  expect(w.clickup.filter(c=>c.method==='PUT').map(c=>c.body.status)).toEqual(['aprovado pelo cliente'])
 })
 it('several waiting arts need a plural approval',async()=>{
  const cards=[card('86a1',['a.png'],['a.png']),card('86a2',['b.png'],['b.png'])]
  const w=world(cards,[task('86a1',0),task('86a2',0)])
  const r:any=await w.client('Aprovado',5);expect(w.approved).toEqual([]);expect(r.client_approval.skipped['86a1']).toBe('varias_artes_conferir')
  await w.client('Todos aprovados',6);expect(w.approved).toEqual(['86a1','86a2'])
 })
 it('a change request on any art holds them all for the team',async()=>{
  const cards=[card('86a1',['a.png'],['a.png'])];const w=world(cards,[task('86a1',0)])
  await w.client('deixa a letra maior',3,'sofia-img-1');const r:any=await w.client('Aprovado',5)
  expect(w.approved).toEqual([]);expect(r.client_approval.skipped['86a1']).toBe('cliente_pediu_ajuste')
 })
})

describe('safety',()=>{
 it('team, Sofia, questions and repeated webhooks change nothing',async()=>{
  const cards=[card('86a1',['a.png'],['a.png'])];const w=world(cards,[task('86a1',0)])
  expect(await clientGroupApproval({} as any,{id:'t',chatid:SORAIA,...LETICIA,text:'Perfeito',messageTimestamp:T0},async()=>({tasks:[]}),T0,w.store)).toEqual({route:'pass'})
  expect(await clientGroupApproval({} as any,{id:'s',chatid:SORAIA,fromMe:true,text:'Aprovado'},async()=>({tasks:[]}),T0,w.store)).toEqual({route:'pass'})
  await w.client('tá aprovado?',5);expect(w.approved).toEqual([])
  const again={id:'dup',messageid:'dup',chatid:SORAIA,...CLIENTE,text:'Aprovado',messageTimestamp:T0+5*MIN}
  const f=async(p:string)=>p.startsWith('/list/901521539717')?{tasks:[task('86a1',0)]}:{}
  await clientGroupApproval({} as any,again,f as any,T0,w.store);const r:any=await clientGroupApproval({} as any,again,f as any,T0,w.store)
  expect(r.client_approval.duplicate).toBe(true);expect(w.approved).toEqual(['86a1'])
 })
 it('other chats keep the existing intake, and Sofia never replies in a client group',async()=>{
  expect(await clientGroupApproval({} as any,{id:'p',chatid:'559492404033@s.whatsapp.net',text:'Aprovado'})).toBeNull()
  const db:any={from:()=>({insert:async()=>({error:null})})}
  for(const m of [{...LETICIA,messageType:'DocumentMessage',content:{fileName:'x.mov'}},{...CLIENTE,text:'Bom dia'},{...CLIENTE,text:'Ainda não pode postar'}])expect(await socialIntake(db,{id:'i'+Math.random(),chatid:SORAIA,messageTimestamp:T0,...m})).toEqual({route:'pass'})
 })
})

// O arquivo que o time manda no grupo do cliente JÁ está com o cliente. Enquanto a
// peça ficar em "conferir", a aprovação que vier depois não encontra nada.
describe('entrega no grupo do cliente marca a peça como enviada',()=>{
 it('move a peça de conferir para aguardando quando o time manda o arquivo',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov'])]
  const w=world(cards)
  expect(cards[0].stage).toBe('conferir')
  await w.team('soraia 1.mov',0)
  expect(w.sent).toEqual(['v1'])
  expect(cards[0].stage).toBe('aguardando')
 })

 it('e por isso a aprovação que vem depois encontra a peça',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov'])]
  const w=world(cards)
  await w.team('soraia 1.mov',0)
  await w.client('Aprovado',10)
  expect(w.approved).toEqual(['v1'])
  expect(cards[0].stage).toBe('aprovado')
 })

 it('não mexe em peça que não está em conferir',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov'],{stage:'aprovado'})]
  const w=world(cards);await w.team('soraia 1.mov',0)
  expect(w.sent).toEqual([]);expect(cards[0].stage).toBe('aprovado')
 })

 it('não mexe em peça sem arquivo selecionado nem com importação pendente',async()=>{
  const semArquivo=[card('v1',['soraia 1.mov'],[])]
  const a=world(semArquivo);await a.team('soraia 1.mov',0)
  expect(a.sent).toEqual([])
  const pendente=[card('v2',['soraia 2.mov'],['soraia 2.mov'],{ingest_pending:true})]
  const b=world(pendente);await b.team('soraia 2.mov',0)
  expect(b.sent).toEqual([])
 })

 // No grupo do cliente também trafega referência e print. Virar card seria lixo no quadro.
 it('arquivo sem peça correspondente não cria nada, só fica o registro',async()=>{
  const w=world([card('v1',['outra.mov'],['outra.mov'])])
  const id=await w.team('referencia solta.jpg',0)
  expect(w.sent).toEqual([])
  expect(w.receipts['cg-media:'+id]).toBeTruthy()
 })
})

// Sem isso, o pedido de mudança ficava só no histórico e a peça parada em "aguardando":
// o designer não via no quadro que tinha retrabalho pedido pelo cliente esperando.
describe('pedido de ajuste do cliente move a peça',()=>{
 it('resposta em cima de um arquivo manda aquela peça para ajustes, com o que o cliente escreveu',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov']),card('v2',['soraia 2.mov'],['soraia 2.mov'])]
  const w=world(cards);const m1=await w.team('soraia 1.mov',0);await w.team('soraia 2.mov',1)
  await w.client('troca a música do começo',5,m1)
  expect(w.changed.map((c:any)=>c.id)).toEqual(['v1'])
  expect(cards[0].stage).toBe('ajustes')
  expect(cards[0].note).toContain('troca a música do começo')
  expect(cards[0].note).toContain('soraia 1.mov')
  expect(cards[1].stage).toBe('aguardando')
 })

 // "muda a cor" depois de três vídeos não diz qual. A mesma régua da aprovação.
 it('pedido solto, sem citar arquivo, não move nada',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov']),card('v2',['soraia 2.mov'],['soraia 2.mov'])]
  const w=world(cards);await w.team('soraia 1.mov',0);await w.team('soraia 2.mov',1)
  await w.client('muda a cor',5)
  expect(w.changed).toEqual([])
  expect(cards.map(c=>c.stage)).toEqual(['aguardando','aguardando'])
 })

 it('a peça em ajustes não entra na aprovação solta que vier depois',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov']),card('v2',['soraia 2.mov'],['soraia 2.mov'])]
  const w=world(cards);const m1=await w.team('soraia 1.mov',0);await w.team('soraia 2.mov',1)
  await w.client('troca a música',5,m1);await w.client('os outros aprovados',6)
  expect(w.approved).toEqual(['v2'])
  expect(cards[0].stage).toBe('ajustes')
 })

 it('tarefa do ClickUp recebe o status de alteração do cliente e o comentário',async()=>{
  const cards=[card('86abc',['soraia 1.mov'],['soraia 1.mov'])]
  const w=world(cards);const m1=await w.team('soraia 1.mov',0)
  await w.client('deixa a legenda maior',5,m1)
  const put=w.clickup.find((c:any)=>c.method==='PUT'&&c.path==='/task/86abc')
  expect(put?.body?.status).toBe('alteração do cliente')
  const com=w.clickup.find((c:any)=>c.path==='/task/86abc/comment')
  expect(com?.body?.comment_text).toContain('deixa a legenda maior')
 })

 it('peça já postada não volta para ajustes',async()=>{
  const cards=[card('v1',['soraia 1.mov'],['soraia 1.mov'],{stage:'postado'})]
  const w=world(cards);const m1=await w.team('soraia 1.mov',0)
  await w.client('troca a música',5,m1)
  expect(w.changed).toEqual([]);expect(cards[0].stage).toBe('postado')
 })
})

// Auditoria externa, 07/10: `return !error` tratava QUALQUER erro de banco como
// "já processado". Uma oscilação do banco faria a aprovação do cliente sumir
// sem deixar rastro.
describe('erro de banco não pode virar aprovação duplicada',()=>{
 const loja=(erro:{code?:string}|null)=>receiptStore({from:()=>({insert:async()=>({error:erro})})} as never)
 it('chave duplicada é duplicata de verdade',async()=>
  expect(await loja({code:'23505'}).claim('x','chat',{})).toBe(false))
 it('qualquer outro erro falha alto, em vez de engolir a aprovação',async()=>
  await expect(loja({code:'08006'}).claim('x','chat',{})).rejects.toThrow('receipt_claim_failed'))
 it('sem erro, reivindica',async()=>
  expect(await loja(null).claim('x','chat',{})).toBe(true))
})
