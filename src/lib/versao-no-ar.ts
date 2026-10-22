/**
 * Recarrega quando sai versão nova.
 *
 * O atalho instalado no celular mantém a página viva por horas sem nunca
 * buscar o HTML de novo. Em 22/10/2026 isso custou várias idas e vindas: a
 * Central já estava no ar com a tela nova e o João continuava vendo a antiga,
 * sem jeito de dar refresh, porque app instalado não tem botão de recarregar.
 *
 * A checagem é barata e acontece no único momento seguro: quando a pessoa
 * volta pro app. Aí ela não está digitando nada, e perder a tela não custa,
 * porque a última rota é restaurada por [[ultima-rota]].
 */

const ESPERA = 60000
let ultimaChecagem = 0

/** O arquivo de script que ESTA página carregou. */
function scriptAtual(): string | null {
  const marcas = Array.from(document.querySelectorAll('script[type="module"][src]'))
  for (const marca of marcas) {
    const src = (marca as HTMLScriptElement).getAttribute('src') || ''
    const achado = src.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
    if (achado) return achado[0]
  }
  return null
}

export async function temVersaoNova(buscar = fetch): Promise<boolean> {
  const aqui = scriptAtual()
  if (!aqui) return false
  const resposta = await buscar('/', { cache: 'no-store' })
  if (!resposta.ok) return false
  const html = await resposta.text()
  const servido = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
  return !!servido && servido[0] !== aqui
}

export function vigiarVersao(): () => void {
  const olhar = async () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - ultimaChecagem < ESPERA) return
    ultimaChecagem = Date.now()
    try {
      if (await temVersaoNova()) window.location.reload()
    } catch {
      /* sem rede: a tela que está aberta continua servindo */
    }
  }
  document.addEventListener('visibilitychange', olhar)
  window.addEventListener('focus', olhar)
  return () => {
    document.removeEventListener('visibilitychange', olhar)
    window.removeEventListener('focus', olhar)
  }
}
