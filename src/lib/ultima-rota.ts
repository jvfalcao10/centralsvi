/**
 * Onde a pessoa estava da última vez.
 *
 * João, 22/10/2026: "tudo que vou fazer, saio do app ele volta pra tela home.
 * Preciso meio que refazer tudo que eu tava fazendo".
 *
 * A causa é o atalho instalado: o manifesto abre em `/`, `/` manda pro login e
 * o login, vendo sessão, manda pra home do papel. Ninguém nunca volta pra
 * página onde estava, mesmo tendo saído do app por dois segundos.
 *
 * Então a última página fica guardada no próprio aparelho. Não é estado
 * compartilhado, é conveniência de quem está ali, por isso localStorage serve.
 */

const CHAVE = 'svi.ultima-rota'
const VALIDADE = 7 * 86400000

/**
 * Página de fora do app não volta: link de aprovação de cliente, relatório
 * público e as telas de entrar existem para serem abertas por link, e restaurar
 * uma delas no lugar do trabalho seria pior do que a home.
 */
const FORA = [
  '/login', '/client-signup', '/pending-approval', '/p/', '/r/', '/aprovar/', '/auth',
]

export function rotaGuardavel(caminho: string): boolean {
  if (!caminho || !caminho.startsWith('/') || caminho === '/') return false
  return !FORA.some(prefixo => caminho === prefixo || caminho.startsWith(prefixo))
}

export function guardarRota(caminho: string) {
  if (!rotaGuardavel(caminho)) return
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ caminho, em: Date.now() }))
  } catch {
    /* aparelho sem storage, modo privado: a home continua funcionando */
  }
}

export function ultimaRota(agora = Date.now()): string | null {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return null
    const { caminho, em } = JSON.parse(cru) as { caminho?: string; em?: number }
    if (!caminho || !rotaGuardavel(caminho)) return null
    // Semana passada não é "onde eu estava": aí a home é mais honesta.
    if (typeof em !== 'number' || agora - em > VALIDADE) return null
    return caminho
  } catch {
    return null
  }
}

export function esquecerRota() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* nada a fazer */
  }
}
