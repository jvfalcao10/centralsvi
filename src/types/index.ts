export interface Profile {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  role: string
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  name: string
  company: string | null
  phone: string
  email: string | null
  segment: string | null
  source: string
  stage: string
  ticket_estimado: number | null
  plano: string | null
  mrr_projetado: number | null
  owner_id: string | null
  notes: string | null
  instagram: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  company: string
  phone: string
  email: string | null
  segment: string
  plano: string
  mrr: number
  currency: string
  status: string
  health_score: number
  inicio_contrato: string
  owner_id: string | null
  notes: string | null
  instagram: string | null
  dia_vencimento: number | null
  created_at: string
  updated_at: string
}

export interface Delivery {
  id: string
  client_id: string
  tipo: string
  titulo: string
  responsavel_id: string | null
  status: string
  prazo: string
  data_entrega: string | null
  created_at: string
  updated_at: string
  clients?: { name: string; company: string }
}

export interface Invoice {
  id: string
  client_id: string
  valor: number
  vencimento: string
  status: string
  metodo_pagamento: string | null
  data_pagamento: string | null
  clients?: { name: string; company: string }
}

export interface Expense {
  id: string
  categoria: string
  descricao: string
  valor: number
  vencimento: string
  status: string
  recorrente: boolean
  recorrencia_gerada: boolean
}

export interface Interaction {
  id: string
  client_id: string | null
  lead_id: string | null
  tipo: string
  descricao: string
  user_id: string | null
  created_at: string
}

