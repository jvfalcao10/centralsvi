import { describe, it, expect } from 'vitest'
import { melhoresNoticias, textoDaNoticia, ganchoDaNoticia, type Noticia } from '../../api/_lib/social-noticia-norte'

// João, 21/10/2026: "Norte segue 1 normal por semana e 1 notícia pra enviar
// pro Elpídio escolher". O Radar já capturava a notícia de agro todo dia e
// ninguém olhava: 15 na semana de 21/10, 8 delas de relevância alta.
const AGORA = Date.parse('2026-10-26T08:00:00-03:00')
const DIA = 86400000
const n = (titulo: string, rel: string, dias: number, url = titulo): Noticia => ({
 title: titulo, source: 'Notícias Agrícolas', url, relevance: rel,
 summary: `Resumo qualquer. Gancho de pauta: o que explica ${titulo.toLowerCase()}?`,
 captured_at: new Date(AGORA - dias * DIA).toISOString(),
})

describe('a notícia da semana da Norte', () => {
 it('alta na frente, e dentro dela a mais recente', () => {
  const l = melhoresNoticias([n('Soja recua', 'media', 0), n('Boi reage', 'alta', 2), n('Safra recorde', 'alta', 1)], new Set(), AGORA)
  expect(l.map(x => x.title)).toEqual(['Safra recorde', 'Boi reage', 'Soja recua'])
 })

 it('leva três, nem mais nem menos', () => {
  const muitas = Array.from({ length: 9 }, (_, i) => n(`Notícia ${i}`, 'alta', 1, `u${i}`))
  expect(melhoresNoticias(muitas, new Set(), AGORA)).toHaveLength(3)
 })

 // Cotação de boi envelhece em horas. Manchete de duas semanas não é notícia.
 it('não oferece notícia velha', () => {
  expect(melhoresNoticias([n('De outro mês', 'alta', 12)], new Set(), AGORA)).toHaveLength(0)
 })

 it('não repete o que já foi oferecido', () => {
  const l = melhoresNoticias([n('Boi reage', 'alta', 1, 'ja-foi'), n('Safra', 'alta', 1, 'nova')], new Set(['ja-foi']), AGORA)
  expect(l.map(x => x.url)).toEqual(['nova'])
 })

 it('o gancho sai limpo, sem o rótulo do radar', () => {
  expect(ganchoDaNoticia('Texto longo. Gancho de pauta: a arroba subiu, por quê?')).toBe('a arroba subiu, por quê?')
  expect(ganchoDaNoticia('Sem rótulo nenhum')).toBe('Sem rótulo nenhum')
 })

 it('a mensagem chama o Elpídio, numera e pede o número', () => {
  const t = textoDaNoticia(melhoresNoticias([n('Boi reage', 'alta', 0), n('Safra', 'alta', 1)], new Set(), AGORA), AGORA)
  expect(t).toContain('Elpídio')
  expect(t).toContain('*1.* Boi reage')
  expect(t).toContain('*2.* Safra')
  expect(t).toContain('quinta')
  expect(t).not.toContain('—')
  expect(t).not.toContain('a gente')
 })
})
