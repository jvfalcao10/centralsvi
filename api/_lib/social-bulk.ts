import type {SupabaseClient} from '@supabase/supabase-js'
import {socialMovePatch,staffMoveState,SocialError,type SocialCard} from './social-domain.js'
import {newApprovalLink} from './social-approval-link.js'

export async function moveManyCards(db:SupabaseClient,body:Record<string,unknown>,actor:string,actorId:string) {
 const items=body.items as {id:string;version:number}[]
 if(!Array.isArray(items)||!items.length||items.length>250||items.some(i=>!i||typeof i.id!=='string'||!Number.isInteger(i.version))||new Set(items.map(i=>i.id)).size!==items.length)throw new SocialError(400,'Selecione de 1 a 250 peças diferentes para mover.')
 const {data,error}=await db.from('central_social_cards').select('*').in('id',items.map(i=>i.id))
 if(error)throw error
 const cards=new Map((data as SocialCard[]).map(c=>[c.id,c]))
 const prepared:Record<string,unknown>[]=[],urls=new Map<string,string>()
 const results:{id:string;ok:boolean;card?:ReturnType<typeof staffMoveState>;error?:string;approval_url?:string}[]=[]
 for(const item of items){
  const card=cards.get(item.id)
  if(!card){results.push({id:item.id,ok:false,error:'Peça não encontrada. Atualize o quadro.'});continue}
  if(card.version!==item.version){results.push({id:item.id,ok:false,error:'Esta peça mudou em outra tela. Atualize e confira.'});continue}
  if(card.stage===body.stage){results.push({id:item.id,ok:true,card:staffMoveState(card)});continue}
  try{
   const patch=socialMovePatch(card,body.stage,actor)
   let ciphertext:string|undefined
   if(patch.stage==='aguardando'){
    const link=newApprovalLink(card.id);patch.token_hash=link.hash;patch.token_expires_at=new Date(Date.now()+30*86400000).toISOString();ciphertext=link.ciphertext;urls.set(card.id,link.url)
   }
   prepared.push({id:card.id,version:item.version,patch,ciphertext})
  }catch(e){if(!(e instanceof SocialError))throw e;results.push({id:item.id,ok:false,error:e.message})}
 }
 if(prepared.length){
  const {data,error}=await db.rpc('central_social_move_many',{p_moves:prepared,p_actor:actor,p_actor_id:actorId})
  if(error)throw error
  for(const result of data){
   if(result.ok)results.push({id:result.id,ok:true,card:staffMoveState(result.card),approval_url:urls.get(result.id)||''})
   else results.push({id:result.id,ok:false,error:result.error==='version_conflict'?'Esta peça mudou em outra tela. Atualize e confira.':'Não foi possível mover esta peça. Atualize e tente novamente.'})
  }
 }
 return {ok:true,results}
}
