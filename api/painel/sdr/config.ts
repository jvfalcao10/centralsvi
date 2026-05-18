import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createUserClient } from '../../_lib/supabase.js';

const putSchema = z.object({
  enabled: z.boolean(),
  persona: z.string().max(2000),
  instructions: z.string().max(2000),
  handoff_triggers: z.array(z.string().max(80)).max(30),
  model: z.string().max(80).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userClient = createUserClient(req.headers.authorization as string | null);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const slug = (req.query.clientSlug as string) || '';
  if (!slug) return res.status(400).json({ error: 'missing_slug' });

  const { data: client } = await userClient
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!client) return res.status(403).json({ error: 'no_access' });

  if (req.method === 'GET') {
    const { data } = await userClient
      .from('painel_ai_sdr_configs')
      .select('client_id, enabled, persona, instructions, handoff_triggers, model, updated_at')
      .eq('client_id', client.id)
      .maybeSingle();
    return res.status(200).json({
      ok: true,
      config: data ?? {
        client_id: client.id,
        enabled: false,
        persona: '',
        instructions: '',
        handoff_triggers: ['preço', 'valor', 'quanto custa', 'cancelar', 'reclamar', 'falar com humano', 'atendente'],
        model: 'claude-haiku-4-5-20251001',
        updated_at: null,
      },
    });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const { data, error } = await userClient
      .from('painel_ai_sdr_configs')
      .upsert({
        client_id: client.id,
        enabled: parsed.data.enabled,
        persona: parsed.data.persona,
        instructions: parsed.data.instructions,
        handoff_triggers: parsed.data.handoff_triggers,
        model: parsed.data.model || 'claude-haiku-4-5-20251001',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'save_failed', message: error.message });
    return res.status(200).json({ ok: true, config: data });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).end();
}
