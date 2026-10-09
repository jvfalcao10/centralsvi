import type {SupabaseClient} from '@supabase/supabase-js'
import {generateSocialCaption} from './social-caption.js'
import {driveVideoRange} from './social-drive.js'
import {lerQuadros} from './social-claude.js'
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
 // A cópia leve tem cerca de 7 MB; o original tem 116 MB de média e não passa
 // no limite de 25 MB da transcrição. Era por isso que só 9 dos 70 vídeos do
 // quadro conseguiam ser transcritos.
 if(asset.approval_path){
  const {data,error}=await db.storage.from('central-social').download(asset.approval_path)
  if(!error&&data)return data
 }
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
export async function understandVideo(db:SupabaseClient,asset:SocialAsset,prazo=Date.now()+240000):Promise<string> {
 const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('gemini_key_missing')
 // Os limites eram por etapa e a soma estourava o teto da função: baixar 20s +
 // abrir 30s + enviar 140s + ler 170s dá 360s dentro dos limites individuais.
 // Agora todas as etapas dividem o mesmo prazo e param juntas.
 const resta=(reserva=0)=>{const ms=prazo-Date.now()-reserva;if(ms<=1000)throw new Error('sem_tempo_na_volta');return ms}
 const arquivo=await baixar(db,asset,LIMITE_VIDEO)
 const tipo=asset.type||'video/mp4'

 const inicio=await fetch(`${GOOGLE}/upload/v1beta/files?key=${key}`,{method:'POST',headers:{
  'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start',
  'X-Goog-Upload-Header-Content-Length':String(arquivo.size),'X-Goog-Upload-Header-Content-Type':tipo,
  'Content-Type':'application/json'},body:JSON.stringify({file:{display_name:'peca'}}),signal:AbortSignal.timeout(Math.min(60000,resta(20000)))})
 const destino=inicio.headers.get('x-goog-upload-url')
 if(!inicio.ok||!destino)throw new Error(`gemini_upload_start_${inicio.status}`)

 const envio=await fetch(destino,{method:'POST',headers:{
  'X-Goog-Upload-Command':'upload, finalize','X-Goog-Upload-Offset':'0','Content-Type':tipo},
  body:arquivo,signal:AbortSignal.timeout(Math.min(180000,resta(20000)))})
 if(!envio.ok)throw new Error(`gemini_upload_${envio.status}`)
 const {file}=await envio.json() as {file:{uri:string;name:string;state:string}}

 // `void apagar()` deixava o processo terminar antes do apagamento. Vídeo de
 // cliente não fica hospedado fora: o apagamento tem prazo próprio e é esperado.
 const apagar=async()=>{try{await fetch(`${GOOGLE}/v1beta/${file.name}?key=${key}`,{method:'DELETE',signal:AbortSignal.timeout(15000)})}catch{/* o Google expira em 48h */}}
 try{
  // O vídeo só pode ser lido depois de processado do outro lado.
  let estado=file.state
  for(let i=0;i<30&&estado==='PROCESSING';i++){
   await new Promise(r=>setTimeout(r,2000))
   const r=await fetch(`${GOOGLE}/v1beta/${file.name}?key=${key}`,{signal:AbortSignal.timeout(Math.min(20000,resta(15000)))})
   if(!r.ok)throw new Error(`gemini_state_${r.status}`)
   estado=((await r.json()) as {state:string}).state
  }
  if(estado!=='ACTIVE')throw new Error('gemini_processing_timeout')

  const pedido={contents:[{parts:[
   {file_data:{mime_type:tipo,file_uri:file.uri}},
   {text:'Comece direto, sem introdução e sem aspas: nada de "aqui está a transcrição". Primeiro, transcreva a fala deste vídeo em português do Brasil, com acentuação correta, na ordem em que é dita. Se não houver fala, escreva apenas: SEM FALA. Depois, em "Texto na tela:", copie PALAVRA POR PALAVRA tudo que aparece escrito no vídeo, na ordem em que aparece, incluindo legendas, títulos e letreiros. Em muitos reels a mensagem inteira está só no texto da tela, com música ao fundo, e sem isso não dá para escrever a legenda. Por fim, em "Cena:", descreva em um parágrafo curto quem aparece, onde está e o que faz. Não interprete, não resuma e não acrescente nada que não esteja no vídeo.'},
  ]}],generationConfig:{temperature:0,maxOutputTokens:8000}}
  const r=await fetch(`${GOOGLE}/v1beta/models/${MODELO_VIDEO}:generateContent?key=${key}`,{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pedido),signal:AbortSignal.timeout(Math.min(180000,resta(15000)))})
  if(!r.ok)throw new Error(`gemini_http_${r.status}`)
  const data=await r.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]}
  const bruto=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim()
  if(!bruto)throw new Error('gemini_sem_resposta')
  // Visto no teste com o vídeo do Dr. Felipe: o modelo abriu com "Aqui está a
  // transcrição da fala do vídeo:". Isso viraria frase na legenda do cliente.
  const texto=bruto.replace(/^[^\n]{0,120}?transcri[çc][ãa]o[^\n]{0,80}?:\s*/i,'').replace(/^["“']+|["”']+$/g,'').trim()
  return (texto||bruto).slice(0,12000)
 }finally{await apagar()}
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
export async function lerVideo(db:SupabaseClient,asset:SocialAsset,prazo?:number):Promise<string> {
 // Caminho preferido: o que se VÊ sai dos quadros, que já existem porque saem
 // do mesmo passe da cópia leve, e o que se OUVE sai da transcrição da cópia,
 // que agora cabe no limite de 25 MB. Nenhum dos dois depende de fila de cota,
 // que é o que derrubava Dr. Felipe, Christo Rei e Dr. Daniel.
 const comClaude=!!(process.env.SOCIAL_VISION_KEY||process.env.ANTHROPIC_API_KEY)
 // Vídeo do Drive ainda sem quadros, com o Claude ligado: o passe que gera os
 // quadros roda de 2 em 2 minutos, então vale esperar. Tentar pelo Gemini aqui
 // gastaria uma das três tentativas num caminho que já sabemos que falha, que
 // foi exatamente como nove peças desistiram.
 if(comClaude&&asset.storage==='drive'&&!Number(asset.frames||0))throw new Error('aguardando_quadros')
 if(Number(asset.frames||0)&&comClaude){
  // Os quadros vêm primeiro: são baratos, e se o teto de uso bater aqui a peça
  // volta inteira para a fila sem pagar o custo da transcrição.
  const visual=await lerQuadros(db,asset,prazo)
  let fala='',transcreveu=false
  try{fala=(await transcribeAsset(db,asset)).trim();transcreveu=true}catch{/* o texto da tela já basta para muita peça */}
  // 'SEM FALA' só quando a transcrição RODOU e voltou vazia. Dizer isso depois
  // de uma falha seria afirmar que o vídeo é mudo sem ter ouvido.
  return [transcreveu?(fala||'SEM FALA'):'',visual].filter(Boolean).join('\n').slice(0,12000)
 }
 if(process.env.GEMINI_API_KEY)return understandVideo(db,asset,prazo)
 return transcribeAsset(db,asset)
}

export async function processCaptions(db:SupabaseClient,max=2,prazo=Date.now()+240000) {
 const feitas:{id:string;status:string}[]=[]
 for(let i=0;i<max;i++){
  // Entender um vídeo leva mais de um minuto: sem tempo, nem começa.
  if(prazo-Date.now()<70000)break
  const {data:card,error}=await db.rpc('central_social_caption_next')
  if(error||!card)break
  const peca=card as SocialCard&{transcript?:string|null}
  try{
   const escolhidos=(peca.assets||[]).filter(a=>peca.selected_assets.includes(a.id))
   const video=escolhidos.find(a=>a.type.startsWith('video/'))
   let fala=(peca.transcript||'').trim()
   if(!fala&&video)fala=await lerVideo(db,video,prazo)
   const pesado=!!video&&!(peca.transcript||'').trim()
   // A leitura do vídeo é a parte cara. Guarda antes de tentar a legenda, para
   // que uma falha na escrita não jogue fora o que já foi entendido.
   if(fala&&!(peca.transcript||'').trim())
    try{await db.rpc('central_social_caption_write',{p_id:peca.id,p_caption:'',p_transcript:fala})}catch{/* segue para a legenda */}
   const resultado=await generateSocialCaption(db,peca,{brief:fala},'esteira',{transcript:fala,automatic:true})
   if(!resultado.caption){
    try{await db.rpc('central_social_caption_fail',{p_id:peca.id,p_motivo:'A IA pediu contexto: '+(resultado.needs_context||'sem detalhe')})}catch{/* diagnóstico */}
    feitas.push({id:peca.id,status:'sem_contexto'});continue
   }
   const {error:gravou}=await db.rpc('central_social_caption_write',{p_id:peca.id,p_caption:resultado.caption,p_transcript:fala})
   feitas.push({id:peca.id,status:gravou?'erro_ao_gravar':'escrita'})
   if(pesado)break
  }catch(e){
   // Sem registrar o motivo, peça que desiste depois de três tentativas vira
   // mistério: era o que acontecia com 13 peças.
   const motivo=String((e as Error)?.message||e||'falhou')
   // 429 é teto de uso da API, não defeito da peça. Gastar tentativa aqui faria
   // a peça desistir por causa de um minuto cheio, que foi o que aconteceu com
   // 13 peças. Ela volta inteira para a fila e a volta termina aqui.
   // Saldo zerado, chave inválida ou sem permissão são problema de configuração,
   // não da peça. Se gastassem tentativa, todas as peças desistiriam antes de
   // alguém trocar a chave, e aí a fila estaria vazia pelo motivo errado.
   const configuracao=/credit balance|claude_http_401|claude_http_403|_key_missing/i.test(motivo)
   const esperando=configuracao||/_429|_503|_504|aguardando_quadros/.test(motivo)
   try{await db.rpc('central_social_caption_fail',{p_id:peca.id,p_motivo:motivo==='aguardando_quadros'?'Preparando os quadros do vídeo para escrever a legenda.':configuracao?'Conta de IA sem saldo ou chave inválida. Avise o João.':esperando?'Limite de uso da API, tenta de novo sozinho: '+motivo:motivo})}catch{/* diagnóstico não derruba a esteira */}
   if(esperando)try{await db.rpc('central_social_caption_retry',{p_id:peca.id})}catch{/* a peça só perde esta tentativa */}
   feitas.push({id:peca.id,status:motivo.slice(0,80)})
   if(esperando)break
  }
 }
 return {captions:feitas.length,results:feitas}
}
