import { Fragment, type ReactNode } from 'react'
import { rico, itens } from '@/lib/criador/texto'
import { Aorta, campo, Foto, PERFIL, Selo, type SlideProps } from './comum'

// Template 7 · Sistema (motor: _t7_base e as funções t7_*) e Template 8 · Duelo (_t8_base, t8_*),
// que reusa a casca do T7: grão, pílula do perfil, contador e pé com a barra de progresso.

export function CascaT7({ n, total, centro = false, claro = false, semPe = false, assinatura, children }: {
  n: number; total: number; centro?: boolean; claro?: boolean; semPe?: boolean; assinatura: boolean; children: ReactNode
}) {
  const pe = !(centro || semPe)
  return <div className={`cz t7bg${claro ? ' claro' : ''}`}>
    <div className="t7grao" />
    <div className={`t7${centro ? ' centro' : ''}`}>
      <span className="cnt">{n}/{total}</span>
      <div className="nome"><img src={PERFIL.avatar} alt="" /><span>{PERFIL.nome}</span><Selo /></div>
      {children}
      {pe && <div className="pe"><span className="tag">AORTA</span><div className="barra"><b style={{ width: `${Math.floor(100 * n / Math.max(total, 1))}%` }} /><i /></div></div>}
    </div>
    <Aorta on={assinatura} />
  </div>
}

function Pilulas({ lista, ultimoDourado }: { lista: string[]; ultimoDourado: boolean }) {
  return <>{lista.map((item, i) => <Fragment key={i}>
    {i > 0 && <span className="vai" />}
    <span className={`pil${ultimoDourado && i === lista.length - 1 ? ' azul' : ''}`}>{rico(item)}</span>
  </Fragment>)}</>
}

/** Duas colunas empilhadas: frase em cima, bloco visual no meio, apoio embaixo (motor: _t7_dois). */
function Dois({ titulo, bloco, apoio }: { titulo: string; bloco: ReactNode; apoio: string }) {
  return <div className="dois">
    <div className="esq"><h1 data-tf="head">{rico(titulo)}</h1></div>
    <div className="dir auto">{bloco}</div>
    {apoio && <p className="sub solta" data-tf="sub">{rico(apoio)}</p>}
  </div>
}

function Mensagem({ linha }: { linha: string }) {
  const m = linha.match(/^\s*([PpCc])\s*:\s*(.*?)\s*(?:\(([^()]*)\))?\s*$/)
  const quem = m ? m[1].toLowerCase() : 'p'
  const texto = m ? m[2] : linha
  const hora = m?.[3] ?? ''
  return <div className={`m ${quem}`}>{texto}{hora && <small>{hora}</small>}</div>
}

export function T7Slide({ slide, n, total, opcoes }: SlideProps) {
  const c = (k: string) => campo(slide, k)
  const base = { n, total, assinatura: opcoes.assinatura }

  switch (slide.tipo) {
    case 'capa_foto':
      return <CascaT7 {...base} centro>
        {c('rotulo') && <span className="rotulo">{c('rotulo')}</span>}
        <h1 data-tf="head">{rico(c('titulo'))}</h1>
        {c('sub') && <p className="sub" data-tf="sub">{rico(c('sub'))}</p>}
        <div className="fotocapa"><Foto foto={slide.fotos.capa} rotulo="Foto da capa (952x640)" /></div>
        <div className="arrasta">arrasta pro lado<span className="seta" /></div>
      </CascaT7>
    case 'duas_buscas':
      return <CascaT7 {...base}>
        <Dois titulo={c('titulo')} apoio={c('apoio')} bloco={<div className="busca duasbuscas">
          {itens(slide.campos.consultas).map((q, i) => <div key={i} className="campo"><span className="lupa" />{q}</div>)}
        </div>} />
      </CascaT7>
    case 'busca':
      return <CascaT7 {...base}>
        <Dois titulo={c('titulo')} apoio={c('apoio')} bloco={<div className="busca">
          <div className="campo"><span className="lupa" />{c('consulta')}</div>
          {itens(slide.campos.resultados).map((r, i) => {
            const [tit, desc, est] = r.split('|').map(p => p.trim())
            return <div key={i} className="res"><span className="tit">{tit}</span>{est && <span className="est">{est}</span>}<span>{desc}</span></div>
          })}
        </div>} />
      </CascaT7>
    case 'whats':
      return <CascaT7 {...base}>
        <Dois titulo={c('titulo')} apoio={c('apoio')} bloco={<div className="whats">
          {itens(slide.campos.mensagens).map((m, i) => <Mensagem key={i} linha={m} />)}
        </div>} />
      </CascaT7>
    case 'cartao':
      return <CascaT7 {...base}>
        <Dois titulo={c('titulo')} apoio={c('apoio')} bloco={<div className="cartao">
          {c('rotulo') && <span className="rot">{c('rotulo')}</span>}<span className="tx">{rico(c('texto'))}</span>
        </div>} />
      </CascaT7>
    case 'linha': {
      const etapas = itens(slide.campos.etapas)
      const on = Math.max(0, etapas.findIndex(e => e.startsWith('*')))
      return <CascaT7 {...base}>
        <Dois titulo={c('titulo')} apoio={c('apoio')} bloco={<div className="linha"><ul>
          {etapas.map((e, i) => <li key={i} className={i === on ? 'on' : undefined}>{e.replace(/^\*\s*/, '')}</li>)}
        </ul></div>} />
      </CascaT7>
    }
    case 'dividida':
      return <CascaT7 {...base}>
        <Dois titulo={c('titulo')} apoio={c('apoio')} bloco={<div className="dividida">
          <div className="esq2"><p className="rot">{c('rotuloEsq')}</p>{itens(slide.campos.esquerda).map((f, i) => <p key={i}>{f}</p>)}</div>
          <div className="dir2"><p className="rot">{c('rotuloDir')}</p>{itens(slide.campos.direita).map((f, i) => <p key={i}>{f}</p>)}</div>
        </div>} />
      </CascaT7>
    case 'fecho': {
      const pilulas = itens(slide.campos.pilulas)
      return <CascaT7 {...base} centro>
        <h1 style={{ fontSize: 64, lineHeight: 1.1 }} data-tf="head">{rico(c('linha1'))}</h1>
        <h1 style={{ marginTop: 26 }} data-tf="head"><mark>{rico(c('linha2'))}</mark></h1>
        {pilulas.length > 0 && <div className="fila">{pilulas.map((p, i) => <span key={i} className={`pil${i === pilulas.length - 1 ? ' azul' : ''}`}>{p}</span>)}</div>}
        {c('cta') && <p className="cta" data-tf="sub">{rico(c('cta'))}</p>}
        {c('cta2') && <p className="sub" style={{ marginTop: 22 }} data-tf="sub">{rico(c('cta2'))}</p>}
      </CascaT7>
    }
    default: {
      // frase: frase grande que puxa a próxima, apoio e caixa opcional de pílulas
      const lista = itens(slide.campos.itens)
      const caixa = lista.length > 0 ? <div className="caixa">
        {c('caixaTitulo') && <p className="bt">{c('caixaTitulo')}</p>}
        <Pilulas lista={lista} ultimoDourado={false} />
        {c('miudo') && <p className="miudo">{c('miudo')}</p>}
      </div> : null
      return <CascaT7 {...base}>
        <div className="dois">
          <div className="esq"><h1 data-tf="head">{rico(c('titulo'))}</h1>{c('apoio') && <p className="sub" data-tf="sub">{rico(c('apoio'))}</p>}</div>
          {caixa && <div className="dir">{caixa}</div>}
        </div>
      </CascaT7>
    }
  }
}
