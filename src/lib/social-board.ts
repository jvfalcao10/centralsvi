import { supabase } from '@/lib/supabase'
export type Asset = { id:string; name:string; path:string; storage?:'drive'; drive_id?:string; folder_url?:string; folder_label?:string; thumbnail?:string; duration_ms?:number; width?:number; height?:number; preview_retry_at?:string; type:string; bytes?:number; url?:string; preview?:string }
export type Card = {
 ingest_pending?:boolean; id:string; client:string; title:string; author:string; source_url:string; source_status:string; source_description?:string;
 source_updated:string; assets:Asset[]; selected_assets:string[]; caption:string; note:string; stage:string; revision:number; version:number;
 approved_by:string|null; approved_at:string|null; approval_evidence:string|null; scheduled_at:string|null; posted_at:string|null; posted_url:string|null; channel:string|null; preview?:string;
}
export const SOCIAL_STAGES = [
 {id:'conferir',label:'Conferir aprovação',color:'#c3a36b',hint:'Falta confirmar esta versão'},
 {id:'aguardando',label:'Aguardando cliente',color:'#80a8cf',hint:'Link de aprovação gerado'},
 {id:'ajustes',label:'Ajustes',color:'#df9279',hint:'Resolver antes de publicar'},
 {id:'aprovado',label:'Aprovado para postar',color:'#79b79b',hint:'Aprovação registrada'},
 {id:'agendado',label:'Agendado',color:'#ada0cf',hint:'Data definida pela equipe'},
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
