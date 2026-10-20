import { clienteRespondeuDepois } from './social-whats.js'
import type { createAdminClient } from './supabase.js'
import type { SocialAsset, SocialCard } from './social-domain.js'
import { clientFacingTitle } from './social-client-title.js'
import { saudacao } from './social-client-message.js'
import { grupoDoCliente } from './social-client-approval.js'
import { approvalLink } from './social-approval-link.js'
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
 try { await enviar(JOAO, textoDoJoao(paradas, orfas, agora)) } catch { /* segue */ }
 return { paradas: paradas.length, grupos: enviados, orfas: orfas.length }
}

// ---------------------------------------------------------------------------
// Cobrar o CLIENTE que não respondeu
// ---------------------------------------------------------------------------
/**
 * João, 13/10/2026: "cobrar o cliente que não responde, hoje a peça fica em
 * aguardando cliente sem prazo e sem ninguém puxar".
 *
 * O link que vai na cobrança é o MESMO que já está com ele. Emitir link novo
 * mataria o que ele talvez tenha aberto e deixaria dois endereços rodando.
 */
export type PecaNoCliente = { card_id: string; client: string; title: string; enviado_ms: number; dias: number; url: string | null }

/** Um dia inteiro de espera antes de puxar. Cobrar no mesmo dia é afobação. */
const ESPERA_CLIENTE = 24 * 3600000
/**
 * Acima disso a peça não é mais lembrete, é decisão.
 *
 * Mandar "lembrando daquela peça" sobre algo de duas semanas atrás soa mal e
 * ainda levanta a pergunta de por que ninguém falou antes. Peça velha vai só
 * para o João escolher o que fazer: cobrar na mão, refazer ou arquivar.
 */
const VELHA_DEMAIS = 10

/**
 * Clientes que a Sofia não cobra, por decisão do João.
 *
 * João, 18/10/2026, 23h: "não enviar nada Ésia, já tá tudo aprovado". A peça
 * dela em Aguardando estava parada havia 62 horas e a ronda de segunda ia
 * cobrar resposta de algo que a cliente já tinha aprovado na conversa. O
 * quadro não sabia, e ele pediu para não mexer na etapa.
 *
 * Silêncio é decisão de pessoa, não de código: cada nome aqui entra com data
 * e motivo, e sai quando o motivo acabar. Não vale para o aviso de peça no ar,
 * que é entrega, nem para a cobrança da social media, que é interna.
 */
export const CLIENTES_SEM_COBRANCA: { cliente: string; desde: string; porque: string }[] = [
 { cliente: 'Dra. Ésia', desde: '2026-10-18', porque: 'João: já aprovou tudo na conversa, falta só programar' },
]

/** Sem acento, minúsculo: "DRA. ÉSIA LOPES" e "Dra. Ésia" têm que casar. */
const normalizado = (v: string) =>
 String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** O nome do cliente bate com algum silêncio pedido? */
export function clienteEmSilencio(client: string) {
 const alvo = normalizado(client)
 return CLIENTES_SEM_COBRANCA.some(x => alvo.includes(normalizado(x.cliente)) || normalizado(x.cliente).includes(alvo))
}

export function pecasComOCliente(cards: SocialCard[], agora = Date.now()): PecaNoCliente[] {
 return cards
  .filter(c => c.stage === 'aguardando' && !clienteEmSilencio(c.client))
  .map(c => ({ c, enviado_ms: Date.parse(c.updated_at) }))
  .filter(({ enviado_ms }) => Number.isFinite(enviado_ms) && agora - enviado_ms >= ESPERA_CLIENTE)
  .map(({ c, enviado_ms }) => ({
   card_id: c.id, client: c.client,
   title: nomeNaCobranca(c.client, c.title,
    c.assets.some(a => c.selected_assets.includes(a.id) && a.type.startsWith('video/')),
    c.selected_assets.length),
   enviado_ms, dias: Math.floor((agora - enviado_ms) / DIA), url: null,
  }))
  .sort((a, b) => a.enviado_ms - b.enviado_ms)
}

const mandei = (dias: number) => dias <= 1 ? 'mandei ontem' : `mandei há ${dias} dias`

