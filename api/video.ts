import type {VercelRequest,VercelResponse} from '@vercel/node'
import {createAdminClient} from './_lib/supabase.js'
import {processApprovalVideos} from './_lib/social-approval-video.js'

/**
 * Função só para comprimir vídeo, separada de propósito.
 *
 * O binário do ffmpeg tem dezenas de megabytes. Se ele entrasse no roteador
 * `api/r.ts`, que atende o quadro, a aprovação do cliente e o streaming, toda
 * rota ficaria mais pesada para subir a frio. Aqui ele fica sozinho.
 */
export default async function handler(req:VercelRequest,res:VercelResponse) {
 res.setHeader('Cache-Control','private, no-store')
 const segredo=(process.env.CRON_SECRET||'').trim()
 if(!segredo)return res.status(503).json({ok:false,error:'cron_secret_ausente'})
 if((req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim()!==segredo)return res.status(401).json({ok:false,error:'nao_autorizado'})
 // 300s é o teto da função. O trabalho para antes para conseguir responder.
 const deadline=Date.now()+275000
 try{
  return res.json({ok:true,...await processApprovalVideos(createAdminClient(),deadline)})
 }catch(e){
  const motivo=e instanceof Error?e.message:'erro'
  console.error('Cópia leve de vídeo falhou',motivo)
  // A espera gravada no claim devolve o vídeo para a fila sozinha.
  return res.status(502).json({ok:false,error:motivo})
 }
}
