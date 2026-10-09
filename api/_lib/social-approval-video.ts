import {spawn} from 'node:child_process'
import {createWriteStream} from 'node:fs'
import {mkdtemp,readFile,readdir,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import ffmpegPath from 'ffmpeg-static'
import type {createAdminClient} from './supabase.js'
import {digest} from './social-sync-domain.js'
import {driveVideoFull} from './social-drive.js'
type DB=ReturnType<typeof createAdminClient>

export const approvalPath=(assetPath:string)=>`approval/${digest(assetPath)}.mp4`
export const framePath=(assetPath:string,n:number)=>`frames/${digest(assetPath)}-${String(n).padStart(2,'0')}.jpg`
const QUADROS=10

/**
 * Um quadro a cada 4 segundos, no máximo dez.
 *
 * Em muito reel a mensagem está escrita na tela, com música ao fundo e sem
 * fala. A transcrição não enxerga esse texto; os quadros enxergam. Dez quadros
 * cobrem 40 segundos, que é a duração da maioria das peças da casa.
 */
const FILTRO_QUADROS="select='isnan(prev_selected_t)+gte(t-prev_selected_t,4)',scale=-2:640"

function rodarFfmpeg(args:string[],prazo:number) {
 return new Promise<void>((pronto,falhou)=>{
  if(!ffmpegPath)return falhou(new Error('ffmpeg_ausente'))
  const p=spawn(ffmpegPath,args,{stdio:['ignore','ignore','pipe']})
  let erro=''
  p.stderr.on('data',d=>{erro=(erro+d).slice(-500)})
  const corta=setTimeout(()=>{p.kill('SIGKILL');falhou(new Error('ffmpeg_demorou'))},Math.max(15000,prazo))
  p.on('error',e=>{clearTimeout(corta);falhou(e)})
  p.on('close',code=>{clearTimeout(corta);code===0?pronto():falhou(new Error('ffmpeg_falhou: '+erro.slice(0,200)))})
 })
}

/** Compressão e quadros no mesmo passe: o arquivo já está aberto. */
const ARGS_COMPRIMIR=(entrada:string,saida:string,quadros:string)=>['-v','error','-y','-i',entrada,
 // Largura no teto de 1080 sem nunca ampliar, altura par pelo -2.
 '-vf',"scale='min(1080,iw)':-2",
 '-c:v','libx264','-preset','veryfast','-crf','28','-profile:v','high','-pix_fmt','yuv420p',
 '-c:a','aac','-b:a','96k','-ac','2',
 // faststart põe o índice no começo: sem isso o player baixa o arquivo todo
 // antes de mostrar o primeiro quadro, que é justamente o que se quer evitar.
 '-movflags','+faststart','-max_muxing_queue_size','1024',saida,
 '-vf',FILTRO_QUADROS,'-vsync','vfr','-frames:v',String(QUADROS),'-q:v','4',quadros]

const ARGS_SO_QUADROS=(entrada:string,quadros:string)=>['-v','error','-y','-i',entrada,
 '-vf',FILTRO_QUADROS,'-vsync','vfr','-frames:v',String(QUADROS),'-q:v','4',quadros]

/**
 * Cópia leve do vídeo para aprovar, e os quadros que a legenda vai ler.
 *
 * O arquivo que o editor entrega vem com bitrate de câmera. O vídeo da GM Gás
 * tinha 49,8s e 126,5 MB, ou seja 20,3 Mbps, e a Central entregava 6,6 Mbps ao
 * cliente: o player nunca alcançava o vídeo. Medido no arquivo real, 1080x1920
 * com crf 28 dá 7,4 MB e 1,24 Mbps.
 *
 * O original não é tocado: ele continua sendo o que vai para o Instagram.
 */
export async function processApprovalVideos(db:DB,deadline:number) {
 const {data,error}=await db.rpc('central_social_approval_claim')
 if(error)throw new Error('approval_claim_failed')
 const job=((data||[]) as {card_id:string;asset_id:string;asset_path:string;drive_id:string;bytes:number;approval_path:string|null}[])[0]
 // A fila vazia é o estado normal depois que tudo foi convertido.
 if(!job)return {comprimidos:0,fila:'vazia'}
 const dir=await mkdtemp(join(tmpdir(),'aprovacao-'))
 try{
  const entrada=join(dir,'original.mp4'),saida=join(dir,'leve.mp4'),quadros=join(dir,'q-%02d.jpg')
  const sobra=()=>deadline-Date.now()
  const patch:Record<string,unknown>={}
  let de=0,para=0

  if(job.approval_path){
   // Só faltam os quadros. Baixar a cópia de 7 MB do Supabase é muito mais
   // barato que buscar o original de 126 MB no Drive outra vez.
   const {data:arquivo,error:erroLeitura}=await db.storage.from('central-social').download(job.approval_path)
   if(erroLeitura||!arquivo)throw new Error('copia_leve_indisponivel')
   await pipeline(Readable.fromWeb(arquivo.stream() as never),createWriteStream(saida))
   await rodarFfmpeg(ARGS_SO_QUADROS(saida,quadros),sobra()-25000)
   para=(await stat(saida)).size
  }else{
   const resposta=await driveVideoFull(job.drive_id,Math.min(200000,Math.max(30000,sobra()-70000)))
   if(!resposta.ok||!resposta.body)throw new Error('drive_download_failed')
   await pipeline(Readable.fromWeb(resposta.body as never),createWriteStream(entrada))
   de=(await stat(entrada)).size
   // Vídeo cortado no meio geraria uma cópia truncada que o cliente aprovaria
   // sem ver o fim. Melhor falhar e tentar de novo na próxima volta.
   if(de!==Number(job.bytes))throw new Error('drive_download_incompleto')
   await rodarFfmpeg(ARGS_COMPRIMIR(entrada,saida,quadros),sobra()-25000)
   const leve=await readFile(saida)
   if(!leve.length)throw new Error('saida_vazia')
   para=leve.length
   const caminho=approvalPath(job.asset_path)
   const {error:erroUpload}=await db.storage.from('central-social')
    .upload(caminho,new Uint8Array(leve),{contentType:'video/mp4',cacheControl:'31536000',upsert:true})
   if(erroUpload)throw new Error('approval_storage_failed')
   patch.approval_path=caminho
  }

  const achados=(await readdir(dir)).filter(f=>f.startsWith('q-')&&f.endsWith('.jpg')).sort()
  let enviados=0
  for(const [i,nome] of achados.slice(0,QUADROS).entries()){
   const bytes=await readFile(join(dir,nome))
   const {error:erroQuadro}=await db.storage.from('central-social')
    .upload(framePath(job.asset_path,i+1),new Uint8Array(bytes),{contentType:'image/jpeg',cacheControl:'31536000',upsert:true})
   if(erroQuadro)break
   enviados++
  }
  // Zero quadros é resposta válida e precisa ser gravada: sem isso a peça volta
  // para a fila para sempre tentando o mesmo vídeo.
  patch.frames=enviados

  const {error:erroBanco}=await db.rpc('central_social_asset_approval',
   {p_card_id:job.card_id,p_asset_id:job.asset_id,p_asset_path:job.asset_path,p_patch:patch})
  if(erroBanco)throw new Error('approval_database_failed')
  return {comprimidos:job.approval_path?0:1,quadros:enviados,card:job.card_id,de,para}
 }finally{
  // A espera de 10 minutos já foi gravada no claim, então uma falha aqui volta
  // para a fila sozinha, sem precisar de outro registro.
  await rm(dir,{recursive:true,force:true}).catch(()=>{})
 }
}
