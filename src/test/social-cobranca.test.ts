import { describe, it, expect, vi } from 'vitest'
import { pecasParadas, dataDoArquivo, textoDoGrupo, textoDoJoao, cobrarAjustes, corta,
 pecasComOCliente, textoDoCliente, dataDoTitulo, pecasComDataChegando, textoDasDatas,
 aprovadasSemData, textoDasAprovadas, cobrarClientes, nomeNaCobranca } from '../../api/_lib/social-cobranca'
const DIA_MS = 86400000
import type { SocialCard } from '../../api/_lib/social-domain'

// João, 13/10/2026: "o José já fez ajustes de várias artes e não atualizou lá
// nem subiu lá". Medido no quadro: as 6 peças em ajuste tinham o arquivo mais
// novo ANTERIOR ao pedido de alteração, uma parada há 16 dias.
const AGORA = Date.parse('2026-10-13T11:30:00-03:00')
const card = (extra: Partial<SocialCard> = {}): SocialCard => ({
 id: 'cu:1', client: 'DRA ERIKA FIGUEIREDO', title: '[DRA ERIKA] Out · Estático · Dia do Médico (18/10)',
 author: 'José', source_url: '', source_status: '', source_description: '', source_updated: null,
 assets: [{ id: 'a1', name: 'arte.png', path: 'p1', type: 'image/png', date: '2026-10-09T13:19:00.000Z' }],
 selected_assets: ['a1'], caption: '', note: 'Trocar a homenagem no texto.', stage: 'ajustes',
 revision: 2, version: 3, approved_revision: null, approved_by: null, approved_at: null,
 approval_evidence: null, scheduled_at: null, posted_at: null, posted_url: null, channel: null,
 token_hash: null, token_expires_at: null, updated_at: '2026-10-09T21:14:00.000Z', ...extra,
} as SocialCard)

describe('data do arquivo', () => {
 it('entende ISO', () => expect(dataDoArquivo({ date: '2026-10-09T13:19:00.000Z' } as never)).toBe(Date.parse('2026-10-09T13:19:00.000Z')))
 // Cards antigos do ClickUp guardam dd/mm/aaaa hh:mm, em hora de Brasília.
 it('entende dd/mm/aaaa hh:mm como hora de Brasília', () =>
  expect(dataDoArquivo({ date: '25/09/2026 12:54' } as never)).toBe(Date.parse('2026-09-25T12:54:00-03:00')))
 it('formato que não entende vira null, que é o lado seguro', () => {
  expect(dataDoArquivo({ date: 'ontem' } as never)).toBeNull()
  expect(dataDoArquivo({} as never)).toBeNull()
 })
})

describe('quem está parado', () => {
 it('arquivo anterior ao pedido conta como parado', () => {
  const [p] = pecasParadas([card()], AGORA)
  expect(p.author).toBe('José')
  expect(p.dias).toBe(3)
  expect(p.title).not.toContain('[DRA ERIKA]')
 })

 it('arquivo DEPOIS do pedido sai da lista, porque a correção chegou', () => {
  const corrigida = card({ assets: [{ id: 'a1', name: 'arte.png', path: 'p1', type: 'image/png', date: '2026-10-10T12:00:00.000Z' }] })
  expect(pecasParadas([corrigida], AGORA)).toHaveLength(0)
 })

 // O arquivo do mesmo minuto do pedido é o que o cliente viu e reprovou.
 it('arquivo do mesmo minuto do pedido continua parado', () => {
  const brenno = card({ updated_at: '2026-10-12T11:32:00.000Z',
   assets: [{ id: 'a1', name: 'c.png', path: 'p', type: 'image/png', date: '2026-10-12T11:31:00.000Z' }] })
  expect(pecasParadas([brenno], AGORA)).toHaveLength(1)
 })

 it('peça sem arquivo nenhum conta como parada', () => {
  expect(pecasParadas([card({ assets: [] })], AGORA)).toHaveLength(1)
 })

 it('só mexe em peça na etapa de ajustes', () => {
  for (const stage of ['conferir', 'aguardando', 'aprovado', 'postado', 'arquivado'])
   expect(pecasParadas([card({ stage })], AGORA)).toHaveLength(0)
 })

 it('mais antiga primeiro, porque é a que está queimando', () => {
  const lista = pecasParadas([
   card({ id: 'novo', updated_at: '2026-10-12T11:32:00.000Z' }),
   // Arquivo de 25/09 e pedido de 27/09: o caso real da Laís, no formato antigo.
   card({ id: 'velho', updated_at: '2026-09-27T23:53:00.000Z', author: 'Laís',
    assets: [{ id: 'a1', name: 'c.png', path: 'p', type: 'image/png', date: '25/09/2026 12:54' }] }),
  ], AGORA)
  expect(lista.map(p => p.card_id)).toEqual(['velho', 'novo'])
  expect(lista[0].dias).toBe(15)
 })
})

