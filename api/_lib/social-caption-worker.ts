import type {SupabaseClient} from '@supabase/supabase-js'
import {generateSocialCaption} from './social-caption.js'
import {driveVideoRange} from './social-drive.js'
import type {SocialAsset,SocialCard} from './social-domain.js'

// Limite de upload da transcrição da OpenAI, com folga para o envelope multipart.
const LIMITE_AUDIO=24*1024*1024
const MODELO_FALA=process.env.SOCIAL_TRANSCRIBE_MODEL||'gpt-4o-mini-transcribe'

/**
 * Transcreve a fala do vídeo da peça.
 *
 * A API aceita mp4 e extrai o áudio sozinha, então não é preciso ffmpeg aqui,
 * que não existe no ambiente serverless. O arquivo vem do Storage ou do Drive,
 * conforme onde a peça foi guardada.
 */
export async function transcribeAsset(db:SupabaseClient,asset:SocialAsset):Promise<string> {
 const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('openai_key_missing')
 const bytes=Number(asset.bytes||0)
 if(bytes>LIMITE_AUDIO)throw new Error('video_grande_demais')

 let arquivo:Blob
 if(asset.storage==='drive'){
  if(!asset.drive_id)throw new Error('drive_id_missing')
  const r=await driveVideoRange(asset.drive_id,0,Math.max(0,(bytes||LIMITE_AUDIO)-1))
  if(!r.ok)throw new Error('drive_download_failed')
  arquivo=await r.blob()
 }else{
  const {data,error}=await db.storage.from('central-social').download(asset.path)
  if(error||!data)throw new Error('storage_download_failed')
  arquivo=data
 }
 if(arquivo.size>LIMITE_AUDIO)throw new Error('video_grande_demais')

 const form=new FormData()
 form.append('file',arquivo,asset.name||'video.mp4')
 form.append('model',MODELO_FALA)
 form.append('language','pt')
 const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{
  method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(180000),
 })
 if(!r.ok)throw new Error(`transcribe_http_${r.status}`)
 const data=await r.json() as {text?:string}
 return String(data.text||'').trim().slice(0,12000)
}

/**
 * Escreve a legenda das peças que entraram sem legenda.
 *
 * Roda junto do resto da esteira, no mesmo ciclo que já importa arquivos e gera
 * prévias. Cada peça sai com a legenda marcada como rascunho de IA; o aviso só
 * cai quando uma pessoa salva a peça, que é o gesto de revisão.
 *
 * Uma peça que falha três vezes sai da fila sozinha, porque a tentativa é
 * contada no momento de reivindicar. Falha aqui nunca derruba a esteira: a
 * legenda é um ganho, a importação do arquivo é que é obrigação.
 */
export async function processCaptions(db:SupabaseClient,max=2) {
 const feitas:{id:string;status:string}[]=[]
 for(let i=0;i<max;i++){
  const {data:card,error}=await db.rpc('central_social_caption_next')
  if(error||!card)break
  const peca=card as SocialCard&{transcript?:string|null}
  try{
   const escolhidos=(peca.assets||[]).filter(a=>peca.selected_assets.includes(a.id))
   const video=escolhidos.find(a=>a.type.startsWith('video/'))
   let fala=(peca.transcript||'').trim()
   if(!fala&&video)fala=await transcribeAsset(db,video)
   const resultado=await generateSocialCaption(db,peca,{brief:fala},'esteira',{transcript:fala,automatic:true})
   if(!resultado.caption){feitas.push({id:peca.id,status:'sem_contexto'});continue}
   const {error:gravou}=await db.rpc('central_social_caption_write',{p_id:peca.id,p_caption:resultado.caption,p_transcript:fala})
   feitas.push({id:peca.id,status:gravou?'erro_ao_gravar':'escrita'})
  }catch(e){
   // Guarda a transcrição mesmo quando a legenda falhar: ela custou tempo e
   // dinheiro, e na próxima volta a peça já começa com a fala em mãos.
   feitas.push({id:peca.id,status:String((e as Error).message||'falhou').slice(0,60)})
  }
 }
 return {captions:feitas.length,results:feitas}
}
