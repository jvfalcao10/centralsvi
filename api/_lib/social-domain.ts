import { clientFacingTitle } from './social-client-title.js'
export type SocialAsset = { id: string; name: string; path: string; storage?: 'drive'; sha256?:string; delivery_period?:string; drive_id?: string; folder_url?: string; folder_label?: string; thumbnail?: string; duration_ms?:number; width?:number; height?:number; preview_retry_at?:string; playback_url?:string; type: string; bytes?: number; date?: string; url?: string; preview?: string }
export type SocialCard = {
 caption_draft?:boolean
 transcript?:string|null
 ingest_pending?: boolean; id: string; client: string; title: string; author: string; source_url: string; source_status: string;
 source_description: string; source_updated: string | null; assets: SocialAsset[]; selected_assets: string[];
 caption: string; note: string; stage: string; revision: number; version: number;
 approved_revision: number | null; approved_by: string | null; approved_at: string | null; approval_evidence: string | null;
 scheduled_at: string | null; posted_at: string | null; posted_url: string | null; channel: string | null;
 token_hash: string | null; token_expires_at: string | null; updated_at: string;
}
export class SocialError extends Error { constructor(public status: number, message: string) { super(message) } }
const reject = (message: string): never => { throw new SocialError(400, message) }
const text = (value: unknown, max = 10000) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const cleared = { approved_revision: null, approved_by: null, approved_at: null, approval_evidence: null, token_hash: null, token_expires_at: null, scheduled_at: null }
// Em ajuste o link continua de pé. Matá-lo deixava o cliente com endereço morto
// na mão e obrigava a mandar outro depois; agora ele abre o mesmo link e vê que
// a peça está sendo corrigida. A aprovação cai do mesmo jeito, porque a versão
// que ele viu mudou.
const {token_hash:_th,token_expires_at:_te,...mantemOLink}=cleared
/** A staff member explicitly moving a card is the decision; optional details never block it. */

/**
 * A ordem das lâminas de um carrossel.
 *
 * Só reordena quando a numeração É a ordem, ou seja, quando os nomes são
 * iguais tirando os dígitos: "Queda_05.png" e "Queda_06.png", ou "1.jpg" e
 * "2.jpg". Aí o número foi escrito para dizer a sequência.
 *
 * Quando os nomes diferem por outra coisa, nada é reordenado. Custou descobrir:
 * ao arrumar os carrosséis eu também mexi numa peça cujos arquivos eram hashes
 * e em outra com dois vídeos, e inverti uma ordem que alguém tinha escolhido à
 * mão. Numeração ausente não é desordem, é escolha.
 */
export function ordemDasLaminas<T extends {name?:string}>(assets:T[]):T[] {
 const esqueleto=(n:string)=>n.replace(/\d+/g,'#')
 const nomes=assets.map(a=>a.name||'')
 const numerados=nomes.every(n=>/\d/.test(n))&&new Set(nomes.map(esqueleto)).size===1
 if(!numerados||new Set(nomes).size!==nomes.length)return assets
 const comparador=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'})
 return assets.map((a,i)=>({a,i})).sort((x,y)=>comparador.compare(x.a.name||'',y.a.name||'')||x.i-y.i).map(x=>x.a)
}

