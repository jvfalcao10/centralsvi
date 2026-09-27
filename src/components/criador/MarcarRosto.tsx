import { useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { FotoSlide } from '@/data/criador/tipos'

type Caixa = [number, number, number, number]

/**
 * O João marca cada cabeça arrastando um retângulo sobre a foto (sem detector de rosto, sem IA).
 * As caixas ficam normalizadas (0..1) em foto.cab e alimentam o enquadramento automático do T10.
 * Marque a cabeça inteira, do topo do cabelo ao queixo.
 */
export function MarcarRosto({ aberto, aoFechar, src, foto, aoSalvar }: {
  aberto: boolean; aoFechar: () => void; src: string; foto: FotoSlide
  aoSalvar: (cab: Caixa[], w: number, h: number) => void
}) {
  const [caixas, setCaixas] = useState<Caixa[]>(foto.cab ?? [])
  const [arrasto, setArrasto] = useState<Caixa | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(foto.w && foto.h ? { w: foto.w, h: foto.h } : null)
  const area = useRef<HTMLDivElement>(null)
  const inicio = useRef<[number, number] | null>(null)

  const ponto = (e: PointerEvent): [number, number] => {
    const r = area.current!.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]
  }
  const norm = (a: [number, number], b: [number, number]): Caixa => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]

  const baixo = (e: PointerEvent) => { e.preventDefault(); area.current?.setPointerCapture(e.pointerId); inicio.current = ponto(e); setArrasto([...inicio.current, ...inicio.current] as Caixa) }
  const move = (e: PointerEvent) => { if (inicio.current) setArrasto(norm(inicio.current, ponto(e))) }
  const cima = (e: PointerEvent) => {
    if (!inicio.current) return
    const c = norm(inicio.current, ponto(e))
    inicio.current = null
    setArrasto(null)
    if (c[2] - c[0] > 0.02 && c[3] - c[1] > 0.02) setCaixas(cs => [...cs, c.map(v => Math.round(v * 10000) / 10000) as Caixa])
  }

  return <Dialog open={aberto} onOpenChange={v => { if (!v) aoFechar() }}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Marcar o rosto</DialogTitle>
        <DialogDescription>Arraste um retângulo sobre cada cabeça da foto, do topo do cabelo ao queixo. Com a marcação, o enquadramento é automático: a cabeça fica inteira e o texto nunca cai em cima dela.</DialogDescription>
      </DialogHeader>
      <div ref={area} className="relative mx-auto w-fit max-w-full touch-none select-none cursor-crosshair"
        onPointerDown={baixo} onPointerMove={move} onPointerUp={cima} onPointerCancel={() => { inicio.current = null; setArrasto(null) }}>
        <img src={src} alt="Foto para marcar o rosto" draggable={false} className="block max-h-[60dvh] max-w-full"
          onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        {[...caixas, ...(arrasto ? [arrasto] : [])].map((c, i) => <div key={i} className="absolute border-2 border-[#D0B870] bg-[#D0B870]/15 pointer-events-none"
          style={{ left: `${c[0] * 100}%`, top: `${c[1] * 100}%`, width: `${(c[2] - c[0]) * 100}%`, height: `${(c[3] - c[1]) * 100}%` }}>
          {i < caixas.length && <span className="absolute -top-5 left-0 text-[11px] font-semibold text-[#D0B870]">{i + 1}</span>}
        </div>)}
      </div>
      <p className="text-xs text-muted-foreground">{caixas.length ? `${caixas.length} cabeça${caixas.length > 1 ? 's' : ''} marcada${caixas.length > 1 ? 's' : ''}.` : 'Nenhuma cabeça marcada ainda.'}</p>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="ghost" onClick={() => setCaixas(cs => cs.slice(0, -1))} disabled={!caixas.length}>Desfazer a última</Button>
        <Button variant="outline" onClick={() => setCaixas([])} disabled={!caixas.length}>Limpar</Button>
        <Button onClick={() => { aoSalvar(caixas, natural?.w ?? 0, natural?.h ?? 0); aoFechar() }} disabled={!natural}>Salvar marcação</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
