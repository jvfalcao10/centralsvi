import { afterEach, describe, expect, it } from 'vitest'
import { guardarRota, ultimaRota, esquecerRota, rotaGuardavel } from '@/lib/ultima-rota'

// João, 22/10/2026: "tudo que vou fazer, saio do app ele volta pra tela home.
// Preciso meio que refazer tudo que eu tava fazendo". O atalho instalado abre
// em "/", que caía no login e de lá na home do papel.
describe('onde a pessoa parou', () => {
  afterEach(() => esquecerRota())

  it('guarda a página do app e devolve ela depois', () => {
    guardarRota('/content/reels')
    expect(ultimaRota()).toBe('/content/reels')
  })

  it('não guarda tela de entrar nem link público de cliente', () => {
    for (const fora of ['/login', '/pending-approval', '/aprovar/cliente/abc', '/p/xyz', '/r/trafego/cliente', '/', ''])
      expect(rotaGuardavel(fora)).toBe(false)
    guardarRota('/login')
    expect(ultimaRota()).toBeNull()
  })

  it('guarda página de cliente e de tráfego, que são trabalho', () => {
    for (const dentro of ['/content/reels', '/cliente/exatta', '/operacional/trafego', '/clients/123'])
      expect(rotaGuardavel(dentro)).toBe(true)
  })

  it('esquece depois de uma semana, porque aí a home é mais honesta', () => {
    guardarRota('/content/social')
    expect(ultimaRota(Date.now() + 6 * 86400000)).toBe('/content/social')
    expect(ultimaRota(Date.now() + 8 * 86400000)).toBeNull()
  })

  it('aguenta storage quebrado sem derrubar a tela', () => {
    const real = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('modo privado') }
    expect(() => guardarRota('/tarefas')).not.toThrow()
    Storage.prototype.setItem = real
  })
})
