import { describe, expect, it } from 'vitest'
import {
  filterOrganizerPieces, organizerAssignees, organizerBaseStage, organizerDone, organizerDueDay,
  organizerPeriodStart, organizerStage, organizerPosted, parseOrganizerFilter, parseOrganizerPeriod,
  parseOrganizerOrder, parseOrganizerPriority,
  type OrganizerFilter, type OrganizerPiece,
} from '@/lib/organizer-planning'

const today = '2026-09-11'
const localMs = (day: number, hour = 12, minute = 0, second = 0, ms = 0) => new Date(2026, 8, day, hour, minute, second, ms).getTime()
const stages = [
  { id: 'fazer', base: 'fazer' }, { id: 'cliente', base: 'cliente' }, { id: 'feito', base: 'feito' },
  { id: 'publicado', base: 'feito' }, { id: 'revisao-cliente', base: 'cliente' },
]
const piece = (id: string, patch: Partial<OrganizerPiece> = {}): OrganizerPiece => ({
  id, nome: id, cli: 'Aurora', tipo: 'post', etapa: 'fazer', status: 'para ser feita',
  updated: localMs(11), due: localMs(11), assignees: ['José'], ...patch,
})
const ids = (rows: readonly OrganizerPiece[], filter: OrganizerFilter = 'all', extra = {}) =>
  filterOrganizerPieces(rows, stages, { today, filter, ...extra }).map(row => row.id)

describe('Períodos do organizador', () => {
  it('mantém 21 dias por padrão e só aceita recortes e filtros conhecidos', () => {
    expect(parseOrganizerPeriod(null)).toBe('21')
    expect(parseOrganizerPeriod('0')).toBe('21')
    expect(parseOrganizerPeriod('90')).toBe('90')
    expect(parseOrganizerPeriod('all')).toBe('all')
    expect(parseOrganizerFilter('client_wait')).toBe('client_wait')
    expect(parseOrganizerFilter('overdue')).toBe('overdue')
    expect(parseOrganizerFilter('invalid')).toBe('all')
    expect(parseOrganizerFilter(undefined)).toBe('all')
    expect(parseOrganizerOrder(null)).toBe('priority')
    expect(parseOrganizerOrder('due')).toBe('due')
    expect(parseOrganizerOrder('posted')).toBe('posted')
    expect(parseOrganizerOrder('updated')).toBe('updated')
    expect(parseOrganizerOrder('asc')).toBe('priority')
    expect(parseOrganizerPriority('yes')).toBe('yes')
    expect(parseOrganizerPriority('no')).toBe('no')
    expect(parseOrganizerPriority('invalid')).toBe('all')
  })

  it('calcula o limite inclusivo de updated em milissegundos, sem cortar pelo dia', () => {
    const now = Date.parse('2026-09-11T14:23:45.678Z')
    expect(organizerPeriodStart('21', now)).toBe(Date.parse('2026-08-21T14:23:45.678Z'))
    expect(organizerPeriodStart('90', now)).toBe(now - 90 * 86400000)
    expect(organizerPeriodStart('all', now)).toBeNull()
    const start = organizerPeriodStart('21', now)!
    const rows = [piece('before', { updated: start - 1 }), piece('at', { updated: start }), piece('after', { updated: start + 1 })]
    expect(rows.filter(row => row.updated >= start).map(row => row.id)).toEqual(['at', 'after'])
  })
})

describe('Etapa e conclusão efetivas', () => {
  it('separa registro de postagem da conclusão da produção sem mudar a etapa de origem', () => {
    const config = [...stages, { id: 'postado', base: 'feito' }]
    const posted = Object.freeze(piece('posted', { etapa: 'aprovado', postado_em: '2026-09-10T14:00:00Z' }))
    expect(organizerPosted(posted)).toBe(true)
    expect(organizerStage(posted, config)).toBe('postado')
    expect(organizerBaseStage(posted, config)).toBe('feito')
    expect(posted.etapa).toBe('aprovado')
    for (const status of ['complete', 'completed', 'postado']) {
      const done = piece('done', { etapa: 'feito', status })
      expect(organizerPosted(done)).toBe(false)
      expect(organizerStage(done, config)).toBe('feito')
    }
    expect(organizerStage({ ...posted, postado_em: null }, config)).toBe('aprovado')
  })

  it('reconhece postado, base feito e etapa customizada concluída', () => {
    expect(organizerDone(piece('posted', { postado_em: '2026-09-10T14:00:00Z' }), stages)).toBe(true)
    expect(organizerDone(piece('done', { etapa: 'feito' }), stages)).toBe(true)
    const custom = piece('custom', { etapa_manual: 'publicado', etapa_manual_status: 'para ser feita' })
    expect(organizerStage(custom, stages)).toBe('publicado')
    expect(organizerBaseStage(custom, stages)).toBe('feito')
    expect(organizerDone(custom, stages)).toBe(true)
    expect(organizerDone(piece('direct', { etapa: 'publicado' }), stages)).toBe(true)
  })

  it('ignora etapa manual removida ou invalidada pela sincronização', () => {
    const stale = piece('stale', { etapa_manual: 'publicado', etapa_manual_status: 'status anterior' })
    const removed = piece('removed', { etapa_manual: 'etapa removida', etapa_manual_status: 'para ser feita' })
    expect(organizerStage(stale, stages)).toBe('fazer')
    expect(organizerDone(stale, stages)).toBe(false)
    expect(organizerStage(removed, stages)).toBe('fazer')
    expect(organizerDone(piece('done-without-config', { etapa: 'feito' }), [])).toBe(true)
  })
})

