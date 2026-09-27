import { forwardRef, type ComponentType } from 'react'
import type { OpcoesCarrossel, SlideDoc, TemplateId } from '@/data/criador/tipos'
import type { SlideProps } from './comum'
import { T10Slide } from './T10Editorial'
import { T9Slide } from './T9Quadros'
import { T7Slide } from './T7Sistema'
import { T8Slide } from './T8Duelo'
import { T5Slide, T6Slide } from './T5T6Tweet'
import '../criador.css'

export const COMPONENTES: Record<TemplateId, ComponentType<SlideProps>> = {
  t10: T10Slide, t9: T9Slide, t7: T7Slide, t8: T8Slide, t6: T6Slide, t5: T5Slide,
}

export const LARGURA = 1080
export const ALTURA = 1350

export interface CanvasProps {
  template: TemplateId
  slide: SlideDoc
  n: number
  total: number
  opcoes: OpcoesCarrossel
}

/** Lâmina em tamanho real (1080x1350), sem escala. É o nó que o exportador fotografa. */
export const SlideCanvas = forwardRef<HTMLDivElement, CanvasProps>(function SlideCanvas({ template, ...props }, ref) {
  const Comp = COMPONENTES[template]
  return <div ref={ref} data-lamina={props.n} style={{ width: LARGURA, height: ALTURA }}><Comp {...props} /></div>
})

/** Lâmina reduzida para caber na tela: canvas fixo de 1080x1350 com transform: scale. */
export function SlidePreview({ largura, className, ...props }: CanvasProps & { largura: number; className?: string }) {
  const escala = largura / LARGURA
  return <div className={className} style={{ width: largura, height: ALTURA * escala, overflow: 'hidden', position: 'relative', flex: 'none' }}>
    <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', width: LARGURA, height: ALTURA, pointerEvents: 'none' }}>
      <SlideCanvas {...props} />
    </div>
  </div>
}
