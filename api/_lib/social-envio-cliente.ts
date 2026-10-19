import type { createAdminClient } from './supabase.js'
import { socialPatch, type SocialCard } from './social-domain.js'
import { grupoDoCliente } from './social-client-approval.js'
import { getClientLink } from './social-client.js'
import { mensagemDeAprovacao, mensagemDeLote, mensagemNoAr } from './social-client-message.js'
import { newApprovalLink } from './social-approval-link.js'
import { linkDeDownload } from './social-drive.js'
type DB = ReturnType<typeof createAdminClient>

/**
 * Levar a peça ao grupo do cliente, num lugar só.
 *
 * Antes isto morava solto dentro da rota, então só existia quando alguém
 * clicava. O vídeo do Matheus caía no quadro e ficava em Conferir até alguém
 * lembrar: 11 peças paradas desde 09/10/2026.
 */

/** Tem vídeo do Drive esperando a cópia leve que o cron ainda vai fazer. */
export function videoAindaComprimindo(card: SocialCard) {
 return card.assets.some(x => card.selected_assets.includes(x.id) && x.type.startsWith('video/') && x.storage === 'drive' && !x.approval_path)
}
export function videoDaPeca(card: SocialCard) {
 const a = card.assets.find(x => card.selected_assets.includes(x.id) && x.type.startsWith('video/') && x.approval_path)
 return a?.approval_path || null
}

/**
 * Põe o convite do cliente na fila de envio.
 *
 * A fila, e não um disparo na hora, porque ela tem nova tentativa e registro:
 * uma falha de rede não pode sumir com o pedido de aprovação.
 */
export async function filaDoEnvioAoCliente(
 db: DB, atual: SocialCard, approvalUrl: string, actor: string,
 /** Posição e tamanho do lote que vai para o mesmo grupo agora. */
 lote: { posicao: number; total: number } = { posicao: 1, total: 1 },
) {
 const grupo = grupoDoCliente(atual.client)
 if (!grupo) return { enviado: false, motivo: 'Não encontrei o grupo deste cliente no WhatsApp. Copie o link e mande você mesmo.' }
 const selecionados = atual.assets.filter(a => atual.selected_assets.includes(a.id))
 // Cliente pedindo o vídeo em alta é recorrente, e o original já está no
 // Drive. Libera o arquivo por link e manda o endereço junto. Falhar aqui não
 // impede o envio: a aprovação é o que não pode faltar.
 const original = selecionados.find(a => a.type.startsWith('video/') && a.storage === 'drive' && a.drive_id)
 const altaUrl = original?.drive_id ? await linkDeDownload(String(original.drive_id)) : null
 // Sem a legenda de propósito: ela já aparece na prévia do link e na própria
 // página de aprovação.
 const aviso = mensagemDeAprovacao({
  client: atual.client, title: atual.title, url: approvalUrl, altaUrl,
  video: selecionados.some(a => a.type.startsWith('video/')), arquivos: selecionados.length,
  posicao: lote.posicao, total: lote.total,
 })
 // A fila exige o evento que originou o envio, e é ele que dá rastro no
 // histórico da peça. O apply acabou de registrar um; é esse que se usa.
 const { data: evento } = await db.from('central_social_events').select('id')
  .eq('card_id', atual.id).order('id', { ascending: false }).limit(1).maybeSingle()
 if (!evento?.id) return { enviado: false, motivo: 'A peça foi para Aguardando cliente, mas o envio não entrou na fila. Copie o link e mande você mesmo.' }
 const esperandoVideo = videoAindaComprimindo(atual)
 const { error } = await db.from('central_social_feedback_outbox').insert({
  event_id: evento.id, card_id: atual.id, channel: 'whatsapp', destination: grupo.jid,
  payload: {
   client: atual.client, title: atual.title, revision: atual.revision, actor, action: 'enviar_cliente',
   comment: '', created_at: new Date().toISOString(), files: [], task_id: null, group_label: grupo.nome,
   texto_pronto: aviso,
   // O cliente assiste no WhatsApp mesmo, que é onde ele já está. Vai o
   // caminho, não a URL: quem envia assina na hora, então tentativa atrasada
   // nunca cai em endereço vencido. Só a cópia leve viaja, porque o arquivo
   // do editor tem bitrate de câmera e não passa no WhatsApp.
   midia_path: videoDaPeca(atual),
  },
  // Peça mandada minutos depois da entrega ainda não tem cópia leve. Segurar
  // três minutos faz o cliente receber o vídeo junto do link, em vez de só o
  // link.
  ...(esperandoVideo ? { next_attempt_at: new Date(Date.now() + 180000).toISOString() } : {}),
  status: 'pending',
 })
 if (error) return { enviado: false, motivo: 'A peça foi para Aguardando cliente, mas o envio não entrou na fila. Copie o link e mande você mesmo.' }
 return { enviado: true, grupo: grupo.nome, aguardando_video: esperandoVideo }
}

