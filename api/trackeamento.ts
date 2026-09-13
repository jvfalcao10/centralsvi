import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createUserClient } from './_lib/supabase.js';

export const config = { maxDuration: 60 };

/**
 * Trackeamento CTWA da carteira: anuncio -> WhatsApp -> Meta.
 *
 * Responde 3 perguntas por cliente:
 *   1. O CANAL ESTA DE PE?   -> instancia conectada na UazAPI, no numero certo
 *   2. ESTA CHEGANDO MSG?    -> ultima execucao do workflow de captura
 *   3. A META RECEBEU?       -> ultimo lead de anuncio com resposta da Meta
 *
 * GET /api/trackeamento             -> canal + ultima captura (rapido)
 * GET /api/trackeamento?eventos=1   -> tambem varre execucoes atras do ultimo
 *                                      lead atribuido (lento, ~20s)
 *
 * O mapa abaixo e a fonte da verdade de quem esta no trackeamento. Cliente novo
 * entra aqui e na lista do workflow "SVI - Vigia do Trackeamento (30 min)".
 */

interface Cliente {
  nome: string;
  instancia: string;
  numero: string;
  wfCaptura: string | null;
  wfCrm: string | null;
  dataset: string;
  nota?: string;
}

const CLIENTES: Cliente[] = [
  { nome: 'Exatta Solar', instancia: 'exatta', numero: '559492860451', wfCaptura: 'iDzLh4n7VjrhhhxN', wfCrm: null, dataset: '1742905066703397' },
  { nome: 'Spa Nature', instancia: 'spanature', numero: '559491897714', wfCaptura: null, wfCrm: 'RPu7pK011BZYTslC', dataset: '1356447069415831', nota: 'captura no app Aura, o n8n so dispara o CAPI de hora em hora' },
  { nome: 'Alpha Fitness', instancia: 'ALPHAA', numero: '559492132746', wfCaptura: null, wfCrm: null, dataset: '1700315807871028', nota: 'captura e CAPI acontecem dentro do app alpha.svicompany.com.br' },
  { nome: 'Dr. Daniel', instancia: 'oR0Qkb', numero: '559492545689', wfCaptura: 'uwxnSk0WXO1sp4oI', wfCrm: 'c6ET5Cd0UNBvYtF9', dataset: '970871862055268' },
  { nome: 'Dr. Brenno', instancia: 'brenno', numero: '559492314183', wfCaptura: 'DWP0eqsUIuQLSFwY', wfCrm: '3LWnDDEK1gdfkyOV', dataset: '889546786872628' },
  { nome: 'PROURO', instancia: 'prouro', numero: '559491933660', wfCaptura: 'FHdF2ziAMf36Ny1E', wfCrm: '5R4cRJr8MwUHa9uT', dataset: '1730232391509692' },
  { nome: 'Dra. Erika', instancia: 'Dra erika figueiredo', numero: '5594936182546', wfCaptura: 'TfeyxOrjJWaBr6Bn', wfCrm: null, dataset: '1022295753649762' },
  { nome: 'Espaco Soraia', instancia: 'soraia', numero: '559491774204', wfCaptura: 'h2czxmpU5us2NZg3', wfCrm: null, dataset: '1063548639737169' },
  { nome: 'Carlotinha', instancia: 'carlotinha', numero: '559491106874', wfCaptura: '9QxNPClVKMHCDwwu', wfCrm: null, dataset: '1806775583795919' },
  { nome: 'Uzi Makeup', instancia: 'uzi', numero: '559481477117', wfCaptura: 'v01sHh2JMiH1G56G', wfCrm: null, dataset: '1572313347865021' },
  { nome: 'Dra. Esia', instancia: 'esia', numero: '559491300762', wfCaptura: 'asUTH9loGQM29LPI', wfCrm: null, dataset: '998651106111383' },
  { nome: 'GM Gas', instancia: 'gmgas', numero: '559491953700', wfCaptura: 'YcN5PFC2Qx7qhbBV', wfCrm: null, dataset: '1059395036971006' },
];