describe('texto da cobrança', () => {
 it('abre com saudação, diz o que foi pedido e qual é o critério', () => {
  const t = textoDoGrupo(pecasParadas([card()], AGORA), AGORA)
  expect(t.startsWith('Bom dia!')).toBe(true)
  expect(t).toContain('DRA ERIKA FIGUEIREDO')
  expect(t).toContain('pedida há 3 dias')
  expect(t).toContain('Trocar a homenagem no texto.')
  expect(t).toContain('Mudar o status não basta')
  expect(t).not.toContain('a gente')
  expect(t).not.toContain('—')
 })

 it('o aviso do João agrupa por autor e separa quem não tem grupo', () => {
  const paradas = pecasParadas([card(), card({ id: 'cu:2', author: 'Laís', client: 'NÚMEROS',
   updated_at: '2026-09-27T23:53:00.000Z', title: '[NÚMEROS] Out · Carrossel 3 slides',
   assets: [{ id: 'a1', name: 'c.png', path: 'p', type: 'image/png', date: '25/09/2026 12:54' }] })], AGORA)
  const orfas = paradas.filter(p => p.author === 'Laís')
  const t = textoDoJoao(paradas, orfas, AGORA)
  expect(t).toContain('*José* · 1')
  expect(t).toContain('ninguém foi cobrado')
  expect(t).toContain('NÚMEROS')
  expect(t).toContain('arquivo novo, não status')
 })
})

describe('cobrança diária', () => {
 const banco = (cards: SocialCard[], grupos: { author: string; jid: string }[]) => ({
  from: (tabela: string) => ({
   select: () => tabela === 'central_social_cards'
    ? { eq: () => ({ limit: async () => ({ data: cards, error: null }) }) }
    : { eq: async () => ({ data: grupos, error: null }) },
  }),
 })

 it('manda uma mensagem por grupo com peça parada, mais a do João', async () => {
  const enviadas: { jid: string; texto: string }[] = []
  const r = await cobrarAjustes(
   banco([card(), card({ id: 'cu:3', author: 'Math', client: 'DRA. ÉSIA' })],
    [{ author: 'José', jid: 'g-jose' }, { author: 'Math', jid: 'g-math' }, { author: 'Sarah', jid: 'g-sarah' }]) as never,
   async (jid, texto) => { enviadas.push({ jid, texto }) }, AGORA)
  expect(r).toMatchObject({ paradas: 2, grupos: 2, orfas: 0 })
  expect(enviadas.map(e => e.jid)).toEqual(['g-jose', 'g-math', '559492404033'])
  expect(enviadas.find(e => e.jid === 'g-sarah'), 'grupo sem peça parada não recebe nada').toBeUndefined()
 })

 it('quadro limpo não manda nada', async () => {
  const enviadas: string[] = []
  const r = await cobrarAjustes(banco([], [{ author: 'José', jid: 'g-jose' }]) as never,
   async jid => { enviadas.push(jid) }, AGORA)
  expect(r).toMatchObject({ paradas: 0 })
  expect(enviadas).toEqual([])
 })

 it('grupo que falha não cala os outros nem o aviso do João', async () => {
  const ok: string[] = []
  const r = await cobrarAjustes(
   banco([card(), card({ id: 'cu:4', author: 'Math' })], [{ author: 'José', jid: 'g-jose' }, { author: 'Math', jid: 'g-math' }]) as never,
   async jid => { if (jid === 'g-jose') throw new Error('offline'); ok.push(jid) }, AGORA)
  expect(ok).toEqual(['g-math', '559492404033'])
  expect(r.grupos).toBe(1)
 })

 it('autor sem grupo ativo não é cobrado, mas aparece para o João', async () => {
  const enviadas: { jid: string; texto: string }[] = []
  await cobrarAjustes(banco([card({ author: 'Laís' })], [{ author: 'José', jid: 'g-jose' }]) as never,
   async (jid, texto) => { enviadas.push({ jid, texto }) }, AGORA)
  expect(enviadas).toHaveLength(1)
  expect(enviadas[0].jid).toBe('559492404033')
  expect(enviadas[0].texto).toContain('Laís')
 })
})

