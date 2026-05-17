import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { createAdminClient } from '../../_lib/supabase.js';
import { parseUazWebhook } from '../../_lib/integrations/uazapi.js';
import { safeEqual } from '../../_lib/errors.js';

/**
 * Webhook UazAPI: recebe mensagem inbound do WhatsApp.
 * URL: /api/painel/whatsapp/<clientSlug>?token=<webhook_token>
 *
 * Fluxo:
 *  1. Valida slug + token
 *  2. Upsert lead pelo phone (cria se novo)
 *  3. Upsert thread (kind=whatsapp_lead, vinculada ao lead)
 *  4. Insert mensagem (trigger conta unread_for_svi)
 *  5. Trigger de notification dispara pros painel_members
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const slug = (req.query.slug as string) || '';
  const token = (req.query.token as string) || '';
  if (!slug || !token) return res.status(401).json({ error: 'missing_credentials' });

  const admin = createAdminClient();

  const { data: client } = await admin
    .from('clients')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!client) return res.status(401).json({ error: 'invalid' });

  const { data: integration } = await admin
    .from('painel_integrations')
    .select('credentials')
    .eq('client_id', client.id)
    .eq('provider', 'whatsapp')
    .maybeSingle();

  const creds = (integration?.credentials || {}) as { webhook_token_hash?: string };
  if (!creds.webhook_token_hash) return res.status(401).json({ error: 'not_configured' });

  const tokenHash = createHash('sha256').update(token).digest('hex');
  if (!safeEqual(tokenHash, creds.webhook_token_hash)) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const msg = parseUazWebhook(req.body);
  if (!msg) return res.status(200).json({ ok: true, skipped: true });

  // 1. Upsert lead pelo phone
  let { data: existingLead } = await admin
    .from('painel_leads')
    .select('id, status')
    .eq('client_id', client.id)
    .eq('phone', msg.from)
    .maybeSingle();

  let leadId = existingLead?.id;
  if (!leadId) {
    const fullName = msg.sender_name || `WhatsApp ${msg.from}`;
    const { data: newLead } = await admin
      .from('painel_leads')
      .insert({
        client_id: client.id,
        full_name: fullName,
        phone: msg.from,
        source: 'whatsapp',
        status: 'new',
      })
      .select('id')
      .single();
    leadId = newLead?.id;
  } else if (existingLead?.status === 'new') {
    // Lead que veio antes mas agora respondeu pela 1ª vez → contacted
    await admin.from('painel_leads').update({ status: 'contacted' }).eq('id', leadId);
  }

  if (!leadId) return res.status(500).json({ error: 'lead_resolve_failed' });

  // 2. Upsert thread WhatsApp (1 por client+phone)
  let { data: thread } = await admin
    .from('painel_threads')
    .select('id')
    .eq('client_id', client.id)
    .eq('kind', 'whatsapp_lead')
    .eq('external_phone', msg.from)
    .maybeSingle();

  let threadId = thread?.id;
  if (!threadId) {
    const { data: newThread } = await admin
      .from('painel_threads')
      .insert({
        client_id: client.id,
        kind: 'whatsapp_lead',
        lead_id: leadId,
        external_phone: msg.from,
        title: msg.sender_name || msg.from,
      })
      .select('id')
      .single();
    threadId = newThread?.id;
  }

  if (!threadId) return res.status(500).json({ error: 'thread_resolve_failed' });

  // 3. Insert mensagem inbound (trigger painel_update_thread_on_message atualiza thread)
  await admin.from('painel_thread_messages').insert({
    thread_id: threadId,
    client_id: client.id,
    actor_kind: 'lead',
    content: msg.text,
    direction: 'inbound',
  });

  // 4. Activity no lead pra histórico
  await admin.from('painel_lead_activities').insert({
    client_id: client.id,
    lead_id: leadId,
    type: 'whatsapp',
    content: msg.text,
    actor_kind: 'system',
    metadata: { direction: 'inbound', message_id: msg.message_id },
  });

  // 5. Notification pros membros (sino badge)
  await admin
    .from('notifications')
    .insert([])
    .then(() => null)
    .catch(() => null);

  // Notification real:
  const { data: members } = await admin
    .from('painel_members')
    .select('user_id')
    .eq('client_id', client.id);
  if (members && members.length > 0) {
    const rows = members.map((m: any) => ({
      user_id: m.user_id,
      client_id: client.id,
      title: `Nova mensagem WhatsApp`,
      message: `${msg.sender_name || msg.from}: ${msg.text.slice(0, 100)}`,
      type: 'info',
      link: `/cliente/${slug}/inbox?thread=${threadId}`,
      read: false,
    }));
    await admin.from('notifications').insert(rows);
  }

  return res.status(200).json({ ok: true, lead_id: leadId, thread_id: threadId });
}

export async function GET(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Allow', 'POST');
  return res.status(405).end();
}
