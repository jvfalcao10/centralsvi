import { supabase } from '@/lib/supabase'
export type Asset = { id:string; name:string; path:string; storage?:'drive'; drive_id?:string; folder_url?:string; folder_label?:string; thumbnail?:string; duration_ms?:number; width?:number; height?:number; preview_retry_at?:string; playback_url?:string; type:string; bytes?:number; url?:string; preview?:string }
export type Card = {
 ingest_pending?:boolean; id:string; client:string; title:string; author:string; source_url:string; source_status:string; source_description?:string;
 source_updated:string; created_at?:string; assets:Asset[]; selected_assets:string[]; caption:string; caption_draft?:boolean; transcript?:string|null; note:string; stage:string; revision:number; version:number;
 approved_by:string|null; approved_at:string|null; approval_evidence:string|null; scheduled_at:string|null; posted_at:string|null; posted_url:string|null; channel:string|null; preview?:string;
}
export const SOCIAL_STAGES = [
 {id:'conferir',label:'Conferir aprovação',color:'#c3a36b',hint:'Falta confirmar esta versão'},
 {id:'aguardando',label:'Aguardando cliente',color:'#80a8cf',hint:'Link de aprovação gerado'},
 {id:'ajustes',label:'Ajustes',color:'#df9279',hint:'Resolver antes de publicar'},
 {id:'aprovado',label:'Aprovado para postar',color:'#79b79b',hint:'Aprovação registrada'},
 {id:'para_anuncio',label:'Para anúncio',color:'#5ea9c9',hint:'Selecionado para tráfego pago'},
 {id:'agendado',label:'Agendado',color:'#ada0cf',hint:'Programado pela equipe'},
 {id:'postado',label:'Postado',color:'#a6b7b0',hint:'Publicação confirmada'},
 {id:'arquivado',label:'Arquivo',color:'#999999',hint:'Fora da fila de postagem'},
]
export async function socialApi(query = '', body?:Record<string,unknown>) {
 const { data:{session} } = await supabase.auth.getSession()
 if (!session) throw new Error('Entre na Central novamente.')
 const r = await fetch('/api/social'+query,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
 const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Não foi possível carregar o quadro.')
 return data
}
export const socialDate=(date?:string|null)=>date?new Date(date).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''
export const localInput=(date=new Date())=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)

// Stage changes never change the order in which deliveries appear.
export function newestSocialFirst(a:Card,b:Card) {
 const time=(card:Card)=>Date.parse(card.source_updated)||Date.parse(card.created_at||'')||0
 return time(b)-time(a)||a.id.localeCompare(b.id)
}

// Etiqueta de cliente: a mesma marca sempre sai na mesma cor, para bater o olho
// no quadro sem ler. Médico e clínica ficam no azul, como no resto da Central.
const TONS=['#c3a36b','#df9279','#79b79b','#ada0cf','#a6b7b0','#d2a3a3','#9fb07e','#c9a86a','#b59ccf','#8fb3a4','#cf9f7e','#9ab8c9']
const AZUL_MEDICO='#80a8cf'
const semAcento=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export function clienteMedico(client:string) {
 const n=semAcento(client)
 return /\b(clinica|hospital|consultorio|odonto|medic)\b/.test(n)||/^dra?[.\s]/.test(n)
}
export function clientTone(client:string) {
 if(!client||client==='Identificar cliente')return '#6b7280'
 if(clienteMedico(client))return AZUL_MEDICO
 let h=0
 for(const ch of semAcento(client))h=(h*31+ch.charCodeAt(0))>>>0
 return TONS[h%TONS.length]
}

/** Mesma regra do servidor: numeração só vira ordem quando ela É a ordem. */
export function ordemDasLaminas<T extends {name?:string}>(assets:T[]):T[] {
 const esqueleto=(n:string)=>n.replace(/\d+/g,'#')
 const nomes=assets.map(a=>a.name||'')
 const numerados=nomes.every(n=>/\d/.test(n))&&new Set(nomes.map(esqueleto)).size===1
 if(!numerados||new Set(nomes).size!==nomes.length)return assets
 const comparador=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'})
 return assets.map((a,i)=>({a,i})).sort((x,y)=>comparador.compare(x.a.name||'',y.a.name||'')||x.i-y.i).map(x=>x.a)
}
