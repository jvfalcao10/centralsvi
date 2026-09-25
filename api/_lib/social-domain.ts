export type SocialAsset = { id: string; name: string; path: string; storage?: 'drive'; drive_id?: string; folder_url?: string; folder_label?: string; thumbnail?: string; type: string; bytes?: number; date?: string; url?: string; preview?: string }
export type SocialCard = {
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
export function socialPatch(c: SocialCard, body: Record<string, unknown>, now = new Date()) {
 const action = text(body.action, 40)
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
  return { client, title, caption, selected_assets: selected, note: text(body.note), ...(changed ? { ...cleared, revision: c.revision + 1, stage: 'conferir' } : {}) }
 }
 if (action === 'solicitar') { requireAssets(); if (c.stage === 'postado' || c.stage === 'arquivado') reject('Reabra a peça antes de solicitar aprovação.'); return { ...cleared, stage: 'aguardando' } }
 if (action === 'aprovar' || action === 'cliente_aprovar') {
  requireAssets()
  if (c.stage === 'postado' || c.stage === 'arquivado') reject('Esta peça está encerrada.')
  const name = text(body.name, 120); const evidence = text(body.evidence, 2000)
  if (name.length < 2) reject('Informe quem aprovou.')
  if (action === 'aprovar' && evidence.length < 8) reject('Registre onde e quando a aprovação foi recebida.')
  return { stage: 'aprovado', approved_revision: c.revision, approved_by: name, approved_at: now.toISOString(), approval_evidence: action === 'cliente_aprovar' ? 'Resposta pelo link desta versão; nome informado pelo cliente.' : evidence, scheduled_at: null }
 }
 if (action === 'ajustes' || action === 'cliente_ajustes') {
  if (c.stage === 'postado') reject('Peça já postada; preserve o registro.')
  const reason = text(body.reason, 2000); if (reason.length < 5) reject('Descreva o ajuste necessário.')
  return { ...cleared, stage: 'ajustes', note: reason }
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
export function publicCard(c: SocialCard) {
 return { ingest_pending:c.ingest_pending, id: c.id, client: c.client, title: c.title, assets: c.assets.filter(a => c.selected_assets.includes(a.id)).sort((a,b)=>c.selected_assets.indexOf(a.id)-c.selected_assets.indexOf(b.id)), caption: c.caption, stage: c.stage, revision: c.revision, version: c.version, approved_by: c.approved_by, approved_at: c.approved_at }
}
