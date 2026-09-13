import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAdminClient } from './supabase.js';

/**
 * Coleta diária do Radar de conteúdo.
 *
 * A pergunta que isto responde não é "o que existe", e sim "o que saiu acima do
 * que este perfil costuma fazer". Por isso a régua é a mediana de visualizações
 * do próprio perfil, acumulada no banco a cada rodada. Número absoluto grande
 * não vira destaque sozinho.
 *
 * O perfil é compartilhado entre clientes: se três clientes vigiam o mesmo @,
 * a coleta roda uma vez e serve os três. Quem liga cliente e perfil é a
 * watchlist, e é a RLS que separa quem vê o quê.
 */

const ACTOR = 'apify~instagram-scraper';
const CUSTO_POR_ITEM = 0.0027;
const MULTIPLO_DESTAQUE = 2;
const JANELA_DIAS = 45;
const MINIMO_PARA_BASELINE = 6;
const PERFIS_POR_RODADA = 8;
const POSTS_POR_PERFIL_PRIMEIRA_VEZ = 30;
const POSTS_POR_PERFIL_DEPOIS = 12;

type PerfilRow = {
  id: string;
  handle: string;
  last_collected_at: string | null;
};

type PostNormalizado = {
  external_id: string;
  handle: string;
  url: string;
  caption: string | null;
  views: number;
  likes: number | null;
  comments: number | null;
  duration_s: number | null;
  published_at: string | null;
  thumb_origem: string | null;
  video_url: string | null;
};

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? Math.round(valor) : null;
}

function texto(valor: unknown, limite: number): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.slice(0, limite) : null;
}

function normalizarPost(bruto: any): PostNormalizado | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const external_id = bruto.shortCode || bruto.shortcode;
  const handle = bruto.ownerUsername || bruto.username;
  if (typeof external_id !== 'string' || typeof handle !== 'string') return null;

  // Só vídeo entra: a comparação é por visualização, e foto não tem essa métrica.
  const tipo = String(bruto.type || bruto.productType || '').toLowerCase();
  if (!['video', 'clips', 'reel', 'reels'].includes(tipo) && !bruto.videoUrl) return null;

  const views = numero(bruto.videoPlayCount) ?? numero(bruto.videoViewCount);
  if (views === null) return null;

  return {
    external_id,
    handle,
    url: `https://www.instagram.com/reel/${external_id}/`,
    caption: texto(bruto.caption, 4000),
    views,
    likes: numero(bruto.likesCount),
    comments: numero(bruto.commentsCount),
    duration_s: typeof bruto.videoDuration === 'number' ? bruto.videoDuration : null,
    published_at: texto(bruto.timestamp, 40),
    thumb_origem: texto(bruto.displayUrl, 2048),
    video_url: texto(bruto.videoUrl, 2048),
  };
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2;
}

async function chamarApify(handles: string[], limite: number, token: string): Promise<any[]> {
  const entrada = {
    directUrls: handles.map(handle => `https://www.instagram.com/${handle}/`),
    resultsType: 'posts',
    resultsLimit: limite,
    onlyPostsNewerThan: `${JANELA_DIAS * 3} days`,
    addParentData: false,
  };
  const resposta = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entrada),
    },
  );
  if (!resposta.ok) {
    // A mensagem do fornecedor pode conter a consulta e não sobe para o cliente.
    throw new Error(`coletor devolveu HTTP ${resposta.status}`);
  }
  const dados = await resposta.json();
  return Array.isArray(dados) ? dados : [];
}

/**
 * A imagem do Instagram expira e bloqueia uso fora do site, então a capa é
 * copiada para o storage. Falha aqui não derruba a coleta: o post entra sem capa.
 */
async function guardarCapa(admin: any, externalId: string, origem: string | null): Promise<string | null> {
  if (!origem) return null;
  try {
    const host = new URL(origem).hostname;
    if (!/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(host)) return null;
    const imagem = await fetch(origem);
    if (!imagem.ok) return null;
    const bytes = new Uint8Array(await imagem.arrayBuffer());
    if (!bytes.length || bytes.length > 6_000_000) return null;
    const caminho = `instagram/${externalId}.jpg`;
    const { error } = await admin.storage.from('radar').upload(caminho, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) return null;
    return admin.storage.from('radar').getPublicUrl(caminho).data.publicUrl as string;
  } catch {
    return null;
  }
}

