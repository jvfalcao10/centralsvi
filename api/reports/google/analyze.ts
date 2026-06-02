import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createUserClient, createAdminClient } from '../../_lib/supabase.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const BUCKET = 'gbp-reports';

const schema = z.object({
  clientId: z.string().uuid(),
  periodLabel: z.string().max(60).optional().default(''),
  analysis: z.string().max(6000).optional().default(''),
  reviewMessages: z.string().max(4000).optional().default(''),
  images: z
    .array(
      z.object({
        data: z.string().min(10), // base64 puro (sem prefixo data:)
        mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']).default('image/jpeg'),
      }),
    )
    .min(1)
    .max(12),
});

const SYSTEM = [
  'Voce FORMATA relatorios de Google Meu Negocio (Google Business Profile) pra uma agencia. Voce NAO inventa: organiza.',
  'Recebe (a) prints do painel de Desempenho do Google, numerados de 1 a N na ordem enviada, e (b) o texto de analise que a equipe escreveu.',
  'Transforma os dois num relatorio claro pro cliente final ler no celular, no mesmo espirito de um relatorio premium.',
  '',
  'Suas tarefas:',
  '1. modules: para CADA imagem, crie um modulo com image_index (numero da imagem), titulo (o que a imagem mostra, ex "Ligacoes pelo perfil", "Cliques no chat", "Antes e depois"), valor (o numero principal visivel como string, ex "39"; se a imagem nao tiver um numero unico deixe ""), delta_pct (a variacao percentual com sinal, ex 18.2 ou -19.6, ou null se nao houver), legenda (1 frase factual descrevendo o print).',
  '2. metrics: resuma os principais KPIs em 4 a 6 cards de visao geral, com os numeros lidos (key, label, current, previous, delta_pct, unit).',
  '3. diagnostico: organize em pontos (gargalos e oportunidades; cada um com tipo "gargalo" ou "oportunidade", titulo e texto) e acoes (proximos passos; cada um com titulo e texto). Baseie-se na analise da equipe e nos numeros dos prints.',
  '4. resumo_cliente, destaque: 2-3 frases resumindo a quinzena/periodo e a frase de maior impacto.',
  '',
  'REGRAS CRITICAS:',
  '- Numeros e percentuais: SOMENTE os que voce le nas imagens. NUNCA invente.',
  '- Quando a equipe escreveu analise, priorize as ideias dela. Nao adicione afirmacao que contradiz os dados.',
  '- Linguagem simples, sem jargao. Leitor e o dono do negocio. Postura humilde, sem soberba.',
  '- Responda APENAS com um objeto JSON valido, sem texto antes ou depois, sem markdown.',
  '',
  'Formato exato do JSON:',
  '{',
  '  "period_inferred": "Maio 2026",',
  '  "metrics": [ { "key": "interacoes", "label": "Interacoes no perfil", "current": 160, "previous": 151, "delta_pct": 6, "unit": "" } ],',
  '  "modules": [ { "image_index": 1, "titulo": "Ligacoes pelo perfil", "valor": "39", "delta_pct": 18.2, "legenda": "Ligacoes iniciadas pelo perfil, fechando maio em 14 chamadas." } ],',
  '  "resumo_cliente": "2 a 3 frases simples resumindo o mes",',
  '  "destaque": "a frase de maior impacto do mes",',
  '  "diagnostico": {',
  '    "pontos": [ { "tipo": "gargalo", "titulo": "Caminho para o site quase inexistente", "texto": "..." } ],',
  '    "acoes": [ { "titulo": "Corrigir e validar o link do site", "texto": "..." } ]',
  '  },',
  '  "observacoes": "ressalvas, prints ilegiveis ou dados ausentes"',
  '}',
].join('\n');

