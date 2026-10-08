import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MOLDES, POSTS } from '@/data/moldes'
import Moldes from '@/pages/content/Moldes'
import { NAV_AREAS } from '@/lib/navigation'

describe('Moldes de post', () => {
  it('todo post aponta para um molde que existe e toda lâmina está em public/moldes', () => {
    const ids = new Set(MOLDES.map(m => m.id))
    for (const p of POSTS) {
      expect(ids.has(p.molde), `post ${p.id} com molde inexistente ${p.molde}`).toBe(true)
      expect(p.laminas.length).toBeGreaterThan(0)
      for (const l of p.laminas) expect(existsSync(resolve('public' + l)), `lâmina ausente: ${l}`).toBe(true)
    }
  })

  it('post de cliente nunca mistura lâmina de outro cliente nem do João, e o post excluído não volta', () => {
    for (const p of POSTS) {
      const doCliente = p.laminas.filter(l => l.includes('-cli-'))
      if (p.cliente === 'João Falcão') expect(doCliente, `lâmina de cliente no post do João: ${p.id}`).toEqual([])
      else if (doCliente.length) expect(doCliente.length).toBe(1)
    }
    expect(POSTS.some(p => p.laminas.some(l => l.includes('/t14-')))).toBe(false)
  })

  it('fica logo abaixo de Social media · Postagens no menu', () => {
    const itens = NAV_AREAS.flatMap(a => a.items).map(i => i.url)
    expect(itens.indexOf('/content/moldes')).toBe(itens.indexOf('/content/social') + 1)
  })

  it('mostra as listas, troca para clientes e abre o post com as lâminas', () => {
    render(<MemoryRouter><Moldes /></MemoryRouter>)
    for (const m of MOLDES) expect(screen.getAllByText(m.nome, { exact: false }).length).toBeGreaterThan(0)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Clientes/ }))
    fireEvent.click(screen.getByRole('tab', { name: /Clientes/ }))
    const brenno = POSTS.find(p => p.cliente === 'Dr. Brenno Cangussu')!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Dr\\. Brenno Cangussu`) }))
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(brenno.titulo) })[0])
    expect(screen.getByText(new RegExp(`lâmina 1 de ${brenno.laminas.length}`))).toBeTruthy()
  })
})
