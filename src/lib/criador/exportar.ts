import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import { cssDasFontesEmbutidas, esperarFontes } from './fontes'

// Exportação das lâminas em PNG 1080x1350 dentro de um ZIP (s01.png, s02.png... + legenda.txt).
// Portado das correções de ~/Dev/svi-estudio/src/lib/exportar.ts:
// 1. foto vira data URL "assada" no tamanho da vaga antes de fotografar (Safari não desenha
//    <img> externo nem object-position dentro do foreignObject);
// 2. fonte carregada e embutida antes da captura;
// 3. o nó fotografado é o canvas de 1080 px sem escala (o preview reduzido sairia borrado);
// 4. quebras de linha congeladas (text-wrap: balance não vale dentro do foreignObject).

export const LARGURA_PNG = 1080
export const ALTURA_PNG = 1350

const cacheData = new Map<string, string>()

async function paraDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url
  if (cacheData.has(url)) return cacheData.get(url)!
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const r = await fetch(url, { mode: 'cors', cache: tentativa ? 'reload' : 'default' })
      if (!r.ok) throw new Error(`http ${r.status}`)
      const blob = await r.blob()
      const d = await new Promise<string>((ok, erro) => {
        const fr = new FileReader()
        fr.onload = () => ok(fr.result as string)
        fr.onerror = () => erro(new Error('leitura'))
        fr.readAsDataURL(blob)
      })
      cacheData.set(url, d)
      return d
    } catch {
      if (tentativa < 2) await new Promise(ok => setTimeout(ok, 350 * (tentativa + 1)))
    }
  }
  return null
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = () => erro(new Error('imagem'))
    im.src = src
  })
}

/** Grava o recorte (object-fit cover + object-position) nos pixels, no tamanho exato da vaga. */
async function assarFoto(img: HTMLImageElement): Promise<string | null> {
  if (img.getAttribute('data-drawn') === '1') return assarDesenhada(img)
  const w = img.clientWidth
  const h = img.clientHeight
  if (!w || !h) return null
  const dado = await paraDataUrl(img.currentSrc || img.src)
  if (!dado) return null
  const fonte = await carregarImagem(dado)
  const nw = fonte.naturalWidth
  const nh = fonte.naturalHeight
  if (!nw || !nh) return null
  const cs = getComputedStyle(img)
  const [px, py] = (cs.objectPosition || '50% 50%').split(/\s+/).map(v => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5))
  const escala = cs.objectFit === 'contain' ? Math.min(w / nw, h / nh) : cs.objectFit === 'fill' ? NaN : Math.max(w / nw, h / nh)
  const canvas = document.createElement('canvas')
  // 2x na vaga para não perder nitidez; a captura final é em 1080x1350.
  const k = 2
  canvas.width = w * k
  canvas.height = h * k
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingQuality = 'high'
  if (Number.isNaN(escala)) ctx.drawImage(fonte, 0, 0, w * k, h * k)
  else {
    const fx = Number.isFinite(px) ? px : 0.5
    const fy = Number.isFinite(py) ? py : 0.5
    let dw = nw * escala
    let dh = nh * escala
    let dx = (w - dw) * fx
    let dy = (h - dh) * fy
    // zoom do usuário: scale(z) com transform-origin no ponto de foco (igual ao CSS da prévia)
    const m = (cs.transform || '').match(/matrix\(([^)]+)\)/)
    const z = m ? parseFloat(m[1].split(',')[0]) || 1 : 1
    if (z !== 1) {
      const ox = w * fx
      const oy = h * fy
      dx = ox + (dx - ox) * z
      dy = oy + (dy - oy) * z
      dw *= z
      dh *= z
    }
    ctx.drawImage(fonte, dx * k, dy * k, dw * k, dh * k)
  }
  return canvas.toDataURL('image/jpeg', 0.93)
}

/**
 * Foto do T10 enquadrada pela cabeça: a <img> já está no tamanho desenhado, com left/top do recorte,
 * dentro da vaga com overflow hidden. Grava o recorte da vaga (e a máscara que dissolve no preto) nos pixels.
 */
