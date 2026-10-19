import { describe, it, expect } from 'vitest'
import { valeTentarDeNovo } from '../../api/_lib/social-publication-worker'
import { MetaPublicationError } from '../../api/_lib/social-publication-meta'

// João, 19/10/2026: "qualidade péssima, todos os vídeos estão com qualidade
// baixa". A raiz não era o vídeo. Publicações grandes falhavam com "o
// Instagram não recebeu o vídeo completo", qualquer erro virava `failed` na
// primeira tentativa, e a saída encontrada na mão foi comprimir o arquivo de
// ~20 Mbps para 4,4. A compressão resolveu o sintoma e estragou a imagem.
//
// Medido: 85 MB falhava e 151 MB passava, o mesmo vídeo do Dr. Geraldo fez as
// duas coisas. Era soluço de transporte, não tamanho.
describe('o que merece outra tentativa', () => {
 it('falha de transporte tenta de novo', () => {
  for (const m of [
   'Mídia: o Instagram não recebeu o vídeo completo. Tente novamente.',
   'Mídia: o download do vídeo foi interrompido.',
   'Mídia: vídeo incompleto.',
   'fetch failed',
   'The operation was aborted due to timeout',
  ]) expect(valeTentarDeNovo(new Error(m)), m).toBe(true)
 })

 it('recusa do Instagram para de primeira', () => {
  for (const m of [
   'Mídia: o Instagram recusou o arquivo ou o prazo de processamento expirou.',
   'Mídia: um arquivo do carrossel foi recusado pelo Instagram.',
   'Mídia: vídeo do Drive inválido para publicação.',
   'Mídia: o Instagram demorou para processar. Confira o arquivo antes de tentar novamente.',
  ]) expect(valeTentarDeNovo(new Error(m)), m).toBe(false)
 })

 it('erro de conta ou permissão não insiste', () => {
  // Token vencido e conta sem permissão não melhoram repetindo.
  expect(valeTentarDeNovo(new MetaPublicationError(190, 'Token vencido'))).toBe(false)
  expect(valeTentarDeNovo(new MetaPublicationError(200, 'Sem permissão'))).toBe(false)
 })
})