/**
 * Põe na fila UMA mensagem para o lote inteiro.
 *
 * João, 18/10/2026: "se tiver mais de 1 peça que ela mande uma mensagem
 * somente com todos já de uma vez, que o cliente já aprova de uma vez".
 *
 * O link é o do cliente, que abre a página com todas as pendentes empilhadas.
 * A mídia não vai junto: cinco vídeos no WhatsApp seriam cinco mensagens, que
 * é exatamente o que ele pediu para acabar. O cliente assiste na página.
 */
async function filaDoLote(db: DB, cards: SocialCard[], url: string, actor: string) {
 const cliente = cards[0].client
 const grupo = grupoDoCliente(cliente)
 if (!grupo) return { enviado: false, motivo: 'cliente sem grupo unico no whatsapp' }
 const texto = mensagemDeLote({
  client: cliente, url,
  pecas: cards.map(c => {
   const sel = c.assets.filter(a => c.selected_assets.includes(a.id))
   return { title: c.title, video: sel.some(a => a.type.startsWith('video/')), arquivos: sel.length }
  }),
 })
 // A fila exige o evento que originou o envio. Vale o da última peça movida:
 // é o registro mais novo e é nela que a mensagem fica ancorada no histórico.
 const ancora = cards[cards.length - 1]
 const { data: evento } = await db.from('central_social_events').select('id')
  .eq('card_id', ancora.id).order('id', { ascending: false }).limit(1).maybeSingle()
 if (!evento?.id) return { enviado: false, motivo: 'o lote nao entrou na fila. Copie o link e mande voce mesmo.' }
 const { error } = await db.from('central_social_feedback_outbox').insert({
  event_id: evento.id, card_id: ancora.id, channel: 'whatsapp', destination: grupo.jid,
  payload: {
   client: cliente, title: `${cards.length} peças`, revision: ancora.revision, actor,
   action: 'enviar_cliente', comment: '', created_at: new Date().toISOString(), files: [],
   task_id: null, group_label: grupo.nome, texto_pronto: texto,
   lote: cards.map(c => c.id),
  },
  status: 'pending',
 })
 if (error) return { enviado: false, motivo: 'o lote nao entrou na fila. Copie o link e mande voce mesmo.' }
 return { enviado: true, grupo: grupo.nome }
}

// ---------------------------------------------------------------------------
// Envio automático
// ---------------------------------------------------------------------------
/** Chave de desligamento. Uma linha para voltar ao envio só pela mão. */
export const AUTO_ENVIO = true
/**
 * As peças que vêm do ClickUp, as únicas fora do automático.
 *
 * Era por prefixo do id ('cu:') e a trava NUNCA pegou: o 'cu:' está na chave da
 * fila de sync (social-sync.ts), enquanto o card nasce com o id puro do ClickUp.
 * Nenhum dos 320 cards começava com 'cu:', então peça do ClickUp seguia elegível
 * ao envio automático, que é justamente o caminho onde o cliente é DEDUZIDO do
 * nome da tarefa. A origem verdadeira está no endereço da tarefa.
 */
export const ORIGEM_MANUAL = 'clickup.com'
export function vemDoClickUp(card: Pick<SocialCard, 'source_url'>) {
 return String(card.source_url || '').includes(ORIGEM_MANUAL)
}
/** Minutos de carência depois da última mexida na peça, para a equipe ainda pegar. */
const CARENCIA_MS = 10 * 60000
const ABRE = 8, FECHA = 18

