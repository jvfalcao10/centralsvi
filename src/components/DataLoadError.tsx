import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DataLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
      <p className="font-medium flex items-center gap-2"><AlertCircle className="h-5 w-5" /> Não foi possível carregar os dados</p>
      <p className="text-sm text-muted-foreground">Atualize para consultar os números e as pendências.</p>
      <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>
    </div>
  )
}
