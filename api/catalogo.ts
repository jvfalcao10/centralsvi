import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createUserClient } from './_lib/supabase.js';

export const config = { maxDuration: 60 };

/**
 * Catalogo SVI — inventario unico do que a casa criou.
 *
 * Responde 3 perguntas:
 *   1. O QUE EXISTE  -> lista tudo (Vercel + n8n), buscavel
 *   2. ESTA NO AR?   -> health check HTTP + ultima execucao do workflow
 *   3. TERMINADO?    -> flags de inacabado (sem dominio, parado, off, duplicado)
 *
 * GET /api/catalogo            -> inventario (rapido, ~2s)
 * GET /api/catalogo?health=1   -> inventario + health check (lento, ~20s)
 */

type Status = 'ok' | 'atencao' | 'quebrado' | 'dormente' | 'desconhecido';

interface Item {
  id: string;
  nome: string;
  tipo: 'site' | 'workflow';
  url: string | null;
  dominioProprio: boolean;
  criadoEm: string | null;
  atualizadoEm: string | null;
  diasParado: number | null;
  ativo: boolean | null;
  status: Status;
  httpStatus: number | null;
  ultimaExecucao: { em: string; status: string } | null;
  flags: string[];
  grupo: string;
}

const DIA = 86400000;

function dias(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DIA);
}

/** Raiz do nome, pra detectar familia de duplicados (spanature, spa-nature, spanaturedetox...). */
function raiz(nome: string): string {
  return nome
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(svi|site|dr|dra|clinica|projeto)/, '')
    .slice(0, 9);
}

/** Executa promises com concorrencia limitada. */
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

// ---------------------------------------------------------------- Vercel

async function vercelFetch(caminho: string, token: string, teamId?: string) {
  const sep = caminho.includes('?') ? '&' : '?';
  const url = `https://api.vercel.com${caminho}${teamId ? `${sep}teamId=${teamId}` : ''}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Vercel ${caminho} -> ${r.status} ${await r.text().catch(() => '')}`);
  return r.json() as Promise<any>;
}

async function coletarVercel(token: string): Promise<Item[]> {
  // Descobre os escopos (pessoal + times) pra nao perder projeto nenhum.
  const escopos: (string | undefined)[] = [undefined];
  try {
    const { teams } = await vercelFetch('/v2/teams?limit=20', token);
    for (const t of teams || []) escopos.push(t.id);
  } catch {
    /* token pessoal sem acesso a times — segue so com o escopo pessoal */
  }

  const vistos = new Map<string, any>();
  for (const teamId of escopos) {
    let until: number | undefined;
    for (let pagina = 0; pagina < 10; pagina++) {
      const q = `/v9/projects?limit=100${until ? `&until=${until}` : ''}`;
      let dados: any;
      try {
        dados = await vercelFetch(q, token, teamId);
      } catch {
        break;
      }
      for (const p of dados.projects || []) if (!vistos.has(p.id)) vistos.set(p.id, p);
      const prox = dados.pagination?.next;
      if (!prox) break;
      until = prox;
    }
  }

  return [...vistos.values()].map((p: any) => {
    const prod = p.targets?.production;
    const aliases: string[] = prod?.alias || [];
    const proprio = aliases.find((a) => !a.endsWith('.vercel.app'));
    const url = proprio ? `https://${proprio}` : aliases[0] ? `https://${aliases[0]}` : null;
    const atualizadoEm = prod?.createdAt ? new Date(prod.createdAt).toISOString() : null;
    const parado = dias(atualizadoEm);

    const flags: string[] = [];
    if (!prod) flags.push('nunca subiu pra producao');
    if (prod && !proprio) flags.push('sem dominio proprio');
    if (parado !== null && parado > 90) flags.push(`sem deploy ha ${parado}d`);
    if (prod?.readyState && prod.readyState !== 'READY') flags.push(`build ${prod.readyState}`);

    return {
      id: `vercel:${p.id}`,
      nome: p.name,
      tipo: 'site' as const,
      url,
      dominioProprio: Boolean(proprio),
      criadoEm: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      atualizadoEm,
      diasParado: parado,
      ativo: null,
      status: 'desconhecido' as Status,
      httpStatus: null,
      ultimaExecucao: null,
      flags,
      grupo: raiz(p.name),
    };
  });
}

// ---------------------------------------------------------------- n8n

