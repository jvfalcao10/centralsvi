import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createAdminClient } from './supabase.js'
import { cadenciaDoMes } from './social-cadencia.js'

/**
 * A cadência do mês, para quem trabalha nela.
 *
 * João, 19/10/2026: "a cadência deve estar dentro da Central SVI, porque quero
 * que a social media tenha acesso". Antes vivia só em
 * cadencia.svicompany.com.br, um painel à parte que a Rayana não abria.
 *
 * Mesma porta da equipe que o quadro usa, inclusive os papéis laterais social
 * e design: quem monta a pauta precisa ver o ritmo antes de montar.
 */
const EQUIPE = ['admin', 'manager', 'seller', 'executor', 'traffic', 'social', 'design']

export async function handleCadencia(req: VercelRequest, res: VercelResponse) {
 const db = createAdminClient()
 const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
 if (!bearer) return res.status(401).json({ error: 'Entre na Central para ver a cadência.' })
 const { data, error } = await db.auth.getUser(bearer)
 if (error || !data.user) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' })
 const { data: roles } = await db.from('user_roles').select('role').eq('user_id', data.user.id)
 if (!roles?.some(r => EQUIPE.includes(r.role))) return res.status(403).json({ error: 'Acesso restrito à equipe SVI.' })
 try {
  const dados = await cadenciaDoMes(db)
  // Meia hora de cache: ler vinte contas no Instagram a cada F5 gasta cota à
  // toa, e o ritmo do mês não muda de minuto em minuto.
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
  return res.status(200).json(dados)
 } catch {
  return res.status(502).json({ error: 'Não consegui ler o Instagram agora. Tente de novo em instantes.' })
 }
}
