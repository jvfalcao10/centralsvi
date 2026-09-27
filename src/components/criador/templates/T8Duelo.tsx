import { rico } from '@/lib/criador/texto'
import { campo, Foto, type SlideProps } from './comum'
import { CascaT7 } from './T7Sistema'

// Template 8 · Duelo (motor: t8_capa, t8_duelo, t8_fecho).

export function T8Slide({ slide, n, total, opcoes }: SlideProps) {
  const c = (k: string) => campo(slide, k)
  const base = { n, total, assinatura: opcoes.assinatura }

  if (slide.tipo === 'capa') {
    return <CascaT7 {...base} centro>
      <div className="capa2">
        <div className="meia"><Foto foto={slide.fotos.a} rotulo="Foto A" /><div className="grad" /></div>
        <div className="meia"><Foto foto={slide.fotos.b} rotulo="Foto B" /><div className="grad" /></div>
      </div>
      <div className="titulos"><h2 className="tit">{rico(c('esquerda'))}</h2><span className="vs">VS.</span><h2 className="tit">{rico(c('direita'))}</h2></div>
      {c('lema') && <p className="lema">{c('lema')}</p>}
      <div className="arrasta">arrasta pro lado<span className="seta" /></div>
    </CascaT7>
  }

  if (slide.tipo === 'fecho') {
    return <CascaT7 {...base} centro claro>
      <h1 style={{ fontSize: 72, lineHeight: 1.05 }} data-tf="head">{rico(c('titulo'), { destaque: (conteudo, k) => <span key={k} className="ouro">{conteudo}</span> })}</h1>
      {c('sub') && <p className="sub" style={{ fontFamily: "'Sora',Helvetica,sans-serif", fontSize: 29, marginTop: 22 }} data-tf="sub">{rico(c('sub'))}</p>}
      <div className="fotofecho" style={{ width: 520, height: 520 }}><Foto foto={slide.fotos.foto} rotulo="Foto real do João" /></div>
      <p className="cta" style={{ marginTop: 44, fontSize: 40 }} data-tf="sub">{rico(c('cta'))}</p>
    </CascaT7>
  }

  const convite = c('convite')
  return <CascaT7 {...base} semPe={!!convite}>
    <div className="duelo">
      <div className="dfoto"><Foto foto={slide.fotos.a} rotulo="Foto A (940x529)" /><div className={`faixa ${c('posA') || 'base'}`} data-tf="sub"><b>{c('rotuloA')}</b> {rico(c('textoA'))}</div></div>
      <div className="dfoto"><Foto foto={slide.fotos.b} rotulo="Foto B (940x529)" /><div className={`faixa ${c('posB') || 'base'}`} data-tf="sub"><b>{c('rotuloB')}</b> {rico(c('textoB'))}</div></div>
    </div>
    {convite && <div className="convite">{convite}</div>}
  </CascaT7>
}