export function horaDeBrasilia(agora: number) {
 return Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', hourCycle: 'h23' }).format(agora))
}

/**
 * A peça pode ir ao cliente sozinha?
 *
 * Automático sem trava manda peça errada para o grupo errado, porque o cliente
 * é identificado pelo NOME DO ARQUIVO que o editor digitou. Então cada
 * condição aqui existe para fechar um caminho de erro, e qualquer uma que
 * falhe deixa a peça em Conferir, esperando gente.
 */
export function podeAutoEnviar(card: SocialCard, agora = Date.now()): string {
 if (!AUTO_ENVIO) return 'envio automatico desligado'
 if (card.stage !== 'conferir') return 'etapa nao e conferir'
 // Peça do ClickUp fica de fora: lá o cliente é DEDUZIDO do nome da tarefa,
 // que é texto interno da equipe. Entrega do grupo de edição e peça criada na
 // mão entram, porque nas duas o cliente casa com o catálogo ou foi digitado
 // por uma pessoa no formulário.
 if (vemDoClickUp(card)) return 'peca do clickup passa por gente'
 if (!card.client || card.client === 'Identificar cliente') return 'cliente nao identificado'
 if (!grupoDoCliente(card.client)) return 'cliente sem grupo unico no whatsapp'
 const selecionados = card.assets.filter(a => card.selected_assets.includes(a.id))
 if (!selecionados.length) return 'peca sem arquivo selecionado'
 // Vídeo sem cópia leve chegaria como link solto, e o cliente abre o WhatsApp
 // esperando ver a peça.
 if (videoAindaComprimindo(card)) return 'copia leve do video ainda nao esta pronta'
 const hora = horaDeBrasilia(agora)
 // Peça entregue 20h30 sai às 8h do dia seguinte, com bom dia, em vez de
 // acordar o cliente.
 if (hora < ABRE || hora >= FECHA) return 'fora do horario comercial'
 if (Date.parse(card.updated_at) > agora - CARENCIA_MS) return 'dentro da carencia de 10 min'
 return 'ok'
}

/**
 * Quantas peças do MESMO cliente saem numa volta.
 *
 * O lote é fechado por cliente de propósito: a mensagem diz "separei três
 * vídeos, o primeiro é...", e esse número só é verdade se as três saírem
 * agora. Partir o lote entre voltas faria a Sofia mentir a contagem.
 */
const LOTE_MAXIMO = 5

