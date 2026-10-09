import {spawn} from 'node:child_process'
import {createWriteStream} from 'node:fs'
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises'
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

/**
 * Cópia leve do vídeo, só para aprovar.
 *
 * O arquivo que o editor entrega vem com bitrate de câmera. O vídeo da GM Gás
 * tinha 49,8s e 126,5 MB, ou seja 20,3 Mbps, e a Central entregava 6,6 Mbps ao
 * cliente: o player nunca alcançava o vídeo e ficava rodando sem sair do lugar.
 * Medido no arquivo real, 1080x1920 com crf 28 dá 7,4 MB e 1,24 Mbps, que cabe
 * folgado na banda do cliente e mantém a resolução cheia.
 *
 * O original não é tocado: ele continua sendo o que vai para o Instagram.
 */
function comprimir(entrada:string,saida:string,prazo:number) {
 return new Promise<void>((pronto,falhou)=>{
  if(!ffmpegPath)return falhou(new Error('ffmpeg_ausente'))
  const p=spawn(ffmpegPath,['-v','error','-y','-i',entrada,
   // Largura no teto de 1080 sem nunca ampliar, altura par pelo -2.
   '-vf',"scale='min(1080,iw)':-2",
   '-c:v','libx264','-preset','veryfast','-crf','28','-profile:v','high','-pix_fmt','yuv420p',
   '-c:a','aac','-b:a','96k','-ac','2',
   // faststart põe o índice no começo: sem isso o player baixa o arquivo todo
   // antes de mostrar o primeiro quadro, que é justamente o que se quer evitar.
   '-movflags','+faststart','-max_muxing_queue_size','1024',saida],{stdio:['ignore','ignore','pipe']})
  let erro=''
  p.stderr.on('data',d=>{erro=(erro+d).slice(-500)})
  const corta=setTimeout(()=>{p.kill('SIGKILL');falhou(new Error('ffmpeg_demorou'))},Math.max(15000,prazo))
  p.on('error',e=>{clearTimeout(corta);falhou(e)})
  p.on('close',code=>{clearTimeout(corta);code===0?pronto():falhou(new Error('ffmpeg_falhou: '+erro.slice(0,200)))})
 })
}

export async function processApprovalVideos(db:DB,deadline:number) {
 const {data,error}=await db.rpc('central_social_approval_claim')
 if(error)throw new Error('approval_claim_failed')
 const job=((data||[]) as {card_id:string;asset_id:string;asset_path:string;drive_id:string;bytes:number}[])[0]
 // A fila vazia é o estado normal depois que tudo foi convertido.
 if(!job)return {comprimidos:0,fila:'vazia'}
 const dir=await mkdtemp(join(tmpdir(),'aprovacao-'))
 try{
  const entrada=join(dir,'original.mp4'),saida=join(dir,'leve.mp4')
  const sobra=()=>deadline-Date.now()
  const resposta=await driveVideoFull(job.drive_id,Math.min(200000,Math.max(30000,sobra()-70000)))
  if(!resposta.ok||!resposta.body)throw new Error('drive_download_failed')
  await pipeline(Readable.fromWeb(resposta.body as never),createWriteStream(entrada))
  const baixado=(await stat(entrada)).size
  // Vídeo cortado no meio geraria uma cópia truncada que o cliente aprovaria
  // sem ver o fim. Melhor falhar e tentar de novo na próxima volta.
  if(baixado!==Number(job.bytes))throw new Error('drive_download_incompleto')

  await comprimir(entrada,saida,sobra()-25000)
  const leve=await readFile(saida)
  if(!leve.length)throw new Error('saida_vazia')
  const caminho=approvalPath(job.asset_path)
  const {error:erroUpload}=await db.storage.from('central-social')
   .upload(caminho,new Uint8Array(leve),{contentType:'video/mp4',cacheControl:'31536000',upsert:true})
  if(erroUpload)throw new Error('approval_storage_failed')
  const {error:erroBanco}=await db.rpc('central_social_asset_approval',
   {p_card_id:job.card_id,p_asset_id:job.asset_id,p_asset_path:job.asset_path,p_patch:{approval_path:caminho}})
  if(erroBanco)throw new Error('approval_database_failed')
  return {comprimidos:1,card:job.card_id,de:baixado,para:leve.length}
 }finally{
  // A espera de 10 minutos já foi gravada no claim, então uma falha aqui volta
  // para a fila sozinha, sem precisar de outro registro.
  await rm(dir,{recursive:true,force:true}).catch(()=>{})
 }
}
