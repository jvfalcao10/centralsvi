import { getAnthropic, MODEL } from './claude';
import { createAdminClient } from '../supabase';

async function snapshotClient(clientId: string) {
  const admin = createAdminClient();
  const now = new Date();
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d60 = new Date(now); d60.setDate(d60.getDate() - 60);

  const [{ data: client }, { count: leads30 }, { count: leadsPrev }, { data: metrics }, { count: campaigns }, { count: won }] =
    await Promise.all([
      admin.from('clients').select('name').eq('id', clientId).single(),
      admin.from('painel_leads').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', d30.toISOString()),
      admin.from('painel_leads').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', d60.toISOString()).lt('created_at', d30.toISOString()),
      admin.from('painel_campaign_metrics_daily').select('spend_brl, date').eq('client_id', clientId).gte('date', d60.toISOString().slice(0, 10)),
      admin.from('painel_campaigns').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'active'),
      admin.from('painel_leads').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'won').gte('created_at', d30.toISOString()),
    ]);
  if (!client) return null;
  const spend30 = (metrics ?? []).filter((m: any) => m.date >= d30.toISOString().slice(0, 10)).reduce((s: number, r: any) => s + Number(r.spend_brl ?? 0), 0);
  const spendPrev = (metrics ?? []).filter((m: any) => m.date < d30.toISOString().slice(0, 10)).reduce((s: number, r: any) => s + Number(r.spend_brl ?? 0), 0);
  return {
    client_id: clientId, client_name: client.name,
    leads_30d: leads30 ?? 0, leads_prev30d: leadsPrev ?? 0,
    spend_30d: spend30, spend_prev30d: spendPrev,
    won_30d: won ?? 0, campaigns_active: campaigns ?? 0,
  };
}

const SYSTEM = `Você é o analista sênior da SVI. Recebe snapshot 30d de uma operação e devolve 1-4 insights JSON estritamente:
[{"title":"...","body":"...","severity":"info|low|medium|high|critical","kind":"campaign_analysis|risk|recommendation|win_pattern"}]

Regras: PT-BR direto, sem floreio. Title até 80 chars, body até 400. Só ACIONÁVEIS. Vazio: []. Responda JSON puro sem cerca.`;

export async function generateInsightsForClient(clientId: string) {
  const snap = await snapshotClient(clientId);
  if (!snap) return { created: 0, skipped: true };
  if (snap.leads_30d === 0 && snap.spend_30d === 0) return { created: 0, skipped: true };
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: MODEL, max_tokens: 1200, system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Snapshot 30d de "${snap.client_name}":
- Leads: ${snap.leads_30d} (vs ${snap.leads_prev30d} antes)
- Investido: R$ ${snap.spend_30d.toFixed(2)} (vs R$ ${snap.spend_prev30d.toFixed(2)})
- Ganhos: ${snap.won_30d}
- Campanhas ativas: ${snap.campaigns_active}

Gere insights.`,
    }],
  });
  const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  let insights: Array<{ title: string; body: string; severity: string; kind: string }> = [];
  try {
    insights = JSON.parse(text);
    if (!Array.isArray(insights)) insights = [];
  } catch {
    return { created: 0, skipped: false };
  }
  if (insights.length === 0) return { created: 0, skipped: false };
  const admin = createAdminClient();
  const rows = insights.slice(0, 4).map((i) => ({
    client_id: clientId,
    kind: ['campaign_analysis','risk','recommendation','win_pattern','creative_fatigue','copy_suggestion'].includes(i.kind) ? i.kind : 'recommendation',
    title: String(i.title || '').slice(0, 120),
    body: String(i.body || '').slice(0, 1000),
    severity: ['info','low','medium','high','critical'].includes(i.severity) ? i.severity : 'info',
  }));
  await admin.from('painel_insights').insert(rows);
  return { created: rows.length, skipped: false };
}

export async function generateInsightsForAllClients() {
  const admin = createAdminClient();
  const { data: clients } = await admin.from('clients').select('id').eq('painel_active', true).eq('status', 'ativo');
  let total = 0;
  for (const c of clients ?? []) {
    try { total += (await generateInsightsForClient(c.id)).created; } catch {}
  }
  return { clients: clients?.length ?? 0, insights_created: total };
}
