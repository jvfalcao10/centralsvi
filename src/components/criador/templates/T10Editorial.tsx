import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { rico, itens } from '@/lib/criador/texto'
import { enquadrar, type Caixa, type Enquadramento, type ModoEnquadramento } from '@/lib/criador/enquadrar'
import type { FotoSlide } from '@/data/criador/tipos'
import { Aorta, campo, estiloZoom, PERFIL, Selo, useFotoSrc, type SlideProps } from './comum'

// Template 10 · Editorial (motor v2 de 27/09: t10_capa, t10_foto, t10_texto, t10_lista, t10_fecho e _T10_JS).
// Foto com cabeça marcada: enquadramento automático (lib/criador/enquadrar.ts, porte do _T10_JS).
// Foto sem marcação: foco e zoom manuais, e o revisor pede para marcar o rosto.

/** Relatório de layout medido na lâmina (porte do conferir_t10.py), entregue à aba Montar. */
export interface RelatorioT10 { erros: string[]; avisos: string[] }
export const RelatorioT10Context = createContext<((slideId: string, r: RelatorioT10) => void) | null>(null)

function Rodape({ fim, data }: { fim: boolean; data?: string }) {
  return <div className="rodape">
    <img src={PERFIL.badgeSvi} alt="" />
    <div className="c"><b>SVI Médicos</b><span>by @joaofalcao.svi</span></div>
    <div className="sep" />
    <div className="c"><b>Todos os direitos reservados</b><span>Conteúdo para médicos e consultórios</span></div>
    <span className="arr">{fim && data ? data : 'Arrasta para o lado ›'}</span>
  </div>
}

function Colab() {
  return <div className="colab">
    <span><img src={PERFIL.avatar} alt="" />{PERFIL.colab[0]}<Selo /></span>
    <span><img src={PERFIL.badgeSvi} alt="" />{PERFIL.colab[1]}<Selo /></span>
  </div>
}

const mesmo = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Vaga de foto do T10 (.ft). Mede a vaga depois do layout e enquadra pela cabeça marcada. */
function VagaFoto({ foto, modo, rotulo, className, children }: { foto?: FotoSlide; modo: ModoEnquadramento; rotulo: string; className: string; children?: ReactNode }) {
  const src = useFotoSrc(foto)
  const box = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [enq, setEnq] = useState<Enquadramento | null>(null)
  const [tick, setTick] = useState(0)
  const temMapa = !!foto?.cab?.length

  // fonte carregada muda a altura do texto e, com ela, a vaga: mede de novo
  useEffect(() => {
    let vivo = true
    document.fonts?.ready.then(() => { if (vivo) setTick(t => t + 1) })
    return () => { vivo = false }
  }, [])

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const iw = foto?.w || natural?.w
    const ih = foto?.h || natural?.h
    if (!temMapa || !iw || !ih) { if (enq) setEnq(null); if (modo === 'bg') el.style.removeProperty('--tt'); return }
    let topoTexto: number | undefined
    if (modo === 'bg') {
      const miolo = el.parentElement?.querySelector<HTMLElement>('.miolo')
      if (miolo) topoTexto = miolo.offsetTop - el.offsetTop
    }
    const novo = enquadrar({ W: el.offsetWidth, H: el.offsetHeight, iw, ih, cab: foto!.cab as Caixa[], util: foto?.util as Caixa | undefined, modo, topoTexto })
    if (novo.tt !== null) el.style.setProperty('--tt', `${novo.tt}px`)
    if (!mesmo(novo, enq)) setEnq(novo)
  })

  let estilo: CSSProperties = { objectPosition: `${foto?.x ?? 50}% ${foto?.y ?? 30}%`, ...estiloZoom(foto) }
  if (enq) {
    const m = enq.mascara ? `linear-gradient(to bottom,#000 ${enq.mascara[0]}px,transparent ${enq.mascara[1]}px)` : undefined
    estilo = { objectFit: 'fill', width: enq.largura, height: enq.altura, left: enq.esquerda, top: enq.topo, ...(m ? { WebkitMaskImage: m, maskImage: m } : {}) }
  }
  return <div ref={box} className={className} data-tick={tick}>
    {src
      ? <img src={src} alt="" data-foto="1" data-drawn={enq ? '1' : undefined} data-mascara={enq?.mascara ? enq.mascara.join(',') : undefined}
          data-cabecas={enq ? JSON.stringify(enq.cabecas) : undefined} data-ok={enq ? String(enq.ok) : undefined}
          data-nitidez={enq ? enq.nitidez.toFixed(2) : undefined} data-mapa={temMapa ? '1' : '0'}
          crossOrigin={/^https?:/.test(src) ? 'anonymous' : undefined} style={estilo}
          onLoad={e => { const im = e.currentTarget; if (im.dataset.assada !== '1' && im.naturalWidth && (!natural || natural.w !== im.naturalWidth)) setNatural({ w: im.naturalWidth, h: im.naturalHeight }) }} />
      : <div className="foto-vazia">{rotulo}</div>}
    {children}
  </div>
}

