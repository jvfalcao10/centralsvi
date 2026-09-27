import { createContext, useContext, type CSSProperties } from 'react'
import type { FotoSlide, OpcoesCarrossel, SlideDoc } from '@/data/criador/tipos'

export const PERFIL = {
  nome: 'João Falcão | Marketing Médico',
  arroba: '@joaofalcao.svi',
  avatar: '/criador/joao-avatar.jpg',
  badgeSvi: '/criador/svi-badge.png',
  colab: ['joaofalcao.svi', 'svi.mktmedico'] as const,
}

export interface SlideProps {
  slide: SlideDoc
  n: number
  total: number
  opcoes: OpcoesCarrossel
}

/** Resolve a foto de uma lâmina: URL direta, ou URL assinada do bucket privado. */
export const FotoContext = createContext<(foto?: FotoSlide) => string | undefined>(foto => foto?.url)

export function useFotoSrc(foto?: FotoSlide) {
  const resolver = useContext(FotoContext)
  return resolver(foto)
}

/** Foto com foco (object-position). Sem foto, mostra uma área listrada com o nome da vaga. */
export function Foto({ foto, rotulo, style, className }: { foto?: FotoSlide; rotulo: string; style?: CSSProperties; className?: string }) {
  const src = useFotoSrc(foto)
  if (!src) return <div className={`foto-vazia ${className ?? ''}`} style={style}>{rotulo}</div>
  return <img src={src} alt="" data-foto="1" className={className} crossOrigin={/^https?:/.test(src) ? 'anonymous' : undefined}
    style={{ objectPosition: `${foto?.x ?? 50}% ${foto?.y ?? 30}%`, ...estiloZoom(foto), ...style }} />
}

/** Zoom em volta do ponto de foco: o mesmo cálculo que o exportador grava nos pixels. */
export function estiloZoom(foto?: FotoSlide): CSSProperties {
  const z = foto?.z ?? 1
  if (!z || z === 1) return {}
  return { transform: `scale(${z})`, transformOrigin: `${foto?.x ?? 50}% ${foto?.y ?? 30}%` }
}

/** Selo azul de verificado (SELO_OK do motor Python). */
export function Selo({ className = 'selo' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="#1D9BF0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.62 13.43 1.75 12 1.75s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.26 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
}

export function Aorta({ on }: { on: boolean }) {
  return on ? <div className="aorta">Método AORTA</div> : null
}

export const campo = (slide: SlideDoc, chave: string) => (slide.campos?.[chave] ?? '').trim()
