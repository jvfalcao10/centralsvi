import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createAdminClient } from '../supabase';

const LEAD_STATUSES = ['new','contacted','qualified','meeting','proposal','won','lost','nurturing'] as const;

export const SDR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_recent_leads',
    description: 'Lista os leads mais recentes do CRM da organização.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 25 },
        status: { type: 'string', enum: [...LEAD_STATUSES] },
      },
    },
  },
  {
    name: 'update_lead_status',
    description: 'Atualiza o status de um lead específico.',
    input_schema: {
      type: 'object',
      required: ['lead_id', 'status'],
      properties: {
        lead_id: { type: 'string' },
        status: { type: 'string', enum: [...LEAD_STATUSES] },
        score: { type: 'integer', minimum: 0, maximum: 100 },
        estimated_value_brl: { type: 'number', minimum: 0 },
      },
    },
  },
  {
    name: 'log_activity',
    description: 'Registra uma atividade no histórico do lead.',
    input_schema: {
      type: 'object',
      required: ['lead_id', 'type', 'content'],
      properties: {
        lead_id: { type: 'string' },
        type: { type: 'string', enum: ['note','whatsapp','ai_sdr_message','ai_sdr_action'] },
        content: { type: 'string', maxLength: 4000 },
      },
    },
  },
  {
    name: 'create_insight',
    description: 'Cria insight visível pra equipe humana.',
    input_schema: {
      type: 'object',
      required: ['title', 'body', 'severity'],
      properties: {
        title: { type: 'string', maxLength: 120 },
        body: { type: 'string', maxLength: 1000 },
        severity: { type: 'string', enum: ['info','low','medium','high','critical'] },
      },
    },
  },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const listInput = z.object({
  limit: z.number().int().min(1).max(25).default(10),
  status: z.enum(LEAD_STATUSES).optional(),
});
const updateInput = z.object({
  lead_id: z.string().regex(UUID_RE),
  status: z.enum(LEAD_STATUSES),
  score: z.number().int().min(0).max(100).optional(),
  estimated_value_brl: z.number().min(0).optional(),
});
const logInput = z.object({
  lead_id: z.string().regex(UUID_RE),
  type: z.enum(['note','whatsapp','ai_sdr_message','ai_sdr_action']),
  content: z.string().min(1).max(4000),
});
const insightInput = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
  severity: z.enum(['info','low','medium','high','critical']),
});

async function assertLeadInClient(admin: ReturnType<typeof createAdminClient>, clientId: string, leadId: string): Promise<boolean> {
  const { data } = await admin.from('painel_leads').select('id').eq('id', leadId).eq('client_id', clientId).maybeSingle();
  return !!data;
}

export async function runSdrTool(clientId: string, name: string, rawInput: Record<string, unknown>): Promise<string> {
  const admin = createAdminClient();
  try {
    switch (name) {
      case 'list_recent_leads': {
        const input = listInput.parse(rawInput);
        let q = admin.from('painel_leads')
          .select('id, full_name, email, phone, status, source, score, estimated_value_brl, notes, last_contact_at, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(input.limit);
        if (input.status) q = q.eq('status', input.status);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }
      case 'update_lead_status': {
        const input = updateInput.parse(rawInput);
        if (!(await assertLeadInClient(admin, clientId, input.lead_id))) {
          return JSON.stringify({ ok: false, error: 'lead_not_in_client' });
        }
        const update: Record<string, unknown> = { status: input.status };
        if (typeof input.score === 'number') update.score = input.score;
        if (typeof input.estimated_value_brl === 'number') update.estimated_value_brl = input.estimated_value_brl;
        const { error } = await admin.from('painel_leads').update(update).eq('id', input.lead_id).eq('client_id', clientId);
        if (error) return JSON.stringify({ ok: false, error: 'update_failed' });
        return JSON.stringify({ ok: true });
      }
      case 'log_activity': {
        const input = logInput.parse(rawInput);
        if (!(await assertLeadInClient(admin, clientId, input.lead_id))) {
          return JSON.stringify({ ok: false, error: 'lead_not_in_client' });
        }
        const { error } = await admin.from('painel_lead_activities').insert({
          client_id: clientId, lead_id: input.lead_id, type: input.type, content: input.content, actor_kind: 'ai_sdr',
        });
        if (error) return JSON.stringify({ ok: false, error: 'insert_failed' });
        return JSON.stringify({ ok: true });
      }
      case 'create_insight': {
        const input = insightInput.parse(rawInput);
        const { error } = await admin.from('painel_insights').insert({
          client_id: clientId, kind: 'recommendation',
          title: input.title, body: input.body, severity: input.severity,
        });
        if (error) return JSON.stringify({ ok: false, error: 'insert_failed' });
        return JSON.stringify({ ok: true });
      }
      default:
        return JSON.stringify({ error: `unknown_tool:${name}` });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return JSON.stringify({ ok: false, error: 'invalid_input', details: err.issues });
    }
    return JSON.stringify({ ok: false, error: 'tool_failure' });
  }
}