/**
 * O nome da peça na cobrança.
 *
 * O título limpo vira genérico quando sobra pouco ("Spa Nature - 5%" vira "5%",
 * "Dra Enia - vídeo 08" é só formato mais número). Numa lista de cinco peças o
 * cliente lê "Vídeo para aprovação" repetido e não sabe qual é qual. Aqui o
 * resto cru entra junto, que é como a casa chama a peça.
 */
export function nomeNaCobranca(client: string, title: string, video: boolean, arquivos: number) {
 const limpo = clientFacingTitle(client, title, video, arquivos)
 const cru = clientFacingTitle(client, title, video, arquivos, true)
 if (limpo !== cru && cru.length > 1) return `${limpo} · ${cru}`
 return limpo
}

export function textoDoCliente(pecas: PecaNoCliente[], agora = Date.now()) {
 const uma = pecas.length === 1
 const corpo = pecas.map((p, i) => {
  const cabeca = uma ? `*${p.title}*` : `${i + 1}. *${p.title}*`
  return p.url ? `${cabeca} (${mandei(p.dias)})\n${p.url}` : `${cabeca} (${mandei(p.dias)})`
 })
 return [`${saudacao(agora)}, pessoal!`, '',
  uma ? 'Passando pra lembrar que ficou uma peça esperando vocês:' : `Passando pra lembrar que ficaram ${pecas.length} peças esperando vocês:`,
  '', corpo.join('\n\n'), '',
  // Sem cobrança seca: o cliente precisa saber o que acontece se não responder.
  uma ? 'É só abrir e aprovar, ou me escrever o que quer mudar. Enquanto não tiver o seu ok, ela não vai pro ar.'
      : 'É só abrir e aprovar, ou me escrever o que quer mudar. Enquanto não tiver o seu ok, elas não vão pro ar.',
 ].join('\n')
}

// ---------------------------------------------------------------------------
// Lembrar a data que está chegando
// ---------------------------------------------------------------------------
/**
 * João, 13/10/2026: "lembrar da data quando a peça aprovada tem data marcada e
 * está chegando perto, como o Dia do Médico em 18/10".
 *
 * A data vem do `scheduled_at` quando existe, e senão do próprio título, que
 * na casa carrega o dia: "Dia do Médico (18/10)", "[DR. BRENNO] 12/10 · Dia da
 * Artrite", "QUA 07/10 18h · ...".
 */
export type PecaComData = { card_id: string; author: string; client: string; title: string; data_ms: number; faltam: number; stage: string }

/** Avisa com cinco dias: é o que dá pra refazer uma arte sem correria. */
const JANELA_DATA = 5

/**
 * O dia que o título anuncia.
 *
 * O `dd/mm` só vale como data quando o contexto é de data. Sem isso, o
 * "Carrossel ANUNCIO Meta 1/2" do Dr. Brenno viraria 1 de fevereiro.
 */
