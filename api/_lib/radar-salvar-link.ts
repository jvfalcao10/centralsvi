import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAdminClient } from './supabase.js';

/**
 * Salvar um conteúdo pelo link, sem passar por perfil.
 *
 * João, 22/10/2026: "não quero por perfil e sim link de conteúdo que deu bom".
 * Ele colou um reel no campo do radar e a tela respondeu que não achava o
 * perfil, porque `radar_add_profile` lê o primeiro pedaço do endereço e em
 * `/reel/DaVEm67qmCM/` esse pedaço é "reel".
 *
 * Aqui o caminho é outro: lê aquele post, guarda o número do dia em que foi
 * salvo e pendura no cliente escolhido. O perfil entra junto porque o post
 * precisa de dono, mas não vira perfil vigiado: quem garimpa por link não quer
 * coleta diária, quer guardar o que já viu funcionar.
 *
 * Aceita reel, foto e carrossel. Para foto e carrossel o Instagram não entrega
 * visualização, então o card mostra curtida e comentário e o campo fica vazio,
 * em vez de inventar número.
 */

const ACTOR = 'apify~instagram-scraper';
const EQUIPE = ['admin', 'manager', 'seller', 'executor', 'traffic', 'social', 'design'];

type PostLido = {
  external_id: string;
  handle: string;
  url: string;
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  duration_s: number | null;
  published_at: string | null;
  thumb_origem: string | null;
  video_url: string | null;
  tipo: string;
};

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? Math.round(valor) : null;
}

function texto(valor: unknown, limite: number): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.slice(0, limite) : null;
}

/** Devolve o código do post e o endereço limpo, sem rastreador na query. */
export function lerEnderecoDoPost(bruto: string): { codigo: string; url: string; tipo: 'reel' | 'post' } | null {
  const limpo = String(bruto || '').trim();
  const achado = limpo.match(/instagram\.com\/(?:[A-Za-z0-9._]+\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,})/i);
  if (!achado) return null;
  const tipo = achado[1].toLowerCase() === 'p' ? 'post' : 'reel';
  const pasta = tipo === 'post' ? 'p' : 'reel';
  return { codigo: achado[2], url: `https://www.instagram.com/${pasta}/${achado[2]}/`, tipo };
}

export function normalizarUm(bruto: any): PostLido | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const external_id = bruto.shortCode || bruto.shortcode;
  const handle = bruto.ownerUsername || bruto.username;
  if (typeof external_id !== 'string' || typeof handle !== 'string') return null;
  const tipo = String(bruto.type || bruto.productType || '').toLowerCase();
  const ehVideo = ['video', 'clips', 'reel', 'reels'].includes(tipo) || !!bruto.videoUrl;
  return {
    external_id,
    handle,
    url: `https://www.instagram.com/${ehVideo ? 'reel' : 'p'}/${external_id}/`,
    caption: texto(bruto.caption, 4000),
    views: numero(bruto.videoPlayCount) ?? numero(bruto.videoViewCount),
    likes: numero(bruto.likesCount),
    comments: numero(bruto.commentsCount),
    duration_s: typeof bruto.videoDuration === 'number' ? bruto.videoDuration : null,
    published_at: texto(bruto.timestamp, 40),
    thumb_origem: texto(bruto.displayUrl, 2048),
    video_url: texto(bruto.videoUrl, 2048),
    tipo: ehVideo ? 'video' : 'imagem',
  };
}

/** A imagem do Instagram expira e bloqueia uso fora do site, então vira cópia nossa. */
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

export async function handleRadarSalvarLink(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo_nao_permitido' });

  const db = createAdminClient();
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'Entre na Central para salvar referência.' });
  const { data: sessao, error: erroSessao } = await db.auth.getUser(bearer);
  if (erroSessao || !sessao.user) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });

  const { data: papeis } = await db.from('user_roles').select('role').eq('user_id', sessao.user.id);
  const daCasa = !!papeis?.some(p => EQUIPE.includes(p.role));

  // Cliente logado não escolhe de quem é a referência: é sempre dele.
  const { data: proprio } = await db.from('clients').select('id').eq('user_id', sessao.user.id).maybeSingle();
  const clienteDoCorpo = texto((req.body || {}).client_id, 64);
  const clientId = proprio?.id || (daCasa ? clienteDoCorpo : null);
  if (!clientId) {
    return res.status(daCasa ? 400 : 403).json({
      error: daCasa ? 'Escolha o cliente antes de salvar a referência.' : 'Acesso restrito.',
    });
  }

  const endereco = lerEnderecoDoPost(texto((req.body || {}).url, 600) || '');
  if (!endereco) {
    return res.status(400).json({ error: 'Esse link não é de um post do Instagram. Cole o endereço de um reel, foto ou carrossel.' });
  }

  const apifyToken = (process.env.APIFY_TOKEN || '').trim();
  if (!apifyToken) return res.status(503).json({ error: 'Leitor de conteúdo sem configuração. Avise o João.' });

  let bruto: any[] = [];
  try {
    const resposta = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(apifyToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directUrls: [endereco.url], resultsType: 'posts', resultsLimit: 1, addParentData: false }),
      },
    );
    if (!resposta.ok) {
      // A mensagem do fornecedor pode trazer a consulta inteira e não sobe pro cliente.
      return res.status(502).json({ error: `O Instagram não devolveu esse post agora (HTTP ${resposta.status}). Tenta de novo em um minuto.` });
    }
    const dados = await resposta.json();
    bruto = Array.isArray(dados) ? dados : [];
  } catch {
    return res.status(502).json({ error: 'Não consegui falar com o leitor de conteúdo agora.' });
  }

  const post = bruto.map(normalizarUm).find(Boolean) as PostLido | undefined;
  if (!post) {
    return res.status(422).json({ error: 'Não consegui ler esse post. Se o perfil for fechado, o Instagram não deixa.' });
  }

  const handle = post.handle.toLowerCase();
  await db.from('radar_profiles').upsert({ platform: 'instagram', handle }, { onConflict: 'platform,handle' });
  const { data: perfil } = await db
    .from('radar_profiles').select('id')
    .eq('platform', 'instagram').eq('handle', handle).maybeSingle();
  if (!perfil) return res.status(500).json({ error: 'Não consegui registrar o perfil do post.' });

  const { data: jaTinha } = await db
    .from('radar_posts').select('id, thumb_url')
    .eq('platform', 'instagram').eq('external_id', post.external_id).maybeSingle();

  const thumb = jaTinha?.thumb_url || (await guardarCapa(db, post.external_id, post.thumb_origem));
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
    last_seen_at: new Date().toISOString(),
  };

  let postId = jaTinha?.id as string | undefined;
  if (postId) {
    await db.from('radar_posts').update(linha).eq('id', postId);
  } else {
    const { data: criado, error } = await db.from('radar_posts').insert(linha).select('id').maybeSingle();
    if (error || !criado) return res.status(500).json({ error: 'Não consegui guardar esse post.' });
    postId = criado.id as string;
  }

  const { error: erroSave } = await db
    .from('radar_saves')
    .upsert(
      { client_id: clientId, post_id: postId, saved_by: sessao.user.id },
      { onConflict: 'client_id,post_id', ignoreDuplicates: true },
    );
  if (erroSave) return res.status(500).json({ error: 'Li o post, mas não consegui pendurar no cliente.' });

  return res.status(200).json({
    ok: true,
    handle,
    tipo: post.tipo,
    views: post.views,
    likes: post.likes,
    comments: post.comments,
  });
}
