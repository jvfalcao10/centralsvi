import { describe, it, expect, vi, afterEach } from 'vitest'
import { semSaudacao, jaFalamosHoje } from '../../api/_lib/social-whats'
import { mensagemDeAprovacao, mensagemNoAr } from '../../api/_lib/social-client-message'

// João, 15/10/2026, com o grupo da Alpha na tela: 08:05 "Bom dia, pessoal!
// Separei vídeo novo pra vocês", duas horas de conversa com o cliente, e 10:55
// "Bom dia, pessoal! Dia do professor está no ar". Dois bons dias na mesma
// manhã, no mesmo grupo. Pessoa nenhuma faz isso.
const AGORA = Date.parse('2026-10-15T10:55:00-03:00')

describe('tirar o cumprimento repetido', () => {
 it('tira o bom dia e mantém o resto intacto', () => {
  const texto = mensagemNoAr({ client: 'ALPHA FITNESS', title: 'Alpha - dia do professor',
   url: 'https://www.instagram.com/reel/DehGGftDBUy/', video: true, agora: AGORA })
  expect(texto.startsWith('Bom dia, pessoal!')).toBe(true)
  const seguida = semSaudacao(texto)
  expect(seguida.startsWith('*Dia do professor* está no ar')).toBe(true)
  expect(seguida).toContain('https://www.instagram.com/reel/DehGGftDBUy/')
 })

 it('serve para os três cumprimentos', () => {
  for (const hora of ['08:00', '14:00', '20:00']) {
   const t = mensagemDeAprovacao({ client: 'ALPHA FITNESS', title: 'Alpha - treino',
    url: 'https://aprovar.svicompany.com.br/p/a', video: true, agora: Date.parse(`2026-10-15T${hora}:00-03:00`) })
   expect(semSaudacao(t).startsWith('Separei')).toBe(true)
  }
 })

 it('mensagem sem cumprimento passa inteira', () => {
  const t = 'Essa é *Outra peça*\n\nhttps://exemplo'
  expect(semSaudacao(t)).toBe(t)
 })

 // Mensagem que é só o cumprimento continua inteira: vazia não serve.
 it('não esvazia a mensagem', () => expect(semSaudacao('Bom dia, pessoal!\n\n')).toBe('Bom dia, pessoal!\n\n'))
})

describe('já falamos hoje nesse grupo', () => {
 afterEach(() => vi.unstubAllGlobals())
 const resposta = (messages: unknown[]) => {
  vi.stubEnv('SOCIAL_UAZ_TOKEN', 't')
  if (!AbortSignal.timeout) vi.stubGlobal('AbortSignal', { ...AbortSignal, timeout: () => new AbortController().signal })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ messages }) })))
 }
 const seg = (iso: string) => Math.floor(Date.parse(iso) / 1000)

 it('sim quando a própria Sofia já falou hoje', async () => {
  resposta([{ fromMe: true, messageTimestamp: seg('2026-10-15T08:05:00-03:00') }])
  expect(await jaFalamosHoje('g@g.us', AGORA)).toBe(true)
 })

 it('não quando a fala de hoje é só do cliente', async () => {
  resposta([{ fromMe: false, messageTimestamp: seg('2026-10-15T09:00:00-03:00') }])
  expect(await jaFalamosHoje('g@g.us', AGORA)).toBe(false)
 })

 // O dia é o de Brasília, não o do servidor, que roda em UTC.
 it('fala de ontem à noite não conta como hoje', async () => {
  resposta([{ fromMe: true, messageTimestamp: seg('2026-10-14T21:00:00-03:00') }])
  expect(await jaFalamosHoje('g@g.us', AGORA)).toBe(false)
 })

 it('falha de leitura cumprimenta, que é o lado menos ruim', async () => {
  vi.stubEnv('SOCIAL_UAZ_TOKEN', 't')
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  expect(await jaFalamosHoje('g@g.us', AGORA)).toBe(false)
 })

 it('sem token não arrisca nada', async () => {
  vi.stubEnv('SOCIAL_UAZ_TOKEN', '')
  expect(await jaFalamosHoje('g@g.us', AGORA)).toBe(false)
 })
})