export async function autoEnviarPecas(db: DB, limite = LOTE_MAXIMO, agora = Date.now()) {
 if (!AUTO_ENVIO) return { enviadas: 0, motivos: { desligado: 1 } }
 // O filtro aqui tem que ser o MESMO de podeAutoEnviar. Numa primeira versão a
 // trava passou a aceitar peça criada na mão e a consulta continuou em 'wa-%':
 // a volta devolvia "enviadas: 0" com motivos vazio, ou seja nenhum candidato,
 // e parecia que a trava tinha barrado quando a peça nem chegava a ser olhada.
 // Depois os dois concordaram no prefixo 'cu:', que nenhum card tem: peça do
 // ClickUp entrava na volta. Por isso agora os dois leem a origem da tarefa.
 const { data, error } = await db.from('central_social_cards').select('*')
  .eq('stage', 'conferir').not('source_url', 'ilike', `%${ORIGEM_MANUAL}%`).neq('client', 'Identificar cliente')
  .order('updated_at', { ascending: true }).limit(20)
 if (error) return { enviadas: 0, motivos: { erro_de_leitura: 1 } }
 const motivos: Record<string, number> = {}
 const prontas: SocialCard[] = []
 for (const card of (data || []) as SocialCard[]) {
  const razao = podeAutoEnviar(card, agora)
  if (razao === 'ok') prontas.push(card)
  else motivos[razao] = (motivos[razao] || 0) + 1
 }
 if (!prontas.length) return { enviadas: 0, motivos }
 // Uma volta atende UM cliente, o da peça mais antiga, e leva todas as dele.
 // Assim a contagem na mensagem bate com o que o grupo recebe, e o próximo
 // cliente entra na volta seguinte.
 const lote = prontas.filter(c => c.client === prontas[0].client).slice(0, limite)
 let enviadas = 0
 // Com duas ou mais, o grupo recebe UMA mensagem com todas e um link só.
 // Move primeiro, porque o link do cliente só existe depois que há peça em
 // Aguardando, e manda depois, quando o lote inteiro já está de pé.
 const emLote = lote.length > 1
 // Guarda o link JUNTO: o token já foi gravado no card, e gerar outro depois
 // daria um endereço que não abre.
 const movidas: { card: SocialCard; url: string }[] = []
 for (const [i, card] of lote.entries()) {
  try {
   const link = newApprovalLink(card.id)
   const patch = {
    ...socialPatch(card, { action: 'enviar_cliente' }),
    token_hash: link.hash, token_expires_at: new Date(agora + 30 * 86400000).toISOString(),
   }
   const { data: aplicado, error: erroRpc } = await db.rpc('central_social_request_link', {
    p_id: card.id, p_expected: card.version, p_patch: patch, p_ciphertext: link.ciphertext,
    p_actor: 'Sofia', p_actor_id: null, p_action: 'enviar_cliente',
   })
   if (erroRpc || !aplicado) { motivos.nao_foi_possivel_mover = (motivos.nao_foi_possivel_mover || 0) + 1; continue }
   if (emLote) { movidas.push({ card: aplicado as SocialCard, url: link.url }); continue }
   const r = await filaDoEnvioAoCliente(db, aplicado as SocialCard, link.url, 'Sofia', { posicao: i + 1, total: lote.length })
   if (r.enviado) enviadas++
   else motivos[r.motivo || 'fila_recusou'] = (motivos[r.motivo || 'fila_recusou'] || 0) + 1
  } catch { motivos.falha_inesperada = (motivos.falha_inesperada || 0) + 1 }
 }
 // O lote inteiro de pé: uma mensagem, um link, todas as peças na mesma
 // página. Se o link do cliente falhar, cai para uma mensagem por peça, que
 // é pior de ler mas não deixa o cliente sem receber nada.
 if (emLote && movidas.length) {
  let url: string | null = null
  try { url = await getClientLink(db, movidas[0].card.client, true) } catch { url = null }
  if (url) {
   const r = await filaDoLote(db, movidas.map(m => m.card), url, 'Sofia')
   if (r.enviado) enviadas = movidas.length
   else motivos[r.motivo || 'fila_recusou'] = (motivos[r.motivo || 'fila_recusou'] || 0) + 1
  } else {
   motivos.lote_sem_link_do_cliente = 1
   for (const [i, m] of movidas.entries()) {
    const r = await filaDoEnvioAoCliente(db, m.card, m.url, 'Sofia', { posicao: i + 1, total: movidas.length })
    if (r.enviado) enviadas++
   }
  }
 }
 return { enviadas, cliente: lote[0].client, motivos }
}

// ---------------------------------------------------------------------------
// Avisar o cliente de que a peça foi ao ar
// ---------------------------------------------------------------------------
/**
 * João, 13/10/2026: "avisar no grupo quando a peça for ao ar, com o link do
 * post". O cliente aprovava e nunca mais ouvia falar.
 *
 * A trava contra aviso repetido é o próprio banco: a fila é única por
 * (event_id, channel), e o evento aqui é o `publicacao_concluida` daquela
 * publicação. Segundo aviso para a mesma publicação simplesmente não entra.
 */
/**
 * Nada publicado ANTES daqui vira aviso.
 *
 * João, 13/10/2026, vendo a Sofia anunciar post de 10/10 como novidade:
 * "ela tá enviando pra todos, mas quero só a partir de hoje". Sem este piso,
 * o primeiro passe depois de qualquer deploy despeja o histórico no grupo do
 * cliente como se tivesse acabado de subir.
 */
const INICIO_DO_AVISO = Date.parse('2026-10-13T15:45:00-03:00')
/** Aviso de "foi ao ar" tem validade curta. Fora disso é ruído, não notícia. */
const JANELA_NO_AR = 6 * 3600000

