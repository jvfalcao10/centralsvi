// Enquadramento medido do T10, portado do _T10_JS de ~/Dev/conteudo-joao/carrosseis/templates.py (27/09/2026).
// Cada foto leva o mapa das cabeças (caixas normalizadas 0..1) e a área útil (sem legenda gravada).
// Depois do layout, acha o MENOR zoom em que todas as cabeças ficam inteiras na área segura
// (foto cheia: até 40 px acima do bloco de texto; caixa: 22 px de respiro; faixa da lista: 28 px),
// com a exigência zerada no lado em que a cabeça já encosta na borda útil (menos embaixo na foto cheia).
// Se a foto cheia não tem saída, ancora no alto e dissolve no preto por trás do texto.
// Na Central não há detector de rosto: o João marca a cabeça arrastando um retângulo na aba Montar.

export type Caixa = [number, number, number, number]

export type ModoEnquadramento = 'bg' | 'pilha' | 'caixa'

export interface EntradaEnquadramento {
  /** Tamanho da vaga em px da lâmina (1080 de largura). */
  W: number
  H: number
  /** Tamanho natural da foto. */
  iw: number
  ih: number
  /** Cabeças, normalizadas. */
  cab: Caixa[]
  /** Área útil, normalizada. Padrão: a foto inteira. */
  util?: Caixa
  modo: ModoEnquadramento
  /** Foto cheia: topo do bloco de texto, medido do topo da vaga. */
  topoTexto?: number
  fx?: number
  fy?: number
  zmax?: number
}

export interface Enquadramento {
  /** Escala da foto (px da lâmina por px da foto). */
  s: number
  largura: number
  altura: number
  esquerda: number
  topo: number
  /** Máscara que dissolve o pé da foto (foto cheia ancorada), em px da própria imagem. */
  mascara: [number, number] | null
  /** Onde o degradê da foto cheia fecha (variável --tt do motor). */
  tt: number | null
  /** Todas as cabeças couberam inteiras. */
  ok: boolean
  ancorada: boolean
  mapa: boolean
  /** Zoom sobre o recorte mínimo. */
  zoom: number
  /** Pixels da foto por pixel da lâmina (abaixo de 0,5 a foto foi ampliada mais de 2 vezes). */
  nitidez: number
  /** Cabeças já posicionadas, em px da vaga. */
  cabecas: Caixa[]
}

export function enquadrar(e: EntradaEnquadramento): Enquadramento {
  const { W, H, iw, ih, cab, modo } = e
  const U = e.util ?? [0, 0, 1, 1]
  const bg = modo === 'bg'
  let S: Caixa
  let ttVar: number | null = null
  if (bg) {
    const tt = e.topoTexto !== undefined ? e.topoTexto - 40 : H - 260
    S = [40, 24, W - 40, tt]
    ttVar = tt + 40
  } else if (modo === 'pilha') S = [28, 28, W - 28, H - 22]
  else S = [22, 22, W - 22, H - 22]

  let hx0 = 1e9, hy0 = 1e9, hx1 = -1e9, hy1 = -1e9
  for (const c of cab) {
    hx0 = Math.min(hx0, c[0] * iw); hy0 = Math.min(hy0, c[1] * ih)
    hx1 = Math.max(hx1, c[2] * iw); hy1 = Math.max(hy1, c[3] * ih)
  }
  const ux0 = U[0] * iw, uy0 = U[1] * ih, ux1 = U[2] * iw, uy1 = U[3] * ih
  const zmax = e.zmax ?? 1.8
  const eps = 0.03
  const m0 = hx0 <= ux0 + eps * iw ? 0 : S[0]
  const m1 = hy0 <= uy0 + eps * ih ? 0 : S[1]
  const m2 = hx1 >= ux1 - eps * iw ? W : S[2]
  const m3 = hy1 >= uy1 - eps * ih && !bg ? H : S[3]
  const tt = bg ? S[3] : H
  const smin = Math.max(W / (ux1 - ux0), H / (uy1 - uy0))
  const sfit = bg ? Math.max(W / (ux1 - ux0), tt / (uy1 - uy0)) : smin

  type Faixa = { s: number; ax0: number; ax1: number; ay0: number; ay1: number }
  const tenta = (s: number, livre: boolean): Faixa | null => {
    let ax0 = ux0, ax1 = ux1 - W / s, ay0 = uy0, ay1 = uy1 - (livre ? tt : H) / s
    if (cab.length) {
      ax0 = Math.max(ax0, hx1 - m2 / s); ax1 = Math.min(ax1, hx0 - m0 / s)
      ay0 = Math.max(ay0, hy1 - m3 / s); ay1 = Math.min(ay1, hy0 - m1 / s)
    }
    return ax0 <= ax1 + 0.5 && ay0 <= ay1 + 0.5 ? { s, ax0, ax1: Math.max(ax0, ax1), ay0, ay1: Math.max(ay0, ay1) } : null
  }

  let best: Faixa | null = null
  for (let s = smin; s <= smin * zmax && !best; s *= 1.005) best = tenta(s, false)
  let solto = false
  if (!best && bg) {
    for (let s = smin; s >= sfit && !best; s /= 1.005) best = tenta(s, true)
    if (best) solto = true
  }
  const ok = !!best
  if (!best) best = { s: smin, ax0: ux0, ax1: ux1 - W / smin, ay0: uy0, ay1: uy1 - H / smin }
  const s = best.s

  let px: number, py: number
  if (cab.length) {
    const hcx = (hx0 + hx1) / 2, hcy = (hy0 + hy1) / 2
    const fx = e.fx ?? Math.min(0.75, Math.max(0.25, (hcx - ux0) / (ux1 - ux0)))
    const fy = e.fy ?? 0.4
    px = hcx - (S[0] + (S[2] - S[0]) * fx) / s
    py = hcy - (S[1] + (S[3] - S[1]) * fy) / s
  } else {
    px = (ux0 + ux1) / 2 - W / s / 2
    py = (uy0 + uy1) / 2 - H / s / 2
  }
  const cx = Math.min(Math.max(px, best.ax0), best.ax1)
  const cy = Math.min(Math.max(py, best.ay0), best.ay1)
  const fundo = (uy1 - cy) * s
  const mascara: [number, number] | null = solto && fundo < H ? [Math.max(0, uy1 * s - 260), uy1 * s] : null

  return {
    s, largura: iw * s, altura: ih * s, esquerda: -cx * s, topo: -cy * s, mascara, tt: ttVar,
    ok, ancorada: solto, mapa: cab.length > 0, zoom: s / smin, nitidez: 1 / s,
    cabecas: cab.map(c => [(c[0] * iw - cx) * s, (c[1] * ih - cy) * s, (c[2] * iw - cx) * s, (c[3] * ih - cy) * s] as Caixa),
  }
}
