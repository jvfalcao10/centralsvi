import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAdminClient } from './supabase.js';

/**
 * Performance de anúncios ao vivo, lida direto da Meta.
 *
 * João, 22/10/2026: "performance de anúncios na Central deve aparecer lá tudo
 * pra não ter que ficar perguntando". A aba só mostrava o relatório de sexta
 * (weekly_traffic_reports), então passava a semana inteira parada no número
 * da sexta anterior. Aqui a conta é lida na hora: gasto, conversas, custo por
 * conversa, quem respondeu a segunda mensagem, leads e saldo das pré-pagas.
 *
 * Uma chamada por conta, com os seis períodos de uma vez (time_ranges), então
 * a carteira inteira volta em poucos segundos. Fica 5 minutos em memória para
 * a tela não bater na Meta a cada aba aberta; o botão de atualizar força.
 *
 * Mesmas réguas do relatório semanal: conversa é
 * messaging_conversation_started_7d e campanha com "Vaga" no nome fica de fora
 * (conversa de candidato não é cliente).
 */

const GRAPH = 'https://graph.facebook.com/v22.0';
const EQUIPE = ['admin', 'manager', 'seller', 'executor', 'traffic', 'social', 'design'];
const CONVERSA = 'onsite_conversion.messaging_conversation_started_7d';
const SEGUNDA = 'onsite_conversion.messaging_user_depth_2_message_send';
const SEM_VAGA = JSON.stringify([{ field: 'campaign.name', operator: 'NOT_CONTAIN', value: 'Vaga' }]);
const DIA_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = 5 * 60 * 1000;

export const PERIODOS = ['hoje', 'ontem', '7d', '7d_ant', '30d', '30d_ant'] as const;
type Periodo = typeof PERIODOS[number];

export type Numeros = {
  gasto: number;
  conversas: number;
  segunda: number;
  leads: number;
  impressoes: number;
  cliques: number;
};

export type Conta = {
  id: string;
  nome: string;
  status: number;
  saldo: number | null;
  cartao: string | null;
  diasDeSaldo: number | null;
  periodos: Record<Periodo, Numeros>;
};

/** Data de hoje em Brasília (UTC-3 o ano todo desde 2019), deslocada em dias. */
export function diaBrasilia(agora: number, deslocamento = 0): string {
  return new Date(agora - 3 * 60 * 60 * 1000 + deslocamento * DIA_MS).toISOString().slice(0, 10);
}

export function intervalos(agora: number): Record<Periodo, { since: string; until: string }> {
  const d = (n: number) => diaBrasilia(agora, n);
  return {
    hoje: { since: d(0), until: d(0) },
    ontem: { since: d(-1), until: d(-1) },
    '7d': { since: d(-7), until: d(-1) },
    '7d_ant': { since: d(-14), until: d(-8) },
    '30d': { since: d(-30), until: d(-1) },
    '30d_ant': { since: d(-60), until: d(-31) },
  };
}

const vazio = (): Numeros => ({ gasto: 0, conversas: 0, segunda: 0, leads: 0, impressoes: 0, cliques: 0 });

export function lerLinha(linha: any): Numeros {
  const acoes: Record<string, number> = {};
  for (const a of linha?.actions || []) acoes[a.action_type] = Number(a.value) || 0;
  return {
    gasto: Number(linha?.spend) || 0,
    conversas: acoes[CONVERSA] || 0,
    segunda: acoes[SEGUNDA] || 0,
    // "lead" já soma formulário nativo e site; o agrupado só entra quando ele não vem.
    leads: acoes.lead || acoes['onsite_conversion.lead_grouped'] || 0,
    impressoes: Number(linha?.impressions) || 0,
    cliques: Number(linha?.inline_link_clicks) || 0,
  };
}

