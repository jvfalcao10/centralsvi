import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createAdminClient } from './_lib/supabase.js'
import { cobrarAjustes } from './_lib/social-cobranca.js'

/**
 * Chamada diária das peças em ajuste que não voltaram com arquivo novo.
 *
 * Roda às 8h30 de Brasília, de segunda a sexta, pelo cron da Vercel. Uma
 * mensagem por grupo de designer e uma consolidada para o João.
 */
async function whats(jid: string, texto: string) {
 const token = process.env.SOCIAL_UAZ_TOKEN || ''
 if (!token) throw new Error('uaz_token_ausente')
 const r = await fetch('https://svicompany.uazapi.com/send/text', {
  method: 'POST', headers: { token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ number: jid, text: texto, linkPreview: false, readchat: false, readmessages: false, async: false }),
  signal: AbortSignal.timeout(20000),
 })
 if (!r.ok) throw new Error(`uaz_${r.status}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
 res.setHeader('Cache-Control', 'private, no-store')
 const segredo = (process.env.CRON_SECRET || '').trim()
 if (!segredo) return res.status(503).json({ ok: false, error: 'cron_secret_ausente' })
 if ((req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() !== segredo) return res.status(401).json({ ok: false, error: 'nao_autorizado' })
 try {
  return res.json({ ok: true, ...await cobrarAjustes(createAdminClient(), whats) })
 } catch (e) {
  const motivo = e instanceof Error ? e.message : 'erro'
  console.error('Cobrança de ajustes falhou', motivo)
  return res.status(502).json({ ok: false, error: motivo })
 }
}