// O texto cortava no meio da palavra: "...Dra Érika Figueire".
describe('corte do que foi pedido', () => {
 it('corta no espaço e marca que continua', () => {
  const t = corta('No lugar de Feliz dia do médico, Dra Érika Figueiredo, coloca Feliz dia do médico e receba essa homenagem especial hoje, Dra Érika Figueiredo', 140)
  expect(t.length).toBeLessThanOrEqual(141)
  expect(t.endsWith('…')).toBe(true)
  expect(t).not.toMatch(/Figueire…$/)
 })
 it('texto curto passa inteiro e sem reticência', () => {
  expect(corta('Mudar imagem do ultrasom mano.', 140)).toBe('Mudar imagem do ultrasom mano.')
 })
})

// João, 13/10/2026: "ela deve ser inteligente a isso mesmo". Três rondas:
// cobrar o cliente que não responde, avisar quando foi ao ar, lembrar da data.
describe('cobrar o cliente que não respondeu', () => {
 const enviada = (horas: number) => card({ stage: 'aguardando',
  updated_at: new Date(AGORA - horas * 3600000).toISOString() })

 it('só puxa depois de um dia inteiro de espera', () => {
  expect(pecasComOCliente([enviada(23)], AGORA)).toHaveLength(0)
  expect(pecasComOCliente([enviada(25)], AGORA)).toHaveLength(1)
 })

 it('não puxa peça que não está com o cliente', () => {
  for (const stage of ['conferir', 'ajustes', 'aprovado', 'postado'])
   expect(pecasComOCliente([card({ stage, updated_at: new Date(AGORA - 5 * DIA_MS).toISOString() })], AGORA)).toHaveLength(0)
 })

 it('o texto lembra sem cobrar seco e diz o que trava', () => {
  const lista = pecasComOCliente([enviada(30)], AGORA)
  lista[0].url = 'https://aprovar.svicompany.com.br/p/abc'
  const t = textoDoCliente(lista, AGORA)
  expect(t.startsWith('Bom dia, pessoal!')).toBe(true)
  expect(t).toContain('mandei ontem')
  expect(t).toContain('https://aprovar.svicompany.com.br/p/abc')
  expect(t).toContain('não vai pro ar')
  expect(t.toLowerCase()).not.toContain('a gente')
 })

 it('duas peças viram uma mensagem numerada, não duas', () => {
  const t = textoDoCliente(pecasComOCliente([enviada(30), enviada(50)], AGORA), AGORA)
  expect(t).toContain('ficaram 2 peças esperando')
  expect(t).toContain('1. *')
  expect(t).toContain('2. *')
  expect(t.match(/Bom dia/g)).toHaveLength(1)
 })
})

