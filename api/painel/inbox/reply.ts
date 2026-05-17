import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createUserClient, createAdminClient } from '../../_lib/supabase.js';
import { sendWhatsApp } from '../../_lib/integrations/uazapi.js';

const schema = z.object({
  clientSlug: z.string().min(1).max(64),
  threadId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const userClient = createUserClient(req.headers.authorization as string | null);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  // Resolve client via user client (RLS valida acesso)
  const { data: client } = await userClient
    .from('clients')
    .select('id')
    .eq('slug', parsed.data.clientSlug)
    .maybeSingle();
  if (!client) return res.status(403).json({ error: 'no_access' });

  // Pega thread + valida que é WhatsApp + pertence ao client
  const { data: thread } = await userClient
    .from('painel_threads')
    .select('id, kind, external_phone, lead_id, client_id')
    .eq('id', parsed.data.threadId)
    .maybeSingle();
  if (!thread || thread.client_id !== client.id) {
    return res.status(404).json({ error: 'thread_not_found' });
  }
  if (thread.kind !== 'whatsapp_lead' || !thread.external_phone) {
    return res.status(400).json({ error: 'not_whatsapp_thread' });
  }

  // Busca creds UazAPI via service role
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('painel_integrations')
    .select('credentials')
    .eq('client_id', client.id)
    .eq('provider', 'whatsapp')
    .maybeSingle();

  const creds = (integration?.credentials || {}) as {
    base_url?: string;
    instance_token?: string;
  };
  if (!creds.base_url || !creds.instance_token) {
    return res.status(503).json({
      error: 'uazapi_not_configured',
      message: 'WhatsApp não configurado pra esse cliente. Configure em Settings → Staff.',
    });
  }

  // Manda via UazAPI
  const sendRes = await sendWhatsApp(
    { base_url: creds.base_url, instance_token: creds.instance_token },
    thread.external_phone,
    parsed.data.content
  );

  if (!sendRes.ok) {
    return res.status(502).json({ error: 'send_failed', message: sendRes.error });
  }

  // Insert mensagem outbound (trigger atualiza thread)
  await admin.from('painel_thread_messages').insert({
    thread_id: thread.id,
    client_id: client.id,
    user_id: user.id,
    actor_kind: 'svi_team',
    content: parsed.data.content,
    direction: 'outbound',
  });

  // Activity no lead
  if (thread.lead_id) {
    await admin.from('painel_lead_activities').insert({
      client_id: client.id,
      lead_id: thread.lead_id,
      type: 'whatsapp',
      content: parsed.data.content,
      actor_user_id: user.id,
      actor_kind: 'user',
      metadata: { direction: 'outbound', uazapi_message_id: sendRes.message_id },
    });
  }

  return res.status(200).json({ ok: true });
}
