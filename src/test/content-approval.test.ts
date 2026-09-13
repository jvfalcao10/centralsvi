import { describe, expect, it } from 'vitest'
import { approvalActionLabel, approvalHasDestination, extractApprovalFacts, safeApprovalUrl } from '@/lib/content-approval'

const facts = (text: string) => Object.fromEntries(extractApprovalFacts(text).map(field => [field.key, field.value]))

describe('Resumo factual da aprovação', () => {
  it('extrai só campos declarados, preservando o texto e a acentuação', () => {
    expect(facts('**Objetivo:** Aumentar pedidos de orçamento.\n- Formato sugerido: Reels\n**Responsável pela execução:** José\nPrazo de entrega: 18/09, após validação')).toEqual({
      objective: 'Aumentar pedidos de orçamento.', audience: null, format: 'Reels', owner: 'José', deadline: '18/09, após validação',
    })
  })

  it('identifica o público somente quando rotulado', () => {
    expect(facts('**Público-alvo:** Donos de clínicas').audience).toBe('Donos de clínicas')
    expect(facts('Uma campanha para donos de clínicas.').audience).toBeNull()
  })

  it('não infere objetivo, responsável ou prazo a partir da narrativa e da data', () => {
    expect(facts('# Briefing Estratégico\n**Data:** 11/09/2026\nJoão aprova e José pode executar.\nUma boa ideia é gravar um vídeo para vender mais.')).toEqual({ objective: null, audience: null, format: null, owner: null, deadline: null })
  })

  it('lê seções e tabela sem absorver a seção seguinte', () => {
    expect(facts('## Objetivo\nGerar pedidos.\n\n## Formato\nCarrossel\n## Fontes\nLink externo\n| Responsável | Laís |\n| Prazo | Sexta-feira |')).toEqual({ objective: 'Gerar pedidos.', audience: null, format: 'Carrossel', owner: 'Laís', deadline: 'Sexta-feira' })
  })

  it('mantém valores distintos e ignora exemplos citados ou em bloco de código', () => {
    expect(facts('Formato: Reels\nFormato: Carrossel\nFormato: Reels\n> Prazo: amanhã\n```\nResponsável: Exemplo\n```')).toEqual({ objective: null, audience: null, format: 'Reels\nCarrossel', owner: null, deadline: null })
  })
})

describe('Destino e links de revisão', () => {
  it('considera grupo ausente, vazio ou só espaços indisponível', () => {
    expect(approvalHasDestination({ chatid: null })).toBe(false)
    expect(approvalHasDestination({ chatid: '   ' })).toBe(false)
    expect(approvalHasDestination({ chatid: 'grupo@g.us' })).toBe(true)
    expect(approvalActionLabel('briefing')).toBe('Aprovar briefing')
    expect(approvalActionLabel('plano_mensal')).toBe('Aprovar para envio')
  })

  it('só permite HTTP(S) sem credenciais, bloqueando esquemas ativos e relativos', () => {
    expect(safeApprovalUrl('https://example.com/fonte?q=1')).toBe('https://example.com/fonte?q=1')
    for (const url of ['javascript:alert(1)', 'data:text/html,test', '//example.com', '/admin', 'mailto:a@example.com', 'https://user:password@example.com', 'https://']) {
      expect(safeApprovalUrl(url)).toBeUndefined()
    }
  })
})
