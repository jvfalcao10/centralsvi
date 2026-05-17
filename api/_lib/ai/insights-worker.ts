import { createAdminClient } from '../supabase.js';

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar-reasoning-pro';

/**
 * Insights Onda 8 — Inteligência de Nicho.
 *
 * Pra cada cliente, busca via Perplexity (com search web):
 *  - Notícias recentes (últimos 30d) sobre o segmento
 *  - Ideias de conteúdo atuais (relevantes pra o nicho)
 *  - Oportunidades de marketing / movimentos de mercado
 *  - Análise interna se houver dados (campanhas, leads, spend)
 *
 * Resultado: 5-10 cards de insight por execução.
 */

async function getClientContext(clientId: string) {
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
    admin.from('clients').select('name, segment, company').eq('id', clientId).single(),
    admin.from('painel_leads').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', d30.toISOString()),
    admin.from('painel_leads').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('created_at', d60.toISOString()).lt('created_at', d30.toISOString()),
    admin.from('painel_campaign_metrics_daily').select('spend_brl, date')
      .eq('client_id', clientId).gte('date', d30.toISOString().slice(0, 10)),
    admin.from('painel_campaigns').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('status', 'active'),
    admin.from('painel_leads').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('status', 'won').gte('created_at', d30.toISOString()),
  ]);

  if (!client) return null;
  const spend30 = (metrics ?? []).reduce((s: number, r: any) => s + Number(r.spend_brl ?? 0), 0);

  return {
    client_id: clientId,
    name: client.name,
    company: (client as any).company || null,
    segment: (client as any).segment || null,
    leads_30d: leads30 ?? 0,
    leads_prev30d: leadsPrev ?? 0,
    spend_30d: spend30,
    won_30d: won ?? 0,
    campaigns_active: campaigns ?? 0,
  };
}

const SYSTEM = `Você é o analista sênior da SVI, agência de marketing inteligente.

Pra cada cliente, você gera **5 a 10 insights** focados no NICHO do cliente, mixando:
- "news": notícias relevantes do setor nos últimos 30 dias (cite a fonte real)
- "content_idea": ideias acionáveis de conteúdo (post, reels, vídeo) baseadas em tendências atuais
- "opportunity": oportunidades de mercado, sazonalidade, movimentos da concorrência
- "risk": riscos regulatórios, perda de relevância, ameaças
- "recommendation": recomendação tática (ex: "aumentar budget em horário X", "testar criativo Y")

Se houver dados internos (leads, spend), use-os pra contextualizar. Sem dados, foque em nicho + tendências.

Formato resposta — JSON puro, sem markdown, sem cerca, sem texto antes/depois:
[
  {
    "kind": "news|content_idea|opportunity|risk|recommendation",
    "title": "máx 80 chars",
    "body": "1-3 frases acionáveis, máx 350 chars",
    "severity": "info|low|medium|high|critical",
    "source_label": "Nome da fonte (opcional, só pra news)",
    "source_url": "URL completa (opcional, só pra news)"
  }
]

Regras: PT-BR direto, sem floreio. Sempre cite fonte real em news. Ideias de conteúdo devem ser específicas (não "fale sobre saúde", e sim "Reels mostrando 3 sinais de refluxo em bebê"). Se nada útil: devolva [].`;

export async function generateInsightsForClient(clientId: string) {
  const ctx = await getClientContext(clientId);
  if (!ctx) return { created: 0, skipped: true };

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.error('[insights] PERPLEXITY_API_KEY ausente');
    return { created: 0, skipped: true };
  }

  const segmento = ctx.segment || ctx.company || 'negócio desse cliente';
  const hasInternalData = ctx.leads_30d > 0 || ctx.spend_30d > 0;

  const userPrompt = `Cliente: ${ctx.name} (${ctx.company || ctx.name})
Segmento: ${segmento}
${hasInternalData ? `
Dados internos últimos 30d:
- Leads: ${ctx.leads_30d} (vs ${ctx.leads_prev30d} antes)
- Investido: R$ ${ctx.spend_30d.toFixed(2)}
- Ganhos: ${ctx.won_30d}
- Campanhas ativas: ${ctx.campaigns_active}
` : '(Sem dados internos ainda — foque 100% em inteligência de nicho.)'}

Gere 5-10 insights mixando news (com fonte real), content_idea (acionáveis pra hoje), opportunity, risk e recommendation. Considere o que está em alta no setor "${segmento}" nas últimas 4 semanas no Brasil.`;

  const res = await fetch(PERPLEXITY_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt }],
      max_tokens: 3000,
      temperature: 0.3,
      // Perplexity busca web por default em sonar-reasoning-pro
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[insights] perplexity err', res.status, errText.slice(0, 200));
    return { created: 0, skipped: false };
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = (data.choices?.[0]?.message?.content || '').trim();
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Tenta extrair JSON array
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('[insights] sem JSON na resposta', cleaned.slice(0, 200));
    return { created: 0, skipped: false };
  }

  let insights: Array<{
    kind: string; title: string; body: string; severity: string;
    source_label?: string; source_url?: string;
  }> = [];
  try {
    insights = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(insights)) insights = [];
  } catch (e) {
    console.error('[insights] parse err', e);
    return { created: 0, skipped: false };
  }

  if (insights.length === 0) return { created: 0, skipped: false };

  const VALID_KINDS = ['campaign_analysis','creative_fatigue','recommendation','win_pattern','risk','copy_suggestion','news','content_idea','opportunity'];
  const VALID_SEVERITY = ['info','low','medium','high','critical'];

  const admin = createAdminClient();
  const rows = insights.slice(0, 12).map((i) => ({
    client_id: clientId,
    kind: VALID_KINDS.includes(i.kind) ? i.kind : 'recommendation',
    title: String(i.title || '').slice(0, 120),
    body: String(i.body || '').slice(0, 1000),
    severity: VALID_SEVERITY.includes(i.severity) ? i.severity : 'info',
    source_label: i.source_label ? String(i.source_label).slice(0, 80) : null,
    source_url: i.source_url ? String(i.source_url).slice(0, 500) : null,
  })).filter(r => r.title.length > 3 && r.body.length > 10);

  if (rows.length === 0) return { created: 0, skipped: false };

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