async function assarDesenhada(img: HTMLImageElement): Promise<string | null> {
  const vaga = img.parentElement
  if (!vaga) return null
  const cw = vaga.clientWidth
  const ch = vaga.clientHeight
  if (!cw || !ch) return null
  const dado = await paraDataUrl(img.currentSrc || img.src)
  if (!dado) return null
  const fonte = await carregarImagem(dado)
  const dw = parseFloat(img.style.width) || fonte.naturalWidth
  const dh = parseFloat(img.style.height) || fonte.naturalHeight
  const dx = parseFloat(img.style.left) || 0
  const dy = parseFloat(img.style.top) || 0
  const k = 2
  const canvas = document.createElement('canvas')
  canvas.width = cw * k
  canvas.height = ch * k
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, dx * k, dy * k, dw * k, dh * k)
  const mascara = img.getAttribute('data-mascara')
  if (mascara) {
    // a máscara é medida na própria imagem: começa opaca e some até o fim da área útil
    const [a, b] = mascara.split(',').map(Number)
    const g = ctx.createLinearGradient(0, (dy + a) * k, 0, (dy + b) * k)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalCompositeOperation = 'destination-in'
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  return canvas.toDataURL(mascara ? 'image/png' : 'image/jpeg', 0.93)
}

async function embutirImagens(no: HTMLElement): Promise<() => void> {
  const voltar: Array<() => void> = []
  await Promise.all(Array.from(no.querySelectorAll('img')).map(async img => {
    const src = img.getAttribute('src') || ''
    if (!src) return
    const antes = { src, fit: img.style.objectFit, pos: img.style.objectPosition, tr: img.style.transform, cross: img.getAttribute('crossorigin'), css: img.style.cssText }
    let novo: string | null = null
    if (img.getAttribute('data-foto') === '1') novo = await assarFoto(img).catch(() => null)
    if (novo) {
      if (img.getAttribute('data-drawn') === '1') {
        // o PNG assado já é do tamanho da vaga: a img volta a ocupar a vaga inteira, sem máscara
        img.style.left = '0px'
        img.style.top = '0px'
        img.style.width = '100%'
        img.style.height = '100%'
        img.style.maskImage = 'none'
        img.style.webkitMaskImage = 'none'
      }
      img.style.objectFit = 'fill'
      img.style.objectPosition = '50% 50%'
      img.style.transform = 'none'
    } else if (!src.startsWith('data:')) {
      novo = await paraDataUrl(new URL(src, window.location.href).href)
    }
    if (!novo) { await img.decode().catch(() => {}); return }
    img.removeAttribute('crossorigin')
    // a foto assada tem outro tamanho natural: o T10 não pode reenquadrar em cima dela
    img.setAttribute('data-assada', '1')
    img.setAttribute('src', novo)
    await img.decode().catch(() => {})
    voltar.push(() => {
      img.setAttribute('src', antes.src)
      img.removeAttribute('data-assada')
      img.style.cssText = antes.css
      if (antes.cross) img.setAttribute('crossorigin', antes.cross)
    })
  }))
  return () => voltar.forEach(f => f())
}

/**
 * Congela as quebras de linha medidas na tela: insere <br> onde cada linha começa.
 * Dentro do SVG do html-to-image o text-wrap: balance não vale e o título mudaria de linhas.
 */
