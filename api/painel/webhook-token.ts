import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { createUserClient, createAdminClient } from '../_lib/supabase';

const schema = z.object({ clientSlug: z.string().min(1).max(64) });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }

  const userClient = createUserClient(req.headers.authorization as string | null);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  const { data: client } = await userClient.from('clients').select('id').eq('slug', parsed.data.clientSlug).maybeSingle();
  if (!client) return res.status(403).json({ error: 'no_access' });

  const token = 'svi_' + randomBytes(24).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');

  const admin = createAdminClient();
  const { error } = await admin.from('painel_integrations').upsert({
    client_id: client.id,
    provider: 'custom',
    account_id: 'lead-webhook',
    account_name: 'Webhook de leads',
    credentials: { webhook_token_hash: hash },
    status: 'connected',
    last_synced_at: new Date().toISOString(),
  }, { onConflict: 'client_id,provider,account_id' });

  if (error) return res.status(400).json({ error: 'rotate_failed' });

  return res.status(200).json({
    token,
    note: 'Salve este token agora — ele NÃO será mostrado de novo. Hash armazenado.',
  });
}
