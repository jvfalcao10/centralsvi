import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createAdminClient } from './supabase.js'
import { approvalLink, newApprovalLink } from './social-approval-link.js'
import { socialPatch, SocialError, type SocialCard } from './social-domain.js'

// O robô de entrega no WhatsApp não tem sessão de pessoa, então entra pela mesma
// chave de máquina do sync. Ele manda o id da tarefa do ClickUp e recebe de volta
// o link daquela peça, já com o card em "Aguardando cliente". É isso que troca o
// envio de imagem por imagem no grupo por um link só, com prévia da arte.

function authorized(req: VercelRequest) {
 const configured = process.env.SOCIAL_SYNC_SECRET || ''
 const provided = String(req.headers['x-social-sync-key'] || '')
 if (!configured || Buffer.byteLength(provided) !== Buffer.byteLength(configured)) return false
 return timingSafeEqual(Buffer.from(provided), Buffer.from(configured))
}

// O card nasce com o id da própria tarefa do ClickUp; o source_url é a rede de
// segurança para cards antigos, importados antes dessa convenção.
async function findCard(db: ReturnType<typeof createAdminClient>, task: string) {
 const byId = await db.from('central_social_cards').select('*').eq('id', task).maybeSingle()
 if (byId.error) throw new Error('card_read_failed')
 if (byId.data) return byId.data as SocialCard
 const byUrl = await db.from('central_social_cards').select('*').eq('source_url', `https://app.clickup.com/t/${task}`).maybeSingle()
 if (byUrl.error) throw new Error('card_read_failed')
 return (byUrl.data as SocialCard) || null
}

export async function handleSocialRobot(req: VercelRequest, res: VercelResponse) {
 res.setHeader('Cache-Control', 'private, no-store')
 res.setHeader('X-Robots-Tag', 'noindex, nofollow')
 if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' })
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }
 try {
  const task = String(req.body?.task || '').trim()
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(task)) return res.status(400).json({ error: 'Informe a tarefa do ClickUp.' })
  const db = createAdminClient()
  const card = await findCard(db, task)
  // A peça pode ainda não ter sido importada, ou ter travado na identificação do
  // cliente. Nos dois casos o robô precisa saber para não mandar link quebrado.
  if (!card) return res.status(404).json({ error: 'peca_nao_esta_na_central', task })
  if (card.ingest_pending) return res.status(409).json({ error: 'importacao_incompleta', task })
  if (!card.client || card.client === 'Identificar cliente') return res.status(409).json({ error: 'cliente_nao_identificado', task })
  if (!card.selected_assets.length) return res.status(409).json({ error: 'peca_sem_arquivo', task })

  const resumo = {
   card: card.id,
   client: card.client,
   title: card.title,
   revision: card.revision,
   files: card.selected_assets.length,
   video: card.assets.some(a => card.selected_assets.includes(a.id) && a.type.startsWith('video/')),
  }

  // Já está com o cliente e o link segue válido: devolve o mesmo endereço em vez
  // de rodar outro, para o cliente não receber dois links da mesma peça.
  if (card.stage === 'aguardando') {
   const existing = await approvalLink(db, card)
   if (existing) return res.json({ ...resumo, approval_url: existing, reused: true })
  }

  const link = newApprovalLink(card.id)
  const patch: Record<string, unknown> = {
   ...socialPatch(card, { action: 'solicitar' }),
   token_hash: link.hash,
   token_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  }
  const { error } = await db.rpc('central_social_request_link', {
   p_id: card.id, p_expected: card.version, p_patch: patch,
   p_ciphertext: link.ciphertext, p_actor: 'Robô de entrega · WhatsApp', p_actor_id: null,
  })
  if (error) {
   if (error.message.includes('version_conflict')) return res.status(409).json({ error: 'peca_mudou_agora', task })
   throw error
  }
  return res.json({ ...resumo, approval_url: link.url, reused: false })
 } catch (error) {
  if (error instanceof SocialError) return res.status(error.status).json({ error: error.message })
  return res.status(503).json({ error: 'central_indisponivel' })
 }
}