function congelarQuebras(no: HTMLElement): () => void {
  const voltar: Array<() => void> = []
  for (const el of Array.from(no.querySelectorAll<HTMLElement>('[data-tf]'))) {
    const htmlAntes = el.innerHTML
    const pontos: { no: Text; off: number }[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let topoAtual: number | null = null
    let n = walker.nextNode() as Text | null
    while (n) {
      const texto = n.data
      for (let i = 0; i < texto.length; i++) {
        if (i > 0 && !/\s/.test(texto[i - 1])) continue
        if (/\s/.test(texto[i])) continue
        const r = document.createRange()
        r.setStart(n, i)
        r.setEnd(n, i + 1)
        const rect = r.getClientRects()[0]
        if (!rect) continue
        const topo = Math.round(rect.top)
        if (topoAtual === null) topoAtual = topo
        else if (topo > topoAtual + 2) { pontos.push({ no: n, off: i }); topoAtual = topo }
      }
      n = walker.nextNode() as Text | null
    }
    if (!pontos.length) continue
    voltar.push(() => { el.innerHTML = htmlAntes })
    const soVazioAntes = (x: Node) => {
      let ant = x.previousSibling
      while (ant) { if ((ant.textContent ?? '') !== '' || ant.nodeName === 'BR') return ant.nodeName === 'BR' ? 'br' : false; ant = ant.previousSibling }
      return true
    }
    for (let k = pontos.length - 1; k >= 0; k--) {
      const { no: alvo, off } = pontos[k]
      const depois = alvo.splitText(off)
      let ondeQuebrar: Node = depois
      let pai = depois.parentElement
      // a linha começa no primeiro caractere de um realce: o <br> vai antes do elemento inteiro
      while (pai && pai !== el && soVazioAntes(ondeQuebrar) === true) { ondeQuebrar = pai; pai = pai.parentElement }
      // já existe um <br> (quebra escrita na copy): não duplica
      if (soVazioAntes(ondeQuebrar) === 'br') continue
      ondeQuebrar.parentNode?.insertBefore(document.createElement('br'), ondeQuebrar)
      const antes = ondeQuebrar.previousSibling?.previousSibling
      if (antes && antes.nodeType === 3) (antes as Text).data = (antes as Text).data.replace(/\s+$/, '')
    }
  }
  return () => voltar.forEach(f => f())
}

/** Fotografa uma lâmina (nó de 1080x1350 sem escala) e devolve o PNG em data URL. */
export async function pngDaLamina(no: HTMLElement): Promise<string> {
  await esperarFontes()
  let fontEmbedCSS: string | undefined
  try { fontEmbedCSS = await cssDasFontesEmbutidas() } catch { fontEmbedCSS = undefined }
  const restaurarImagens = await embutirImagens(no)
  const restaurarQuebras = congelarQuebras(no)
  try {
    const opcoes = { width: LARGURA_PNG, height: ALTURA_PNG, pixelRatio: 1, cacheBust: false, fontEmbedCSS, style: { transform: 'none', margin: '0' } }
    // a primeira captura aquece o cache de imagens do navegador (bug conhecido do html-to-image no Safari)
    await toPng(no, opcoes).catch(() => '')
    return await toPng(no, opcoes)
  } finally {
    restaurarQuebras()
    restaurarImagens()
  }
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const nomeArquivo = (titulo: string) => (titulo || 'carrossel').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'carrossel'

/** Exporta todas as lâminas num ZIP e dispara o download. Devolve o ZIP para teste. */
export async function exportarZip(nos: HTMLElement[], legenda: string, titulo: string, aoAvancar?: (feitas: number, total: number) => void): Promise<Blob> {
  const zip = new JSZip()
  for (let i = 0; i < nos.length; i++) {
    const png = await pngDaLamina(nos[i])
    zip.file(`s${String(i + 1).padStart(2, '0')}.png`, png.split(',')[1], { base64: true })
    aoAvancar?.(i + 1, nos.length)
  }
  zip.file('legenda.txt', legenda || '')
  const blob = await zip.generateAsync({ type: 'blob' })
  baixar(blob, `${nomeArquivo(titulo)}.zip`)
  return blob
}

/** Peça única (estático ou carrossel de 1 lâmina): baixa o PNG direto, sem ZIP. Devolve o PNG para teste. */
export async function exportarPngUnico(no: HTMLElement, titulo: string): Promise<Blob> {
  const png = await pngDaLamina(no)
  const blob = await (await fetch(png)).blob()
  baixar(blob, `${nomeArquivo(titulo)}.png`)
  return blob
}