async function coletarN8n(base: string, chave: string): Promise<Item[]> {
  const raiz_ = base.replace(/\/+$/, '');
  const headers = { 'X-N8N-API-KEY': chave, accept: 'application/json' };

  const wfs: any[] = [];
  let cursor: string | undefined;
  for (let pagina = 0; pagina < 10; pagina++) {
    const u = `${raiz_}/api/v1/workflows?limit=250${cursor ? `&cursor=${cursor}` : ''}`;
    const r = await fetch(u, { headers });
    if (!r.ok) throw new Error(`n8n workflows -> ${r.status}`);
    const d: any = await r.json();
    wfs.push(...(d.data || []));
    if (!d.nextCursor) break;
    cursor = d.nextCursor;
  }

  // Ultima execucao por workflow (uma varredura das execucoes recentes).
  const ultima = new Map<string, { em: string; status: string }>();
  try {
    let ec: string | undefined;
    for (let pagina = 0; pagina < 4; pagina++) {
      const u = `${raiz_}/api/v1/executions?limit=250&includeData=false${ec ? `&cursor=${ec}` : ''}`;
      const r = await fetch(u, { headers });
      if (!r.ok) break;
      const d: any = await r.json();
      for (const e of d.data || []) {
        const wid = String(e.workflowId);
        if (!ultima.has(wid)) {
          ultima.set(wid, { em: e.startedAt || e.createdAt, status: e.status || 'unknown' });
        }
      }
      if (!d.nextCursor) break;
      ec = d.nextCursor;
    }
  } catch {
    /* sem historico de execucao — o inventario continua valido */
  }

  return wfs.map((w: any) => {
    const exec = ultima.get(String(w.id)) || null;
    const parado = dias(w.updatedAt || null);
    const flags: string[] = [];
    let status: Status = 'ok';

    if (!w.active) {
      flags.push('desligado');
      status = 'atencao';
      if (!exec) {
        flags.push('nunca rodou');
        status = 'dormente';
      }
    }
    if (exec && ['error', 'crashed', 'failed'].includes(exec.status)) {
      flags.push(`ultima execucao: ${exec.status}`);
      status = 'quebrado';
    }
    if (w.active && !exec) {
      flags.push('ligado mas sem execucao recente');
      status = 'atencao';
    }
    if (parado !== null && parado > 90) flags.push(`sem edicao ha ${parado}d`);

    return {
      id: `n8n:${w.id}`,
      nome: w.name,
      tipo: 'workflow' as const,
      url: `${raiz_}/workflow/${w.id}`,
      dominioProprio: true,
      criadoEm: w.createdAt || null,
      atualizadoEm: w.updatedAt || null,
      diasParado: parado,
      ativo: Boolean(w.active),
      status,
      httpStatus: null,
      ultimaExecucao: exec,
      flags,
      grupo: raiz(w.name),
    };
  });
}

// ---------------------------------------------------------------- health

async function checarUrl(url: string): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'CatalogoSVI/1.0 (health-check)' },
    });
    return r.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function aplicarHealth(itens: Item[]) {
  const sites = itens.filter((i) => i.tipo === 'site' && i.url);
  await pool(sites, 25, async (item) => {
    const code = await checarUrl(item.url!);
    item.httpStatus = code;
    if (code === null) {
      item.status = 'quebrado';
      item.flags.push('nao respondeu');
    } else if (code >= 500) {
      item.status = 'quebrado';
      item.flags.push(`HTTP ${code}`);
    } else if (code === 404 || code === 410) {
      item.status = 'quebrado';
      item.flags.push(`HTTP ${code}`);
    } else if (code === 401 || code === 403) {
      item.status = 'atencao';
      item.flags.push(`protegido (HTTP ${code})`);
    } else if (code < 400) {
      item.status = item.dominioProprio ? 'ok' : 'atencao';
    } else {
      item.status = 'atencao';
      item.flags.push(`HTTP ${code}`);
    }
    // Site no ar, mas abandonado ha muito tempo e sem dominio: candidato a matar.
    if (item.status !== 'quebrado' && !item.dominioProprio && (item.diasParado ?? 0) > 90) {
      item.status = 'dormente';
    }
  });
}

// ---------------------------------------------------------------- handler

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Mesmo padrao dos outros endpoints: exige sessao valida do Supabase.
  try {
    const sb = createUserClient(req.headers.authorization || null);
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return res.status(401).json({ error: 'nao_autenticado' });
  } catch (e: any) {
    return res.status(500).json({ error: 'auth_indisponivel', detalhe: e?.message });
  }

  const vercelToken = process.env.VERCEL_TOKEN;
  const n8nUrl = process.env.N8N_API_URL;
  const n8nKey = process.env.N8N_API_KEY;

  const itens: Item[] = [];
  const fontes: Record<string, { ok: boolean; total: number; erro?: string }> = {};

  const [rv, rn] = await Promise.allSettled([
    vercelToken ? coletarVercel(vercelToken) : Promise.reject(new Error('VERCEL_TOKEN ausente')),
    n8nUrl && n8nKey
      ? coletarN8n(n8nUrl, n8nKey)
      : Promise.reject(new Error('N8N_API_URL ou N8N_API_KEY ausente')),
  ]);

  if (rv.status === 'fulfilled') {
    itens.push(...rv.value);
    fontes.vercel = { ok: true, total: rv.value.length };
  } else {
    fontes.vercel = { ok: false, total: 0, erro: String(rv.reason?.message || rv.reason) };
  }

  if (rn.status === 'fulfilled') {
    itens.push(...rn.value);
    fontes.n8n = { ok: true, total: rn.value.length };
  } else {
    fontes.n8n = { ok: false, total: 0, erro: String(rn.reason?.message || rn.reason) };
  }

  if (req.query.health === '1') {
    await aplicarHealth(itens);
  }

  // Duplicados: mesma raiz de nome, mesmo tipo, 2+ itens.
  const familias = new Map<string, Item[]>();
  for (const i of itens) {
    if (!i.grupo) continue;
    const k = `${i.tipo}:${i.grupo}`;
    familias.set(k, [...(familias.get(k) || []), i]);
  }
  for (const [, membros] of familias) {
    if (membros.length < 2) continue;
    for (const m of membros) {
      m.flags.push(`possivel duplicado (${membros.length} com nome parecido)`);
    }
  }

  itens.sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));

  const inacabados = itens.filter((i) => i.flags.length > 0);
  const problemas = itens.filter((i) => i.status === 'quebrado');

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    geradoEm: new Date().toISOString(),
    comHealth: req.query.health === '1',
    fontes,
    resumo: {
      total: itens.length,
      sites: itens.filter((i) => i.tipo === 'site').length,
      workflows: itens.filter((i) => i.tipo === 'workflow').length,
      quebrados: problemas.length,
      dormentes: itens.filter((i) => i.status === 'dormente').length,
      inacabados: inacabados.length,
    },
    itens,
  });
}
