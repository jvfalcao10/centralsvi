import {randomUUID} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {SocialError} from './social-domain.js'

const TIPOS=/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime))$/
/** Teto do bucket no plano atual. Acima disso o upload falha calado. */
const TETO=50*1024*1024
// Peça nova nunca entra em Enviar pra aprovação: de lá a Sofia manda sozinha
// ao grupo do cliente. Entra em 'interna' para o time ver antes (João, 15/10/2026).
const ETAPAS=['interna','aguardando','ajustes','aprovado','agendado'] as const

const limpo=(v:unknown,max:number)=>typeof v==='string'?v.trim().replace(/\s+/g,' ').slice(0,max):''
const semAcento=(v:string)=>v.normalize('NFD').replace(/[̀-ͯ]/g,'')
const apelido=(v:string)=>semAcento(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)

/**
 * Endereço para o navegador subir o arquivo direto no Supabase.
 *
 * O arquivo NÃO passa pela função: a Vercel aceita corpo de cerca de 4,5 MB e
 * vídeo de cliente passa muito disso. O navegador recebe um endereço assinado,
 * sobe direto e depois só avisa o caminho.
 */
export async function enderecoDeUpload(db:SupabaseClient,body:Record<string,unknown>) {
 const nome=limpo(body.nome,120)
 const tipo=limpo(body.tipo,60)
 const bytes=Number(body.bytes)
 if(!nome)throw new SocialError(400,'Arquivo sem nome.')
 if(!TIPOS.test(tipo))throw new SocialError(400,'Formato não aceito. Envie imagem JPG, PNG ou WebP, ou vídeo MP4.')
 if(!Number.isFinite(bytes)||bytes<=0)throw new SocialError(400,'Arquivo vazio.')
 if(bytes>TETO)throw new SocialError(400,'Arquivo acima de 50 MB. Exporte em H.264 por volta de 6 Mbps e envie de novo.')

 const extensao=(nome.match(/\.[A-Za-z0-9]{2,5}$/)?.[0]||'').toLowerCase()
 const caminho=`manual/${randomUUID()}${extensao}`
 const {data,error}=await db.storage.from('central-social').createSignedUploadUrl(caminho)
 if(error||!data)throw new SocialError(503,'Não foi possível preparar o envio. Tente de novo.')
 return {caminho,url:data.signedUrl,token:data.token}
}

/**
 * Cria a peça no quadro a partir de arquivos já enviados.
 *
 * Nem toda peça nasce no ClickUp ou no WhatsApp: arte que a casa gera e
 * hospeda ficava fora do quadro e virava trabalho invisível. Aqui ela entra
 * pela mesma porta das outras, com cliente, título e etapa.
 */
export async function criarPecaManual(db:SupabaseClient,body:Record<string,unknown>,actor:string) {
 const client=limpo(body.client,120)
 const title=limpo(body.title,200)
 const stage=ETAPAS.includes(body.stage as typeof ETAPAS[number])?String(body.stage):'interna'
 if(client.length<2)throw new SocialError(400,'Escolha o cliente.')
 if(title.length<3)throw new SocialError(400,'Dê um título à peça.')

 const brutos=Array.isArray(body.arquivos)?body.arquivos:[]
 if(!brutos.length)throw new SocialError(400,'Envie pelo menos um arquivo.')
 if(brutos.length>10)throw new SocialError(400,'No máximo dez arquivos por peça.')

 const assets=brutos.map((a:Record<string,unknown>,i:number)=>{
  const caminho=limpo(a.caminho,200),tipo=limpo(a.tipo,60),nome=limpo(a.nome,120)
  if(!caminho.startsWith('manual/'))throw new SocialError(400,'Arquivo inválido.')
  if(!TIPOS.test(tipo))throw new SocialError(400,'Formato não aceito.')
  return {id:`${i+1}-${caminho.slice(7,43)}`,name:nome||`arquivo ${i+1}`,path:caminho,type:tipo,
   bytes:Number.isFinite(Number(a.bytes))?Number(a.bytes):0}
 })

 // Conferir que cada arquivo chegou mesmo. Sem isto, uma falha no envio criaria
 // card vazio, que é pior do que não criar: alguém confia que a peça está lá.
 // Um por um, e não listando a pasta: listagem tem teto e passaria a falhar
 // calada quando a pasta crescer.
 const conferidos=await Promise.all(assets.map(async a=>{
  const {data,error}=await db.storage.from('central-social').info(a.path)
  return {a,ok:!error&&!!data}
 }))
 if(conferidos.some(c=>!c.ok))throw new SocialError(409,'O envio de algum arquivo não terminou. Tente de novo.')

 const hoje=new Date(Date.now()-3*3600000).toISOString().slice(0,10).replace(/-/g,'')
 const id=`manual-${hoje}-${apelido(title)||randomUUID().slice(0,8)}-${randomUUID().slice(0,4)}`

 const {data,error}=await db.from('central_social_cards').insert({
  id,client,title,author:actor,source_url:'',source_status:'manual',
  source_description:`Peça adicionada na Central por ${actor}.`,
  assets,selected_assets:assets.map(a=>a.id),stage,
 }).select('id').single()
 if(error)throw new SocialError(409,'Não foi possível criar a peça. Confira se o título já existe.')
 return {ok:true,id:data.id}
}
