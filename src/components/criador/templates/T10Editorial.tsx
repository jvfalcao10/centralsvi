import { useLayoutEffect, useRef } from 'react'
import { rico, itens } from '@/lib/criador/texto'
import { Aorta, campo, Foto, PERFIL, Selo, type SlideProps } from './comum'

// Template 10 · Editorial (motor v2 de 27/09: t10_capa, t10_foto, t10_texto, t10_lista, t10_fecho).
// O enquadramento automático por mapa de rosto do motor (rostos.json) não vem para cá: aqui o João
// ajusta foco e zoom de cada foto na aba Montar, e o revisor avisa quando o foco desce demais.

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

/** Foto cheia: o degradê começa 300 px acima do topo do texto e fecha no preto atrás dele (--tt do motor). */
function FotoCheia({ slide, children, bottom, className }: { slide: SlideProps['slide']; children: React.ReactNode; bottom: number; className: string }) {
  const bg = useRef<HTMLDivElement>(null)
  const miolo = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!bg.current || !miolo.current) return
    bg.current.style.setProperty('--tt', `${miolo.current.offsetTop}px`)
  })
  return <>
    <div ref={bg} className="ft bg"><Foto foto={slide.fotos.fundo} rotulo="Foto de fundo" /><div className="gr" /></div>
    <div ref={miolo} className={`miolo ${className}`} style={{ bottom }}>{children}</div>
  </>
}

export function T10Slide({ slide, n, total, opcoes }: SlideProps) {
  const escuro = ['capa', 'foto', 'fecho'].includes(slide.tipo)
  const fim = slide.tipo === 'fecho'
  const titulo = campo(slide, 'titulo')
  const apoio = campo(slide, 'apoio')
  let miolo: JSX.Element

  if (slide.tipo === 'capa') {
    miolo = <FotoCheia slide={slide} bottom={134} className="capa">
      <Colab />
      <h1 data-tf="head">{rico(titulo)}</h1>
      {apoio && <p data-tf="sub">{rico(apoio)}</p>}
      <span className="arrasta">Arrasta para o lado ›</span>
    </FotoCheia>
  } else if (slide.tipo === 'foto') {
    miolo = <FotoCheia slide={slide} bottom={144} className="cheia">
      <h1 data-tf="head">{rico(titulo)}</h1>
      {apoio && <p data-tf="sub">{rico(apoio)}</p>}
    </FotoCheia>
  } else if (slide.tipo === 'fecho') {
    miolo = <FotoCheia slide={slide} bottom={144} className="capa">
      <Colab />
      <h1 data-tf="head">{rico(titulo)}</h1>
    </FotoCheia>
  } else if (slide.tipo === 'lista') {
    const txt = <div className="txt">
      <h1 data-tf="head">{rico(titulo)}</h1>
      {apoio && <p data-tf="sub">{rico(apoio)}</p>}
      <ul className="lista">{itens(slide.campos.itens).map((item, i) => <li key={i} data-tf="sub">{rico(item)}</li>)}</ul>
    </div>
    miolo = slide.fotos.faixa
      ? <div className="pilha"><div className="ft"><Foto foto={slide.fotos.faixa} rotulo="Foto no topo" /></div>{txt}</div>
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
      const ft = <div className="ft"><Foto foto={slide.fotos.caixa} rotulo="Foto em caixa" /></div>
      miolo = <div className={`col ${onde}`}>{onde === 'acima' ? <>{ft}{txt}</> : <>{txt}{ft}</>}</div>
    }
  }

  return <div className={`cz ${escuro ? 't10esc' : 't10cla'}`}>
    <div className="t10">
      <span className="cnt">{n}/{total}</span>
      {miolo}
      <Rodape fim={fim} data={opcoes.dataRodape} />
    </div>
    <Aorta on={opcoes.assinatura} />
  </div>
}
