import type { createAdminClient } from './supabase.js'
import { publicationGraph } from './social-publication-meta.js'
type DB = ReturnType<typeof createAdminClient>

/**
 * Quanto cada cliente já postou no mês, contra a régua da casa.
 *
 * Regra do João, atualizada em 19/10/2026: cada cliente recebe **1 a 2 flyers
 * e 1 a 2 vídeos por semana**, ou seja 4 a 8 de cada por mês. Story fora.
 *
 * O vídeo varia por um motivo concreto: sempre sai 1 produzido pelo Matheus, e
 * vira 2 quando existe caixinha, POV ou algo do tipo da Sarah. Sem isso, não
 * se inventa a segunda peça.
 *
 * A régua anterior, de 11/10, era 4 a 6 feed e **4 vídeos** por mês. Medido em
 * setembro fechado, nas 18 contas: a casa entregou média de **1,2 flyer e 1,7
 * vídeo por semana**, ou seja o vídeo já rodava a quase o dobro do alvo. A
 * tela cobrava todo mundo contra um número que a casa não praticava mais.
 *
 * A origem continua valendo: a auditoria de 11/10 achou contas de 2 a 25 posts
 * por mês sem critério, e volume não trouxe resultado, a Dra. Ênia postou o
 * dobro e a mediana de engajamento caiu de 82 para 19. O teto existe para isso.
 *
 * Isso vivia num painel separado, cadencia.svicompany.com.br. João, 19/10:
 * "a cadência deve estar dentro da Central SVI, porque quero que a social
 * media tenha acesso". Aqui a lista de contas não é fixa: sai de
 * `central_social_client_accounts`, que é a mesma que publica, então cliente
 * novo aparece sozinho.
 */
export const META = { feedMin: 4, feedMax: 8, video: 4, videoMax: 8 }

/** Story não entra na conta: sai do ar em 24h e não é entrega de feed. */
const CAMPOS = 'id,timestamp,media_type,media_product_type,permalink,like_count,comments_count,media_url,thumbnail_url'

export type ContaDaCadencia = { client: string; account_id: string; account_username: string }
export type Publicacao = { timestamp: string; media_type?: string; media_product_type?: string; permalink?: string; like_count?: number; comments_count?: number; media_url?: string; thumbnail_url?: string }
/** O que a tela mostra quando alguém abre um cliente. */
export type PostRecente = { timestamp: string; tipo: 'feed' | 'video'; permalink: string | null; curtidas: number | null; comentarios: number | null; capa: string | null }

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
   // Vídeo não tem media_url servível como imagem: a capa dele é o
   // thumbnail_url. Em foto e carrossel, media_url já é a imagem.
   capa: m.thumbnail_url || m.media_url || null,
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

export type StatusCadencia = 'em dia' | 'atrasado' | 'parado' | 'acima' | 'sem acesso' | 'sem conta'

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
 // O teto agora vale nos dois: até 19/10 só o feed tinha limite, e conta com
 // 16 vídeos no mês passava como "em dia".
 if (p.feed > META.feedMax || p.video > META.videoMax) return 'acima'
 // Margem de uma peça: cobrar no dia exato do ritmo deixaria quase todo mundo
 // atrasado o tempo todo, e aviso que toca sempre ninguém escuta.
 const esperadoFeed = META.feedMin * p.fracao - 1
 const esperadoVideo = META.video * p.fracao - 1
 if (p.feed < esperadoFeed || p.video < esperadoVideo) return 'atrasado'
 return 'em dia'
}

/** Sem acento, minúsculo: "DRA ERIKA FIGUEIREDO" e "Dra Erika Figueredo" precisam casar. */
const chave = (v: string) =>
 String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Casa a conta de Instagram com o cliente da carteira.
 *
 * Os dois nomes são digitados por pessoas diferentes em telas diferentes, e
 * divergem: a Dra. Erika está como "Figueiredo" na conta e "Figueredo" na
 * carteira. Por isso o encontro é por pedaço de nome, não por igualdade.
 */
export function mesmoCliente(a: string, b: string) {
 const x = chave(a), y = chave(b)
 if (!x || !y) return false
 if (x === y || x.includes(y) || y.includes(x)) return true
 // Duas palavras de peso em comum bastam, comparadas pelo começo: "figueiredo"
 // e "figueredo" são a mesma pessoa escrita por duas mãos. O título sai da
 // conta, senão "dra" sozinha aproximaria todas as médicas.
 const TITULOS = new Set(['dra', 'dr', 'sra', 'sr', 'clinica', 'espaco'])
 const pesadas = (v: string) => v.split(' ').filter(p => p.length > 3 && !TITULOS.has(p)).map(p => p.slice(0, 5))
 const px = pesadas(x), py = new Set(pesadas(y))
 let juntas = 0
 for (const p of px) if (py.has(p)) juntas++
 return juntas >= 2
}

export async function cadenciaDoMes(db: DB, agora = Date.now()) {
 // A fonte de quem DEVE aparecer é a carteira, não a lista de contas de
 // publicação. João, 19/10/2026: "cadência com clientes que não tá ativo e
 // faltando os ativos, LIV e TE Mulher". A lista de contas trazia quem já saiu
 // (Vanessa Back) e escondia nove clientes ativos sem conta cadastrada.
 const [{ data: contasRaw, error }, { data: carteiraRaw }] = await Promise.all([
  db.from('central_social_client_accounts').select('client,account_id,account_username').order('client'),
  // `social_ativo` é o liga-desliga da cadência, separado do status do
  // contrato. João, 19/10/2026: "tirar Essenc, Fórmula, Médic, MJC, Números".
  // São clientes ativos da casa que não têm carteira de social media, e por
  // isso apareciam eternamente como 0/4 cobrando uma entrega que não existe.
  db.from('clients').select('name,status').eq('status', 'ativo').eq('social_ativo', true),
 ])
 if (error) throw new Error('cadencia_contas_leitura_falhou')
 const carteira = (carteiraRaw || []) as { name: string }[]
 // Só conta de cliente que ainda está na casa.
 const contas = ((contasRaw || []) as ContaDaCadencia[])
  .filter(c => carteira.some(x => mesmoCliente(c.client, x.name)))
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
 // Cliente ativo sem conta cadastrada aparece dizendo isso, em vez de sumir.
 // Sumir calado foi justamente o que escondeu a Clínica LIV.
 const semConta = carteira
  .filter(x => !contas.some(c => mesmoCliente(c.client, x.name)))
  .map(x => ({
   client: x.name, username: '', feed: 0, video: 0, ultimo: null, ultimoLink: null,
   status: 'sem conta' as StatusCadencia, recentes: [] as PostRecente[],
  }))
 return { geradoEm: new Date().toISOString(), dia, diasNoMes, meta: META, clientes: [...clientes, ...semConta] }
}
