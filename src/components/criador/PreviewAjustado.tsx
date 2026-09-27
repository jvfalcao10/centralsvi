import { useEffect, useRef, useState } from 'react'
import { SlidePreview, type CanvasProps } from './templates'

/** Largura disponível de um contêiner, acompanhando redimensionamento. */
export function useLargura<T extends HTMLElement>(inicial = 320) {
  const ref = useRef<T>(null)
  const [largura, setLargura] = useState(inicial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setLargura(Math.max(120, Math.floor(el.clientWidth)))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, largura }
}

/** Prévia que ocupa a largura do contêiner (até um teto), mantendo 1080x1350. */
export function PreviewAjustado({ max = 540, className, ...props }: CanvasProps & { max?: number; className?: string }) {
  const { ref, largura } = useLargura<HTMLDivElement>()
  return <div ref={ref} className={className}>
    <SlidePreview {...props} largura={Math.min(largura, max)} className="rounded-md shadow-sm ring-1 ring-border" />
  </div>
}