/** "Saldo disponível (R$1.084,29 BRL)" vira 1084.29. Cartão não tem saldo. */
export function lerSaldo(texto: string | undefined | null): number | null {
  const m = /saldo[^R]*R\$\s*([\d.]+,\d{2}|[\d.]+)/i.exec(texto || '');
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** "C1 - Exatta", "CA 01 - TE Mulher", "C.A Urologia Redenção" viram só o nome do cliente. */
export function nomeLimpo(nome: string): string {
  return nome
    .replace(/^\s*(CONTA\s*\d+|CA\s*\d+|C\d+|C\.\s?A\.?)\s*[-|]?\s*/i, '')
    .trim() || nome;
}

async function graph(caminho: string, parametros: Record<string, string>, token: string, limiteMs = 25000) {
  const url = `${GRAPH}/${caminho}?${new URLSearchParams({ ...parametros, access_token: token })}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(limiteMs) });
  const corpo: any = await r.json().catch(() => ({}));
  if (!r.ok || corpo.error) throw new Error(corpo?.error?.message || `Meta respondeu ${r.status}`);
  return corpo;
}

async function emLotes<T, R>(itens: T[], tamanho: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(tamanho, itens.length) }, trabalhador));
  return saida;
}

let cache: { em: number; dados: any } | null = null;

export async function lerCarteira(token: string, rotulos: Map<string, string>) {
  const agora = Date.now();
  const faixas = intervalos(agora);
  const lista = await graph('me/adaccounts', {
    fields: 'name,account_id,account_status,amount_spent,funding_source_details',
    limit: '200',
  }, token);
  // Conta encerrada (101) ou que nunca gastou só atrasa a leitura: a Meta leva até 10 s para dizer que não tem nada.
  const vivas = (lista.data || []).filter((a: any) => a.account_status !== 101 && Number(a.amount_spent) > 0);

  const falhas: string[] = [];
  const contas = await emLotes<any, Conta | null>(vivas, 20, async (a) => {
    const periodos = Object.fromEntries(PERIODOS.map(p => [p, vazio()])) as Record<Periodo, Numeros>;
    try {
      const r = await graph(`act_${a.account_id}/insights`, {
        fields: 'spend,impressions,inline_link_clicks,actions',
        time_ranges: JSON.stringify(PERIODOS.map(p => faixas[p])),
        filtering: SEM_VAGA,
      }, token, 8000);
      for (const linha of r.data || []) {
        for (const p of PERIODOS) {
          if (faixas[p].since === linha.date_start && faixas[p].until === linha.date_stop) periodos[p] = lerLinha(linha);
        }
      }
    } catch {
      falhas.push(a.name);
      return null;
    }
    // Conta que não gastou nada em 60 dias não interessa a ninguém na tela.
    if (!PERIODOS.some(p => periodos[p].gasto > 0)) return null;
    const exibicao = a.funding_source_details?.display_string || '';
    const saldo = lerSaldo(exibicao);
    const porDia = periodos['7d'].gasto / 7;
    return {
      id: a.account_id,
      nome: rotulos.get(a.account_id) || nomeLimpo(a.name),
      status: a.account_status,
      saldo,
      cartao: saldo == null && exibicao ? exibicao : null,
      diasDeSaldo: saldo != null && porDia > 0 ? Math.round((saldo / porDia) * 10) / 10 : null,
      periodos,
    };
  });

  return {
    atualizadoEm: new Date(agora).toISOString(),
    intervalos: faixas,
    contas: contas.filter(Boolean),
    falhas,
  };
}

async function lerConjuntos(token: string, conta: string, periodo: Periodo) {
  const faixa = intervalos(Date.now())[periodo];
  const r = await graph(`act_${conta}/insights`, {
    level: 'adset',
    fields: 'campaign_name,adset_id,adset_name,spend,impressions,inline_link_clicks,frequency,actions',
    time_range: JSON.stringify(faixa),
    filtering: SEM_VAGA,
    limit: '200',
  }, token);
  return (r.data || [])
    .map((l: any) => ({
      id: l.adset_id,
      campanha: l.campaign_name,
      conjunto: l.adset_name,
      frequencia: Number(l.frequency) || 0,
      ...lerLinha(l),
    }))
    .filter((l: any) => l.gasto > 0)
    .sort((a: any, b: any) => b.gasto - a.gasto);
}

export async function handleAnunciosAoVivo(req: VercelRequest, res: VercelResponse) {
  // Conferência da chave sem login: diz só quantas contas ela enxerga, nenhum número de cliente.
  if (req.query.saude === '1') {
    const chave = (process.env.META_ADS_TOKEN || process.env.SOCIAL_IG_ACCESS_TOKEN || '').trim();
    if (!chave) return res.status(503).json({ ok: false, erro: 'sem chave' });
    try {
      const r = await graph('me/adaccounts', { fields: 'account_id', limit: '200' }, chave);
      return res.status(200).json({ ok: true, contas: (r.data || []).length });
    } catch (e: any) {
      return res.status(200).json({ ok: false, erro: String(e?.message || e).slice(0, 120) });
    }
  }

  const db = createAdminClient();
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'Entre na Central para ver os anúncios.' });
  const { data: sessao, error: erroSessao } = await db.auth.getUser(bearer);
  if (erroSessao || !sessao.user) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
  const { data: papeis } = await db.from('user_roles').select('role').eq('user_id', sessao.user.id);
  if (!papeis?.some(p => EQUIPE.includes(p.role))) return res.status(403).json({ error: 'Acesso restrito à equipe.' });

  const token = (process.env.META_ADS_TOKEN || process.env.SOCIAL_IG_ACCESS_TOKEN || '').trim();
  if (!token) return res.status(503).json({ error: 'Leitura da Meta sem configuração. Avise o João.' });

  res.setHeader('Cache-Control', 'no-store');
  try {
    const conta = String(req.query.conta || '').replace(/\D/g, '');
    if (conta) {
      const periodo = (PERIODOS as readonly string[]).includes(String(req.query.periodo)) ? req.query.periodo as Periodo : '7d';
      return res.status(200).json({ conjuntos: await lerConjuntos(token, conta, periodo) });
    }

    if (cache && Date.now() - cache.em < CACHE_MS && req.query.fresh !== '1') {
      return res.status(200).json({ ...cache.dados, doCache: true });
    }
    // O nome que a casa usa para o cliente é o do relatório semanal, não o da conta na Meta.
    const { data: relatorios } = await db
      .from('weekly_traffic_reports')
      .select('account_id,cliente_label,period_end')
      .order('period_end', { ascending: false })
      .limit(400);
    const rotulos = new Map<string, string>();
    for (const r of relatorios || []) {
      const id = String(r.account_id || '').replace(/\D/g, '');
      if (id && r.cliente_label && !rotulos.has(id)) rotulos.set(id, r.cliente_label);
    }
    const dados = await lerCarteira(token, rotulos);
    cache = { em: Date.now(), dados };
    return res.status(200).json(dados);
  } catch (e: any) {
    return res.status(502).json({ error: `Não consegui ler a Meta agora (${String(e?.message || e).slice(0, 160)}).` });
  }
}
