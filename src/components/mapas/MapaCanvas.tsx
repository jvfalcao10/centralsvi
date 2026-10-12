import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as d3 from 'd3'
import { Markmap, deriveOptions } from 'markmap-view'
import { CORES_RAMOS, DOURADO, caminhoDoNo, htmlParaTexto, type NoMapa } from '@/lib/mapas'

/** Forma do nó que o markmap-view devolve em `state.data` e no datum do <g>. */
interface NoVista {
  content: string
  children: NoVista[]
  payload?: { fold?: number; [chave: string]: unknown }
}

export interface MapaCanvasHandle {
  zoom: (fator: number) => void
  centralizar: () => void
  aplicarNivel: (nivel: number) => void
}

interface Props {
  raiz: NoMapa
  /** Profundidade a partir da qual os nós começam dobrados no primeiro desenho. */
  nivelInicial: number
  fonte: number
  fundo: 'preto' | 'branco'
  /** Textos de nós criados ou editados na sessão: ficam dourados até salvar. */
  destacados: Set<string>
  onDuploClique: (caminho: number[], texto: string) => void
  onMenuContexto: (caminho: number[], texto: string) => void
}

const SEPARADOR = '\u0001'

function chaveDoCaminho(textos: string[]) {
  return textos.join(SEPARADOR)
}

/** Guarda quais nós estão dobrados, por caminho de textos, para sobreviver a um redesenho. */
function capturarDobras(raiz: NoVista | undefined) {
  const dobras = new Set<string>()
  if (!raiz) return dobras
  const descer = (no: NoVista, textos: string[]) => {
    const atual = [...textos, htmlParaTexto(no.content)]
    if (no.payload?.fold) dobras.add(chaveDoCaminho(atual))
    for (const filho of no.children ?? []) descer(filho, atual)
  }
  descer(raiz, [])
  return dobras
}

function aplicarDobras(raiz: NoVista, dobras: Set<string>) {
  const descer = (no: NoVista, textos: string[]) => {
    const atual = [...textos, htmlParaTexto(no.content)]
    no.payload = { ...no.payload, fold: dobras.has(chaveDoCaminho(atual)) ? 1 : 0 }
    for (const filho of no.children ?? []) descer(filho, atual)
  }
  descer(raiz, [])
}

function aplicarNivelNaArvore(raiz: NoVista, nivel: number) {
  const descer = (no: NoVista, profundidade: number) => {
    const dobrar = profundidade >= nivel && (no.children?.length ?? 0) > 0
    no.payload = { ...no.payload, fold: dobrar ? 1 : 0 }
    for (const filho of no.children ?? []) descer(filho, profundidade + 1)
  }
  descer(raiz, 0)
}

/** Copia a árvore e envolve em dourado o que foi mexido na sessão. */
function prepararArvore(raiz: NoMapa, destacados: Set<string>): NoVista {
  const copiar = (no: NoMapa): NoVista => {
    const texto = htmlParaTexto(no.content)
    const content = destacados.has(texto) ? `<span class="mm-dourado">${no.content}</span>` : no.content
    return { content, children: (no.children ?? []).map(copiar) }
  }
  return copiar(raiz)
}

