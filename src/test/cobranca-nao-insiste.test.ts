import { describe, it, expect, vi, afterEach } from 'vitest'
import { clienteRespondeuDepois } from '../../api/_lib/social-whats'
import { cobrarClientes } from '../../api/_lib/social-cobranca'
import type { SocialCard } from '../../api/_lib/social-domain'

// O link vivo é o que libera a cobrança, e emitir um de verdade pede banco e
// segredo. Aqui o que está em teste é a decisão de cobrar, não o link.
vi.mock('../../api/_lib/social-approval-link.js', () => ({
 approvalLink: async () => 'https://aprovar.svicompany.com.br/p/7zdead9zwekd',
}))

// João, 20/10/2026: "ontem o Dr. Geraldo disse que precisava alterar a copy de
// um carrossel que enviamos, e não mudou a etapa, e hoje a Sofia enviou
// novamente o ajuste sendo que já tinha sido falado por ele".
//
// A sequência real no grupo: peça em 18/10 18h50; 19/10 08h59 ele responde ali
// mesmo ("o sangue quase nunca mostra?", "nunca mostra") e às 09h01 avisa que
// não sabe mexer no link; 20/10 08h30 a ronda cobra como se ninguém tivesse
// falado; 08h55 ele devolve "já falei aí o que mudar". Entender a frase é
// difícil, saber que ele FALOU basta para a Sofia calar e chamar gente.
const envio = Date.parse('2026-10-18T18:50:00-03:00')
const respondeu = Date.parse('2026-10-19T08:59:00-03:00')
const UM_DIA = 86400000
const seg = (ms: number) => Math.floor(ms / 1000)

type Msg = { fromMe?: boolean; messageTimestamp: number }

function historico(messages: Msg[], ok = true) {
 vi.stubEnv('SOCIAL_UAZ_TOKEN', 't')
 // jsdom não tem AbortSignal.timeout, e sem isto todo caminho cai no catch,
 // que devolve true, e o teste passaria sem testar nada.
 if (!AbortSignal.timeout) vi.stubGlobal('AbortSignal', { ...AbortSignal, timeout: () => new AbortController().signal })
 vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => ({ messages }) })))
}

describe('a Sofia não insiste com quem já respondeu', () => {
 afterEach(() => vi.unstubAllGlobals())

 it('o caso do Dr. Geraldo: ele falou no grupo depois do envio', async () => {
  historico([{ fromMe: false, messageTimestamp: seg(respondeu) }])
  expect(await clienteRespondeuDepois('g@g.us', envio)).toBe(true)
 })

 it('silêncio de verdade libera a cobrança', async () => {
  // Só mensagem nossa depois do envio: o cliente não disse nada.
  historico([{ fromMe: true, messageTimestamp: seg(envio + UM_DIA) }])
  expect(await clienteRespondeuDepois('g@g.us', envio)).toBe(false)
 })

 it('conversa de antes do envio não conta como resposta', async () => {
  historico([{ fromMe: false, messageTimestamp: seg(envio - UM_DIA) }])
  expect(await clienteRespondeuDepois('g@g.us', envio)).toBe(false)
 })

 it('aceita timestamp em segundos e em milissegundos', async () => {
  historico([{ fromMe: false, messageTimestamp: respondeu }])
  expect(await clienteRespondeuDepois('g@g.us', envio)).toBe(true)
 })

 // Calar demais é menos ruim que cobrar quem já respondeu, que foi a queixa.
 it('falha de leitura não cobra', async () => {
  historico([], false)
  expect(await clienteRespondeuDepois('g@g.us', envio)).toBe(true)
  historico([{ fromMe: false, messageTimestamp: seg(respondeu) }])
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  expect(await clienteRespondeuDepois('g@g.us', envio)).toBe(true)
 })

 it('sem token não arrisca cobrar', async () => {
  vi.stubEnv('SOCIAL_UAZ_TOKEN', '')
  expect(await clienteRespondeuDepois('g@g.us', envio)).toBe(true)
 })
})

// O mesmo caso visto de fora, pela ronda inteira.
describe('a ronda diária no caso do Dr. Geraldo', () => {
 afterEach(() => vi.unstubAllGlobals())
 const GRUPO = '120363430603367858@g.us'
 const JOAO = '559492404033'
 // Datas reais do card manual-20261018-geraldo-p13-v4-tw: foi para Aguardando
 // em 18/10 18h46, entregue 18h50, e continuou lá até hoje ao meio-dia.
 const AGORA = Date.parse('2026-10-20T08:30:00-03:00')
 const card = {
  id: 'manual-20261018-geraldo-p13-v4-tw', client: 'Dr. Geraldo Cecílio',
  title: '[DR GERALDO] Carrossel · Exame de sangue todo ano', stage: 'aguardando',
  updated_at: '2026-10-18T21:46:14.252Z', author: 'SVI (Claude)', note: '',
  assets: [], selected_assets: [], scheduled_at: null, approved_at: null,
 } as unknown as SocialCard
 const banco = { from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [card], error: null }) }) }) }) }

 const ronda = async (historico: { fromMe?: boolean; messageTimestamp: number }[]) => {
  vi.stubEnv('SOCIAL_UAZ_TOKEN', 't')
  if (!AbortSignal.timeout) vi.stubGlobal('AbortSignal', { ...AbortSignal, timeout: () => new AbortController().signal })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ messages: historico }) })))
  const saiu: { jid: string; texto: string }[] = []
  const r = await cobrarClientes(banco as never, async (jid, texto) => { saiu.push({ jid, texto }) }, AGORA)
  return { r, saiu }
 }

 it('ele respondeu 19/10 08h59, então ninguém cobra e o João é chamado', async () => {
  const { r, saiu } = await ronda([{ fromMe: false, messageTimestamp: seg(Date.parse('2026-10-19T08:59:00-03:00')) }])
  expect(r.clientes, 'nenhuma mensagem para o grupo do cliente').toBe(0)
  expect(r.responderam).toBe(1)
  expect(saiu.map(s => s.jid)).toEqual([JOAO])
  expect(saiu[0].texto).toContain('já responderam no grupo')
  expect(saiu[0].texto).toContain('Dr. Geraldo')
  // Negrito do WhatsApp é um asterisco só. Dois saem na cara do João.
  expect(saiu[0].texto).not.toContain('**')
 })

 it('sem resposta dele, a cobrança sai no grupo como antes', async () => {
  const { r, saiu } = await ronda([{ fromMe: true, messageTimestamp: seg(Date.parse('2026-10-19T08:30:00-03:00')) }])
  expect(r.clientes).toBe(1)
  expect(r.responderam).toBe(0)
  expect(saiu.map(s => s.jid)).toEqual([GRUPO])
  expect(saiu[0].texto).toContain('esperando vocês')
 })
})
