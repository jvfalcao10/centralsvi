import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createAdminClient } from '../../_lib/supabase.js';
import { humanizeDbError, safeEqual } from '../../_lib/errors.js';

const schema = z.object({
  full_name: z.string().min(1).max(120),
  email: z.string().email().max(120).optional(),
  phone: z.string().max(40).optional(),
  source: z.string().max(80).optional(),
  utm: z.record(z.string().max(200)).optional(),
  notes: z.string().max(2000).optional(),
  estimated_value_brl: z.number().nonnegative().max(1e9).optional(),
});

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }

  const orgToken = req.headers['x-org-token'] as string | undefined;
  const orgSlug = req.headers['x-org-slug'] as string | undefined;
  if (!orgToken || !orgSlug) return res.status(401).json({ error: 'missing_org_credentials' });

  const admin = createAdminClient();
  const { data: client } = await admin.from('clients').select('id').eq('slug', orgSlug).maybeSingle();
  if (!client) return res.status(401).json({ error: 'invalid_credentials' });

  const { data: integration } = await admin.from('painel_integrations')
    .select('credentials').eq('client_id', client.id).eq('provider', 'custom').eq('account_id', 'lead-webhook').maybeSingle();

  const stored = (integration?.credentials as { webhook_token_hash?: string } | null)?.webhook_token_hash;
  if (!stored || !safeEqual(hashToken(orgToken), stored)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  const { data: lead, error } = await admin.from('painel_leads').insert({
    client_id: client.id,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    source: parsed.data.source || 'webhook',
    utm: parsed.data.utm,
    notes: parsed.data.notes,
    estimated_value_brl: parsed.data.estimated_value_brl,
    status: 'new',
  }).select('id').single();

  if (error) {
    const { code, message } = humanizeDbError(error);
    return res.status(400).json({ error: code, message });
  }
  return res.status(201).json({ ok: true, lead_id: lead.id });
}