type Retangulo = [number, number, number, number]
const cruza = (a: Retangulo, b: Retangulo) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))

/** Mede a lâmina renderizada (em px de 1080) como o conferir_t10.py do motor. */
function medir(raiz: HTMLElement): RelatorioT10 {
  const k = raiz.getBoundingClientRect().width / 1080 || 1
  const base = raiz.getBoundingClientRect()
  const R = (el: Element): Retangulo => { const r = el.getBoundingClientRect(); return [(r.left - base.left) / k, (r.top - base.top) / k, (r.right - base.left) / k, (r.bottom - base.top) / k] }
  const erros: string[] = []
  const avisos: string[] = []
  const textos = Array.from(raiz.querySelectorAll('.t10 h1,.t10 p,.t10 li,.t10 .colab span,.t10 .rodape,.t10 .cnt,.t10 .arrasta')).map(R)
  raiz.querySelectorAll<HTMLImageElement>('.t10 .ft img').forEach(img => {
    if (img.dataset.mapa !== '1' || !img.dataset.cabecas) return
    const caixa = R(img.parentElement!)
    if (img.dataset.ok === 'false') erros.push('Não há enquadramento com todas as cabeças inteiras nesta vaga')
    const cabecas = JSON.parse(img.dataset.cabecas) as Retangulo[]
    for (const c of cabecas) {
      const h: Retangulo = [caixa[0] + c[0], caixa[1] + c[1], caixa[0] + c[2], caixa[1] + c[3]]
      if (h[0] < caixa[0] - 1 || h[1] < caixa[1] - 1 || h[2] > caixa[2] + 1 || h[3] > caixa[3] + 1) erros.push('Cabeça cortada pela borda da foto')
      if (textos.some(t => cruza(h, t) > 4)) erros.push('Texto em cima do rosto')
    }
    const nit = Number(img.dataset.nitidez)
    if (nit && nit < 0.5) avisos.push(`Foto ampliada demais (${nit.toFixed(2)} px da foto por px da lâmina), pode sair borrada`)
  })
  const col = raiz.querySelector<HTMLElement>('.t10 .col, .t10 .pilha')
  const rod = raiz.querySelector('.t10 .rodape')
  if (col && rod) {
    const c = R(col)
    if (col.scrollHeight > col.clientHeight + 1) erros.push(`Texto não coube na coluna (${col.scrollHeight - col.clientHeight} px a mais)`)
    const filhos = Array.from(col.children).map(R)
    const fim = Math.max(...filhos.map(f => f[3]))
    const ini = Math.min(...filhos.map(f => f[1]))
    if (col.classList.contains('so')) {
      const ocup = (fim - ini) / (c[3] - c[1])
      if (ocup < 0.5) avisos.push(`Lâmina sem foto ocupa só ${Math.round(ocup * 100)}% da altura`)
    } else if (c[3] - fim > 6) erros.push(`Sobram ${Math.round(c[3] - fim)} px vazios antes do rodapé`)
    const ft = col.querySelector('.ft')
    if (ft) { const r = R(ft); if (r[3] - r[1] < 330) erros.push(`Foto espremida (${Math.round(r[3] - r[1])} px de altura, mínimo 330)`) }
    if (c[3] > R(rod)[1]) erros.push('A coluna invade o rodapé')
  }
  return { erros: [...new Set(erros)], avisos: [...new Set(avisos)] }
}

