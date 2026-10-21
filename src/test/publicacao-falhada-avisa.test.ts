import { describe, it, expect } from 'vitest'
import { publicacoesFalhadas, textoDasFalhadas } from '../../api/_lib/social-cobranca'
import type { SocialCard } from '../../api/_lib/social-domain'

// João, 20/10/2026: "4 peças mentem no quadro, estão em agendado e nunca vão
// sair". Publicação que falha não avisa ninguém: o card continua dizendo
// "agendado" e a data passa. Uma delas estava assim desde 16/10.
const AGORA = Date.parse('2026-10-21T08:30:00-03:00')
const DIA = 86400000
const job = (card_id: string, dias: number, extra: Partial<{ status: string; error: string }> = {}) => ({
 card_id, status: 'failed', account_username: 'conta',
 scheduled_at: new Date(AGORA - dias * DIA).toISOString(),
 error: 'O Instagram recusou o arquivo e nada foi publicado.', ...extra,
})
const card = (id: string, extra: Partial<SocialCard> = {}) =>
 ({ id, client: 'GM GAS', title: 'GM gás - vídeo 05', stage: 'agendado', assets: [], selected_assets: [], ...extra } as unknown as SocialCard)

describe('peça que não foi ao ar grita no mesmo dia', () => {
 it('entra o que falhou e a data já passou', () => {
  const l = publicacoesFalhadas([job('a', 1)], [card('a')], AGORA)
  expect(l).toHaveLength(1)
  expect(l[0].title).toBeTruthy()
 })

 it('peça que saiu por outro caminho não é cobrada', () => {
  // O card manda: se está postado, alguém resolveu na mão e acabou.
  expect(publicacoesFalhadas([job('a', 1)], [card('a', { stage: 'postado' })], AGORA)).toHaveLength(0)
 })

 it('falha velha demais já virou decisão, não lembrete', () => {
  expect(publicacoesFalhadas([job('a', 9)], [card('a')], AGORA)).toHaveLength(0)
 })

 it('o que ainda vai acontecer não é falha para hoje', () => {
  expect(publicacoesFalhadas([job('a', -2)], [card('a')], AGORA)).toHaveLength(0)
 })

 it('a mensagem diz o cliente, quando era e que nada foi publicado', () => {
  const t = textoDasFalhadas(publicacoesFalhadas([job('a', 1)], [card('a')], AGORA), AGORA)
  expect(t).toContain('GM GAS')
  expect(t).toContain('era para ontem')
  expect(t).toContain('Nada foi publicado')
  expect(t).toContain('Reenvia pela Central')
  expect(t).not.toContain('—')
 })
})
