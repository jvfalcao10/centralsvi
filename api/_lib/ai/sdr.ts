/**
 * Cliente Anthropic enxuto pra IA SDR.
 * Sem SDK — fetch direto pra evitar dependência adicional.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export type SdrMessage = { role: 'user' | 'assistant'; content: string };

export type SdrResult =
  | { ok: true; reply: string; should_handoff: boolean; handoff_reason: string | null }
  | { ok: false; error: string };

const DEFAULT_HANDOFF = ['preço', 'valor', 'quanto custa', 'cancelar', 'reclamar', 'falar com humano', 'atendente'];

function detectHandoff(text: string, triggers: string[]): { hit: boolean; reason: string | null } {
  const lower = text.toLowerCase();
  for (const t of triggers) {
    if (t && lower.includes(t.toLowerCase())) return { hit: true, reason: t };
  }
  return { hit: false, reason: null };
}

export async function generateSdrReply(opts: {
  model: string;
  persona: string;
  instructions: string;
  history: SdrMessage[];
  incoming: string;
  triggers?: string[];
}): Promise<SdrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'anthropic_not_configured' };

  // Detecção de handoff acontece SOBRE a mensagem que chegou (antes de gerar)
  const triggers = opts.triggers && opts.triggers.length > 0 ? opts.triggers : DEFAULT_HANDOFF;
  const handoff = detectHandoff(opts.incoming, triggers);

  // Se handoff detectado, não gera resposta — passa pra humano direto
  if (handoff.hit) {
    return {
      ok: true,
      reply: '',
      should_handoff: true,
      handoff_reason: handoff.reason,
    };
  }

  const system = [
    opts.persona,
    '',
    opts.instructions,
    '',
    'Regras:',
    '- Respostas curtas (máx 3 frases), tom de WhatsApp brasileiro.',
    '- Nunca invente preço, horário ou produto que não está acima.',
    '- Se não souber, diga que vai chamar um humano e pergunta o melhor horário.',
    '- Nunca peça pra cliente "aguardar um momento" mais de uma vez na conversa.',
  ].join('\n');

  const body = {
    model: opts.model,
    max_tokens: 400,
    system,
    messages: [
      ...opts.history.slice(-10),
      { role: 'user' as const, content: opts.incoming },
    ],
  };

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `anthropic_${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const reply = data.content?.find((b) => b.type === 'text')?.text?.trim() || '';
    if (!reply) return { ok: false, error: 'empty_reply' };
    return { ok: true, reply, should_handoff: false, handoff_reason: null };
  } catch {
    return { ok: false, error: 'anthropic_network' };
  }
}
