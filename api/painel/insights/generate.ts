import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createUserClient } from '../../_lib/supabase.js';
import { generateInsightsForClient } from '../../_lib/ai/insights-worker.js';

const schema = z.object({ clientSlug: z.string().min(1).max(64) });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }

  const userClient = createUserClient(req.headers.authorization as string | null);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  // Resolve client via user-scoped (RLS bloqueia se o user não tem acesso)
  const { data: client } = await userClient.from('clients').select('id').eq('slug', parsed.data.clientSlug).maybeSingle();
  if (!client) return res.status(403).json({ error: 'no_access' });

  if (!process.env.PERPLEXITY_API_KEY) {
    return res.status(503).json({ error: 'perplexity_not_configured', message: 'Chave Perplexity ausente.' });
  }

  try {
    const result = await generateInsightsForClient(client.id);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[insights/generate]', err);
    return res.status(500).json({ error: 'generate_failed', message: 'Não conseguimos gerar agora. Tenta de novo em alguns segundos.' });
  }
}

export const config = { maxDuration: 120 };