export function T10Slide({ slide, n, total, opcoes }: SlideProps) {
  const escuro = ['capa', 'foto', 'fecho'].includes(slide.tipo)
  // estático (peça única): sem contador e sem "arrasta", o rodapé leva a data como no fecho
  const estatico = opcoes.formato === 'estatico'
  const fim = slide.tipo === 'fecho' || estatico
  const titulo = campo(slide, 'titulo')
  const apoio = campo(slide, 'apoio')
  const relatar = useContext(RelatorioT10Context)
  const raiz = useRef<HTMLDivElement>(null)
  const ultimo = useRef('')

  useEffect(() => {
    if (!relatar || !raiz.current) return
    const el = raiz.current
    const rodar = () => {
      const r = medir(el)
      const chave = JSON.stringify(r)
      if (chave !== ultimo.current) { ultimo.current = chave; relatar(slide.id, r) }
    }
    rodar()
    const t = setTimeout(rodar, 400)
    document.fonts?.ready.then(rodar)
    return () => clearTimeout(t)
  })

  let miolo: JSX.Element
  if (slide.tipo === 'capa' || slide.tipo === 'fecho' || slide.tipo === 'foto') {
    const cls = slide.tipo === 'foto' ? 'cheia' : 'capa'
    miolo = <>
      <VagaFoto foto={slide.fotos.fundo} modo="bg" rotulo="Foto de fundo" className="ft bg"><div className="gr" /></VagaFoto>
      <div className={`miolo ${cls}`} style={{ bottom: slide.tipo === 'capa' ? 134 : 144 }}>
        {slide.tipo !== 'foto' && <Colab />}
        <h1 data-tf="head">{rico(titulo)}</h1>
        {slide.tipo !== 'fecho' && apoio && <p data-tf="sub">{rico(apoio)}</p>}
        {slide.tipo === 'capa' && !estatico && <span className="arrasta">Arrasta para o lado ›</span>}
      </div>
    </>
  } else if (slide.tipo === 'lista') {
    const txt = <div className="txt">
      <h1 data-tf="head">{rico(titulo)}</h1>
      {apoio && <p data-tf="sub">{rico(apoio)}</p>}
      <ul className="t10lista">{itens(slide.campos.itens).map((item, i) => <li key={i} data-tf="sub">{rico(item)}</li>)}</ul>
    </div>
    miolo = slide.fotos.faixa
      ? <div className="pilha"><VagaFoto foto={slide.fotos.faixa} modo="pilha" rotulo="Foto no topo" className="ft" />{txt}</div>
      : <div className="col so">{txt}</div>
  } else {
    // texto: lâmina branca em coluna, a foto em caixa preenche o resto até o rodapé (acima ou abaixo)
    const onde = campo(slide, 'onde') || 'abaixo'
    const forte = campo(slide, 'forte')
    const txt = <div className="txt">
      <h1 data-tf="head">{rico(titulo)}</h1>
      {apoio && <p data-tf="sub">{rico(apoio)}</p>}
      {forte && <p className="forte" data-tf="sub">{rico(forte)}</p>}
    </div>
    if (onde === 'sem' || !slide.fotos.caixa) miolo = <div className="col so">{txt}</div>
    else {
      const ft = <VagaFoto foto={slide.fotos.caixa} modo="caixa" rotulo="Foto em caixa" className="ft" />
      miolo = <div className={`col ${onde}`}>{onde === 'acima' ? <>{ft}{txt}</> : <>{txt}{ft}</>}</div>
    }
  }

  return <div ref={raiz} className={`cz ${escuro ? 't10esc' : 't10cla'}`}>
    <div className="t10">
      {!estatico && <span className="cnt">{n}/{total}</span>}
      {miolo}
      <Rodape fim={fim} data={opcoes.dataRodape} />
    </div>
    <Aorta on={opcoes.assinatura} />
  </div>
}
