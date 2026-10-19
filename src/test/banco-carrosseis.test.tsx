import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BancoCarrosseis } from '@/components/content/BancoCarrosseis'
import { BANCO } from '@/data/banco-carrosseis'

// 18/10/2026: os 22 formatos do Banco Best-Sellers ganharam o molde pronto da SVI.
// Todo formato precisa mostrar a amostra e o pedido; formato sem molde seria um buraco na aba.
describe('Banco de Carrosséis Best-Sellers', () => {
  it('todo formato tem molde pronto da SVI com amostra', () => {
    expect(BANCO).toHaveLength(22)
    for (const f of BANCO) {
      expect(f.svi, f.nome).not.toBeNull()
      expect(f.svi!.laminas.length, f.nome).toBeGreaterThanOrEqual(3)
      expect(f.svi!.laminas.every(l => l.startsWith('/banco/molde/')), f.nome).toBe(true)
    }
  })

  it('o formato aberto mostra o molde pronto e o pedido', () => {
    render(<BancoCarrosseis busca="" />)
    expect(screen.getByText('Molde pronto da SVI')).toBeInTheDocument()
    expect(screen.getByText(`Carrossel ${BANCO[0].nome} pro cliente [nome], sobre [tema]`)).toBeInTheDocument()
    expect(screen.getAllByAltText(new RegExp(`${BANCO[0].nome.replace(/[+]/g, '\\+')}, amostra lâmina`))).toHaveLength(BANCO[0].svi!.laminas.length)
  })

  it('trocar de formato troca o molde', () => {
    render(<BancoCarrosseis busca="" />)
    const tapa = BANCO.find(f => f.nome === 'Tapa na Cara')!
    fireEvent.click(screen.getByRole('button', { name: 'Tapa na Cara' }))
    expect(screen.getByText(`base do Canva: ${tapa.svi!.molde}`)).toBeInTheDocument()
    expect(screen.getAllByAltText(/Tapa na Cara, amostra lâmina/)).toHaveLength(tapa.svi!.laminas.length)
  })
})