export function dataDoTitulo(titulo: string, agora: number): number | null {
 const re = /(?:^|([\s(\[·|]))(\d{1,2})\/(\d{1,2})(?=\)|\s*·|\s*\||\s+\d{1,2}h|\s*$)/g
 for (const m of String(titulo || '').matchAll(re)) {
  const antes = m[1] || '', diaTexto = m[2]
  // "Carrossel ANUNCIO Meta 1/2" e "SPA NATURE · 5/5 · R03" são numeração de
  // peça, não data. Data de verdade nos títulos da casa vem com o dia em dois
  // dígitos ("12/10", "QUA 07/10") ou entre parênteses ("(18/10)").
  if (diaTexto.length < 2 && antes !== '(') continue
  const dia = Number(diaTexto), mes = Number(m[3])
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue
  const hoje = new Date(agora - 3 * 3600000)
  for (const ano of [hoje.getUTCFullYear(), hoje.getUTCFullYear() + 1]) {
   const t = Date.parse(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T23:59:00-03:00`)
   if (Number.isFinite(t) && t > agora - 2 * DIA) return t
  }
 }
 return null
}

export function dataDaPeca(card: SocialCard, agora: number): number | null {
 const agendada = Date.parse(card.scheduled_at || '')
 if (Number.isFinite(agendada)) return agendada
 return dataDoTitulo(card.title, agora)
}

/**
 * Dias de calendário em Brasília, não horas corridas.
 *
 * Por hora corrida, 18/10 visto do dia 13 dava 5,5 e virava 6, e a peça saía
 * da janela de 5 dias. Quem lê conta no calendário: de 13 para 18 são 5.
 */
const diaDeBrasilia = (ms: number) => {
 const d = new Date(ms - 3 * 3600000)
 return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function pecasComDataChegando(cards: SocialCard[], agora = Date.now()): PecaComData[] {
 const prontas = ['agendado', 'postado', 'arquivado']
 const lista: PecaComData[] = []
 for (const card of cards) {
  if (prontas.includes(card.stage)) continue
  const data_ms = dataDaPeca(card, agora)
  if (data_ms === null) continue
  const faltam = Math.round((diaDeBrasilia(data_ms) - diaDeBrasilia(agora)) / DIA)
  if (faltam < 0 || faltam > JANELA_DATA) continue
  lista.push({ card_id: card.id, author: String(card.author || '').trim() || 'sem autor',
   client: card.client, title: clientFacingTitle(card.client, card.title), data_ms, faltam, stage: card.stage })
 }
 return lista.sort((a, b) => a.data_ms - b.data_ms)
}

const emQuantos = (faltam: number) => faltam <= 0 ? 'é HOJE' : faltam === 1 ? 'é AMANHÃ' : `faltam ${faltam} dias`
const diaCurto = (ms: number) => {
 const d = new Date(ms - 3 * 3600000)
 return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const ETAPA: Record<string, string> = { interna: 'ainda em aprovação interna', conferir: 'ainda em conferência', ajustes: 'ainda em ajuste',
 aguardando: 'esperando o cliente aprovar', aprovado: 'aprovada, falta programar' }

export function textoDasDatas(pecas: PecaComData[], agora = Date.now()) {
 return [`${saudacao(agora)}! Data chegando e a peça não está pronta:`,
  ...pecas.map(p => `*${diaCurto(p.data_ms)}* · ${p.client} · ${p.title}\n   ${emQuantos(p.faltam)}, ${ETAPA[p.stage] || p.stage} (${p.author})`),
 ].join('\n\n')
}

// ---------------------------------------------------------------------------
// As três rondas
// ---------------------------------------------------------------------------
const JOAO = '559492404033'
/**
 * O grupo onde a social media trabalha, com a Sofia dentro.
 *
 * João, 18/10/2026, sobre as peças da Dra. Ésia: "a Ésia já foi aprovado e aí
 * é só programar, aí isso você deve cobrar a Rayana no grupo de social media,
 * Sofia tá lá". ⚠️ 20/10/2026: a Rayana saiu da SVI e já não está no grupo, que
 * hoje tem o João, a Letícia, o Arthur e a Sofia. A mensagem deixou de chamar
 * alguém pelo nome: chamar quem não trabalha mais aqui é pior que não chamar
 * ninguém. Quando o João disser quem assume a programação, volta o nome.
 * Sofia tá lá". Quem programa é a social, então a cobrança de peça aprovada
 * sem data ia para o lugar errado: ficava no privado do João, que não é quem
 * executa.
 */
const SOCIAL_MEDIA = '120363431737365497@g.us'

export async function cobrarClientes(
 db: DB, enviar: (jid: string, texto: string) => Promise<void>, agora = Date.now(),
) {
 const { data, error } = await db.from('central_social_cards').select('*').eq('stage', 'aguardando').limit(500)
 if (error) throw new Error('cobranca_cliente_leitura_falhou')
 const cards = (data || []) as SocialCard[]
 const todas = pecasComOCliente(cards, agora)
 if (!todas.length) return { clientes: 0, pecas: 0, velhas: 0 }
 const paradas = todas.filter(p => p.dias <= VELHA_DEMAIS)
 const velhas = todas.filter(p => p.dias > VELHA_DEMAIS)
 // Peça velha não vai para o cliente. Vai para o João decidir.
 if (velhas.length) {
  const texto = [`${saudacao(agora)}! Peça parada com o cliente há mais de ${VELHA_DEMAIS} dias, velha demais para eu cobrar sozinha:`,
   ...velhas.map(p => `*${p.client}* · ${p.title} (${mandei(p.dias)})`),
   'Decide se cobro na mão, se refazemos ou se arquiva.'].join('\n\n')
  try { await enviar(JOAO, texto) } catch { /* segue */ }
 }
 if (!paradas.length) return { clientes: 0, pecas: 0, velhas: velhas.length }
 const porCliente = new Map<string, PecaNoCliente[]>()
 for (const p of paradas) porCliente.set(p.client, [...(porCliente.get(p.client) || []), p])
 let clientes = 0, pecas = 0
 const semLink: PecaNoCliente[] = []
 const responderam: PecaNoCliente[] = []
 for (const [cliente, lista] of porCliente) {
  const grupo = grupoDoCliente(cliente)
  // Cliente sem grupo único não é cobrado: mandar peça no grupo errado é pior
  // que não cobrar.
  if (!grupo) continue
  for (const p of lista) {
   const card = cards.find(c => c.id === p.card_id)
   if (card) p.url = await approvalLink(db, card).catch(() => null)
  }
  // Peça SEM link vivo não é cobrada. João, 15/10/2026, com o print do grupo do
  // Spa Nature: a Sofia mandou "ficou uma peça esperando vocês" sem endereço
  // nenhum, e a cliente respondeu "qual vídeo ficou faltando?" e "o link não
  // está abrindo". Cobrar sem dar o caminho é pior que não cobrar: transfere o
  // trabalho pra quem já não sabe o que fazer.
  const comLink = lista.filter(p => p.url)
  semLink.push(...lista.filter(p => !p.url))
  if (!comLink.length) continue
  // Quem já respondeu no grupo não leva cobrança. João, 20/10/2026: o Dr.
  // Geraldo pediu a alteração por escrito ali mesmo, no dia seguinte ao envio,
  // e ainda avisou que não sabe mexer no link. Como nada daquilo virou estado,
  // a ronda cobrou e ele respondeu "já falei aí o que mudar".
  const maisAntiga = Math.min(...comLink.map(p => p.enviado_ms))
  if (await clienteRespondeuDepois(grupo.jid, maisAntiga)) {
   responderam.push(...comLink)
   continue
  }
  try { await enviar(grupo.jid, textoDoCliente(comLink, agora)); clientes++; pecas += comLink.length } catch { /* segue */ }
 }
 // O cliente falou e ninguém tratou: isso é trabalho da casa, não dele.
 if (responderam.length) {
  const texto = [`${saudacao(agora)}! Estes clientes *já responderam no grupo* e a peça continua esperando. Não cobrei, porque a resposta deles está lá:`,
   ...responderam.map(p => `*${p.client}* · ${p.title} (${mandei(p.dias)})`),
   'Abre a conversa, aplica o que pediram e move a peça.'].join('\n\n')
  try { await enviar(JOAO, texto) } catch { /* segue */ }
 }
 // O que não deu para cobrar vira tarefa do João, com o motivo na cara.
 if (semLink.length) {
  const texto = [`${saudacao(agora)}! Peça em Aguardando cliente SEM link vivo, não dá para cobrar:`,
   ...semLink.map(p => `*${p.client}* · ${p.title} (${mandei(p.dias)})`),
   'Ou o cliente nunca recebeu o link, ou ele venceu. Reenvia pela Central que eu volto a cobrar sozinha.'].join('\n\n')
  try { await enviar(JOAO, texto) } catch { /* segue */ }
 }
 return { clientes, pecas, velhas: velhas.length, sem_link: semLink.length, responderam: responderam.length }
}

export async function lembrarDatas(
 db: DB, enviar: (jid: string, texto: string) => Promise<void>, agora = Date.now(),
) {
 const { data, error } = await db.from('central_social_cards').select('*')
  .not('stage', 'in', '(postado,arquivado,agendado)').limit(800)
 if (error) throw new Error('lembrete_data_leitura_falhou')
 const chegando = pecasComDataChegando((data || []) as SocialCard[], agora)
 if (!chegando.length) return { pecas: 0, grupos: 0 }
 const { data: grupos } = await db.from('central_social_feedback_groups').select('author,jid').eq('enabled', true)
 let avisados = 0
 for (const g of (grupos || []) as { author: string; jid: string }[]) {
  // Para o grupo do autor só o que depende dele. Peça esperando o cliente é
  // assunto da outra ronda.
  const dele = chegando.filter(p => p.author === g.author && ['interna', 'conferir', 'ajustes'].includes(p.stage))
  if (!dele.length) continue
  try { await enviar(g.jid, textoDasDatas(dele, agora)); avisados++ } catch { /* segue */ }
 }
 try { await enviar(JOAO, textoDasDatas(chegando, agora)) } catch { /* segue */ }
 return { pecas: chegando.length, grupos: avisados }
}

export async function rondaDiaria(
 db: DB, enviar: (jid: string, texto: string) => Promise<void>, agora = Date.now(),
) {
 // Uma ronda que falha não pode levar as outras junto.
 const ajustes = await cobrarAjustes(db, enviar, agora).catch(e => ({ erro: String(e?.message || e) }))
 const clientes = await cobrarClientes(db, enviar, agora).catch(e => ({ erro: String(e?.message || e) }))
 const datas = await lembrarDatas(db, enviar, agora).catch(e => ({ erro: String(e?.message || e) }))
 const programar = await cobrarProgramacao(db, enviar, agora).catch(e => ({ erro: String(e?.message || e) }))
 const interna = await cobrarInterna(db, enviar, agora).catch(e => ({ erro: String(e?.message || e) }))
 return { ajustes, clientes, datas, programar, interna }
}

// ---------------------------------------------------------------------------
// Peça aprovada que ninguém programou
// ---------------------------------------------------------------------------
/**
 * João, 13/10/2026: "Dra. Ênia aprovou o último, e aí? Tá no lugar certo?".
 *
 * Está: o card foi para `aprovado` no mesmo minuto do clique dela. O problema
 * é que `aprovado` virou depósito. Medido no mesmo dia: 38 peças aprovadas
 * sem data de publicação, duas delas aprovadas havia 32 dias. Aprovação não
 * é entrega; entrega é o post no ar.
 */
export type PecaAprovada = { card_id: string; client: string; title: string; aprovada_ms: number; dias: number }

/** Quantas cabem na mensagem antes de virar parede de texto. */
const TETO_NA_MENSAGEM = 10

export function aprovadasSemData(cards: SocialCard[], agora = Date.now()): PecaAprovada[] {
 return cards
  .filter(c => c.stage === 'aprovado' && !c.scheduled_at)
  .map(c => ({ c, aprovada_ms: Date.parse(c.approved_at || c.updated_at) }))
  .filter(({ aprovada_ms }) => Number.isFinite(aprovada_ms))
  .map(({ c, aprovada_ms }) => ({ card_id: c.id, client: c.client,
   title: clientFacingTitle(c.client, c.title), aprovada_ms,
   dias: Math.floor((agora - aprovada_ms) / DIA) }))
  .sort((a, b) => b.aprovada_ms - a.aprovada_ms)
}

export function textoDasAprovadas(pecas: PecaAprovada[], agora = Date.now()) {
 const mostrar = pecas.slice(0, TETO_NA_MENSAGEM)
 const resto = pecas.length - mostrar.length
 const uma = pecas.length === 1
 const linhas = [`${saudacao(agora)}, pessoal! ${uma ? '1 peça aprovada e sem data de publicação' : `${pecas.length} peças aprovadas e sem data de publicação`}:`, '',
  ...mostrar.map(p => `*${p.client}* · ${p.title} (aprovada ${p.dias <= 0 ? 'hoje' : p.dias === 1 ? 'ontem' : `há ${p.dias} dias`})`)]
 // Lista longa demais vira parede de texto e ninguém lê. O resto fica no quadro.
 if (resto > 0) linhas.push('', `E mais ${resto} de antes, no quadro.`)
 linhas.push('', 'O cliente já aprovou, falta só a data. Programa na Central: https://central.svicompany.com.br/content/social?etapa=aprovado')
 return linhas.join('\n')
}

export async function cobrarProgramacao(
 db: DB, enviar: (jid: string, texto: string) => Promise<void>, agora = Date.now(),
) {
 const { data, error } = await db.from('central_social_cards').select('*').eq('stage', 'aprovado').limit(500)
 if (error) throw new Error('aprovadas_leitura_falhou')
 const pecas = aprovadasSemData((data || []) as SocialCard[], agora)
 if (!pecas.length) return { pecas: 0 }
 // Para o grupo da social media, que é quem programa. Antes ia para o privado
 // do João, que acompanha mas não executa, então a peça aprovada ficava
 // esperando alguém reencaminhar o recado.
 try { await enviar(SOCIAL_MEDIA, textoDasAprovadas(pecas, agora)) } catch { /* segue */ }
 return { pecas: pecas.length }
}

// ---------------------------------------------------------------------------
// Peça parada na Aprovação interna
// ---------------------------------------------------------------------------
/**
 * João, 17/10/2026: "Sofia não tá enviando os posts pra aprovação. Vários que
 * não foi, tipo Ésia os vídeos".
 *
 * A Sofia estava inteira: o último envio ao cliente tinha saído na noite
 * anterior, entregue. O que mudou foi a etapa "Aprovação interna", criada em
 * 16/10 na frente do quadro para que nada fosse ao cliente sem passar por
 * gente. Ela cumpre o papel, mas o envio automático só olha "Conferir", então
 * a peça nova para ali e NADA avisa. Seis peças ficaram presas, uma por 34
 * horas, e a leitura de fora foi que o robô tinha quebrado.
 *
 * A trava continua. O que ela não pode mais é ser silenciosa.
 */
export type PecaNaInterna = { card_id: string; client: string; title: string; horas: number }

/** A partir de quantas horas paradas vale incomodar. */
const ESPERA_INTERNA = 6

export function paradasNaInterna(cards: SocialCard[], agora = Date.now()): PecaNaInterna[] {
 return cards
  .filter(c => c.stage === 'interna')
  .map(c => ({ c, horas: (agora - Date.parse(c.updated_at)) / 3600000 }))
  .filter(x => Number.isFinite(x.horas) && x.horas >= ESPERA_INTERNA)
  .sort((a, b) => b.horas - a.horas)
  .map(x => ({ card_id: x.c.id, client: x.c.client, title: x.c.title, horas: Math.floor(x.horas) }))
}

export function textoDaInterna(pecas: PecaNaInterna[]) {
 const tempo = (h: number) => h >= 24 ? `há ${Math.floor(h / 24)} dia${h >= 48 ? 's' : ''}` : `há ${h}h`
 const mostrar = pecas.slice(0, TETO_NA_MENSAGEM)
 const resto = pecas.length - mostrar.length
 const linhas = [
  pecas.length === 1
   ? '1 peça esperando sua liberação na Aprovação interna:'
   : `${pecas.length} peças esperando sua liberação na Aprovação interna:`,
  '',
  ...mostrar.map(p => `*${p.client}* · ${p.title} (${tempo(p.horas)})`),
 ]
 if (resto > 0) linhas.push('', `E mais ${resto} no quadro.`)
 // O que fazer, não só o que está errado: elas não saem sozinhas de propósito.
 linhas.push('', 'Enquanto ficam aí, não vão pro cliente. Libere na Central: https://central.svicompany.com.br/content/social?etapa=interna')
 return linhas.join('\n')
}

export async function cobrarInterna(
 db: DB, enviar: (jid: string, texto: string) => Promise<void>, agora = Date.now(),
) {
 const { data, error } = await db.from('central_social_cards').select('*').eq('stage', 'interna').limit(500)
 if (error) throw new Error('interna_leitura_falhou')
 const pecas = paradasNaInterna((data || []) as SocialCard[], agora)
 if (!pecas.length) return { pecas: 0 }
 try { await enviar(JOAO, textoDaInterna(pecas)) } catch { /* segue */ }
 return { pecas: pecas.length }
}
