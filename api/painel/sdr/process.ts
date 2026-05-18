import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createAdminClient } from '../../_lib/supabase.js';
import { sendWhatsApp } from '../../_lib/integrations/uazapi.js';
import { generateSdrReply, type SdrMessage } from '../../_lib/ai/sdr.js';

const schema = z.object({
  clientId: z.string().uuid(),
  threadId: z.string().uuid(),
  leadId: z.string().uuid().optional().nullable(),
  internalToken: z.string(),
});

/**
 * Processa mensagem inbound com IA SDR.
 * Acionado pelo webhook UazAPI (chamada fire-and-forget) quando bot ativo.
 *
 * - Lê config + últimas mensagens da thread
 * - Detecta handoff (palavra-chave). Se hit, marca unread_for_svi=1 e sai.
 * - Senão gera resposta via Anthropic e envia via UazAPI
 * - Grava outbound em painel_thread_messages
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // Internal token check (webhook compartilha SDR_INTERNAL_TOKEN com process.ts)
  const expected = process.env.SDR_INTERNAL_TOKEN;
  if (!expected) return res.status(503).json({ error: 'internal_token_not_configured' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });
  if (parsed.data.internalToken !== expected) return res.status(401).json({ error: 'unauthorized' });

  const admin = createAdminClient();

  // 1. Config da IA
  const { data: config } = await admin
    .from('painel_ai_sdr_configs')
    .select('enabled, persona, instructions, handoff_triggers, model')
    .eq('client_id', parsed.data.clientId)
    .maybeSingle();

  if (!config?.enabled) return res.status(200).json({ ok: true, skipped: 'disabled' });
  if (!config.persona?.trim()) return res.status(200).json({ ok: true, skipped: 'no_persona' });

  // 2. Thread + última inbound + histórico recente
  const { data: thread } = await admin
    .from('painel_threads')
    .select('id, external_phone, lead_id')
    .eq('id', parsed.data.threadId)
    .maybeSingle();
  if (!thread?.external_phone) return res.status(404).json({ error: 'thread_not_found' });

  const { data: history } = await admin
    .from('painel_thread_messages')
    .select('content, direction, actor_kind, created_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(20);

  const msgs = (history || []).slice(0, -1); // tira a última (que é a inbound recém-chegada)
  const incoming = (history || []).slice(-1)[0]?.content || '';
  if (!incoming) return res.status(200).json({ ok: true, skipped: 'no_incoming' });

  const sdrHistory: SdrMessage[] = msgs.map((m: any) => ({
    role: m.direction === 'outbound' || m.actor_kind === 'svi_team' ? 'assistant' : 'user',
    content: m.content || '',
  }));

  // 3. Gera resposta (ou detecta handoff)
  const triggers = Array.isArray(config.handoff_triggers) ? (config.handoff_triggers as string[]) : [];
  const result = await generateSdrReply({
    model: config.model || 'claude-haiku-4-5-20251001',
    persona: config.persona,
    instructions: config.instructions || '',
    history: sdrHistory,
    incoming,
    triggers,
  });

  if (!result.ok) {
    // Falha: marca thread como precisando atenção humana, sem responder
    await admin.from('painel_threads').update({ unread_for_svi: 1 }).eq('id', thread.id);
    return res.status(502).json({ error: result.error });
  }

  if (result.should_handoff) {
    // Handoff: marca unread e grava nota interna (não envia ao lead)
    await admin.from('painel_threads').update({ unread_for_svi: 1 }).eq('id', thread.id);
    await admin.from('painel_lead_activities').insert({
      client_id: parsed.data.clientId,
      lead_id: thread.lead_id || parsed.data.leadId || null,
      type: 'ai_handoff',
      content: `IA SDR escalou pra humano. Gatilho: "${result.handoff_reason}"`,
      actor_kind: 'system',
      metadata: { trigger: result.handoff_reason },
    });
    return res.status(200).json({ ok: true, handoff: result.handoff_reason });
  }

  // 4. Envia via UazAPI
  const { data: integration } = await admin
    .from('painel_integrations')
    .select('credentials')
    .eq('client_id', parsed.data.clientId)
    .eq('provider', 'whatsapp')
    .maybeSingle();
  const creds = (integration?.credentials || {}) as { base_url?: string; instance_token?: string };
  if (!creds.base_url || !creds.instance_token) {
    return res.status(503).json({ error: 'uazapi_not_configured' });
  }

  const sendRes = await sendWhatsApp(
    { base_url: creds.base_url, instance_token: creds.instance_token },
    thread.external_phone,
    result.reply,
  );
  if (!sendRes.ok) return res.status(502).json({ error: 'send_failed', message: sendRes.error });

  // 5. Grava outbound no banco
  await admin.from('painel_thread_messages').insert({
    thread_id: thread.id,
    client_id: parsed.data.clientId,
    actor_kind: 'svi_team',
    content: result.reply,
    direction: 'outbound',
  });
  await admin.from('painel_lead_activities').insert({
    client_id: parsed.data.clientId,
    lead_id: thread.lead_id || parsed.data.leadId || null,
    type: 'whatsapp',
    content: result.reply,
    actor_kind: 'system',
    metadata: { direction: 'outbound', source: 'ai_sdr', uazapi_message_id: sendRes.message_id },
  });

  return res.status(200).json({ ok: true, sent: true });
}

export const config = { maxDuration: 60 };