describe('Prazos locais e pendências', () => {
  it('separa ontem, hoje e o limite dos próximos sete dias pela data local', () => {
    const rows = [
      piece('yesterday-end', { due: localMs(10, 23, 59, 59, 999) }),
      piece('today-start', { due: localMs(11, 0) }), piece('today-end', { due: localMs(11, 23, 59, 59, 999) }),
      piece('last-end', { due: localMs(17, 23, 59, 59, 999) }), piece('later-start', { due: localMs(18, 0) }),
    ]
    expect(organizerDueDay(rows[0])).toBe('2026-09-10')
    expect(organizerDueDay(rows[3])).toBe('2026-09-17')
    expect(ids(rows, 'overdue')).toEqual(['yesterday-end'])
    expect(ids(rows, 'week')).toEqual(['today-start', 'today-end', 'last-end'])
  })

  it('converte instantes UTC para o calendário local inclusive quando muda o dia', () => {
    const instant = Date.parse('2026-09-11T01:00:00Z')
    const local = new Date(instant)
    const localDay = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
    expect(organizerDueDay(piece('utc', { due: instant }))).toBe(localDay)
    expect(ids([piece('utc', { due: instant })], 'overdue')).toEqual(localDay < today ? ['utc'] : [])
  })

  it('trata ausências e instantes inválidos como sem prazo, sem inventar atraso', () => {
    const rows = [
      piece('null', { due: null }), piece('missing', { due: undefined }), piece('nan', { due: NaN }),
      piece('infinite', { due: Infinity }), piece('out-of-range', { due: 8640000000000001 }),
      piece('wrong-type', { due: '2026-09-01' as unknown as number }),
      piece('legacy-zero', { due: 0 }), piece('legacy-negative', { due: -1 }),
    ]
    expect(ids(rows, 'undated')).toEqual(rows.map(row => row.id))
    expect(ids(rows, 'overdue')).toEqual([])
    expect(ids(rows, 'week')).toEqual([])
  })

  it('atravessa mês e ano e rejeita um hoje inválido sem falhar', () => {
    const yearEnd = [piece('last', { due: new Date(2027, 0, 6, 23, 59).getTime() }), piece('later', { due: new Date(2027, 0, 7).getTime() })]
    expect(ids(yearEnd, 'week', { today: '2026-12-31' })).toEqual(['last'])
    const leap = [piece('leap', { due: new Date(2028, 1, 29).getTime() }), piece('last', { due: new Date(2028, 2, 5).getTime() })]
    expect(ids(leap, 'week', { today: '2028-02-28' })).toEqual(['leap', 'last'])
    expect(ids([piece('due')], 'week', { today: '2026-02-30' })).toEqual([])
    expect(ids([piece('due')], 'overdue', { today: 'bad' })).toEqual([])
  })

  it('identifica pendência com cliente pela base efetiva da etapa customizada', () => {
    const rows = [
      piece('base', { etapa: 'cliente' }),
      piece('custom', { etapa_manual: 'revisao-cliente', etapa_manual_status: 'para ser feita' }),
      piece('stale', { etapa_manual: 'revisao-cliente', etapa_manual_status: 'antigo' }),
      piece('other'),
    ]
    expect(ids(rows, 'client_wait')).toEqual(['base', 'custom'])
  })
})

