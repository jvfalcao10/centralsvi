import { handleSocialSync, socialSyncStatus } from './social-sync.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from './supabase.js'
import { publicCard, socialPatch, SocialError, type SocialCard, type SocialAsset } from './social-domain.js'

const fail = (status: number, message: string): never => { throw new SocialError(status, message) }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export async function handleSocial(req: VercelRequest, res: VercelResponse) {
 if (req.query.sync === 'run') return handleSocialSync(req,res)
 res.setHeader('Cache-Control', 'private, no-store')
 res.setHeader('X-Robots-Tag', 'noindex, nofollow')
 res.setHeader('Referrer-Policy', 'no-referrer')
 if (!['GET','POST'].includes(req.method || '')) return res.status(405).json({ error: 'Método não permitido.' })
 try {
  const db = createAdminClient()
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  let actor = ''; let actorId: string | null = null
  if (!token) {
   const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
   if (!bearer) fail(401, 'Entre na Central para acessar o quadro.')
   const { data, error } = await db.auth.getUser(bearer)
   if (error || !data.user) fail(401, 'Sua sessão expirou. Entre novamente.')
   const { data: roles, error: roleError } = await db.from('user_roles').select('role').eq('user_id', data.user.id)
   if (roleError || !roles?.some(r => ['admin','manager','seller','executor','traffic'].includes(r.role))) fail(403, 'Acesso restrito à equipe SVI.')
   const { data: profile } = await db.from('profiles').select('name').eq('user_id', data.user.id).maybeSingle()
   actorId = data.user.id; actor = profile?.name || data.user.email || 'Equipe SVI'
  } else if (!/^[a-f0-9]{64}$/.test(token)) fail(404, 'Este link não está disponível.')

  async function media<T extends { assets: SocialAsset[] }>(card: T, all = true): Promise<T> {
   const assets = (all ? card.assets : card.assets.slice(0,1)).filter(a=>a.storage!=='drive')
   const paths = assets.flatMap(a => [a.path, ...(a.thumbnail ? [a.thumbnail] : [])])
   if (!paths.length) return { ...card,assets:card.assets.map(a=>a.storage==='drive'&&/^[A-Za-z0-9_-]+$/.test(a.drive_id||'')?{...a,url:`https://drive.google.com/file/d/${a.drive_id}/view`}:a) }
   const { data, error } = await db.storage.from('central-social').createSignedUrls(paths, 3600)
   if (error) throw new Error('media_sign_failed')
   const urls = new Map(data?.map(a => [a.path, a.signedUrl] as const))
   return { ...card, assets: card.assets.map(a => (a.storage==='drive'&&/^[A-Za-z0-9_-]+$/.test(a.drive_id||'')?{...a,url:`https://drive.google.com/file/d/${a.drive_id}/view`}:{ ...a, url: urls.get(a.path), preview: urls.get(a.thumbnail || a.path) })) }
  }
  let card: SocialCard | null = null
  const id = typeof req.query.id === 'string' ? req.query.id : typeof req.body?.id === 'string' ? req.body.id : ''
  if (token || id) {
   let query = db.from('central_social_cards').select('*')
   query = token ? query.eq('token_hash', hash(token)) : query.eq('id', id)
   const { data, error } = await query.maybeSingle()
   if (error) throw error
   if (!data || (token && (!data.token_expires_at || Date.parse(data.token_expires_at) < Date.now()))) fail(404, 'Este link expirou ou foi substituído. Peça o link atualizado à equipe.')
   card = data as SocialCard
  }
  if (req.method === 'GET') {
   if (!token && req.query.sync === 'status') return res.json(await socialSyncStatus(db))
   if (card && token) return res.json({ card: await media(publicCard(card)) })
   if (card) {
    const { data: events, error } = await db.from('central_social_events').select('*').eq('card_id', card.id).order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    const { token_hash: _hash, ...safe } = card
    return res.json({ card: await media(safe), events })
   }
   const cards: SocialCard[] = []
   for (let offset=0;;offset+=500) {
    const { data, error } = await db.from('central_social_cards').select('*').order('source_updated', { ascending:false, nullsFirst:false }).order('id').range(offset,offset+499)
    if (error) throw error
    cards.push(...data); if (data.length<500) break
   }
   const paths = cards.map(c => { const a = c.assets.find(a=>a.id===c.selected_assets[0]) || c.assets[0]; return a?.storage==='drive'?null:a?.thumbnail || a?.path }).filter(Boolean) as string[]
   const { data: signed, error: signError } = paths.length ? await db.storage.from('central-social').createSignedUrls([...new Set(paths)], 3600) : { data:[], error:null }
   if (signError) throw signError
   const urls = new Map(signed?.map(a=>[a.path,a.signedUrl] as const))
   return res.json({ cards: cards.map(c=>{
    const { token_hash: _hash, source_description: _description, ...safe } = c
    const a = c.assets.find(a=>a.id===c.selected_assets[0]) || c.assets[0]
    return { ...safe, preview: a&&a.storage!=='drive' ? urls.get(a.thumbnail || a.path) : null }
   }), refreshed_at: new Date().toISOString() })
  }
  if (!card) fail(400, 'Selecione uma peça.')
  const body = req.body
  if (!body || typeof body !== 'object' || !Number.isInteger(body.version)) fail(400, 'Reabra a peça antes de salvar.')
  if (body.version !== card.version) fail(409, 'Esta peça mudou em outra tela. Reabra antes de salvar.')
  let action = typeof body.action === 'string' ? body.action : ''
  if (token) {
   if (card.stage !== 'aguardando') fail(409, 'Esta versão já recebeu uma resposta ou saiu de aprovação.')
   if (!['cliente_aprovar','cliente_ajustes'].includes(action)) fail(403, 'Ação não permitida neste link.')
   if (typeof body.name !== 'string' || body.name.trim().length < 2) fail(400, 'Informe seu nome para registrar a resposta.')
   actor = body.name.trim().slice(0,120)
  } else if (action.startsWith('cliente_')) fail(403, 'Use o registro de aprovação da equipe.')
  const patch: Record<string, unknown> = socialPatch(card, body)
  let approvalUrl: string | undefined
  if (action === 'solicitar') {
   const raw = randomBytes(32).toString('hex')
   patch.token_hash = hash(raw); patch.token_expires_at = new Date(Date.now()+30*86400000).toISOString()
   approvalUrl = `https://central.svicompany.com.br/aprovar/social/${raw}`
  }
  const { data, error } = await db.rpc('central_social_apply', { p_id: card.id, p_expected: body.version, p_patch: patch, p_action: action, p_actor: actor, p_actor_id: actorId })
  if (error) { if (error.message.includes('version_conflict')) fail(409, 'Outra pessoa acabou de atualizar esta peça. Reabra e confira.'); throw error }
  if (token) return res.json({ ok:true, card: publicCard(data as SocialCard) })
  return res.json({ ok:true, approval_url: approvalUrl })
 } catch (error) {
  if (error instanceof SocialError) return res.status(error.status).json({ error:error.message })
  console.error('Central social request failed', error instanceof Error ? error.message : 'database_error')
  return res.status(500).json({ error:'Não foi possível salvar ou carregar. Tente novamente.' })
 }
}
