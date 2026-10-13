import type { createAdminClient } from './supabase.js'
import { socialPatch, type SocialCard } from './social-domain.js'
import { grupoDoCliente } from './social-client-approval.js'
import { mensagemDeAprovacao } from './social-client-message.js'
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

// ---------------------------------------------------------------------------
// Envio automático
// ---------------------------------------------------------------------------
/** Chave de desligamento. Uma linha para voltar ao envio só pela mão. */
export const AUTO_ENVIO = true
/** Prefixo das peças que vêm do ClickUp, as únicas fora do automático. */
export const PREFIXO_MANUAL = 'cu:'
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
 if (card.id.startsWith(PREFIXO_MANUAL)) return 'peca do clickup passa por gente'
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
 const { data, error } = await db.from('central_social_cards').select('*')
  .eq('stage', 'conferir').not('id', 'like', `${PREFIXO_MANUAL}%`).neq('client', 'Identificar cliente')
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
   const r = await filaDoEnvioAoCliente(db, aplicado as SocialCard, link.url, 'Sofia', { posicao: i + 1, total: lote.length })
   if (r.enviado) enviadas++
   else motivos[r.motivo || 'fila_recusou'] = (motivos[r.motivo || 'fila_recusou'] || 0) + 1
  } catch { motivos.falha_inesperada = (motivos.falha_inesperada || 0) + 1 }
 }
 return { enviadas, cliente: lote[0].client, motivos }
}