describe('Combinação dos filtros do organizador', () => {
  it('controla concluídos e ocultos separadamente e mantém pendências só em aberto', () => {
    const rows = [piece('open'), piece('done', { etapa: 'feito' }), piece('posted', { postado_em: '2026-09-10' }), piece('hidden', { oculto: true }), piece('hidden-done', { oculto: true, etapa: 'feito' })]
    expect(ids(rows)).toEqual(['open'])
    expect(ids(rows, 'all', { mostrarFeito: true })).toEqual(['open', 'done', 'posted'])
    expect(ids(rows, 'all', { mostrarOcultos: true })).toEqual(['open', 'hidden'])
    expect(ids(rows, 'all', { mostrarFeito: true, mostrarOcultos: true })).toHaveLength(5)
    const completed = piece('completed', { postado_em: '2026-09-10', due: localMs(10), assignees: [], etapa: 'cliente' })
    for (const filter of ['overdue', 'week', 'unassigned', 'undated', 'client_wait'] as const) {
      expect(ids([completed], filter, { mostrarFeito: true, mostrarOcultos: true })).toEqual([])
    }
  })

  it('usa todos os assignees, limpa espaços e ignora o dono do quadro', () => {
    const rows = [
      { ...piece('multi', { assignees: [' José ', 'Laís', '', 'José'] }), dono: 'Outro quadro' },
      { ...piece('empty', { assignees: ['', '  '] }), dono: 'José' },
      { ...piece('null', { assignees: null }), dono: 'Laís' },
      piece('single', { assignees: ['Laís'] }),
    ]
    expect(organizerAssignees(rows[0])).toEqual(['José', 'Laís'])
    expect(ids(rows, 'all', { person: 'José' })).toEqual(['multi'])
    expect(ids(rows, 'all', { person: ' Laís ' })).toEqual(['multi', 'single'])
    expect(ids(rows, 'unassigned')).toEqual(['empty', 'null'])
    expect(ids(rows, 'unassigned', { person: 'José' })).toEqual([])
  })

  it('combina cliente, tipo, texto e pessoa sem inferir IDs ou perder a descrição', () => {
    const rows = [
      piece('match', { nome: 'Campanha', tipo: 'video', descricao: 'Oferta de SETEMBRO', assignees: ['Laís'] }),
      piece('other-client', { cli: 'Boreal', tipo: 'video', descricao: 'Setembro', assignees: ['Laís'] }),
      piece('other-type', { descricao: 'Setembro', assignees: ['Laís'] }),
      piece('other-person', { tipo: 'video', descricao: 'Setembro' }),
    ]
    expect(ids(rows, 'all', { client: 'Aurora', type: 'video', text: 'setembro', person: 'Laís' })).toEqual(['match'])
    expect(ids(rows, 'all', { client: 'uuid-da-aurora' })).toEqual([])
    expect(ids([rows[0]], 'all', { text: 'CAMPANHA' })).toEqual(['match'])
    expect(ids([rows[0]], 'all', { text: 'aurora' })).toEqual(['match'])
  })

  it('ordena prioridade, prazo e atualização sem alterar a entrada nem seus campos', () => {
    const rows = Object.freeze([
      Object.freeze(piece('boreal', { cli: 'Boreal' })), Object.freeze(piece('older', { updated: 1 })),
      Object.freeze(piece('priority', { cli: 'Zebra', prioridade: true })), Object.freeze(piece('newer', { updated: 2 })),
    ])
    const result = filterOrganizerPieces(rows, stages, { today })
    expect(result.map(row => row.id)).toEqual(['priority', 'boreal', 'newer', 'older'])
    expect(rows.map(row => row.id)).toEqual(['boreal', 'older', 'priority', 'newer'])
    expect(result[0]).toBe(rows[2])
  })

  it('mostra postados separadamente dos concluídos e aplica os demais filtros', () => {
    const rows = [piece('open'), piece('done', { etapa: 'feito' }),
      piece('posted', { postado_em: '2026-09-10', prioridade: true }),
      piece('hidden-posted', { postado_em: '2026-09-10', oculto: true })]
    expect(ids(rows, 'all', { showPosted: true })).toEqual(['posted', 'open'])
    expect(ids(rows, 'all', { showPosted: true, priority: 'yes' })).toEqual(['posted'])
    expect(ids(rows, 'all', { showPosted: true, priority: 'no' })).toEqual(['open'])
    expect(ids(rows, 'all', { showPosted: true, client: 'Boreal' })).toEqual([])
    expect(ids(rows, 'week', { showPosted: true, mostrarFeito: true })).toEqual(['open'])
  })

  it('usa o prazo da peça e coloca datas ausentes ou inválidas ao fim', () => {
    const rows = [piece('no-date', { due: null }), piece('late-priority', { due: localMs(17), prioridade: true }),
      piece('tomorrow', { due: localMs(12) }), piece('overdue', { due: localMs(10) }),
      piece('invalid', { due: Infinity }), piece('out-of-range', { due: 8640000000000001 })]
    expect(ids(rows)).toEqual(['late-priority', 'overdue', 'tomorrow', 'no-date', 'invalid', 'out-of-range'])
    expect(ids(rows, 'all', { order: 'due' })).toEqual(['overdue', 'tomorrow', 'late-priority', 'no-date', 'invalid', 'out-of-range'])
    expect(ids(rows, 'all', { order: 'due', priority: 'yes' })).toEqual(['late-priority'])
  })

  it('distingue atualização de postagem e não inventa uma data de publicação', () => {
    const rows = [piece('recent-update', { updated: localMs(11) }),
      piece('old-post', { updated: localMs(10), postado_em: '2026-09-09T14:00:00Z' }),
      piece('recent-post', { updated: localMs(9), postado_em: '2026-09-10T14:00:00Z' }),
      piece('invalid-post', { updated: localMs(8), postado_em: 'invalid' })]
    expect(ids(rows, 'all', { order: 'updated', showPosted: true })).toEqual(['recent-update', 'old-post', 'recent-post', 'invalid-post'])
    expect(ids(rows, 'all', { order: 'posted', showPosted: true })).toEqual(['recent-post', 'old-post', 'recent-update', 'invalid-post'])
  })
})
