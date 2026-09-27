import { rico } from '@/lib/criador/texto'
import { Aorta, campo, Foto, type SlideProps } from './comum'

// Template 9 · Quadros (motor: t9_quadros). Dois fotogramas 1080x672 com 6 px de preto entre eles.

export function T9Slide({ slide, opcoes }: SlideProps) {
  const cta = campo(slide, 'cta')
  return <div className="cz t9bg">
    <div className="t9q a">
      <Foto foto={slide.fotos.a} rotulo="Quadro de cima" />
      <div className="sombra" />
      <div className="leg" data-tf="head">{rico(campo(slide, 'linhaA'))}</div>
    </div>
    <div className="t9q b">
      <Foto foto={slide.fotos.b} rotulo="Quadro de baixo" />
      <div className="sombra" />
      <div className="leg" data-tf="head">{rico(campo(slide, 'linhaB'))}{cta && <><br /><span className="cta">{cta}</span></>}</div>
    </div>
    <Aorta on={opcoes.assinatura} />
  </div>
}
