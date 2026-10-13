import { describe, it, expect } from 'vitest'
import { saudacao, mensagemDeAprovacao, comoChamar } from '../../api/_lib/social-client-message'

// João, 13/10/2026: "sempre que mandar ter um bom dia ou tarde, não enviar no seco".
const bsb = (dia: string, hora: string) => Date.parse(`${dia}T${hora}:00-03:00`)

describe('saudação pela hora de Brasília', () => {
 it('bom dia das 5h às 11h59', () => {
  expect(saudacao(bsb('2026-10-13', '05:00'))).toBe('Bom dia')
  expect(saudacao(bsb('2026-10-13', '08:36'))).toBe('Bom dia')
  expect(saudacao(bsb('2026-10-13', '11:59'))).toBe('Bom dia')
 })
 it('boa tarde das 12h às 17h59', () => {
  expect(saudacao(bsb('2026-10-13', '12:00'))).toBe('Boa tarde')
  expect(saudacao(bsb('2026-10-13', '17:59'))).toBe('Boa tarde')
 })
 it('boa noite das 18h às 4h59', () => {
  expect(saudacao(bsb('2026-10-13', '18:00'))).toBe('Boa noite')
  expect(saudacao(bsb('2026-10-13', '23:30'))).toBe('Boa noite')
  expect(saudacao(bsb('2026-10-13', '02:00'))).toBe('Boa noite')
 })
 // O servidor roda em UTC. Sem o fuso, 11h45 de Brasília virava 14h45 e o
 // cliente lia "boa tarde" de manhã.
 it('usa a hora de parede de Brasília, não a do servidor', () => {
  // 14:45 UTC é 11:45 em Brasília, que foi a hora do envio da Dra. Enia.
  expect(saudacao(Date.parse('2026-10-13T14:45:00Z'))).toBe('Bom dia')
  // 20:30 UTC é 17:30 em Brasília, ainda tarde.
  expect(saudacao(Date.parse('2026-10-13T20:30:00Z'))).toBe('Boa tarde')
 })
})

describe('mensagem que vai para o grupo do cliente', () => {
 const base = { client: 'Dra Enia', title: 'Dra Enia - primeira consulta (novo)',
  url: 'https://aprovar.svicompany.com.br/p/abc', video: true, agora: bsb('2026-10-13', '11:45') }

 it('abre com a saudação e nunca no seco', () => {
  expect(mensagemDeAprovacao(base).startsWith('Bom dia, pessoal!')).toBe(true)
 })
 it('não repete o nome do cliente no título, que é texto da equipe', () => {
  const texto = mensagemDeAprovacao(base)
  expect(texto).toContain('Primeira consulta')
  expect(texto).not.toContain('Dra Enia - primeira consulta')
 })
 it('leva o link de aprovação', () => {
  expect(mensagemDeAprovacao(base)).toContain(base.url)
 })
 it('oferece o arquivo em alta só quando o link existe', () => {
  expect(mensagemDeAprovacao(base)).not.toContain('alta qualidade')
  const com = mensagemDeAprovacao({ ...base, altaUrl: 'https://drive.google.com/file/d/ABC1234567/view' })
  expect(com).toContain('alta qualidade')
  expect(com).toContain('https://drive.google.com/file/d/ABC1234567/view')
 })
 it('peça sem título usável cai no genérico, nunca em texto vazio', () => {
  const texto = mensagemDeAprovacao({ ...base, title: 'Dra Enia' })
  expect(texto).toContain('Vídeo para aprovação')
 })
 it('não carrega marcador interno', () => {
  expect(mensagemDeAprovacao(base)).not.toContain('SVI retorno')
 })
})

// João, 13/10/2026, vendo o print do grupo da Alpha com duas mensagens
// idênticas no mesmo minuto: "pode melhorar dms a Sofia". Dois "Boa tarde!"
// colados são a cara de robô despejando arquivo.
describe('lote de peças para o mesmo grupo', () => {
 const base = { client: 'ALPHA FITNESS', url: 'https://aprovar.svicompany.com.br/p/a',
  altaUrl: 'https://drive.google.com/file/d/ABC1234567/view', video: true, agora: Date.parse('2026-10-13T15:00:00-03:00') }

 it('a primeira saúda, diz quantas vêm e apresenta a primeira', () => {
  const t = mensagemDeAprovacao({ ...base, title: 'Primeira aula', posicao: 1, total: 2 })
  expect(t.startsWith('Boa tarde, pessoal!')).toBe(true)
  expect(t).toContain('Separei dois vídeos novos')
  expect(t).toContain('O primeiro é *Primeira aula*')
 })

 it('a segunda NÃO repete a saudação e continua a conversa', () => {
  const t = mensagemDeAprovacao({ ...base, title: 'Cérebro na academia', posicao: 2, total: 2 })
  expect(t).not.toContain('Boa tarde')
  expect(t.startsWith('O segundo é *Cérebro na academia*')).toBe(true)
  expect(t).toContain('Aprova ou pede ajuste por aqui:')
  expect(t).toContain('Arquivo em alta:')
 })

 it('com três ou mais, a última se anuncia como última', () => {
  expect(mensagemDeAprovacao({ ...base, title: 'Terceira', posicao: 3, total: 3 }).startsWith('E o último é *Terceira*')).toBe(true)
  expect(mensagemDeAprovacao({ ...base, title: 'Meio', posicao: 2, total: 3 }).startsWith('O segundo é *Meio*')).toBe(true)
 })

 it('peça sozinha segue com o texto de uma peça só', () => {
  const t = mensagemDeAprovacao({ ...base, title: 'Primeira aula' })
  expect(t).toContain('Separei vídeo novo pra vocês: *Primeira aula*')
  expect(t).not.toContain('O primeiro')
 })

 it('posição fora do lote não quebra o texto', () => {
  expect(mensagemDeAprovacao({ ...base, title: 'X', posicao: 9, total: 2 }).startsWith('O segundo é')).toBe(true)
  expect(mensagemDeAprovacao({ ...base, title: 'X', posicao: 0, total: 0 }).startsWith('Boa tarde, pessoal!')).toBe(true)
 })

 it('chama a peça pelo que o cliente vai abrir', () => {
  expect(comoChamar(true, 1).um).toBe('vídeo novo')
  expect(comoChamar(false, 3).um).toBe('carrossel novo')
  expect(comoChamar(false, 1).um).toBe('arte nova')
  expect(mensagemDeAprovacao({ ...base, title: 'Dia das Crianças', video: false, arquivos: 3, posicao: 1, total: 2 }))
   .toContain('Separei dois carrosséis novos')
 })

 it('nada de travessão nem de "a gente"', () => {
  for (const p of [1, 2]) {
   const t = mensagemDeAprovacao({ ...base, title: 'Peça', posicao: p, total: 2 })
   expect(t).not.toContain('—')
   expect(t.toLowerCase()).not.toContain('a gente')
  }
 })
})
