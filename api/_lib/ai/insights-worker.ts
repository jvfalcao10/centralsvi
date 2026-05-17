import { createAdminClient } from '../supabase';

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar-reasoning-pro';

async function snapshotClient(clientId: string) {
  const admin = createAdminClient();
  const now = new Date();
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d60 = new Date(now); d60.setDate(d60.getDate() - 60);

  const [
    { data: client },
    { count: leads30 },
    { count: leadsPrev },
    { data: metrics },
    { count: campaigns },
    { count: won },
  ] = await Promise.all([
    admin.from('clients').select('name, segment').eq('id', clientId).single(),
    admin.from('painel_leads').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', d30.toISOString()),
    admin.from('painel_leads').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', d60.toISOString()).lt('created_at', d30.toISOString()),
    admin.from('painel_campaign_metrics_daily').select('spend_brl, date')
      .eq('client_id', clientId).gte('date', d60.toISOString().slice(0, 10)),
    admin.from('painel_campaigns').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('status', 'active'),
    admin.from('painel_leads').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('status', 'won').gte('created_at', d30.toISOString()),
  ]);

  if (!client) return null;
  const spend30 = (metrics ?? []).filter((m: any) => m.date >= d30.toISOString().slice(0, 10))
    .reduce((s: number, r: any) => s + Number(r.spend_brl ?? 0), 0);
  const spendPrev = (metrics ?? []).filter((m: any) => m.date < d30.toISOString().slice(0, 10))
    .reduce((s: number, r: any) => s + Number(r.spend_brl ?? 0), 0);
  return {
    client_id: clientId,
    client_name: client.name,
    segment: (client as any).segment || null,
    leads_30d: leads30 ?? 0,
    leads_prev30d: leadsPrev ?? 0,
    spend_30d: spend30,
    spend_prev30d: spendPrev,
    won_30d: won ?? 0,
    campaigns_active: campaigns ?? 0,
  };
}

const SYSTEM = `Você é o analista sênior da SVI. Recebe snapshot 30d de uma operação de marketing e devolve 1-4 insights JSON estritamente nesse formato:
[{"title":"...","body":"...","severity":"info|low|medium|high|critical","kind":"campaign_analysis|risk|recommendation|win_pattern"}]

Regras: português BR direto, sem floreio. Title até 80 chars, body até 400. Inclua APENAS insights ACIONÁVEIS (não factuais óbvios). Se nada interessante: devolva []. Responda JSON puro sem cerca de código nem markdown.`;

export async function generateInsightsForClient(clientId: string) {
  const snap = await snapshotClient(clientId);
  if (!snap) return { created: 0, skipped: true };
  if (snap.leads_30d === 0 && snap.spend_30d === 0) return { created: 0, skipped: true };

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.error('[insights-worker] PERPLEXITY_API_KEY ausente');
    return { created: 0, skipped: true };
  }

  const userPrompt = `Snapshot 30d de "${snap.client_name}"${snap.segment ? ` (segmento: ${snap.segment})` : ''}:
- Leads: ${snap.leads_30d} (vs ${snap.leads_prev30d} nos 30d anteriores)
- Investido: R$ ${snap.spend_30d.toFixed(2)} (vs R$ ${snap.spend_prev30d.toFixed(2)})
- Ganhos: ${snap.won_30d}
- Campanhas ativas: ${snap.campaigns_active}

Gere insights acionáveis em JSON.`;

  const res = await fetch(PERPLEXITY_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt }],
      max_tokens: 1200,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    console.error('[insights-worker] perplexity err', res.status);
    return { created: 0, skipped: false };
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = (data.choices?.[0]?.message?.content || '').trim();

  // sonar-reasoning-pro às vezes envolve em <think>...</think> — tira.
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Extrai JSON (defensivo)
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { created: 0, skipped: false };

  let insights: Array<{ title: string; body: string; severity: string; kind: string }> = [];
  try {
    insights = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(insights)) insights = [];
  } catch {
    return { created: 0, skipped: false };
  }

  if (insights.length === 0) return { created: 0, skipped: false };

  const admin = createAdminClient();
  const rows = insights.slice(0, 4).map((i) => ({
    client_id: clientId,
    kind: ['campaign_analysis','risk','recommendation','win_pattern','creative_fatigue','copy_suggestion'].includes(i.kind)
      ? i.kind : 'recommendation',
    title: String(i.title || '').slice(0, 120),
    body: String(i.body || '').slice(0, 1000),
    severity: ['info','low','medium','high','critical'].includes(i.severity) ? i.severity : 'info',
  }));

  await admin.from('painel_insights').insert(rows);
  return { created: rows.length, skipped: false };
}

export async function generateInsightsForAllClients() {
  const admin = createAdminClient();
  const { data: clients } = await admin.from('clients').select('id')
    .eq('painel_active', true).eq('status', 'ativo');
  let total = 0;
  for (const c of clients ?? []) {
    try { total += (await generateInsightsForClient(c.id)).created; } catch {}
  }
  return { clients: clients?.length ?? 0, insights_created: total };
}