export async function handleRadarColetar(req: VercelRequest, res: VercelResponse) {
  // Distingue os dois casos: sem segredo no servidor é configuração faltando,
  // segredo diferente é chamada não autorizada. Nenhum dos dois devolve o valor.
  const segredo = (process.env.CRON_SECRET || '').trim();
  if (!segredo) {
    return res.status(503).json({ ok: false, error: 'cron_secret_ausente' });
  }
  const enviado = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (enviado !== segredo) {
    // Só o tamanho do que chegou, para separar "não mandou nada" de "mandou errado".
    // Nada do segredo do servidor entra na resposta.
    return res.status(401).json({ ok: false, error: 'nao_autorizado', recebido_tamanho: enviado.length });
  }

  const apifyToken = process.env.APIFY_TOKEN || '';
  if (!apifyToken) {
    return res.status(503).json({ ok: false, error: 'coleta_nao_configurada' });
  }

  const admin = createAdminClient();
  const inicio = new Date().toISOString();

  // Toda saída deixa rastro: sem isso, uma rodada que não fez nada fica
  // indistinguível de uma rodada que falhou calada.
  const registrar = async (dados: Record<string, unknown>) => {
    await admin.from('radar_collections').insert({
      source: 'instagram',
      profiles_count: 0,
      items_read: 0,
      posts_new: 0,
      highlights: 0,
      cost_usd: 0,
      started_at: inicio,
      finished_at: new Date().toISOString(),
      ...dados,
    });
  };

  // Só perfil que alguém vigia entra na conta: perfil órfão não gera custo.
  const { data: vigiados, error: erroWatch } = await admin.from('radar_watchlist').select('profile_id');
  if (erroWatch) {
    await registrar({ ok: false, message: `watchlist: ${erroWatch.message}`.slice(0, 300) });
    return res.status(502).json({ ok: false, error: 'watchlist_indisponivel', detalhe: erroWatch.message });
  }
  const idsVigiados = [...new Set((vigiados || []).map((linha: any) => linha.profile_id))];
  if (!idsVigiados.length) {
    await registrar({ ok: true, message: 'nenhum perfil vigiado' });
    return res.status(200).json({ ok: true, message: 'nenhum perfil vigiado', perfis: 0 });
  }

  const { data: perfis, error: erroPerfis } = await admin
    .from('radar_profiles')
    .select('id, handle, last_collected_at')
    .in('id', idsVigiados)
    .eq('active', true)
    .eq('platform', 'instagram')
    .order('last_collected_at', { ascending: true, nullsFirst: true })
    .limit(PERFIS_POR_RODADA);

  if (erroPerfis) {
    await registrar({ ok: false, message: `perfis: ${erroPerfis.message}`.slice(0, 300) });
    return res.status(502).json({ ok: false, error: 'perfis_indisponiveis', detalhe: erroPerfis.message });
  }

  const lista = (perfis || []) as PerfilRow[];
  if (!lista.length) {
    await registrar({
      ok: true,
      message: `nenhum perfil ativo entre os ${idsVigiados.length} vigiados`,
    });
    return res.status(200).json({
      ok: true, message: 'nenhum perfil ativo', perfis: 0, vigiados: idsVigiados.length,
    });
  }

  // Perfil novo precisa de história para ter mediana; perfil conhecido só do que é novo.
  const primeiraVez = lista.filter(perfil => !perfil.last_collected_at);
  const conhecidos = lista.filter(perfil => perfil.last_collected_at);

  let brutos: any[] = [];
  let erro: string | null = null;
  try {
    if (primeiraVez.length) {
      brutos = brutos.concat(
        await chamarApify(primeiraVez.map(p => p.handle), POSTS_POR_PERFIL_PRIMEIRA_VEZ, apifyToken),
      );
    }
    if (conhecidos.length) {
      brutos = brutos.concat(
        await chamarApify(conhecidos.map(p => p.handle), POSTS_POR_PERFIL_DEPOIS, apifyToken),
      );
    }
  } catch (e: any) {
    erro = String(e?.message || 'falha na coleta').slice(0, 300);
    console.error('radar: falha ao coletar', erro);
  }

  const porHandle = new Map<string, PostNormalizado[]>();
  for (const bruto of brutos) {
    const post = normalizarPost(bruto);
    if (!post) continue;
    const chave = post.handle.toLowerCase();
    if (!porHandle.has(chave)) porHandle.set(chave, []);
    porHandle.get(chave)!.push(post);
  }

  let novos = 0;
  let destaques = 0;
  const agora = new Date().toISOString();
  const corte = new Date(Date.now() - JANELA_DIAS * 86400000).toISOString();

  for (const perfil of lista) {
    const coletados = porHandle.get(perfil.handle.toLowerCase()) || [];
    if (!coletados.length) {
      await admin.from('radar_profiles').update({
        last_collected_at: agora,
        last_error: erro || 'nenhum reel público retornado',
      }).eq('id', perfil.id);
      continue;
    }

    for (const post of coletados) {
      const { data: existente } = await admin
        .from('radar_posts')
        .select('id, thumb_url')
        .eq('platform', 'instagram')
        .eq('external_id', post.external_id)
        .maybeSingle();

      const thumb = existente?.thumb_url || (await guardarCapa(admin, post.external_id, post.thumb_origem));
      const linha = {
        profile_id: perfil.id,
        platform: 'instagram',
        external_id: post.external_id,
        url: post.url,
        caption: post.caption,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        duration_s: post.duration_s,
        published_at: post.published_at,
        thumb_url: thumb,
        video_url: post.video_url,
        last_seen_at: agora,
      };
      if (existente) {
        await admin.from('radar_posts').update(linha).eq('id', existente.id);
      } else {
        await admin.from('radar_posts').insert(linha);
        novos += 1;
      }
    }

    // A mediana usa todo o histórico guardado do perfil, não só a rodada de hoje.
    const { data: historico } = await admin
      .from('radar_posts')
      .select('id, views, published_at')
      .eq('profile_id', perfil.id)
      .not('views', 'is', null);

    const valores = (historico || []).map((linha: any) => Number(linha.views)).filter((v: number) => v > 0);
    const medianaPerfil = mediana(valores);
    const confiavel = valores.length >= MINIMO_PARA_BASELINE && medianaPerfil > 0;

    await admin.from('radar_profiles').update({
      median_views: Math.round(medianaPerfil),
      sample_size: valores.length,
      median_updated_at: agora,
      last_collected_at: agora,
      last_error: null,
    }).eq('id', perfil.id);

    // Recalcula o selo de todo post do perfil dentro da janela: quando a mediana
    // muda, um destaque de ontem pode deixar de ser destaque.
    for (const linha of historico || []) {
      const dentroDaJanela = linha.published_at && linha.published_at >= corte;
      const vezes = medianaPerfil > 0 ? Number((Number(linha.views) / medianaPerfil).toFixed(1)) : null;
      const destaque = Boolean(confiavel && dentroDaJanela && vezes !== null && vezes >= MULTIPLO_DESTAQUE);
      if (destaque) destaques += 1;
      await admin.from('radar_posts')
        .update({ times_median: vezes, is_highlight: destaque })
        .eq('id', linha.id);
    }
  }

  await admin.from('radar_collections').insert({
    source: 'instagram',
    profiles_count: lista.length,
    items_read: brutos.length,
    posts_new: novos,
    highlights: destaques,
    cost_usd: Number((brutos.length * CUSTO_POR_ITEM).toFixed(4)),
    ok: !erro,
    message: erro,
    started_at: inicio,
    finished_at: new Date().toISOString(),
  });

  console.log(
    `radar: ${lista.length} perfis, ${brutos.length} itens lidos, ${novos} novos, ${destaques} destaques`,
  );
  return res.status(erro ? 502 : 200).json({
    ok: !erro,
    perfis: lista.length,
    itens_lidos: brutos.length,
    posts_novos: novos,
    destaques,
    custo_usd: Number((brutos.length * CUSTO_POR_ITEM).toFixed(4)),
    message: erro,
  });
}
