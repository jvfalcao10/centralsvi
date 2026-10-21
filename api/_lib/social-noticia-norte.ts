import type { createAdminClient } from './supabase.js'
import { saudacao } from './social-client-message.js'
type DB = ReturnType<typeof createAdminClient>

/**
 * A notícia da semana da Norte Capital.
 *
 * João, 21/10/2026: "Norte segue 1 normal por semana e 1 notícia pra enviar
 * pro Elpídio escolher". A conta passou a ter duas peças por semana: a normal
 * do lote aprovado, na terça, e uma NOTÍCIA na quinta, escolhida por ele.
 *
 * A matéria-prima já existia e estava parada: o Radar da Central captura
 * notícia de agro para a Norte todo dia, com gancho de pauta pronto em cada
 * uma. Só na semana de 21/10 eram 15, sendo 8 de relevância alta. Ninguém
 * olhava. Aqui elas viram escolha de cliente toda segunda de manhã, o que dá
 * três dias para produzir a peça da quinta.
 */
export const NORTE = {
 client: 'Norte Capital',
 client_id: 'eb55f97f-989b-4792-ac65-a5ce67e61f16',
 jid: '120363422788943235@g.us',
}

export type Noticia = { title: string; source: string; url: string; relevance: string; summary: string; captured_at: string }

/** Uma semana. Notícia de agro mais velha que isso já não é notícia. */
const JANELA = 7 * 86400000
const QUANTAS = 3

/** O gancho que o Radar já escreveu, sem o rótulo. */
export function ganchoDaNoticia(summary: string) {
 const m = String(summary || '').match(/Gancho de pauta:\s*(.+)$/s)
 const texto = (m ? m[1] : String(summary || '')).trim().replace(/\s+/g, ' ')
 return texto.length > 160 ? texto.slice(0, 157).trimEnd() + '...' : texto
}

/**
 * As três mais fortes, sem repetir o que já foi oferecido.
 *
 * Relevância alta primeiro, e dentro dela a mais recente. Notícia de cotação
 * envelhece em horas, então o que chegou hoje vale mais que o de terça.
 */
export function melhoresNoticias(noticias: Noticia[], jaOferecidas: Set<string>, agora = Date.now()) {
 const peso = (r: string) => (r === 'alta' ? 0 : r === 'media' ? 1 : 2)
 return noticias
  .filter(n => !jaOferecidas.has(n.url))
  .map(n => ({ n, ms: Date.parse(n.captured_at) }))
  .filter(({ ms }) => Number.isFinite(ms) && agora - ms <= JANELA)
  .sort((a, b) => peso(a.n.relevance) - peso(b.n.relevance) || b.ms - a.ms)
  .slice(0, QUANTAS)
  .map(({ n }) => n)
}

export function textoDaNoticia(noticias: Noticia[], agora = Date.now()) {
 const itens = noticias.map((n, i) => `*${i + 1}.* ${n.title}\n${ganchoDaNoticia(n.summary)}\n_${n.source}_`)
 return [`${saudacao(agora)}, Elpídio!`, '',
  'Separei as notícias mais fortes da semana no agro. Me diz o número da que você quer que vire post na quinta:',
  '', itens.join('\n\n'), '',
  'Se nenhuma dessas for o assunto da semana, me fala o tema que eu monto.'].join('\n')
}

export async function oferecerNoticiaNorte(
 db: DB, enviar: (jid: string, texto: string) => Promise<void>, agora = Date.now(),
) {
 const { data, error } = await db.from('content_trends')
  .select('title,source,url,relevance,summary,captured_at')
  .eq('client_id', NORTE.client_id).gte('captured_at', new Date(agora - JANELA).toISOString()).limit(60)
 if (error) throw new Error('noticia_norte_leitura_falhou')
 // O que já foi oferecido fica num recibo, que é a mesma mesa usada para os
 // eventos de grupo. Sem isso a mesma manchete voltaria toda semana.
 const { data: recibos } = await db.from('central_social_intake_receipts')
  .select('result').eq('chat_id', NORTE.jid).like('id', 'norte-noticia:%').limit(200)
 const jaOferecidas = new Set<string>((recibos || []).flatMap((r: { result: { urls?: string[] } }) => r.result?.urls || []))
 const escolhidas = melhoresNoticias((data || []) as Noticia[], jaOferecidas, agora)
 if (!escolhidas.length) return { oferecidas: 0 }
 await enviar(NORTE.jid, textoDaNoticia(escolhidas, agora))
 await db.from('central_social_intake_receipts').insert({
  id: `norte-noticia:${new Date(agora).toISOString().slice(0, 10)}`, chat_id: NORTE.jid,
  result: { urls: escolhidas.map(n => n.url), titulos: escolhidas.map(n => n.title) },
 })
 return { oferecidas: escolhidas.length }
}