export const PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead', color: 'bg-blue-500/20 border-blue-500/30' },
  { id: 'qualificacao', label: 'Qualificação', color: 'bg-purple-500/20 border-purple-500/30' },
  { id: 'diagnostico', label: 'Diagnóstico', color: 'bg-yellow-500/20 border-yellow-500/30' },
  { id: 'proposta', label: 'Proposta', color: 'bg-orange-500/20 border-orange-500/30' },
  { id: 'negociacao', label: 'Negociação', color: 'bg-pink-500/20 border-pink-500/30' },
  { id: 'fechado', label: 'Fechado', color: 'bg-green-500/20 border-green-500/30' },
  { id: 'perdido', label: 'Perdido', color: 'bg-muted border-border' },
]

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  risco: { label: 'Em Risco', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  inadimplente: { label: 'Inadimplente', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export const PLANO_CONFIG: Record<string, { label: string; className: string }> = {
  starter: { label: 'Starter', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  growth: { label: 'Growth', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  pro: { label: 'Pro', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  enterprise: { label: 'Enterprise', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
}

export const DELIVERY_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  roteiro: { label: 'Roteiro', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  copy: { label: 'Copy', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  reuniao: { label: 'Reunião', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  relatorio: { label: 'Relatório', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  design: { label: 'Design', className: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  video: { label: 'Vídeo', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export const DELIVERY_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  em_progresso: { label: 'Em Progresso', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  revisao: { label: 'Em Revisão', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  entregue: { label: 'Entregue', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
}

// ── Prospecting Types ─────────────────────────────────────────────────────
export interface Prospect {
  id: string
  name: string
  specialty: string
  city: string
  instagram: string
  tier: 'verde' | 'amarelo' | 'vermelho'
  touch: number
  channel: 'dm' | 'whatsapp' | 'call'
  status: string
  signal: string
  nextFollowUp: string
  notes: string
  createdAt: string
}

export const PROSPECT_TIER_CONFIG: Record<string, { label: string; className: string }> = {
  verde: { label: 'Verde', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  amarelo: { label: 'Amarelo', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  vermelho: { label: 'Vermelho', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export const PROSPECT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  novo: { label: 'Novo', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  enviado: { label: 'Enviado', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  respondeu: { label: 'Respondeu', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  whatsapp: { label: 'WhatsApp', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  call_agendada: { label: 'Call Agendada', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  call_realizada: { label: 'Call Realizada', className: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  proposta_enviada: { label: 'Proposta', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  fechado: { label: 'Fechado', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  nao_agora: { label: 'Não Agora', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  perdido: { label: 'Perdido', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export const PROSPECT_CHANNELS: Record<string, { label: string; className: string }> = {
  dm: { label: 'DM', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  whatsapp: { label: 'WhatsApp', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  call: { label: 'Call', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

export const CITIES = ['Redenção', 'Xinguara', 'Marabá', 'Tucumã', 'Conceição do Araguaia', 'Rio Maria', 'Outra']

export const SPECIALTIES = [
  'Ortopedista', 'Dermatologista', 'Ginecologista', 'Urologista',
  'Cardiologista', 'Oftalmologista', 'Cirurgião Plástico', 'Neurologista',
  'Gastroenterologista', 'Pediatra', 'Psiquiatra', 'Endocrinologista', 'Outra'
]

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function getDaysAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'hoje'
  if (diff === 1) return '1d'
  return `${diff}d`
}

export function getDeadlineColor(prazo: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(prazo + 'T00:00:00')
  const diff = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'text-red-400'
  if (diff <= 2) return 'text-yellow-400'
  return 'text-green-400'
}

export function formatDateTime(ts: string): string {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleDateString('pt-BR')
}

// ============================================================================
// CONTEÚDO
// ============================================================================

export type ContentFormat = 'carrossel' | 'reels' | 'stories' | 'feed'
export type PostStatus = 'ideia' | 'producao' | 'agendado' | 'publicado'
export type PautaUrgency = 'evergreen' | 'tendencia' | 'sazonal'
export type PautaStatus = 'disponivel' | 'usada' | 'descartada'
export type RefPlatform = 'instagram' | 'youtube' | 'linkedin' | 'tiktok'
export type TrendRelevance = 'alta' | 'media' | 'baixa'

export interface ContentPost {
  id: string
  client_id: string
  title: string
  format: ContentFormat
  category: string | null
  status: PostStatus
  scheduled_date: string | null
  published_at: string | null
  caption: string | null
  hashtags: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContentPauta {
  id: string
  client_id: string
  title: string
  category: string
  format_suggestion: string | null
  urgency: PautaUrgency
  status: PautaStatus
  notes: string | null
  used_in_post_id: string | null
  created_at: string
  updated_at: string
}

export interface ContentReference {
  id: string
  client_id: string
  name: string
  platform: RefPlatform
  handle: string
  specialty: string | null
  notes: string | null
  last_checked_at: string | null
  followers_count: number | null
  posts_per_week: number | null
  top_formats: string | null
  created_at: string
}

export interface ContentTrend {
  id: string
  client_id: string | null
  title: string
  source: string
  url: string | null
  relevance: TrendRelevance
  category: string | null
  summary: string | null
  converted_to_pauta_id: string | null
  captured_at: string
}

export const POST_STATUS_CONFIG: Record<PostStatus, { label: string; className: string }> = {
  ideia:      { label: 'Ideia',       className: 'bg-muted text-muted-foreground' },
  producao:   { label: 'Em produção', className: 'bg-info/15 text-info' },
  agendado:   { label: 'Agendado',    className: 'bg-warning/15 text-warning' },
  publicado:  { label: 'Publicado',   className: 'bg-success/15 text-success' },
}

export const CONTENT_FORMAT_CONFIG: Record<ContentFormat, { label: string; className: string; chipBg: string }> = {
  carrossel: { label: 'Carrossel', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       chipBg: 'bg-blue-500' },
  reels:     { label: 'Reels',     className: 'bg-red-500/15 text-red-400 border-red-500/30',          chipBg: 'bg-red-500' },
  stories:   { label: 'Stories',   className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', chipBg: 'bg-yellow-500' },
  feed:      { label: 'Feed',      className: 'bg-green-500/15 text-green-400 border-green-500/30',    chipBg: 'bg-green-500' },
}

export const PAUTA_URGENCY_CONFIG: Record<PautaUrgency, { label: string; className: string }> = {
  evergreen:  { label: 'Evergreen',  className: 'bg-success/15 text-success' },
  tendencia:  { label: 'Tendência',  className: 'bg-warning/15 text-warning' },
  sazonal:    { label: 'Sazonal',    className: 'bg-info/15 text-info' },
}

export const PAUTA_STATUS_CONFIG: Record<PautaStatus, { label: string; className: string }> = {
  disponivel: { label: 'Disponível', className: 'bg-primary/15 text-primary' },
  usada:      { label: 'Usada',      className: 'bg-muted text-muted-foreground' },
  descartada: { label: 'Descartada', className: 'bg-destructive/10 text-destructive' },
}

export const TREND_RELEVANCE_CONFIG: Record<TrendRelevance, { label: string; className: string }> = {
  alta:   { label: 'Alta',   className: 'bg-destructive/15 text-destructive' },
  media:  { label: 'Média',  className: 'bg-warning/15 text-warning' },
  baixa:  { label: 'Baixa',  className: 'bg-muted text-muted-foreground' },
}
