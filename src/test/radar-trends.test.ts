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
