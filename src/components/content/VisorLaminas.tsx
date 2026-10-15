import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Visor de carrossel lâmina a lâmina.
 *
 * Saiu de dentro da página de Moldes quando o Banco de Carrosséis do curso
 * entrou na Central: os dois mostram carrossel do mesmo jeito, e carrossel que
 * abre diferente em cada aba confunde quem está escolhendo molde.
 */
export interface Laminas {
  titulo: string
  subtitulo: string
  laminas: string[]
  /** Link da peça original, quando ela existe fora da Central. */
  fonte?: string
  rotuloFonte?: string
}

export function VisorLaminas({ item, onFechar }: { item: Laminas | null; onFechar: () => void }) {
  const [lamina, setLamina] = useState(0)

  // Toda peça nova começa na primeira lâmina: o gancho é o que importa na abertura.
  useEffect(() => { setLamina(0) }, [item])

  useEffect(() => {
    if (!item) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLamina(i => Math.min(item.laminas.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setLamina(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [item])

  const atual = item ? Math.min(lamina, item.laminas.length - 1) : 0

  return (
    <Dialog open={!!item} onOpenChange={o => { if (!o) onFechar() }}>
      <DialogContent className="max-w-3xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>{item.titulo}</DialogTitle>
              <DialogDescription>
                {item.subtitulo} · lâmina {atual + 1} de {item.laminas.length}
              </DialogDescription>
            </DialogHeader>
            <div className="relative mx-auto w-full max-w-md">
              <img src={item.laminas[atual]} alt={`Lâmina ${atual + 1}`} className="w-full rounded-lg border aspect-[4/5] object-cover" />
              {atual > 0 && (
                <button type="button" onClick={() => setLamina(atual - 1)} aria-label="Lâmina anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><ChevronLeft className="h-5 w-5" /></button>
              )}
              {atual < item.laminas.length - 1 && (
                <button type="button" onClick={() => setLamina(atual + 1)} aria-label="Próxima lâmina"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><ChevronRight className="h-5 w-5" /></button>
              )}
            </div>
            {item.laminas.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {item.laminas.map((src, i) => (
                  <button key={src} type="button" onClick={() => setLamina(i)} aria-label={`Ver lâmina ${i + 1}`}
                    className={`shrink-0 w-16 rounded-md overflow-hidden border-2 ${i === atual ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                    <img src={src} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {item.fonte && (
              <a href={item.fonte} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4">
                {item.rotuloFonte || 'Ver original'} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
