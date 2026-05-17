import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '../../_lib/supabase';
import { parseUazWebhook, sendWhatsApp } from '../../_lib/integrations/uazapi';
import { getAnthropic, MODEL } from '../../_lib/ai/claude';
import { sdrAgentSystemPrompt } from '../../_lib/ai/prompts';
import { SDR_TOOLS, runSdrTool } from '../../_lib/ai/sdr-tools';
import { safeEqual } from '../../_lib/errors';

const MAX_TOOL_ITERATIONS = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }

  const slug = (req.query.slug as string) || '';
  const token = (req.query.token as string) || '';
  if (!slug || !token) return res.status(401).json({ error: 'missing' });

  const admin = createAdminClient();
  const { data: client } = await admin.from('clients').select('id, name').eq('slug', slug).maybeSingle();
  if (!client) return res.status(401).json({ error: 'invalid' });

  const { data: integration } = await admin.from('painel_integrations')
    .select('credentials').eq('client_id', client.id).eq('provider', 'whatsapp').maybeSingle();

  const creds = (integration?.credentials || {}) as {
    webhook_token_hash?: string; base_url?: string; instance_token?: string;
  };
  if (!creds.webhook_token_hash || !creds.base_url || !creds.instance_token) {
    return res.status(401).json({ error: 'not_configured' });
  }
  const tokenHash = createHash('sha256').update(token).digest('hex');
  if (!safeEqual(tokenHash, creds.webhook_token_hash)) return res.status(401).json({ error: 'invalid_token' });

  const msg = parseUazWebhook(req.body);
  if (!msg) return res.status(200).json({ ok: true, skipped: true });

  const { data: existingLead } = await admin.from('painel_leads')
    .select('id, status').eq('client_id', client.id).eq('phone', msg.from).maybeSingle();
  let leadId = existingLead?.id;
  if (!leadId) {
    const { data: newLead } = await admin.from('painel_leads').insert({
      client_id: client.id, full_name: `WhatsApp ${msg.from}`, phone: msg.from,
      source: 'whatsapp', status: 'contacted',
    }).select('id').single();
    leadId = newLead?.id;
  }

  if (leadId) {
    await admin.from('painel_lead_activities').insert({
      client_id: client.id, lead_id: leadId, type: 'whatsapp', content: msg.text,
      actor_kind: 'system', metadata: { direction: 'inbound', message_id: msg.message_id },
    });
  }

  const anthropic = getAnthropic();
  const system = sdrAgentSystemPrompt(client.name);
  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: msg.text }];
  let reply = '';
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024, system, tools: SDR_TOOLS, messages,
    });
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await runSdrTool(client.id, block.name, block.input as any);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }
    reply = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n');
    break;
  }

  if (reply && leadId) {
    await sendWhatsApp({ base_url: creds.base_url, instance_token: creds.instance_token }, msg.from, reply);
    await admin.from('painel_lead_activities').insert({
      client_id: client.id, lead_id: leadId, type: 'ai_sdr_message',
      content: reply, actor_kind: 'ai_sdr', metadata: { direction: 'outbound' },
    });
  }
  return res.status(200).json({ ok: true, lead_id: leadId, sent: !!reply });
}
