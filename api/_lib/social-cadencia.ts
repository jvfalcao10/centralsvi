import type { createAdminClient } from './supabase.js'
import { publicationGraph } from './social-publication-meta.js'
type DB = ReturnType<typeof createAdminClient>

/**
 * Quanto cada cliente já postou no mês, contra a régua da casa.
 *
 * Regra do João, 11/10/2026: cada cliente da carteira recebe **4 a 6 posts de
 * feed e 4 vídeos por mês, somente**. Nem menos, nem mais. A auditoria daquele
 * dia achou contas de 2 a 25 posts por mês sem critério, e volume não trouxe
 * resultado: a Dra. Ênia postou o dobro e a mediana de engajamento caiu de 82
 * para 19.
 *
 * Isso vivia num painel separado, cadencia.svicompany.com.br. João, 19/10:
 * "a cadência deve estar dentro da Central SVI, porque quero que a social
 * media tenha acesso". Aqui a lista de contas não é fixa: sai de
 * `central_social_client_accounts`, que é a mesma que publica, então cliente
 * novo aparece sozinho.
 */
export const META = { feedMin: 4, feedMax: 6, video: 4 }

/** Story não entra na conta: sai do ar em 24h e não é entrega de feed. */
const CAMPOS = 'id,timestamp,media_type,media_product_type,permalink,like_count,comments_count'

export type ContaDaCadencia = { client: string; account_id: string; account_username: string }
export type Publicacao = { timestamp: string; media_type?: string; media_product_type?: string; permalink?: string; like_count?: number; comments_count?: number }
/** O que a tela mostra quando alguém abre um cliente. */
export type PostRecente = { timestamp: string; tipo: 'feed' | 'video'; permalink: string | null; curtidas: number | null; comentarios: number | null }

/** Quantas publicações aparecem ao abrir o cliente. Uma tela, sem rolagem. */
const RECENTES = 8

/**
 * As últimas publicações, da mais nova para a mais velha.
 *
 * João, 19/10/2026: "quero clicar no cliente e abrir o link das últimas
 * postagens". Ver o número do mês não diz o que foi publicado; o link diz.
 */
export function ultimasPublicacoes(midias: Publicacao[]): PostRecente[] {
 return midias
  .filter(m => m.media_product_type !== 'STORY')
  .slice()
  .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  .slice(0, RECENTES)
  .map(m => ({
   timestamp: m.timestamp,
   tipo: m.media_product_type === 'REELS' || m.media_type === 'VIDEO' ? 'video' : 'feed',
   permalink: m.permalink || null,
   curtidas: typeof m.like_count === 'number' ? m.like_count : null,
   comentarios: typeof m.comments_count === 'number' ? m.comments_count : null,
  }))
}

/** Começo do mês corrente em Brasília, como instante UTC. */
export function inicioDoMes(agora = Date.now()) {
 const br = new Date(agora - 3 * 3600000)
 return Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1, 3)
}

/** Em que ponto do mês estamos, de 0 a 1. Dia 15 de 30 é 0,5. */
export function fracaoDoMes(agora = Date.now()) {
 const br = new Date(agora - 3 * 3600000)
 const dias = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth() + 1, 0)).getUTCDate()
 return { dia: br.getUTCDate(), diasNoMes: dias, fracao: br.getUTCDate() / dias }
}

export function separarPorTipo(midias: Publicacao[], desde: number) {
 // Story sai primeiro, antes de qualquer outra conta. O painel antigo
 // classificava por `media_type === 'VIDEO'` sem tirar story da frente, e um
 // story de vídeo entrava como vídeo da cadência. Hoje a Graph não devolve
 // story em /media, então isso nunca apareceu, mas a conta estava errada e
 // dependia de um detalhe da API para não aparecer.
 const doMes = midias.filter(m => Date.parse(m.timestamp) >= desde && m.media_product_type !== 'STORY')
 const ehVideo = (m: Publicacao) => m.media_product_type === 'REELS' || m.media_type === 'VIDEO'
 return { video: doMes.filter(ehVideo).length, feed: doMes.filter(m => !ehVideo(m)).length }
}

export type StatusCadencia = 'em dia' | 'atrasado' | 'parado' | 'acima' | 'sem acesso'

/**
 * O recado em uma palavra.
 *
 * "Atrasado" compara com o ritmo esperado PARA O DIA do mês, não com a meta
 * cheia: dia 10 com 1 post não é atraso, dia 28 com 1 post é. "Parado" é mais
 * grave e ganha da conta: sete dias sem publicar nada, mesmo que o número do
 * mês ainda feche.
 */
export function statusDaConta(p: {
 feed: number; video: number; ultimo: string | null; fracao: number; agora?: number
}): StatusCadencia {
 const agora = p.agora ?? Date.now()
 if (p.ultimo && agora - Date.parse(p.ultimo) > 7 * 86400000) return 'parado'
 if (p.feed > META.feedMax) return 'acima'
 // Margem de uma peça: cobrar no dia exato do ritmo deixaria quase todo mundo
 // atrasado o tempo todo, e aviso que toca sempre ninguém escuta.
 const esperadoFeed = META.feedMin * p.fracao - 1
 const esperadoVideo = META.video * p.fracao - 1
 if (p.feed < esperadoFeed || p.video < esperadoVideo) return 'atrasado'
 return 'em dia'
}

export async function cadenciaDoMes(db: DB, agora = Date.now()) {
 const { data, error } = await db.from('central_social_client_accounts')
  .select('client,account_id,account_username').order('client')
 if (error) throw new Error('cadencia_contas_leitura_falhou')
 const contas = (data || []) as ContaDaCadencia[]
 const desde = inicioDoMes(agora)
 const { dia, diasNoMes, fracao } = fracaoDoMes(agora)
 const clientes = await Promise.all(contas.map(async c => {
  try {
   const d = await publicationGraph('GET', `${c.account_id}/media`, { fields: CAMPOS, limit: '60' })
   const midias = (d?.data || []) as Publicacao[]
   const { feed, video } = separarPorTipo(midias, desde)
   const ultimo = midias.length ? midias.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)) : null
   return {
    client: c.client, username: c.account_username, feed, video,
    ultimo: ultimo?.timestamp || null, ultimoLink: ultimo?.permalink || null,
    status: statusDaConta({ feed, video, ultimo: ultimo?.timestamp || null, fracao, agora }),
    recentes: ultimasPublicacoes(midias),
   }
  } catch {
   // Uma conta sem acesso não pode derrubar o painel das outras dezessete.
   return { client: c.client, username: c.account_username, feed: 0, video: 0,
    ultimo: null, ultimoLink: null, status: 'sem acesso' as StatusCadencia, recentes: [] as PostRecente[] }
  }
 }))
 return { geradoEm: new Date().toISOString(), dia, diasNoMes, meta: META, clientes }
}
