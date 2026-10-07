import type {SupabaseClient} from '@supabase/supabase-js'
import {generateSocialCaption} from './social-caption.js'
import {driveVideoRange} from './social-drive.js'
import type {SocialAsset,SocialCard} from './social-domain.js'

// Limite de upload da transcrição da OpenAI, com folga para o envelope multipart.
const LIMITE_AUDIO=24*1024*1024
// Teto de memória do processo. O maior vídeo do quadro hoje tem 325 MB.
const LIMITE_VIDEO=450*1024*1024
const MODELO_FALA=process.env.SOCIAL_TRANSCRIBE_MODEL||'gpt-4o-mini-transcribe'
const MODELO_VIDEO=process.env.SOCIAL_VIDEO_MODEL||'gemini-2.5-flash'
const GOOGLE='https://generativelanguage.googleapis.com'

/** Baixa o arquivo da peça, esteja ele no Drive ou no Storage. */
async function baixar(db:SupabaseClient,asset:SocialAsset,teto:number):Promise<Blob> {
 const bytes=Number(asset.bytes||0)
 if(bytes>teto)throw new Error('video_grande_demais')
 if(asset.storage==='drive'){
  if(!asset.drive_id)throw new Error('drive_id_missing')
  const r=await driveVideoRange(asset.drive_id,0,Math.max(0,(bytes||teto)-1))
  if(!r.ok)throw new Error('drive_download_failed')
  return r.blob()
 }
 const {data,error}=await db.storage.from('central-social').download(asset.path)
 if(error||!data)throw new Error('storage_download_failed')
 return data
}

/**
 * Lê e ouve o vídeo inteiro, sem limite de 25 MB.
 *
 * A API de transcrição da OpenAI aceita 25 MB, e os vídeos do quadro têm 116 MB
 * de média porque chegam como arquivo original, não comprimidos pelo WhatsApp.
 * Este caminho manda o vídeo inteiro e volta com a fala E o que aparece em cena,
 * que é o que falta para escrever legenda de peça falada.
 *
 * O arquivo é apagado do Google ao fim: é vídeo de cliente, não fica hospedado.
 */
export async function understandVideo(db:SupabaseClient,asset:SocialAsset):Promise<string> {
 const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('gemini_key_missing')
 const arquivo=await baixar(db,asset,LIMITE_VIDEO)
 const tipo=asset.type||'video/mp4'

 const inicio=await fetch(`${GOOGLE}/upload/v1beta/files?key=${key}`,{method:'POST',headers:{
  'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start',
  'X-Goog-Upload-Header-Content-Length':String(arquivo.size),'X-Goog-Upload-Header-Content-Type':tipo,
  'Content-Type':'application/json'},body:JSON.stringify({file:{display_name:'peca'}}),signal:AbortSignal.timeout(60000)})
 const destino=inicio.headers.get('x-goog-upload-url')
 if(!inicio.ok||!destino)throw new Error(`gemini_upload_start_${inicio.status}`)

 const envio=await fetch(destino,{method:'POST',headers:{
  'X-Goog-Upload-Command':'upload, finalize','X-Goog-Upload-Offset':'0','Content-Type':tipo},
  body:arquivo,signal:AbortSignal.timeout(180000)})
 if(!envio.ok)throw new Error(`gemini_upload_${envio.status}`)
 const {file}=await envio.json() as {file:{uri:string;name:string;state:string}}

 const apagar=()=>fetch(`${GOOGLE}/v1beta/${file.name}?key=${key}`,{method:'DELETE'}).catch(()=>{})
 try{
  // O vídeo só pode ser lido depois de processado do outro lado.
  let estado=file.state
  for(let i=0;i<30&&estado==='PROCESSING';i++){
   await new Promise(r=>setTimeout(r,2000))
   const r=await fetch(`${GOOGLE}/v1beta/${file.name}?key=${key}`,{signal:AbortSignal.timeout(20000)})
   if(!r.ok)throw new Error(`gemini_state_${r.status}`)
   estado=((await r.json()) as {state:string}).state
  }
  if(estado!=='ACTIVE')throw new Error('gemini_processing_timeout')

  const pedido={contents:[{parts:[
   {file_data:{mime_type:tipo,file_uri:file.uri}},
   {text:'Transcreva a fala deste vídeo em português do Brasil, com acentuação correta, na ordem em que é dita. Depois, em um parágrafo curto começando com "Cena:", descreva o que aparece: quem fala, onde está e qualquer texto escrito na tela. Não interprete, não resuma e não acrescente nada que não esteja no vídeo. Se não houver fala, escreva apenas a parte da cena.'},
  ]}],generationConfig:{temperature:0,maxOutputTokens:4000}}
  const r=await fetch(`${GOOGLE}/v1beta/models/${MODELO_VIDEO}:generateContent?key=${key}`,{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pedido),signal:AbortSignal.timeout(180000)})
  if(!r.ok)throw new Error(`gemini_http_${r.status}`)
  const data=await r.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]}
  const texto=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim()
  if(!texto)throw new Error('gemini_sem_resposta')
  return texto.slice(0,12000)
 }finally{void apagar()}
}

/**
 * Transcreve a fala do vídeo da peça.
 *
 * A API aceita mp4 e extrai o áudio sozinha, então não é preciso ffmpeg aqui,
 * que não existe no ambiente serverless. O arquivo vem do Storage ou do Drive,
 * conforme onde a peça foi guardada.
 */
export async function transcribeAsset(db:SupabaseClient,asset:SocialAsset):Promise<string> {
 const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('openai_key_missing')
 const arquivo=await baixar(db,asset,LIMITE_AUDIO)
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
/**
 * Escolhe como entender o vídeo.
 *
 * Com a chave do Gemini configurada, ele lê e ouve o vídeo inteiro, que é o
 * caminho que cobre os 116 MB de média do quadro. Sem ela, resta a transcrição
 * da OpenAI, que só aceita 25 MB e hoje atende 9 dos 70 vídeos.
 */
export async function lerVideo(db:SupabaseClient,asset:SocialAsset):Promise<string> {
 if(process.env.GEMINI_API_KEY)return understandVideo(db,asset)
 return transcribeAsset(db,asset)
}

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
   if(!fala&&video)fala=await lerVideo(db,video)
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
