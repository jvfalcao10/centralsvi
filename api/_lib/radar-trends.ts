import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAdminClient } from './supabase.js';

/**
 * Radar de tendências: notícia quente do nicho de cada cliente.
 *
 * Complementa o Radar de Reels. Lá a pergunta é "que formato performou";
 * aqui é "o que está acontecendo no mercado dele esta semana", que é o que
 * dá assunto para a pauta.
 *
 * A busca é por segmento, não por cliente: dois clientes de varejo recebem a
 * mesma leitura de mercado e a consulta roda uma vez só.
 *
 * O que vem daqui é notícia com fonte e link, não conselho. O resumo diz por
 * que aquilo interessa a quem produz conteúdo no nicho, e nada mais.
 */

const ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const MODELO = 'sonar';
const SEGMENTOS_POR_LOTE = 4;
const ITENS_POR_SEGMENTO = 4;
const TIMEOUT_MS = 45000;
const JANELA_DIAS = 10;

const RELEVANCIAS = ['alta', 'media', 'baixa'] as const;

const PROMPT = `Você acompanha o noticiário setorial brasileiro para uma agência de marketing.
Receberá um segmento de mercado. Devolva as notícias e mudanças recentes mais
relevantes desse segmento no Brasil, dos últimos dias.

Regras:
- Só o que tem fonte pública verificável, com link direto para a matéria.
- Prefira o que mudou agora: decisão, regra nova, dado divulgado, fato do setor.
- Nada de conselho técnico, diagnóstico, prescrição ou promessa de resultado.
- Em segmento de saúde, trate como notícia do setor, nunca como orientação clínica.
- O resumo explica em uma ou duas frases por que isso interessa a quem produz
  conteúdo nesse nicho, e o gancho sugere o ângulo de pauta, sem prometer nada.
- Se não houver nada relevante e recente, devolva a lista vazia. Não invente.
Responda apenas no formato JSON pedido, em português do Brasil.`;

type Item = {
  titulo: string;
  fonte: string;
  url: string;
  data: string | null;
  resumo: string;
  gancho: string;
  relevancia: string;
};

const ESQUEMA = {
  type: 'object',
  properties: {
    itens: {
      type: 'array',
      maxItems: ITENS_POR_SEGMENTO,
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          fonte: { type: 'string' },
          url: { type: 'string' },
          data: { type: 'string' },
          resumo: { type: 'string' },
          gancho: { type: 'string' },
          relevancia: { type: 'string', enum: [...RELEVANCIAS] },
        },
        required: ['titulo', 'fonte', 'url', 'resumo', 'gancho', 'relevancia'],
        additionalProperties: false,
      },
    },
  },
  required: ['itens'],
  additionalProperties: false,
};

function urlPublica(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > 2048) return null;
  try {
    const endereco = new URL(valor);
    return endereco.protocol === 'https:' && endereco.hostname.includes('.') ? endereco.href : null;
  } catch {
    return null;
  }
}

function texto(valor: unknown, limite: number): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.replace(/\s+/g, ' ').trim();
  return limpo ? limpo.slice(0, limite) : null;
}

async function buscarSegmento(segmento: string, chave: string): Promise<Item[]> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      signal: controle.signal,
      body: JSON.stringify({
        model: MODELO,
        temperature: 0.2,
        max_tokens: 1600,
        search_recency_filter: 'week',
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: `Segmento: ${segmento}. País: Brasil.` },
        ],
        response_format: { type: 'json_schema', json_schema: { schema: ESQUEMA } },
      }),
    });
    if (!resposta.ok) {
      throw new Error(`busca devolveu HTTP ${resposta.status}`);
    }
    const bruto = await resposta.json();
    const conteudo = bruto?.choices?.[0]?.message?.content;
    if (typeof conteudo !== 'string') return [];
    const dados = JSON.parse(conteudo);
    return Array.isArray(dados?.itens) ? dados.itens : [];
  } finally {
    clearTimeout(relogio);
  }
}

