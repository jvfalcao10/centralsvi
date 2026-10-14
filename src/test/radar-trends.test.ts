import { describe, expect, it } from 'vitest'
import { ehSaude, pedidoDoSegmento } from '../../api/_lib/radar-trends'

describe('radar de tendências por cliente', () => {
  it('reconhece segmento de saúde com e sem acento', () => {
    expect(ehSaude('Saude · Pediatria')).toBe(true)
    expect(ehSaude('Saúde · Urologia')).toBe(true)
    expect(ehSaude('Contabilidade · impostos, MEI, Simples Nacional e folha')).toBe(false)
  })

  it('trava médico no nicho e deixa fora notícia que não vira post pro paciente', () => {
    const pedido = pedidoDoSegmento('Saude · Geriatria', null)
    expect(pedido).toContain('Segmento: Saude · Geriatria')
    expect(pedido).toContain('mutirão ou ação local de outro')
    expect(pedido).toContain('investimento de')
    expect(pedido).not.toContain('Foco e formato')
  })

  it('leva a nota de formato do cliente e não aplica a trava de saúde fora da saúde', () => {
    const pedido = pedidoDoSegmento(
      'Contabilidade · impostos, MEI, Simples Nacional e folha',
      'Pauta pra post estático ou carrossel, nunca vídeo.',
    )
    expect(pedido).toContain('Foco e formato deste cliente: Pauta pra post estático ou carrossel')
    expect(pedido).not.toContain('consultório')
  })
})

import { radarCategoryOf } from '@/types'

describe('coluna do Radar a partir do segmento do cliente', () => {
  it('põe cada segmento da coleta diária na coluna certa', () => {
    expect(radarCategoryOf('Saude · Pediatria')).toBe('medico')
    expect(radarCategoryOf('Saude · Enfermagem, saúde da mulher')).toBe('medico')
    expect(radarCategoryOf('Advocacia · agrário, tributário, trabalhista e empresarial')).toBe('juridico')
    expect(radarCategoryOf('Contabilidade · impostos, MEI, Simples Nacional e folha')).toBe('contabil')
    expect(radarCategoryOf('Agro e investimentos · boi, soja, milho, câmbio e crédito')).toBe('agro')
    expect(radarCategoryOf('energia_agro')).toBe('solar')
  })

  it('mantém as chaves lançadas à mão e ignora o que não reconhece', () => {
    expect(radarCategoryOf('ia')).toBe('ia')
    expect(radarCategoryOf('Medico')).toBe('medico')
    expect(radarCategoryOf('varejo')).toBeNull()
    expect(radarCategoryOf(null)).toBeNull()
  })
})