/**
 * Recebe os prints do painel GMN, sobe pro Storage, extrai metricas + modulos
 * via Claude Vision, organiza a analise da equipe e salva o relatorio (draft).
 * Auth: staff SVI (RLS via painel_is_svi_team na tabela google_reports).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'anthropic_not_configured' });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', detail: parsed.error.flatten() });
  const { clientId, periodLabel, analysis: teamAnalysis, reviewMessages, images } = parsed.data;

  // Roda como o usuario logado — RLS garante que so staff SVI cria.
  const sb = createUserClient(req.headers.authorization || null);
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return res.status(401).json({ error: 'unauthorized' });

  const { data: client, error: clientErr } = await sb
    .from('clients')
    .select('id, name, slug')
    .eq('id', clientId)
    .maybeSingle();
  if (clientErr || !client) return res.status(404).json({ error: 'client_not_found' });

  // 1. Slug publico unico (definido antes pra nomear os arquivos no Storage)
  const slugify = (s: string) =>
    s.toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  const slug = `${slugify(client.slug || client.name || 'cliente') || 'cliente'}-${slugify(periodLabel) || 'rel'}-${rand}`;

  // 2. Sobe os prints pro Storage (service role) e guarda as URLs publicas
  const admin = createAdminClient();
  const urls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const ext = images[i].mediaType.split('/')[1] || 'jpg';
    const path = `${slug}/${i + 1}.${ext}`;
    const buf = Buffer.from(images[i].data, 'base64');
    const up = await admin.storage.from(BUCKET).upload(path, buf, { contentType: images[i].mediaType, upsert: true });
    if (up.error) return res.status(500).json({ error: 'storage_failed', detail: up.error.message });
    urls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }

  // 3. Claude Vision le os prints e organiza
  const content: any[] = [];
  images.forEach((img, i) => {
    content.push({ type: 'text', text: `Imagem ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
  });
  content.push({
    type: 'text',
    text:
      `Periodo informado pela equipe: ${periodLabel || '(nao informado, infira pelos prints)'}.\n\n` +
      `ANALISE ESCRITA PELA EQUIPE (priorize estas ideias):\n${teamAnalysis || '(equipe nao escreveu analise — organize a partir dos numeros dos prints)'}\n\n` +
      'Leia os numeros dos prints e gere o relatorio no formato JSON definido. Lembre: um modulo por imagem, na ordem.',
  });

  let analysis: any;
  try {
    const aiRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 5000, system: SYSTEM, messages: [{ role: 'user', content }] }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text().catch(() => '');
      return res.status(502).json({ error: `anthropic_${aiRes.status}`, detail: t.slice(0, 300) });
    }
    const data = (await aiRes.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = data.content?.find((b) => b.type === 'text')?.text || '';
    analysis = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch (e: any) {
    return res.status(502).json({ error: 'ai_parse_failed', detail: String(e?.message || e).slice(0, 200) });
  }

  // 4. Liga cada modulo ao print correspondente (image_index 1-based)
  const modules = (Array.isArray(analysis.modules) ? analysis.modules : []).map((m: any) => {
    const idx = Number(m.image_index) - 1;
    return {
      titulo: m.titulo || '',
      valor: m.valor != null ? String(m.valor) : '',
      delta_pct: typeof m.delta_pct === 'number' ? m.delta_pct : null,
      legenda: m.legenda || '',
      image_url: urls[idx] || urls[0] || '',
    };
  });
  // Garante que todo print enviado aparece, mesmo que a IA nao tenha citado
  urls.forEach((u, i) => {
    if (!modules.some((m: any) => m.image_url === u)) {
      modules.push({ titulo: `Print ${i + 1}`, valor: '', delta_pct: null, legenda: '', image_url: u });
    }
  });

  const metrics = Array.isArray(analysis.metrics) ? analysis.metrics : [];
  const diagnostico = {
    pontos: Array.isArray(analysis.diagnostico?.pontos) ? analysis.diagnostico.pontos : [],
    acoes: Array.isArray(analysis.diagnostico?.acoes) ? analysis.diagnostico.acoes : [],
  };
  const period = periodLabel || analysis.period_inferred || '';

  // 5. Salva (draft)
  const { data: row, error: insErr } = await sb
    .from('google_reports')
    .insert({
      client_id: clientId,
      client_name: client.name || '',
      slug,
      period_label: period,
      metrics,
      analysis: {
        resumo_cliente: analysis.resumo_cliente || '',
        destaque: analysis.destaque || '',
        observacoes: analysis.observacoes || '',
        modules,
        diagnostico,
      },
      review_messages: reviewMessages,
      status: 'draft',
      created_by: auth.user.id,
    })
    .select('id, slug, client_name, period_label, metrics, analysis, review_messages, status')
    .single();

  if (insErr) return res.status(500).json({ error: 'save_failed', detail: insErr.message });

  return res.status(200).json({ ok: true, report: row });
}

export const config = { maxDuration: 90 };