export async function handleRadarTrends(req: VercelRequest, res: VercelResponse) {
  const segredo = (process.env.CRON_SECRET || '').trim();
  if (!segredo) {
    return res.status(503).json({ ok: false, error: 'cron_secret_ausente' });
  }
  if ((req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() !== segredo) {
    return res.status(401).json({ ok: false, error: 'nao_autorizado' });
  }

  const chave = (process.env.PERPLEXITY_API_KEY || '').trim();
  if (!chave) {
    return res.status(503).json({ ok: false, error: 'busca_nao_configurada' });
  }

  const admin = createAdminClient();
  const inicio = new Date().toISOString();

  const { data: clientes, error: erroClientes } = await admin
    .from('clients')
    .select('id, segment')
    .not('segment', 'is', null);

  if (erroClientes) {
    return res.status(502).json({ ok: false, error: 'clientes_indisponiveis', detalhe: erroClientes.message });
  }

  // Um segmento, uma consulta, mesmo que vários clientes compartilhem.
  const porSegmento = new Map<string, string[]>();
  for (const cliente of clientes || []) {
    const segmento = texto((cliente as any).segment, 120);
    if (!segmento) continue;
    if (!porSegmento.has(segmento)) porSegmento.set(segmento, []);
    porSegmento.get(segmento)!.push((cliente as any).id);
  }

  const segmentos = [...porSegmento.keys()];
  if (!segmentos.length) {
    return res.status(200).json({ ok: true, message: 'nenhum segmento cadastrado', segmentos: 0 });
  }

  // O que já entrou recentemente não entra de novo, nem que a busca repita a fonte.
  const desde = new Date(Date.now() - JANELA_DIAS * 86400000).toISOString();
  const { data: recentes } = await admin
    .from('content_trends')
    .select('client_id, url')
    .gte('captured_at', desde);
  const jaVistos = new Set(
    (recentes || []).map((linha: any) => `${linha.client_id}::${linha.url}`),
  );

  let inseridos = 0;
  let encontrados = 0;
  const falhas: string[] = [];

  for (let i = 0; i < segmentos.length; i += SEGMENTOS_POR_LOTE) {
    const lote = segmentos.slice(i, i + SEGMENTOS_POR_LOTE);
    const resultados = await Promise.all(
      lote.map(async segmento => {
        try {
          return { segmento, itens: await buscarSegmento(segmento, chave) };
        } catch (e: any) {
          falhas.push(`${segmento}: ${String(e?.message || 'falha').slice(0, 120)}`);
          return { segmento, itens: [] as Item[] };
        }
      }),
    );

    for (const { segmento, itens } of resultados) {
      const alvos = porSegmento.get(segmento) || [];
      for (const item of itens) {
        const url = urlPublica(item?.url);
        const titulo = texto(item?.titulo, 300);
        const fonte = texto(item?.fonte, 120);
        if (!url || !titulo || !fonte) continue;
        encontrados += 1;

        const relevancia = RELEVANCIAS.includes(item?.relevancia as any)
          ? (item.relevancia as string)
          : 'media';
        const resumo = [texto(item?.resumo, 700), texto(item?.gancho, 400)]
          .filter(Boolean)
          .join(' Gancho de pauta: ');

        for (const clientId of alvos) {
          const marca = `${clientId}::${url}`;
          if (jaVistos.has(marca)) continue;
          jaVistos.add(marca);
          const { error } = await admin.from('content_trends').insert({
            client_id: clientId,
            title: titulo,
            source: fonte,
            url,
            relevance: relevancia,
            category: segmento,
            summary: resumo,
            captured_at: new Date().toISOString(),
          });
          if (!error) inseridos += 1;
        }
      }
    }
  }

  await admin.from('radar_collections').insert({
    source: 'trends',
    profiles_count: segmentos.length,
    items_read: encontrados,
    posts_new: inseridos,
    highlights: 0,
    cost_usd: null,
    ok: falhas.length === 0,
    message: falhas.length ? falhas.slice(0, 5).join(' | ').slice(0, 300) : null,
    started_at: inicio,
    finished_at: new Date().toISOString(),
  });

  console.log(
    `radar-trends: ${segmentos.length} segmentos, ${encontrados} itens, ${inseridos} gravados, ${falhas.length} falhas`,
  );

  return res.status(200).json({
    ok: falhas.length === 0,
    segmentos: segmentos.length,
    itens_encontrados: encontrados,
    trends_gravadas: inseridos,
    falhas: falhas.slice(0, 5),
  });
}
