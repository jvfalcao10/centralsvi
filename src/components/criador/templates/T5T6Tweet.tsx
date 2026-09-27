import { useState } from 'react'
import { rico, paragrafos } from '@/lib/criador/texto'
import type { FotoSlide } from '@/data/criador/tipos'
import { Aorta, campo, estiloZoom, Foto, PERFIL, Selo, useFotoSrc, type SlideProps } from './comum'

// Template 5 · Tweet (motor: tw_capa, tw, tw_isca) e Template 6 · Tweet com imagem (t6_capa, t6).

function Cabecalho({ contador }: { contador?: string }) {
  return <div className="cab">
    <img src={PERFIL.avatar} alt="" />
    <div className="quem"><span className="nm">{PERFIL.nome}<Selo /></span><span className="ar">{PERFIL.arroba}</span></div>
    {contador && <span className="cont">{contador}</span>}
  </div>
}

/** Estrofe: Enter simples empilha linhas coladas, linha em branco abre parágrafo novo. */
function Paragrafos({ texto, seta = false }: { texto: string; seta?: boolean }) {
  const ps = paragrafos(texto)
  return <>{ps.map((p, i) => {
    const ultimo = i === ps.length - 1
    const comSeta = seta && ultimo && !p.trim().endsWith('>')
    return <p key={i} data-tf="sub">{rico(p)}{comSeta ? ' >' : ''}</p>
  })}</>
}

const dois = (n: number) => String(n).padStart(2, '0')

// ─────────── T5 ───────────
/** Manchete em Anton que desce na escala da casa até caber em 4 linhas (a escada do motor, simplificada). */
const ESCALA = [96, 85, 76, 68, 60, 53, 47]
function tamanhoManchete(texto: string) {
  const n = texto.replace(/\*\*|==/g, '').length
  // Anton caixa alta a 96px cabe ~24 caracteres por linha em 948px, a escala encolhe proporcional.
  for (const px of ESCALA) {
    const porLinha = Math.floor(24 * 96 / px)
    const linhas = Math.ceil(n / porLinha)
    if (linhas <= 4) return px
  }
  return ESCALA[ESCALA.length - 1]
}

export function T5Slide({ slide, n, total, opcoes }: SlideProps) {
  const escuro = opcoes.fundo === 'preto'
  const cls = `cz tweet${escuro ? ' escuro' : ' branco'}`
  const contador = `${dois(n)}/${dois(total)}`
  if (slide.tipo === 'capa') {
    const manchete = campo(slide, 'manchete')
    return <div className={cls}>
      <div className="tw">
        <Cabecalho contador={contador} />
        <h2 style={{ fontSize: tamanhoManchete(manchete) }} data-tf="head">{rico(manchete, { destaque: (c, k) => <em key={k}>{c}</em> })}</h2>
        {campo(slide, 'corpo') && <p data-tf="sub">{rico(campo(slide, 'corpo'))}</p>}
      </div>
      <Aorta on={opcoes.assinatura} />
    </div>
  }
  if (slide.tipo === 'isca') {
    return <div className={cls}>
      <div className="tw">
        <Cabecalho />
        <p className="ch" data-tf="sub">{rico(campo(slide, 'chamada'))}</p>
        <div className="pal">{campo(slide, 'palavra')}</div>
        {campo(slide, 'detalhe') && <p className="det" data-tf="sub">{rico(campo(slide, 'detalhe'))}</p>}
      </div>
      <Aorta on={opcoes.assinatura} />
    </div>
  }
  return <div className={cls}>
    <div className="tw"><Cabecalho contador={contador} /><Paragrafos texto={campo(slide, 'texto')} /></div>
    <Aorta on={opcoes.assinatura} />
  </div>
}

// ─────────── T6 ───────────
/** Imagens do pé: a caixa tem o tamanho exato da foto (teto 560 px), nada cortado sem necessidade. */
function ImagensT6({ fotos }: { fotos: FotoSlide[] }) {
  const srcs = fotos.map(f => f) // mantém a ordem a, b
  const [naturais, setNaturais] = useState<Record<number, number>>({})
  const vaga = srcs.length === 1 ? 968 : Math.floor((968 - 16 * (srcs.length - 1)) / srcs.length)
  const alturas = srcs.map((_, i) => naturais[i]).filter(Boolean) as number[]
  const H = alturas.length === srcs.length ? Math.min(560, Math.max(...alturas)) : 420
  return <div className="img" style={{ height: H }}>
    {srcs.map((f, i) => {
      const h = naturais[i]
      const hh = h ? Math.min(h, H) : H
      const ww = h && h > H ? Math.floor(vaga * H / h) : vaga
      return <div key={i} className="quadro" style={{ width: ww, height: hh }}>
        <FotoMedida foto={f} onAltura={alt => setNaturais(prev => prev[i] === Math.round(alt * vaga) ? prev : { ...prev, [i]: Math.round(alt * vaga) })} />
      </div>
    })}
  </div>
}

function FotoMedida({ foto, onAltura }: { foto: FotoSlide; onAltura: (proporcao: number) => void }) {
  const src = useFotoSrc(foto)
  if (!src) return <Foto foto={foto} rotulo="Imagem" />
  return <img src={src} alt="" data-foto="1" crossOrigin={/^https?:/.test(src) ? 'anonymous' : undefined}
    style={{ objectPosition: `${foto.x}% ${foto.y}%`, ...estiloZoom(foto) }}
    onLoad={e => { const im = e.currentTarget; if (im.naturalWidth) onAltura(im.naturalHeight / im.naturalWidth) }} />
}

export function T6Slide({ slide, opcoes }: SlideProps) {
  const claro = opcoes.fundo === 'branco'
  const fotos = [slide.fotos.a, slide.fotos.b].filter(Boolean) as FotoSlide[]
  const fim = slide.tipo === 'fim'
  let corpo: JSX.Element
  if (slide.tipo === 'capa') {
    const promessa = campo(slide, 'promessa')
    corpo = <>
      <p className="tit" data-tf="sub">{rico(campo(slide, 'titulo'))}</p>
      {campo(slide, 'subtitulo') && <p className="tit" data-tf="sub">{rico(campo(slide, 'subtitulo'))}</p>}
      <p data-tf="sub">{rico(promessa)}{promessa.trim().endsWith('>') ? '' : ' >'}</p>
    </>
  } else {
    corpo = <Paragrafos texto={campo(slide, 'texto')} seta={!fim} />
  }
  return <div className={`cz t6bg${claro ? ' claro' : ''}`}>
    <div className={`t6${fim ? ' fim' : ''}`}>
      <Cabecalho />
      {corpo}
      {!fim && fotos.length > 0 && <ImagensT6 fotos={fotos} />}
    </div>
    <Aorta on={opcoes.assinatura} />
  </div>
}
