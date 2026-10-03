import { describe,it,expect } from 'vitest'
import { clientApproval,isTeamSender,matchesClient,clientGroupApproval } from '../../api/_lib/social-client-approval'
import { socialIntake } from '../../api/_lib/social-intake'

const VANESSA='120363421173501760@g.us', ESIA='120363425888591043@g.us'
const NOW=Date.parse('2026-10-01T22:10:00Z')

describe('client approval wording (real replies from the client groups)',()=>{
 it('accepts explicit approval',()=>{for(const t of ['Aprovado ✅','Aprovado','aprovados','Mais que aprovado hehehe','Pode postar ta ok','Top aprovado','Aprovado ! Kkkkkkkkkkk','Pode postar'])expect(clientApproval(t)).toBe('explicit')})
 it('accepts praise as a weaker approval',()=>{for(const t of ['Amei','Bom dia Perfeito','Ficou ótimo','Amei todossssss','perfeito','Ficou top'])expect(clientApproval(t)).toBe('praise')})
 it('rejects questions, negation, conditions and change requests',()=>{for(const t of ['Bom dia Ainda não pode postar','Se tiver aprovado sim','Material está aprovado?','@15161620463718 doutor, tá aprovado?','Já pode postar ?','muda a cor e pode postar','troca a foto','foi aprovado semana passada','ok','Bom dia'])expect(clientApproval(t)).toBe('')})
})

describe('who counts as client',()=>{
 it('treats SVI team phones and known team ids as team',()=>{expect(isTeamSender({sender:'43229013668067@lid',sender_pn:'559492404033@s.whatsapp.net'})).toBe(true);expect(isTeamSender({sender:'188695110004740@lid'})).toBe(true);expect(isTeamSender({sender_pn:'5594933005199@s.whatsapp.net'})).toBe(true)})
 it('treats anyone else as client',()=>expect(isTeamSender({sender:'14890701959294@lid',sender_pn:'5594991234567@s.whatsapp.net'})).toBe(false))
 it('matches tasks by client name only',()=>{expect(matchesClient({name:'[VANESSA BACK] Carrossel outubro'},['vanessa'])).toBe(true);expect(matchesClient({name:'[DRA ÉSIA] Post rotina'},['vanessa'])).toBe(false)})
})

function fakes(tasks:any[],cards:Record<string,any>,opts:{duplicate?:boolean}={}){
 const applied:any[]=[],clickupCalls:any[]=[],receipts:any[]=[]
 const db:any={
  from:(table:string)=>({
   insert:async(row:any)=>{receipts.push(row);return {error:opts.duplicate?{message:'duplicate key'}:null}},
   update:(row:any)=>({eq:async()=>{receipts.push(row);return {error:null}}}),
   select:()=>({eq:(_:string,id:string)=>({maybeSingle:async()=>({data:table==='central_social_cards'?cards[id]||null:null,error:null})})}),
  }),
  rpc:async(name:string,args:any)=>{applied.push({name,args});return {data:{},error:null}},
 }
 const clickup=async(path:string,init?:any)=>{clickupCalls.push({path,method:init?.method||'GET',body:init?.body});return path.startsWith('/list/901521539717')?{tasks}:{tasks:[]}}
 return {db,clickup,applied,clickupCalls,receipts}
}
const card=(id:string,extra:any={})=>({id,client:'Vanessa Back',title:'Arte',author:'José',assets:[{id:'a1',name:'a.png',path:'x',type:'image/png'}],selected_assets:['a1'],caption:'',note:'',stage:'conferir',revision:1,version:3,approved_revision:null,approved_by:null,approved_at:null,approval_evidence:null,ingest_pending:false,posted_at:null,...extra})
const task=(id:string,name:string,hoursBefore:number,status='com o cliente')=>({id,name,status:{status},date_updated:String(NOW-hoursBefore*3600000)})
const msg=(text:string,extra:any={})=>({id:'wamid-1',chatid:VANESSA,sender:'14890701959294@lid',sender_pn:'5594991234567@s.whatsapp.net',fromMe:false,messageTimestamp:NOW,text,...extra})