describe('data chegando', () => {
 it('lê a data do título quando o contexto é de data', () => {
  expect(dataDoTitulo('[DRA ERIKA] Out · Estático · Dia do Médico (18/10)', AGORA)).toBe(Date.parse('2026-10-18T23:59:00-03:00'))
  expect(dataDoTitulo('[DR. BRENNO] 12/10 · Dia da Artrite', AGORA)).toBe(Date.parse('2026-10-12T23:59:00-03:00'))
  expect(dataDoTitulo('QUA 14/10 18h · [GM GÁS] Out · Estático', AGORA)).toBe(Date.parse('2026-10-14T23:59:00-03:00'))
 })

 // O caso que estragaria tudo: "Carrossel ANUNCIO Meta 1/2" virando 1 de fevereiro.
 it('não confunde numeração de peça com data', () => {
  expect(dataDoTitulo('HOJE · [BRENNO] Carrossel ANUNCIO Meta 1/2: caso clinico artrose', AGORA)).toBeNull()
  expect(dataDoTitulo('SPA NATURE · 5/5 · R03 Quem chega antes', AGORA)).toBeNull()
  expect(dataDoTitulo('[DRA ENIA] Editar VIDEO 03 · 2/4', AGORA)).toBeNull()
  expect(dataDoTitulo('Carrossel 3 slides sobre reforma', AGORA)).toBeNull()
 })

 it('data que já passou vira a do ano que vem, não a de trás', () => {
  const t = dataDoTitulo('Natal (25/12)', AGORA)!
  expect(new Date(t - 3 * 3600000).getUTCFullYear()).toBe(2026)
  const passada = dataDoTitulo('Ano novo (01/01)', AGORA)!
  expect(new Date(passada - 3 * 3600000).getUTCFullYear()).toBe(2027)
  // Data de poucos dias atrás continua valendo como deste ano, para a peça
  // atrasada ainda aparecer como "é hoje" em vez de sumir por um ano.
  expect(new Date(dataDoTitulo('[GM GÁS] 12/10 · Estático', AGORA)! - 3 * 3600000).getUTCFullYear()).toBe(2026)
 })

 it('avisa com cinco dias e só de peça que não está pronta', () => {
  const erika = card({ title: '[DRA ERIKA] Out · Estático · Dia do Médico (18/10)', stage: 'ajustes' })
  const [p] = pecasComDataChegando([erika], AGORA)
  expect(p.faltam).toBe(5)
  expect(p.stage).toBe('ajustes')
  for (const stage of ['agendado', 'postado', 'arquivado'])
   expect(pecasComDataChegando([card({ ...erika, stage })], AGORA)).toHaveLength(0)
 })

 it('data longe não entra', () => {
  expect(pecasComDataChegando([card({ title: 'Natal (25/12)', stage: 'ajustes' })], AGORA)).toHaveLength(0)
 })

 it('o aviso diz o dia, quanto falta e onde a peça está', () => {
  const t = textoDasDatas(pecasComDataChegando([card({ title: '[DRA ERIKA] Out · Estático · Dia do Médico (18/10)', stage: 'ajustes' })], AGORA), AGORA)
  expect(t).toContain('*18/10*')
  expect(t).toContain('faltam 5 dias')
  expect(t).toContain('ainda em ajuste')
  expect(t).toContain('José')
 })
})

describe('formatação do aviso de data', () => {
 it('não deixa linha em branco dobrada entre o cabeçalho e a primeira peça', () => {
  const t = textoDasDatas(pecasComDataChegando([card({ title: '[DRA ERIKA] Dia do Médico (18/10)', stage: 'ajustes' })], AGORA), AGORA)
  expect(t).not.toContain('\n\n\n')
 })
})

