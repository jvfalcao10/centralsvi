import { approvalLink, newApprovalLink } from './social-approval-link.js'
import {clientReview,clientReviewCard,getClientLink,pendingClientCards} from './social-client.js'
import {socialMedia} from './social-media.js'
import { previewPath } from './social-preview.js'
import { feedbackContext, saveFeedbackRoute } from './social-feedback.js'
import { handleSocialPlayback } from './social-playback.js'
import { handleSocialSync, socialSyncStatus } from './social-sync.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { createAdminClient } from './supabase.js'
import { publicCard, socialPatch, socialMovePatch, SocialError, type SocialCard } from './social-domain.js'

const fail = (status: number, message: string): never => { throw new SocialError(status, message) }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export async function handleSocial(req: VercelRequest, res: VercelResponse) {
 if(req.query.stream==='1')return handleSocialPlayback(req,res)
 if (req.query.sync === 'run') return handleSocialSync(req,res)
 res.setHeader('Cache-Control', 'private, no-store')
 res.setHeader('X-Robots-Tag', 'noindex, nofollow')
 res.setHeader('Referrer-Policy', 'no-referrer')
 if (!['GET','POST'].includes(req.method || '')) return res.status(405).json({ error: 'Método não permitido.' })
 try {
  const db = createAdminClient()
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const bundle = typeof req.query.bundle === 'string' ? req.query.bundle : ''
  if(token&&bundle)fail(400,'Use apenas um link de aprovação.')
  const publicAccess=!!(token||bundle)
  let actor = ''; let actorId: string | null = null
  if (!publicAccess) {
   const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
   if (!bearer) fail(401, 'Entre na Central para acessar o quadro.')
   const { data, error } = await db.auth.getUser(bearer)
   if (error || !data.user) fail(401, 'Sua sessão expirou. Entre novamente.')
   const { data: roles, error: roleError } = await db.from('user_roles').select('role').eq('user_id', data.user.id)
   if (roleError || !roles?.some(r => ['admin','manager','seller','executor','traffic'].includes(r.role))) fail(403, 'Acesso restrito à equipe SVI.')
   const { data: profile } = await db.from('profiles').select('name').eq('user_id', data.user.id).maybeSingle()
   actorId = data.user.id; actor = profile?.name || data.user.email || 'Equipe SVI'
  } else if (!/^[a-f0-9]{64}$/.test(token||bundle)) fail(404, 'Este link não está disponível.')

  const media=<T extends {id:string;assets:SocialCard['assets']}>(card:T)=>socialMedia(db,card,{token,bundle})
  if(!publicAccess&&(req.query.bundle_link==='1'||req.body?.action==='client_link')){
   const client=typeof req.body?.client==='string'?req.body.client:typeof req.query.client==='string'?req.query.client:''
   return res.json({approval_url:await getClientLink(db,client,req.method==='POST')})
  }
  if(bundle&&req.method==='GET'){
   const review=await clientReview(db,bundle),pending=await pendingClientCards(db,review.client)
   return res.json({client:review.client,cards:await Promise.all(pending.map(c=>media(publicCard(c))))})
  }
  let card: SocialCard | null = null
  const id = typeof req.query.id === 'string' ? req.query.id : typeof req.body?.id === 'string' ? req.body.id : ''
  if(bundle){card=await clientReviewCard(db,bundle,id)}
  else if (token || id) {
   let query = db.from('central_social_cards').select('*')
   query = token ? query.eq('token_hash', hash(token)) : query.eq('id', id)
   const { data, error } = await query.maybeSingle()
   if (error) throw error
   if (!data || (token && (!data.token_expires_at || Date.parse(data.token_expires_at) < Date.now()))) fail(404, 'Este link expirou ou foi substituído. Peça o link atualizado à equipe.')
   card = data as SocialCard
  }
  if (req.method === 'GET') {
   if (!publicAccess && req.query.sync === 'status') return res.json(await socialSyncStatus(db))
   if (card && token) return res.json({ card: await media(publicCard(card)) })
   if (card) {
    const { data: events, error } = await db.from('central_social_events').select('*').eq('card_id', card.id).order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    const { token_hash: _hash, ...safe } = card
    return res.json({ card: await media(safe), events, feedback: await feedbackContext(db,card), approval_url: await approvalLink(db,card) })
   }
   const cards: SocialCard[] = []
   for (let offset=0;;offset+=500) {
    const { data, error } = await db.from('central_social_cards').select('*').order('source_updated', { ascending:false, nullsFirst:false }).order('id').range(offset,offset+499)
    if (error) throw error
    cards.push(...data); if (data.length<500) break
   }
   const paths = cards.map(c => { const a = c.assets.find(a=>a.id===c.selected_assets[0]) || c.assets[0]; return a?previewPath(a,true):null }).filter(Boolean) as string[]
   const { data: signed, error: signError } = paths.length ? await db.storage.from('central-social').createSignedUrls([...new Set(paths)], 3600) : { data:[], error:null }
   if (signError) throw signError
   const urls = new Map(signed?.map(a=>[a.path,a.signedUrl] as const))
   return res.json({ cards: cards.map(c=>{
    const { token_hash: _hash, source_description: _description, ...safe } = c
    const a = c.assets.find(a=>a.id===c.selected_assets[0]) || c.assets[0]
    return { ...safe, preview: a ? urls.get(previewPath(a,true)||'') : null }
   }), refreshed_at: new Date().toISOString() })
  }
  if (!card) fail(400, 'Selecione uma peça.')
  const body = req.body
  if (!body || typeof body !== 'object' || !Number.isInteger(body.version)) fail(400, 'Reabra a peça antes de salvar.')
  if (body.version !== card.version) fail(409, 'Esta peça mudou em outra tela. Reabra antes de salvar.')
  let action = typeof body.action === 'string' ? body.action : ''
  if (publicAccess) {
   if (card.stage !== 'aguardando') fail(409, 'Esta versão já recebeu uma resposta ou saiu de aprovação.')
   if (!['cliente_aprovar','cliente_ajustes','cliente_reprovar'].includes(action)) fail(403, 'Ação não permitida neste link.')
   if (typeof body.name !== 'string' || body.name.trim().length < 2) fail(400, 'Informe seu nome para registrar a resposta.')
   actor = body.name.trim().slice(0,120)
  } else if (action.startsWith('cliente_')) fail(403, 'Use o registro de aprovação da equipe.')
  if(!publicAccess&&action==='destino') {await saveFeedbackRoute(db,card,body,actor,actorId);return res.json({ok:true})}
  if(action==='solicitar'&&!body.renew&&card.stage==='aguardando') {const existing=await approvalLink(db,card);if(existing)return res.json({ok:true,approval_url:existing})}
  if(action==='mover'&&body.stage===card.stage)return res.json({ok:true})
  const patch: Record<string, unknown> = action==='mover' ? socialMovePatch(card,body.stage,actor) : socialPatch(card, body)
  let approvalUrl: string | undefined; let sealed: string | undefined
  if (action === 'solicitar' || (action==='mover'&&patch.stage==='aguardando')) {
   const link=newApprovalLink(card.id)
   patch.token_hash=link.hash;patch.token_expires_at=new Date(Date.now()+30*86400000).toISOString()
   approvalUrl=link.url;sealed=link.ciphertext
  }
  const { data, error } = bundle ? await db.rpc('central_social_client_answer',{p_hash:hash(bundle),p_id:card.id,p_expected:body.version,p_patch:patch,p_action:action,p_actor:actor}) : sealed ? await db.rpc('central_social_request_link',{p_id:card.id,p_expected:body.version,p_patch:patch,p_ciphertext:sealed,p_actor:actor,p_actor_id:actorId}) : await db.rpc('central_social_apply', { p_id: card.id, p_expected: body.version, p_patch: patch, p_action: action, p_actor: actor, p_actor_id: actorId })
  if (error) { if (error.message.includes('version_conflict')) fail(409, 'Outra pessoa acabou de atualizar esta peça. Reabra e confira.'); if(error.message.includes('link_unavailable'))fail(404,'Este link ou esta peça não está disponível. Atualize a página.'); throw error }
  if (publicAccess) return res.json({ ok:true, card: publicCard(data as SocialCard) })
  return res.json({ ok:true, approval_url: approvalUrl })
 } catch (error) {
  if (error instanceof SocialError) return res.status(error.status).json({ error:error.message })
  console.error('Central social request failed', error instanceof Error ? error.message : 'database_error')
  return res.status(500).json({ error:'Não foi possível salvar ou carregar. Tente novamente.' })
 }
}