type Status = 'ok' | 'atencao' | 'quebrado' | 'aguardando_qr';

interface Linha {
  nome: string;
  instancia: string;
  numeroEsperado: string;
  numeroReal: string | null;
  conectado: boolean;
  numeroBate: boolean;
  status: Status;
  motivo: string;
  ultimaCaptura: string | null;
  horasSemCaptura: number | null;
  ultimoLeadAtribuido: { em: string; anuncio: string | null; metaAceitou: boolean } | null;
  linkWorkflow: string | null;
  linkEventsManager: string;
  nota?: string;
}

const HORA = 3600000;

function horasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / HORA);
}

/** Executa promises com concorrencia limitada, mesmo padrao do catalogo. */
async function pool<T, R>(itens: T[], limite: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let cursor = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (cursor < itens.length) {
      const i = cursor++;
      saida[i] = await fn(itens[i]);
    }
  });
  await Promise.all(trabalhadores);
  return saida;
}

async function lerInstancias(token: string): Promise<Record<string, any>> {
  const r = await fetch('https://svicompany.uazapi.com/instance/all', {
    headers: { admintoken: token },
  });
  if (!r.ok) throw new Error(`UazAPI /instance/all -> ${r.status}`);
  const bruto: any = await r.json();
  const lista: any[] = Array.isArray(bruto) ? bruto : bruto?.instances || bruto?.data || [];
  const porNome: Record<string, any> = {};
  for (const i of lista) if (i?.name) porNome[String(i.name)] = i;
  return porNome;
}

async function n8n(url: string, key: string, caminho: string): Promise<any> {
  const r = await fetch(`${url.replace(/\/$/, '')}${caminho}`, {
    headers: { 'X-N8N-API-KEY': key },
  });
  if (!r.ok) throw new Error(`n8n ${caminho} -> ${r.status}`);
  return r.json();
}

/** Ultima execucao do workflow, sem baixar os dados (rapido). */
async function ultimaExecucao(url: string, key: string, wf: string): Promise<string | null> {
  try {
    const d = await n8n(url, key, `/api/v1/executions?workflowId=${wf}&limit=1`);
    return d?.data?.[0]?.startedAt || null;
  } catch {
    return null;
  }
}

/**
 * Varre as ultimas execucoes atras do ultimo lead que veio de anuncio.
 * O no "Send Meta CAPI Lead" so roda quando o parser achou o clique, entao a
 * presenca dele ja e a prova de atribuicao.
 */