// João, 13/10/2026: "Dra. Ênia aprovou o último, e aí? Tá no lugar certo?".
// Está, mas "aprovado" virou depósito: 38 peças aprovadas sem data, duas delas
// havia 32 dias.
describe('peça aprovada que ninguém programou', () => {
 const aprovada = (dias: number, extra: Partial<SocialCard> = {}) => card({
  stage: 'aprovado', scheduled_at: null,
  approved_at: new Date(AGORA - dias * DIA_MS).toISOString(), ...extra })

 it('entra só o que está aprovado e sem data', () => {
  expect(aprovadasSemData([aprovada(3)], AGORA)).toHaveLength(1)
  expect(aprovadasSemData([aprovada(3, { scheduled_at: '2026-10-18T21:00:00Z' })], AGORA)).toHaveLength(0)
  expect(aprovadasSemData([card({ stage: 'aguardando' })], AGORA)).toHaveLength(0)
 })

 it('a mais recente primeiro, porque a antiga já virou decisão', () => {
  const l = aprovadasSemData([aprovada(30, { id: 'velha' }), aprovada(1, { id: 'nova' })], AGORA)
  expect(l.map(p => p.card_id)).toEqual(['nova', 'velha'])
 })

 it('lista longa não vira parede de texto', () => {
  const muitas = Array.from({ length: 38 }, (_, i) => aprovada(i + 1, { id: `c${i}` }))
  const t = textoDasAprovadas(aprovadasSemData(muitas, AGORA), AGORA)
  expect(t).toContain('38 peças aprovadas')
  expect(t).toContain('E mais 28 de antes, no quadro.')
  expect(t.split('\n').filter(l => l.startsWith('*'))).toHaveLength(10)
 })

 // Em 18/10/2026 o destinatário mudou: a cobrança saiu do privado do João e
 // foi para o grupo da social media. A Rayana saiu em 20/10 e a mensagem deixou
// de chamar nome de gente: o grupo segue com João, Letícia, Arthur e Sofia.
 it('diz a régua e leva para o quadro', () => {
  const t = textoDasAprovadas(aprovadasSemData([aprovada(0)], AGORA), AGORA)
  expect(t).toContain('aprovada hoje')
  expect(t).not.toContain('Rayana')
  expect(t).toContain('O cliente já aprovou, falta só a data')
  expect(t).toContain('central.svicompany.com.br/content/social')
 })
})

// João, 15/10/2026, com o print do grupo do Spa Nature: a Sofia mandou "ficou
// uma peça esperando vocês" SEM link nenhum, e a cliente respondeu "qual vídeo
// ficou faltando?" e "o link não está abrindo". Eram 6 peças em Aguardando sem
// link vivo, 4 delas velhas o bastante para entrar na cobrança daquela manhã.
describe('cobrança sem link não sai', () => {
 const banco = (cards: SocialCard[]) => ({
  from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: cards, error: null }) }) }) }),
 })
 const parada = (id: string, client: string, extra: Partial<SocialCard> = {}) => card({
  id, client, stage: 'aguardando', updated_at: new Date(AGORA - 3 * DIA_MS).toISOString(), ...extra })

 it('item sem link fica de fora e vira aviso pro João', async () => {
  const enviadas: { jid: string; texto: string }[] = []
  // approvalLink real precisa de banco e segredo; aqui só o caminho de falha,
  // que é exatamente o que aconteceu em produção.
  const r = await cobrarClientes(banco([parada('c1', 'SPA NATURE')]) as never,
   async (jid, texto) => { enviadas.push({ jid, texto }) }, AGORA)
  expect(r.sem_link).toBe(1)
  expect(r.clientes, 'nenhum grupo de cliente recebeu').toBe(0)
  expect(enviadas).toHaveLength(1)
  expect(enviadas[0].jid).toBe('559492404033')
  expect(enviadas[0].texto).toContain('SEM link vivo')
  expect(enviadas[0].texto).toContain('SPA NATURE')
  expect(enviadas[0].texto).toContain('Reenvia pela Central')
 })
})

// "Spa Nature - 5%" e "Dra Enia - vídeo 08" viravam os dois "Vídeo para
// aprovação", e numa lista de cinco o cliente não sabe qual é qual.
describe('nome da peça na cobrança', () => {
 it('o genérico leva junto o nome que a casa usa', () => {
  expect(nomeNaCobranca('SPA NATURE', 'Spa Nature - 5%', true, 1)).toBe('Vídeo para aprovação · 5%')
  expect(nomeNaCobranca('Dra Enia', 'Dra Enia - vídeo 08', true, 1)).toBe('Vídeo para aprovação · vídeo 08')
 })
 it('título que já se explica fica limpo, sem repetição', () => {
  expect(nomeNaCobranca('PROURO', 'Prouro - pergunta 01', true, 1)).toBe('Pergunta 01')
  expect(nomeNaCobranca('Dra Enia', 'Dra Enia - primeira consulta', true, 1)).toBe('Primeira consulta')
 })
 it('nunca devolve vazio', () => {
  expect(nomeNaCobranca('SPA NATURE', 'Spa Nature', true, 1).length).toBeGreaterThan(3)
 })
})
