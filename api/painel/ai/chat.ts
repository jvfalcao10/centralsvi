import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { createUserClient, createAdminClient } from '../../_lib/supabase';
import { getAnthropic, MODEL } from '../../_lib/ai/claude';
import { growthAgentSystemPrompt, sdrAgentSystemPrompt } from '../../_lib/ai/prompts';
import { SDR_TOOLS, runSdrTool } from '../../_lib/ai/sdr-tools';
import { rateLimit } from '../../_lib/rate-limit';

const MAX_TOOL_ITERATIONS = 6;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 6_000;

const schema = z.object({
  scope: z.enum(['growth_agent', 'sdr_agent']).catch('growth_agent'),
  clientSlug: z.string().min(1).max(64),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(MAX_MESSAGE_CHARS),
  })).min(1).max(MAX_MESSAGES),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const userClient = createUserClient(req.headers.authorization as string | null);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const minute = rateLimit(`chat:min:${user.id}`, { max: 20, windowMs: 60_000 });
  if (!minute.allowed) return res.status(429).json({ error: 'rate_limited', message: 'Muitas mensagens. Aguarde um minuto.' });
  const daily = rateLimit(`chat:day:${user.id}`, { max: 300, windowMs: 24 * 60 * 60_000 });
  if (!daily.allowed) return res.status(429).json({ error: 'daily_quota', message: 'Limite diário atingido.' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  // Resolve client + valida acesso via RLS (user-scoped client)
  const { data: client } = await userClient.from('clients')
    .select('id, name').eq('slug', parsed.data.clientSlug).maybeSingle();
  if (!client) return res.status(403).json({ error: 'no_access' });

  const system = parsed.data.scope === 'sdr_agent'
    ? sdrAgentSystemPrompt(client.name)
    : growthAgentSystemPrompt(client.name);

  const anthropic = getAnthropic();
  const tools = parsed.data.scope === 'sdr_agent' ? SDR_TOOLS : undefined;
  let messages: Anthropic.MessageParam[] = parsed.data.messages.map(m => ({ role: m.role, content: m.content }));
  let reply = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024, system, tools, messages,
    });
    if (response.stop_reason === 'tool_use' && tools) {
      messages.push({ role: 'assistant', content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await runSdrTool(client.id, block.name, block.input as Record<string, unknown>);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }
    reply = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n');
    break;
  }

  if (!reply) reply = 'Não consegui formular resposta. Tente reformular.';
  return res.status(200).json({ reply });
}
