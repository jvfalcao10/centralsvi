import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { createUserClient, createAdminClient } from '../../_lib/supabase';

const schema = z.object({
  clientSlug: z.string().min(1).max(64),
  base_url: z.string().url().max(200),
  instance_token: z.string().min(10).max(200),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const userClient = createUserClient(req.headers.authorization as string | null);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

    const { data: client } = await userClient.from('clients').select('id').eq('slug', parsed.data.clientSlug).maybeSingle();
    if (!client) return res.status(403).json({ error: 'no_access' });

    const token = 'uz_' + randomBytes(24).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');

    const admin = createAdminClient();
    const { error } = await admin.from('painel_integrations').upsert({
      client_id: client.id, provider: 'whatsapp', account_id: 'uazapi',
      account_name: parsed.data.base_url,
      credentials: { base_url: parsed.data.base_url, instance_token: parsed.data.instance_token, webhook_token_hash: hash },
      status: 'connected', last_synced_at: new Date().toISOString(),
    }, { onConflict: 'client_id,provider,account_id' });

    if (error) return res.status(400).json({ error: 'save_failed' });
    return res.status(200).json({ token, note: 'Salve este token. Configure-o como Webhook URL na UazAPI.' });
  }

  if (req.method === 'DELETE') {
    const userClient = createUserClient(req.headers.authorization as string | null);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    const { clientSlug } = req.body || {};
    const { data: client } = await userClient.from('clients').select('id').eq('slug', clientSlug).maybeSingle();
    if (!client) return res.status(403).json({ error: 'no_access' });
    const admin = createAdminClient();
    await admin.from('painel_integrations').delete().eq('client_id', client.id).eq('provider', 'whatsapp');
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).end();
}