async function ultimoLeadAtribuido(url: string, key: string, wf: string, quantas: number) {
  try {
    const lista = await n8n(url, key, `/api/v1/executions?workflowId=${wf}&limit=${quantas}`);
    const ids: number[] = (lista?.data || []).map((e: any) => e.id);
    for (const id of ids) {
      const d = await n8n(url, key, `/api/v1/executions/${id}?includeData=true`);
      const run = d?.data?.resultData?.runData || {};
      const noCapi = Object.keys(run).find((n) => n.includes('CAPI'));
      if (!noCapi) continue;
      let metaAceitou = false;
      let anuncio: string | null = null;
      try {
        const resp = run[noCapi][0].data.main[0][0].json;
        metaAceitou = Number(resp?.events_received) > 0;
      } catch { /* resposta fora do formato esperado */ }
      try {
        const parse = Object.keys(run).find((n) => n.includes('Parse'));
        if (parse) anuncio = run[parse][0].data.main[0][0].json?.ad_title || null;
      } catch { /* sem titulo de anuncio no payload */ }
      return { em: d.startedAt as string, anuncio, metaAceitou };
    }
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  // Mesmo padrao dos outros endpoints: exige sessao valida do Supabase.
  try {
    const sb = createUserClient(req.headers.authorization || null);
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return res.status(401).json({ error: 'nao_autenticado' });
  } catch (e: any) {
    return res.status(500).json({ error: 'auth_indisponivel', detalhe: e?.message });
  }

  const adminToken = process.env.UAZAPI_ADMIN_TOKEN;
  const n8nUrl = process.env.N8N_API_URL;
  const n8nKey = process.env.N8N_API_KEY;
  const comEventos = req.query.eventos === '1';

  if (!adminToken) {
    return res.status(500).json({ error: 'config', detalhe: 'UAZAPI_ADMIN_TOKEN ausente' });
  }

  let instancias: Record<string, any> = {};
  const fontes: Record<string, { ok: boolean; erro?: string }> = {};
  try {
    instancias = await lerInstancias(adminToken);
    fontes.uazapi = { ok: true };
  } catch (e: any) {
    fontes.uazapi = { ok: false, erro: String(e?.message || e) };
  }
  fontes.n8n = n8nUrl && n8nKey ? { ok: true } : { ok: false, erro: 'N8N_API_URL ou N8N_API_KEY ausente' };

  const linhas: Linha[] = await pool(CLIENTES, 4, async (c) => {
    const inst = instancias[c.instancia];
    const conectado = Boolean(inst) && inst.status === 'connected';
    const numeroReal = inst ? String(inst.owner || '') || null : null;
    const numeroBate = numeroReal === c.numero;

    let status: Status;
    let motivo: string;
    if (!inst) {
      status = 'quebrado';
      motivo = 'a instancia nao existe mais na UazAPI';
    } else if (conectado && numeroBate) {
      status = 'ok';
      motivo = 'canal de pe';
    } else if (conectado && !numeroBate) {
      status = 'quebrado';
      motivo = `conectada em ${numeroReal || 'numero desconhecido'}, deveria ser ${c.numero}`;
    } else if (numeroReal) {
      status = 'quebrado';
      motivo = 'ja conectou antes e caiu, precisa parear de novo';
    } else {
      status = 'aguardando_qr';
      motivo = 'nunca conectou, esperando o QR';
    }

    let ultimaCaptura: string | null = null;
    if (n8nUrl && n8nKey && c.wfCaptura) {
      ultimaCaptura = await ultimaExecucao(n8nUrl, n8nKey, c.wfCaptura);
    }
    const horas = horasDesde(ultimaCaptura);

    // Canal de pe mas silencioso ha mais de um dia merece olhada.
    if (status === 'ok' && c.wfCaptura && horas !== null && horas >= 24) {
      status = 'atencao';
      motivo = `sem capturar mensagem ha ${horas}h`;
    }

    let ultimoLead = null;
    if (comEventos && n8nUrl && n8nKey && c.wfCaptura && status !== 'aguardando_qr') {
      ultimoLead = await ultimoLeadAtribuido(n8nUrl, n8nKey, c.wfCaptura, 15);
    }

    return {
      nome: c.nome,
      instancia: c.instancia,
      numeroEsperado: c.numero,
      numeroReal,
      conectado,
      numeroBate,
      status,
      motivo,
      ultimaCaptura,
      horasSemCaptura: horas,
      ultimoLeadAtribuido: ultimoLead,
      linkWorkflow: c.wfCaptura ? `https://n8n.svicompany.com.br/workflow/${c.wfCaptura}` : null,
      linkEventsManager: `https://business.facebook.com/events_manager2/list/dataset/${c.dataset}`,
      nota: c.nota,
    };
  });

  const resumo = {
    total: linhas.length,
    ok: linhas.filter((l) => l.status === 'ok').length,
    atencao: linhas.filter((l) => l.status === 'atencao').length,
    quebrado: linhas.filter((l) => l.status === 'quebrado').length,
    aguardandoQr: linhas.filter((l) => l.status === 'aguardando_qr').length,
  };

  return res.status(200).json({
    geradoEm: new Date().toISOString(),
    comEventos,
    fontes,
    resumo,
    linhas,
  });
}
