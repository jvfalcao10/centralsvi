import { describe, it, expect, vi } from 'vitest'

// O social-board puxa o cliente do Supabase, que exige as envs do navegador.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { semArquivoMarcado } = await import('../lib/social-board')

// João, 15/10/2026. A falha mais silenciosa do quadro: a peça tem as artes
// anexadas, parece pronta na coluna, mas ninguém marcou qual vai para o
// cliente, então o envio recusa e nada na tela explica o motivo.
//
// Pegou três peças no mesmo dia. A pior foi a Dra. Érika, Dia do Médico: a
// arte CORRIGIDA estava na Central desde 14/10 e a peça ficou parada em
// Ajustes com as duas versões sem marcar, a três dias da data.
const peca = (extra: Record<string, unknown> = {}) => ({
 stage: 'conferir', assets: [{ id: 'a' }, { id: 'b' }], selected_assets: [], ...extra,
}) as Parameters<typeof semArquivoMarcado>[0]

describe('aviso de peça sem arquivo marcado', () => {
 it('avisa quando tem arte anexada e nenhuma marcada', () => {
  expect(semArquivoMarcado(peca())).toBe(true)
 })

 it('cala quando alguém já escolheu', () => {
  expect(semArquivoMarcado(peca({ selected_assets: ['a'] }))).toBe(false)
 })

 it('cala quando a peça ainda não tem arquivo nenhum', () => {
  // Aí o problema é outro, e a peça nem aparenta estar pronta.
  expect(semArquivoMarcado(peca({ assets: [] }))).toBe(false)
 })

 it('avisa em toda etapa que ainda vai para o cliente', () => {
  for (const stage of ['interna', 'conferir', 'aguardando', 'ajustes', 'aprovado', 'para_anuncio', 'agendado'])
   expect(semArquivoMarcado(peca({ stage })), stage).toBe(true)
 })

 it('não avisa em Postado nem em Arquivo, onde a peça já cumpriu o caminho', () => {
  for (const stage of ['postado', 'arquivado'])
   expect(semArquivoMarcado(peca({ stage })), stage).toBe(false)
 })

 it('o caso da Dra. Érika: duas versões anexadas, nenhuma marcada', () => {
  const erika = peca({ stage: 'ajustes', assets: [{ id: 'antiga' }, { id: 'corrigida' }], selected_assets: [] })
  expect(semArquivoMarcado(erika)).toBe(true)
  // Depois de marcar a corrigida, o aviso some e a peça anda.
  expect(semArquivoMarcado({ ...erika, selected_assets: ['corrigida'] })).toBe(false)
 })
})
