import { describe, it, expect } from 'vitest'
import { podeAutoEnviar, horaDeBrasilia, videoAindaComprimindo } from '../../api/_lib/social-envio-cliente'
import type { SocialCard } from '../../api/_lib/social-domain'

// João, 13/10/2026: "ela não enviou automaticamente". A peça do editor caía em
// Conferir e esperava alguém clicar: 11 vídeos parados desde 09/10.
// O automático só é seguro com trava, porque o cliente da peça é identificado
// pelo NOME DO ARQUIVO que o editor digitou.
const bsb = (hora: string) => Date.parse(`2026-10-13T${hora}:00-03:00`)

const card = (extra: Partial<SocialCard> = {}, agora = bsb('11:00')): SocialCard => ({
 id: 'wa-abc123', client: 'Alpha Fitness', title: 'Alpha - treino em casa', author: 'Math',
 source_url: '', source_status: 'Entregue no grupo', source_description: '', source_updated: null,
 assets: [{ id: '1', name: 'alpha.mp4', path: 'drive:x1', storage: 'drive', drive_id: 'x1',
  type: 'video/mp4', approval_path: 'leve/x1.mp4' }],
 selected_assets: ['1'], caption: '', note: '', stage: 'conferir', revision: 1, version: 4,
 approved_revision: null, approved_by: null, approved_at: null, approval_evidence: null,
 scheduled_at: null, posted_at: null, posted_url: null, channel: null,
 token_hash: null, token_expires_at: null,
 updated_at: new Date(agora - 30 * 60000).toISOString(), ...extra,
} as SocialCard)

describe('hora de Brasília', () => {
 it('não usa a hora do servidor', () => {
  expect(horaDeBrasilia(Date.parse('2026-10-13T14:45:00Z'))).toBe(11)
  expect(horaDeBrasilia(Date.parse('2026-10-12T23:30:00Z'))).toBe(20)
 })
})

describe('trava do envio automático', () => {
 it('entrega pronta, cliente conhecido e horário comercial: pode ir', () => {
  expect(podeAutoEnviar(card(), bsb('11:00'))).toBe('ok')
 })

 it('só mexe em peça que está em Conferir', () => {
  for (const stage of ['aguardando', 'ajustes', 'aprovado', 'postado', 'arquivado'])
   expect(podeAutoEnviar(card({ stage }), bsb('11:00'))).toBe('etapa nao e conferir')
 })

 it('peça do ClickUp continua passando por gente, porque lá o cliente é deduzido', () => {
  expect(podeAutoEnviar(card({ id: 'cu:86cbbqbcn' }), bsb('11:00'))).toBe('peca do clickup passa por gente')
 })

 it('peça criada na mão no formulário pode ir, porque o cliente foi digitado', () => {
  expect(podeAutoEnviar(card({ id: 'manual-20261013-arte-ab12' }), bsb('11:00'))).toBe('ok')
 })

 it('cliente não identificado nunca sai sozinho', () => {
  expect(podeAutoEnviar(card({ client: 'Identificar cliente' }), bsb('11:00'))).toBe('cliente nao identificado')
  expect(podeAutoEnviar(card({ client: '' }), bsb('11:00'))).toBe('cliente nao identificado')
 })

 it('cliente sem grupo próprio no WhatsApp fica parado', () => {
  expect(podeAutoEnviar(card({ client: 'Ótica Central' }), bsb('11:00'))).toBe('cliente sem grupo unico no whatsapp')
 })

 // Nome que casa com dois grupos é o caminho de erro mais caro: a peça de um
 // cliente no grupo do outro. grupoDoCliente devolve null quando há empate.
 it('nome que casa com mais de um grupo fica parado', () => {
  expect(podeAutoEnviar(card({ client: 'Alpha e Exatta' }), bsb('11:00'))).toBe('cliente sem grupo unico no whatsapp')
 })

 it('peça sem arquivo selecionado fica parada', () => {
  expect(podeAutoEnviar(card({ selected_assets: [] }), bsb('11:00'))).toBe('peca sem arquivo selecionado')
 })

 it('vídeo sem cópia leve espera, para o cliente não receber só o link', () => {
  const sem = card({ assets: [{ id: '1', name: 'a.mp4', path: 'drive:x1', storage: 'drive', drive_id: 'x1', type: 'video/mp4' }] })
  expect(videoAindaComprimindo(sem)).toBe(true)
  expect(podeAutoEnviar(sem, bsb('11:00'))).toBe('copia leve do video ainda nao esta pronta')
 })

 it('fora do horário comercial espera a manhã seguinte', () => {
  expect(podeAutoEnviar(card({}, bsb('20:30')), bsb('20:30'))).toBe('fora do horario comercial')
  expect(podeAutoEnviar(card({}, bsb('07:00')), bsb('07:00'))).toBe('fora do horario comercial')
  expect(podeAutoEnviar(card({}, bsb('18:00')), bsb('18:00'))).toBe('fora do horario comercial')
  // A entrega das 20h30 de ontem sai às 8h de hoje.
  expect(podeAutoEnviar(card({ updated_at: '2026-10-12T23:30:00Z' }), bsb('08:00'))).toBe('ok')
 })

 it('carência de 10 minutos deixa a equipe pegar antes', () => {
  const agora = bsb('11:00')
  expect(podeAutoEnviar(card({ updated_at: new Date(agora - 60000).toISOString() }), agora)).toBe('dentro da carencia de 10 min')
  expect(podeAutoEnviar(card({ updated_at: new Date(agora - 11 * 60000).toISOString() }), agora)).toBe('ok')
 })
})
