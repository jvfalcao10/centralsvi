import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createAdminClient } from './_lib/supabase.js'
import { rondaDiaria } from './_lib/social-cobranca.js'
import { jaFalamosHoje, semSaudacao } from './_lib/social-whats.js'

/**
 * A ronda diária da Sofia, às 8h30 de Brasília, de segunda a sexta.
 *
 * 1. Peça em ajuste que não voltou com arquivo novo: cobra o grupo do autor.
 * 2. Peça parada com o cliente há mais de um dia: puxa no grupo do cliente,
 *    com o MESMO link que já está com ele.
 * 3. Data chegando e peça não pronta: avisa quem está com ela, e o João.
 */
async function whats(jid: string, bruto: string) {
 const token = process.env.SOCIAL_UAZ_TOKEN || ''
 if (!token) throw new Error('uaz_token_ausente')
 // Cumprimento só na primeira fala do dia naquele grupo.
 const texto = await jaFalamosHoje(jid) ? semSaudacao(bruto) : bruto
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
  return res.json({ ok: true, ...await rondaDiaria(createAdminClient(), whats) })
 } catch (e) {
  const motivo = e instanceof Error ? e.message : 'erro'
  console.error('Cobrança de ajustes falhou', motivo)
  return res.status(502).json({ ok: false, error: motivo })
 }
}
