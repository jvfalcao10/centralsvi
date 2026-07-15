import { ExternalLink } from 'lucide-react'

const DIRETORIA_URL = 'https://diretoria-svi.vercel.app'

export default function Diretoria() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 56px)' }}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="text-sm font-semibold text-muted-foreground">Diretoria — Raio-X da Operação</span>
        <a
          href={DIRETORIA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          Abrir em tela cheia <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <iframe
        src={DIRETORIA_URL}
        title="Diretoria SVI — Raio-X da Operação"
        className="w-full flex-1 border-0"
      />
    </div>
  )
}