export async function avisarNoAr(db: DB, limite = 4, agora = Date.now()) {
 const desde = new Date(Math.max(INICIO_DO_AVISO, agora - JANELA_NO_AR)).toISOString()
 const { data: eventos, error } = await db.from('central_social_events')
  .select('id,card_id,details').eq('action', 'publicacao_concluida')
  .gte('created_at', desde).order('id', { ascending: true }).limit(40)
 if (error) return { avisadas: 0, motivos: { erro_de_leitura: 1 } }
 const lista = (eventos || []) as { id: number; card_id: string; details: Record<string, unknown> }[]
 if (!lista.length) return { avisadas: 0, motivos: {} }

 // Um aviso por PEÇA, não por publicação. Feed e story da mesma peça são duas
 // publicações, e o cliente recebia o mesmo título duas vezes seguidas, como
 // aconteceu com o "Dia da Saúde Mental" da Dra. Ênia em 13/10.
 const porCard = new Map<string, typeof lista>()
 for (const e of lista) porCard.set(e.card_id, [...(porCard.get(e.card_id) || []), e])
 const { data: jaAvisados } = await db.from('central_social_feedback_outbox')
  .select('card_id').in('card_id', [...porCard.keys()]).eq('payload->>action', 'no_ar')
 for (const r of ((jaAvisados || []) as { card_id: string }[])) porCard.delete(r.card_id)
 if (!porCard.size) return { avisadas: 0, motivos: {} }

 const motivos: Record<string, number> = {}
 let avisadas = 0
 const { data: cards } = await db.from('central_social_cards').select('*').in('id', [...porCard.keys()])
 const porId = new Map(((cards || []) as SocialCard[]).map(c => [c.id, c]))
 // Mesma regra do envio: várias peças do mesmo grupo numa tacada só saúdam
 // uma vez. Postagem em lote às 18h é comum.
 const porGrupo = new Map<string, { nome: string; cards: string[] }>()
 for (const cardId of porCard.keys()) {
  const card = porId.get(cardId)
  const grupo = card ? grupoDoCliente(card.client) : null
  if (!card || !grupo) { motivos.sem_grupo = (motivos.sem_grupo || 0) + 1; continue }
  const atual = porGrupo.get(grupo.jid) || { nome: grupo.nome, cards: [] }
  porGrupo.set(grupo.jid, { nome: grupo.nome, cards: [...atual.cards, cardId] })
 }
 for (const [jid, { nome, cards: doGrupo }] of porGrupo) {
  const lote = doGrupo.slice(0, limite)
  for (const [i, cardId] of lote.entries()) {
   const card = porId.get(cardId)!
   const publicacoes = porCard.get(cardId)!
   // O link do feed é o que vale: story sai do ar em 24h. Só quando a peça
   // foi SÓ para o story é que o aviso usa o link de lá e diz isso.
   const feed = publicacoes.find(e => String(e.details?.format || '') !== 'story')
   const escolhida = feed || publicacoes[publicacoes.length - 1]
   const link = String(escolhida.details?.permalink || card.posted_url || '')
   if (!link) { motivos.sem_link = (motivos.sem_link || 0) + 1; continue }
   const selecionados = card.assets.filter(a => card.selected_assets.includes(a.id))
   const texto = mensagemNoAr({ client: card.client, title: card.title, url: link,
    video: selecionados.some(a => a.type.startsWith('video/')), arquivos: selecionados.length,
    agora, posicao: i + 1, total: lote.length, soStory: !feed })
   const { error: erroFila } = await db.from('central_social_feedback_outbox').insert({
    event_id: escolhida.id, card_id: card.id, channel: 'whatsapp', destination: jid,
    payload: { client: card.client, title: card.title, revision: card.revision, actor: 'Sofia',
     action: 'no_ar', comment: '', created_at: new Date(agora).toISOString(), files: [],
     task_id: null, group_label: nome, texto_pronto: texto },
    status: 'pending',
   })
   if (erroFila) motivos.fila_recusou = (motivos.fila_recusou || 0) + 1
   else avisadas++
  }
 }
 return { avisadas, motivos }
}