export function socialMovePatch(c: SocialCard, target: unknown, actor: string, now = new Date()): Record<string, unknown> {
 const stage = text(target, 30)
 if (!['conferir','aguardando','ajustes','aprovado','para_anuncio','agendado','postado','arquivado'].includes(stage)) reject('Etapa inválida.')
 if (!actor.trim()) reject('Entre na Central novamente.')
 if (['aguardando','aprovado','para_anuncio','agendado','postado'].includes(stage)) {
  if (c.ingest_pending) reject('Aguarde a importação dos arquivos para continuar.')
  // O caminho em lote move pelo estado salvo e nem sempre carrega os arquivos.
  if (!(c.assets||[]).length && !(c.selected_assets||[]).length) reject('Esta peça ainda não tem nenhum arquivo.')
  if (c.client === 'Identificar cliente') reject('Identifique o cliente desta peça para continuar.')
 }
 const patch: Record<string, unknown> = stage==='ajustes' ? {stage} : {stage, token_hash:null, token_expires_at:null}
 // Quem não escolheu arquivo quis dizer "é tudo". Num carrossel de 8 lâminas
 // todas são finais, e exigir a seleção travava a peça sem motivo.
 //
 // A ordem é a do NOME, não a de importação. Custou caro descobrir: o ClickUp
 // entregou as lâminas de um carrossel da Dra Érika como _06, _05, _07, nessa
 // ordem, e o post saiu no Instagram fora de ordem. Lâmina numerada tem ordem
 // escrita no nome, e é ela que vale.
 if (!(c.selected_assets||[]).length && (c.assets||[]).length) patch.selected_assets = ordemDasLaminas(c.assets).map(a => a.id)
 // Moving back corrects the current board; the earlier publication stays in the event history.
 if (stage !== 'postado') Object.assign(patch,{posted_at:null,posted_url:null})
 if (['conferir','aguardando','ajustes','arquivado'].includes(stage)) Object.assign(patch,stage==='ajustes'?mantemOLink:cleared)
 if (stage === 'aprovado') {
  patch.scheduled_at=null
  if (c.approved_revision !== c.revision || !c.approved_at || !c.approved_by) Object.assign(patch,{
   approved_revision:c.revision, approved_by:actor, approved_at:now.toISOString(),
   approval_evidence:'Liberação interna pela equipe ao mover para Aprovado para postar na Central.',
  })
 }
 // Do not invent a planned date or a customer approval for a manual stage change.
 if (stage === 'agendado') patch.scheduled_at=c.scheduled_at || null
 if (stage === 'para_anuncio') patch.scheduled_at=null
 if (stage === 'postado') patch.posted_at=c.posted_at || now.toISOString()
 return patch
}
export function socialPatch(c: SocialCard, body: Record<string, unknown>, now = new Date()) {
 const action = text(body.action, 40)
 if (action === 'informacoes') {
  const date=(value:unknown)=>{if(!value)return null;const parsed=new Date(text(value,50));if(!Number.isFinite(parsed.getTime()))reject('Data inválida.');return parsed.toISOString()}
  const url=text(body.posted_url,2000)
  if(url){try{if(new URL(url).protocol!=='https:')reject('Use um link HTTPS.')}catch{reject('Link de publicação inválido.')}}
  const patch:Record<string,unknown>={scheduled_at:date(body.scheduled_at),channel:text(body.channel,100)||null,posted_url:url||null}
  if(c.stage==='postado'){
   const posted=date(body.posted_at)||c.posted_at
   if(!posted||Date.parse(posted)>now.getTime()+60000)reject('Informe uma data de publicação válida.')
   patch.posted_at=posted
  }
  return patch
 }
 if (c.posted_at || c.stage === 'postado') reject('Peça já postada. Preserve o histórico; use uma nova tarefa para outra publicação.')
 const requireAssets = () => { if(c.ingest_pending) reject('Aguarde a importação dos novos arquivos antes de aprovar.'); if(c.client==='Identificar cliente') reject('Identifique o cliente antes de solicitar ou registrar aprovação.'); if (!c.selected_assets.length) reject('Selecione ao menos um arquivo final.') }
 const requireApproved = () => { if(c.ingest_pending) reject('Há uma entrega nova pendente de conferência.'); if (c.approved_revision !== c.revision || !c.approved_at || !c.approved_by) reject('Registre a aprovação desta versão antes de continuar.') }
 if (action === 'editar') {
  if (c.stage === 'postado') reject('Peça já postada. Preserve o histórico; use uma nova tarefa para outra publicação.')
  const selected = body.selected_assets
  if (!Array.isArray(selected) || selected.some(id => typeof id !== 'string' || !c.assets.some(a => a.id === id)) || new Set(selected).size !== selected.length) reject('Seleção de arquivos inválida.')
  const caption = text(body.caption)
  const client = body.client===undefined?c.client:text(body.client,120)
  const title = body.title===undefined?c.title:text(body.title,250)
  if(!client || !title) reject('Informe o cliente e o título da peça.')
  const changed = client !== c.client || title !== c.title || caption !== c.caption || JSON.stringify(selected) !== JSON.stringify(c.selected_assets)
  // Salvar é o gesto de revisão: a legenda deixa de ser rascunho da IA.
  return { client, title, caption, caption_draft: false, selected_assets: selected, note: text(body.note), ...(changed ? { ...cleared, revision: c.revision + 1, stage: 'conferir' } : {}) }
 }
 if (action === 'solicitar' || action === 'enviar_cliente') { requireAssets(); if (c.stage === 'postado' || c.stage === 'arquivado') reject('Reabra a peça antes de solicitar aprovação.'); return { ...cleared, stage: 'aguardando' } }
 if (action === 'aprovar' || action === 'cliente_aprovar') {
  requireAssets()
  if (c.stage === 'postado' || c.stage === 'arquivado') reject('Esta peça está encerrada.')
  const name = text(body.name, 120); const evidence = text(body.evidence, 2000)
  // O cliente aprova pelo link sem precisar digitar nada: o link é único por
  // peça e o clique fica registrado com data e versão. Só o registro feito pela
  // equipe continua pedindo quem aprovou e onde, porque aí a prova está fora.
  if (action === 'aprovar' && name.length < 2) reject('Informe quem aprovou.')
  if (action === 'aprovar' && evidence.length < 8) reject('Registre onde e quando a aprovação foi recebida.')
  const quem = name.length >= 2 ? name : 'Cliente (pelo link da peça)'
  const prova = action === 'cliente_aprovar'
   ? (name.length >= 2 ? 'Resposta pelo link desta versão; nome informado pelo cliente.' : 'Resposta pelo link desta versão, sem nome informado.')
   : evidence
  return { stage: 'aprovado', approved_revision: c.revision, approved_by: quem, approved_at: now.toISOString(), approval_evidence: prova, scheduled_at: null }
 }
 if (action === 'ajustes' || action === 'cliente_ajustes' || action === 'cliente_reprovar') {
  if (c.stage === 'postado') reject('Peça já postada; preserve o registro.')
  const reason = text(body.reason, 2000); if (reason.length < 5) reject(action==='cliente_reprovar'?'Informe o motivo da reprovação.':'Descreva o ajuste necessário.')
  return { ...(action==='ajustes'?mantemOLink:cleared), stage: 'ajustes', note: reason }
 }
 if (action === 'agendar') {
  requireApproved(); if (c.stage !== 'aprovado' && c.stage !== 'agendado') reject('A peça precisa estar aprovada.')
  const date = new Date(text(body.scheduled_at, 50)); if (!Number.isFinite(date.getTime()) || date <= now) reject('Escolha uma data futura para a postagem.')
  const channel = text(body.channel, 100); if (!channel) reject('Informe a rede e o formato.')
  return { stage: 'agendado', scheduled_at: date.toISOString(), channel }
 }
 if (action === 'postar') {
  requireApproved(); if (!['aprovado','agendado'].includes(c.stage)) reject('A peça precisa estar aprovada ou agendada.')
  const date = new Date(text(body.posted_at, 50)); if (!Number.isFinite(date.getTime()) || date.getTime() > now.getTime()+60000) reject('Informe quando a peça foi publicada.')
  const channel = text(body.channel, 100); if (!channel) reject('Informe a rede e o formato.')
  const url = text(body.posted_url, 2000)
  if (url) { try { if (new URL(url).protocol !== 'https:') reject('Use um link de publicação HTTPS.') } catch { reject('Link de publicação inválido.') } }
  if (body.confirmed !== true) reject('Confirme que a publicação já foi feita.')
  return { stage: 'postado', posted_at: date.toISOString(), posted_url: url || null, channel, token_hash: null, token_expires_at: null }
 }
 if (action === 'arquivar') return { ...cleared, stage: 'arquivado' }
 if (action === 'conferir') { if (c.stage === 'postado') reject('Peça já postada; preserve o registro.'); return { ...cleared, stage: 'conferir' } }
 reject('Ação inválida.')
}
// O título é escrito para a equipe dentro da tarefa do ClickUp. Tudo que sai daqui
// é lido pelo cliente, na página e no card do WhatsApp, então sai limpo.
export function publicCard(c: SocialCard) {
 const selecionados = c.assets.filter(a => c.selected_assets.includes(a.id))
 const title = clientFacingTitle(c.client, c.title, selecionados.some(a => String(a.type||'').startsWith('video/')), selecionados.length)
 return { ingest_pending:c.ingest_pending, id: c.id, client: c.client, title, assets: c.assets.filter(a => c.selected_assets.includes(a.id)).sort((a,b)=>c.selected_assets.indexOf(a.id)-c.selected_assets.indexOf(b.id)), caption: c.caption, stage: c.stage, revision: c.revision, version: c.version, approved_by: c.approved_by, approved_at: c.approved_at }
}

// Return only the persisted movement fields, without signing all media again.
export function staffMoveState(card:SocialCard) {
 const {id,stage,version,revision,approved_revision,approved_by,approved_at,approval_evidence,scheduled_at,posted_at,posted_url,channel}=card
 return {id,stage,version,revision,approved_revision,approved_by,approved_at,approval_evidence,scheduled_at,posted_at,posted_url,channel}
}