const MapaCanvas = forwardRef<MapaCanvasHandle, Props>(function MapaCanvas(props, ref) {
  const svgRef = useRef<SVGSVGElement>(null)
  const mmRef = useRef<Markmap | null>(null)
  const primeiraVez = useRef(true)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const mm = Markmap.create(svg, {
      ...deriveOptions({ color: CORES_RAMOS, colorFreezeLevel: 2 }),
      maxWidth: 380,
      initialExpandLevel: -1,
      duration: 250,
      autoFit: false,
      zoom: true,
      pan: true,
      scrollForPan: false,
    })
    mmRef.current = mm

    const acharNo = (ev: Event) => {
      const alvo = ev.target as Element | null
      const g = alvo?.closest?.('g.markmap-node') as SVGGElement | null
      if (!g) return null
      const dado = d3.select(g).datum() as NoVista | undefined
      const raiz = mm.state.data as unknown as NoVista | undefined
      if (!dado || !raiz) return null
      const caminho = caminhoDoNo(raiz, dado)
      return caminho ? { caminho, texto: htmlParaTexto(dado.content) } : null
    }

    // O d3-zoom do markmap chama stopImmediatePropagation no dblclick e o
    // foreignObject corta a propagação: só a fase de captura no <svg> vê.
    const duploClique = (ev: MouseEvent) => {
      const no = acharNo(ev)
      if (!no) return
      ev.stopPropagation()
      ev.preventDefault()
      propsRef.current.onDuploClique(no.caminho, no.texto)
    }
    const menuContexto = (ev: MouseEvent) => {
      const no = acharNo(ev)
      if (!no) return
      ev.stopPropagation()
      ev.preventDefault()
      propsRef.current.onMenuContexto(no.caminho, no.texto)
    }

    // Celular: toque longo cria filho, dois toques editam.
    let ultimoToque = 0
    let timerToque: number | undefined
    let noTocado: { caminho: number[]; texto: string } | null = null
    const toqueInicio = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) { window.clearTimeout(timerToque); noTocado = null; return }
      noTocado = acharNo(ev)
      window.clearTimeout(timerToque)
      if (!noTocado) return
      timerToque = window.setTimeout(() => {
        if (noTocado) propsRef.current.onMenuContexto(noTocado.caminho, noTocado.texto)
        noTocado = null
      }, 550)
    }
    const toqueMove = () => { window.clearTimeout(timerToque) }
    const toqueFim = (ev: TouchEvent) => {
      window.clearTimeout(timerToque)
      const agora = Date.now()
      if (noTocado && agora - ultimoToque < 350) {
        ev.preventDefault()
        propsRef.current.onDuploClique(noTocado.caminho, noTocado.texto)
        ultimoToque = 0
      } else {
        ultimoToque = agora
      }
    }

    svg.addEventListener('dblclick', duploClique, true)
    svg.addEventListener('contextmenu', menuContexto, true)
    svg.addEventListener('touchstart', toqueInicio, { capture: true, passive: true })
    svg.addEventListener('touchmove', toqueMove, { capture: true, passive: true })
    svg.addEventListener('touchend', toqueFim, true)

    return () => {
      svg.removeEventListener('dblclick', duploClique, true)
      svg.removeEventListener('contextmenu', menuContexto, true)
      svg.removeEventListener('touchstart', toqueInicio, true)
      svg.removeEventListener('touchmove', toqueMove, true)
      svg.removeEventListener('touchend', toqueFim, true)
      window.clearTimeout(timerToque)
      mm.destroy()
      mmRef.current = null
      primeiraVez.current = true
    }
  }, [])

  useEffect(() => {
    const mm = mmRef.current
    if (!mm) return
    const dado = prepararArvore(props.raiz, props.destacados)
    if (primeiraVez.current) {
      aplicarNivelNaArvore(dado, props.nivelInicial)
    } else {
      aplicarDobras(dado, capturarDobras(mm.state.data as unknown as NoVista | undefined))
    }
    const eraPrimeira = primeiraVez.current
    primeiraVez.current = false
    mm.setData(dado).then(() => { if (eraPrimeira) mm.fit() })
    // nivelInicial só vale no primeiro desenho; depois os botões mandam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.raiz, props.destacados])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const linha = Math.round(props.fonte * 1.35)
    svg.style.setProperty('--markmap-font', `400 ${props.fonte}px/${linha}px ui-sans-serif, system-ui, -apple-system, sans-serif`)
  }, [props.fonte])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const escuro = props.fundo === 'preto'
    svg.style.setProperty('--markmap-text-color', escuro ? '#F5F5F5' : '#161616')
    svg.style.setProperty('--markmap-circle-open-bg', escuro ? '#111111' : '#FFFFFF')
    svg.style.setProperty('--markmap-code-bg', escuro ? '#1F1F1F' : '#F0F0F0')
    svg.style.setProperty('--markmap-code-color', escuro ? '#E5E5E5' : '#444444')
    svg.style.background = escuro ? '#000000' : '#FFFFFF'
  }, [props.fundo])

  useImperativeHandle(ref, () => ({
    zoom: fator => { mmRef.current?.rescale(fator) },
    centralizar: () => { mmRef.current?.fit() },
    aplicarNivel: nivel => {
      const mm = mmRef.current
      const raiz = mm?.state.data as unknown as NoVista | undefined
      if (!mm || !raiz) return
      aplicarNivelNaArvore(raiz, nivel)
      mm.renderData().then(() => mm.fit())
    },
  }), [])

  return (
    <div className="relative h-full w-full min-h-[320px] overflow-hidden rounded-lg border border-border">
      <style>{`.mm-dourado{color:${DOURADO};font-weight:600}`}</style>
      <svg ref={svgRef} className="h-full w-full touch-none" aria-label="Mapa mental" />
    </div>
  )
})

export default MapaCanvas