describe('approval in the client group moves the batch sent before it',()=>{
 it('approves every waiting piece of that client in Central and ClickUp, silently',async()=>{
  const f=fakes([task('t1','[VANESSA BACK] Arte 1',3),task('t2','[VANESSA BACK] Arte 2',3),task('t3','[DRA ÉSIA] outra cliente',3)],{t1:card('t1'),t2:card('t2')})
  const r:any=await clientGroupApproval(f.db,msg('Aprovado'),f.clickup,NOW)
  expect(r.route).toBe('pass')
  expect(r.client_approval.approved).toEqual(['t1','t2'])
  expect(f.applied.every(a=>a.name==='central_social_apply'&&a.args.p_action==='aprovar'&&a.args.p_patch.stage==='aprovado')).toBe(true)
  expect(f.applied[0].args.p_patch.approval_evidence).toContain('"Aprovado"')
  expect(f.clickupCalls.filter(c=>c.method==='PUT').map(c=>c.body.status)).toEqual(['aprovado pelo cliente','aprovado pelo cliente'])
  expect(f.clickupCalls.some(c=>c.path.includes('t3'))).toBe(false)
 })
 it('ignores pieces sent after the reply',async()=>{
  const f=fakes([task('t1','[VANESSA BACK] Arte 1',-2)],{t1:card('t1')})
  const r:any=await clientGroupApproval(f.db,msg('Aprovado'),f.clickup,NOW)
  expect(r.client_approval.tasks).toEqual([])
 })
 it('only lets praise approve a recent delivery',async()=>{
  const f=fakes([task('t1','[VANESSA BACK] Arte 1',72)],{t1:card('t1')})
  expect((await clientGroupApproval(f.db,msg('Amei'),f.clickup,NOW) as any).client_approval.tasks).toEqual([])
  const g=fakes([task('t1','[VANESSA BACK] Arte 1',72)],{t1:card('t1')})
  expect((await clientGroupApproval(g.db,msg('Aprovado'),g.clickup,NOW) as any).client_approval.approved).toEqual(['t1'])
 })
 it('does nothing for team members, Sofia, questions or repeated webhooks',async()=>{
  for(const m of [msg('Perfeito',{sender:'43229013668067@lid',sender_pn:'559492404033@s.whatsapp.net'}),msg('Aprovado',{fromMe:true}),msg('tá aprovado?')]){
   const f=fakes([task('t1','[VANESSA BACK] Arte 1',3)],{t1:card('t1')})
   expect(await clientGroupApproval(f.db,m,f.clickup,NOW)).toEqual({route:'pass'});expect(f.applied).toEqual([]);expect(f.clickupCalls).toEqual([])
  }
  const d=fakes([task('t1','[VANESSA BACK] Arte 1',3)],{t1:card('t1')},{duplicate:true})
  expect((await clientGroupApproval(d.db,msg('Aprovado'),d.clickup,NOW) as any).client_approval.duplicate).toBe(true);expect(d.applied).toEqual([])
 })
 it('keeps an already approved version and still mirrors ClickUp',async()=>{
  const f=fakes([task('t1','[VANESSA BACK] Arte 1',3)],{t1:card('t1',{approved_revision:1,approved_at:'2026-10-01T00:00:00Z',approved_by:'Letícia'})})
  const r:any=await clientGroupApproval(f.db,msg('Aprovado'),f.clickup,NOW)
  expect(r.client_approval.skipped.t1).toBe('ja_aprovado');expect(f.applied).toEqual([]);expect(r.client_approval.clickup).toEqual(['t1'])
 })
 it('leaves other chats to the existing intake',async()=>{
  const f=fakes([],{})
  expect(await clientGroupApproval(f.db,msg('Aprovado',{chatid:'559492404033@s.whatsapp.net'}),f.clickup,NOW)).toBeNull()
  expect(await clientGroupApproval(f.db,msg('Aprovado',{chatid:ESIA,text:'Bom dia Ainda não pode postar'}),f.clickup,NOW)).toEqual({route:'pass'})
 })
 it('never asks Sofia to reply inside a client group',async()=>{
  const f=fakes([task('t1','[VANESSA BACK] Arte 1',3)],{t1:card('t1')})
  for(const m of [msg('Perfeito',{sender_pn:'559492416107@s.whatsapp.net'}),msg('Bom dia'),msg('Ainda não pode postar')])expect(await socialIntake(f.db,m)).toEqual({route:'pass'})
  expect(f.applied).toEqual([])
 })
})
