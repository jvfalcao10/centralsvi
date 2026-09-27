// Fontes dos templates (as mesmas que o motor Python carrega do Google Fonts).
// Só entram na página do Criador, para não pesar o resto da Central.

export const URL_FONTES = 'https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@400;600;700'
  + '&family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Sora:wght@400;500;600;700;800&display=swap'

const AMOSTRAS = [
  '400 66px Newsreader', 'italic 400 22px Newsreader', '500 40px Newsreader',
  '400 26px Inter', '500 19px Inter', '600 21px Inter',
  '400 48px "Inter Tight"', '700 48px "Inter Tight"', '600 30px "Inter Tight"',
  '400 90px "Instrument Serif"', 'italic 400 28px "Instrument Serif"',
  '400 41px Sora', '500 26px Sora', '600 24px Sora', '700 31px Sora',
  '400 96px Anton',
]
const TEXTO_AMOSTRA = 'AaÁáÉéÍíÓóÚúÂâÊêÔôÃãÕõÇç0123456789'

export function injetarFontes() {
  if (typeof document === 'undefined' || document.getElementById('criador-fontes')) return
  const pre1 = document.createElement('link')
  pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com'
  const pre2 = document.createElement('link')
  pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous'
  const link = document.createElement('link')
  link.id = 'criador-fontes'; link.rel = 'stylesheet'; link.href = URL_FONTES; link.crossOrigin = 'anonymous'
  document.head.append(pre1, pre2, link)
}

/** Espera todas as famílias carregarem de verdade (não só o CSS). */
export async function esperarFontes() {
  injetarFontes()
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all(AMOSTRAS.map(f => document.fonts.load(f, TEXTO_AMOSTRA).catch(() => [])))
  await document.fonts.ready
}

let cacheEmbed: Promise<string> | null = null

async function paraDataUrl(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fonte ${r.status}`)
  const blob = await r.blob()
  return await new Promise<string>((ok, erro) => {
    const fr = new FileReader()
    fr.onload = () => ok(fr.result as string)
    fr.onerror = () => erro(new Error('leitura da fonte'))
    fr.readAsDataURL(blob)
  })
}

/**
 * CSS com as fontes embutidas em data URL, entregue ao html-to-image (fontEmbedCSS).
 * Sem isso o PNG sai com fonte de sistema, porque a folha do Google é de outra origem.
 * Só os subconjuntos latin e latin-ext (português inteiro), para não baixar cirílico e vietnamita.
 */
export function cssDasFontesEmbutidas(): Promise<string> {
  if (!cacheEmbed) {
    cacheEmbed = (async () => {
      const css = await (await fetch(URL_FONTES)).text()
      const blocos = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
        .filter(m => m[1] === 'latin' || m[1] === 'latin-ext')
        .map(m => m[2])
      const usados = blocos.length ? blocos : (css.match(/@font-face\s*\{[^}]*\}/g) || [])
      const saida = await Promise.all(usados.map(async bloco => {
        const m = bloco.match(/url\((['"]?)([^'")]+)\1\)/)
        if (!m) return bloco
        try { return bloco.replace(m[0], `url(${await paraDataUrl(m[2])})`) } catch { return bloco }
      }))
      return saida.join('\n')
    })().catch(e => { cacheEmbed = null; throw e })
  }
  return cacheEmbed
}
