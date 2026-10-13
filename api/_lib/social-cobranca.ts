import type { createAdminClient } from './supabase.js'
import type { SocialAsset, SocialCard } from './social-domain.js'
import { clientFacingTitle } from './social-client-title.js'
import { saudacao } from './social-client-message.js'
type DB = ReturnType<typeof createAdminClient>

/**
 * Chamada diária das peças que pediram alteração e não voltaram.
 *
 * João, 13/10/2026: "o José já fez ajustes de várias artes e não atualizou lá
 * nem subiu lá para enviarmos para o cliente". Medido no quadro no mesmo dia:
 * as SEIS peças em ajuste tinham o arquivo mais novo ANTERIOR ao pedido de
 * alteração, uma delas parada há 16 dias, e a do Dia do Médico faltando 5 dias
 * para a data. O retorno ia para o grupo do designer uma vez e morria ali:
 * ninguém volta no quadro para conferir se o arquivo chegou.
 *
 * O que decide é o arquivo, não o status. Status muda em um clique e não
 * prova nada; peça só sai para o cliente quando existe arquivo novo.
 */

export type PecaParada = {
 card_id: string; author: string; client: string; title: string
 pedido_ms: number; arquivo_ms: number | null; dias: number; nota: string
}

/**
 * Data de um arquivo da peça.
 *
 * Os cards antigos guardam `date` em formatos diferentes: ISO nos que vieram
 * do WhatsApp e `dd/mm/aaaa hh:mm` em alguns do ClickUp. Formato que não
 * entende vira null, e null conta como "sem prova de arquivo novo", que é o
 * lado seguro: cobrar à toa custa uma mensagem, deixar passar custa o cliente.
 */
export function dataDoArquivo(a: SocialAsset): number | null {
 const bruto = String(a.date || '').trim()
 if (!bruto) return null
 const br = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?$/)
 const t = br
  ? Date.parse(`${br[3]}-${br[2]}-${br[1]}T${br[4] || '00'}:${br[5] || '00'}:00-03:00`)
  : Date.parse(bruto)
 return Number.isFinite(t) ? t : null
}

const DIA = 86400000

/** Corte no espaço, nunca no meio da palavra: "Dra Érika Figueire" fica feio. */
export function corta(valor: string, max: number) {
 const t = String(valor || '').replace(/\s+/g, ' ').trim()
 if (t.length <= max) return t
 const pedaco = t.slice(0, max)
 const espaco = pedaco.lastIndexOf(' ')
 return (espaco > max * 0.6 ? pedaco.slice(0, espaco) : pedaco).replace(/[,;:.]$/, '') + '…'
}

export function pecasParadas(cards: SocialCard[], agora = Date.now()): PecaParada[] {
 const paradas: PecaParada[] = []
 for (const card of cards) {
  if (card.stage !== 'ajustes') continue
  const pedido_ms = Date.parse(card.updated_at)
  if (!Number.isFinite(pedido_ms)) continue
  const datas = card.assets.map(dataDoArquivo).filter((t): t is number => t !== null)
  const arquivo_ms = datas.length ? Math.max(...datas) : null
  // Arquivo do mesmo minuto do pedido é o arquivo ANTIGO, aquele que o cliente
  // viu e reprovou. Só conta o que entrou DEPOIS.
  if (arquivo_ms !== null && arquivo_ms > pedido_ms) continue
  paradas.push({
   card_id: card.id, author: String(card.author || '').trim() || 'sem autor',
   client: card.client, title: clientFacingTitle(card.client, card.title),
   pedido_ms, arquivo_ms, dias: Math.floor((agora - pedido_ms) / DIA),
   nota: corta(String(card.note || ''), 140),
  })
 }
 return paradas.sort((a, b) => a.pedido_ms - b.pedido_ms)
}

const quanto = (dias: number) => dias <= 0 ? 'pedida hoje' : dias === 1 ? 'pedida ontem' : `pedida há ${dias} dias`

export function textoDoGrupo(pecas: PecaParada[], agora = Date.now()) {
 const linhas = pecas.map((p, i) => [
  `${i + 1}. *${p.client}* · ${p.title}`,
  `   alteração ${quanto(p.dias)}`,
  p.nota ? `   o que foi pedido: ${p.nota}` : '',
 ].filter(Boolean).join('\n'))
 const uma = pecas.length === 1
 return [`${saudacao(agora)}!`, '',
  uma ? 'Tem uma peça esperando a versão corrigida:' : `Tem ${pecas.length} peças esperando a versão corrigida:`,
  '', linhas.join('\n\n'), '',
  // Dizer o critério, e não só pedir: o José mudou o status e avisou que estava
  // pronto, sem arquivo novo em nenhum lugar.
  uma ? 'Sobe o arquivo corrigido na tarefa do ClickUp. Mudar o status não basta: enquanto não entra arquivo novo, a peça não vai para o cliente.'
      : 'Sobe os arquivos corrigidos nas tarefas do ClickUp. Mudar o status não basta: enquanto não entra arquivo novo, a peça não vai para o cliente.',
 ].join('\n')
}

export function textoDoJoao(pecas: PecaParada[], orfas: PecaParada[], agora = Date.now()) {
 const porAutor = new Map<string, PecaParada[]>()
 for (const p of pecas) porAutor.set(p.author, [...(porAutor.get(p.author) || []), p])
 const blocos = [...porAutor.entries()].map(([autor, lista]) => [
  `*${autor}* · ${lista.length}`,
  ...lista.map(p => `   ${p.client} · ${p.title} (${quanto(p.dias)})`),
 ].join('\n'))
 const texto = [`${saudacao(agora)}! Peças em ajuste sem arquivo novo:`, '', blocos.join('\n\n')]
 if (orfas.length) texto.push('', '*Sem responsável com grupo ativo, ninguém foi cobrado:*',
  ...orfas.map(p => `   ${p.author} · ${p.client} · ${p.title} (${quanto(p.dias)})`))
 texto.push('', 'O que vale é arquivo novo, não status.')
 return texto.join('\n')
}

export async function cobrarAjustes(
 db: DB,
 enviar: (jid: string, texto: string) => Promise<void>,
 agora = Date.now(),
) {
 const [{ data: cards, error }, { data: grupos }] = await Promise.all([
  db.from('central_social_cards').select('*').eq('stage', 'ajustes').limit(500),
  db.from('central_social_feedback_groups').select('author,jid,enabled').eq('enabled', true),
 ])
 if (error) throw new Error('cobranca_leitura_falhou')
 const paradas = pecasParadas((cards || []) as SocialCard[], agora)
 if (!paradas.length) return { paradas: 0, grupos: 0, orfas: 0 }
 const porJid = new Map<string, string>()
 for (const g of (grupos || []) as { author: string; jid: string }[]) porJid.set(g.author, g.jid)
 const orfas = paradas.filter(p => !porJid.has(p.author))
 let enviados = 0
 for (const [autor, jid] of porJid) {
  const lista = paradas.filter(p => p.author === autor)
  if (!lista.length) continue
  // Uma falha de grupo não pode calar os outros nem o aviso do João.
  try { await enviar(jid, textoDoGrupo(lista, agora)); enviados++ } catch { /* segue */ }
 }
 const JOAO = '559492404033'
 try { await enviar(JOAO, textoDoJoao(paradas, orfas, agora)) } catch { /* segue */ }
 return { paradas: paradas.length, grupos: enviados, orfas: orfas.length }
}
