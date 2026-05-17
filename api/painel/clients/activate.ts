import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createUserClient } from '../../_lib/supabase.js';

const schema = z.object({ clientId: z.string().uuid() });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }

  const userClient = createUserClient(req.headers.authorization as string | null);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  // RPC roda como service definer e valida is_svi_team internamente
  const { data: pipeId, error } = await userClient.rpc('painel_activate_client', {
    p_client_id: parsed.data.clientId,
  });
  if (error) return res.status(400).json({ error: error.message || 'activate_failed' });
  return res.status(200).json({ ok: true, pipeline_id: pipeId });
}
