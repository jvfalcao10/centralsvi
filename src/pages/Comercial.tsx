import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCommercialPersona } from '@/hooks/useCommercialPersona'
import { CommercialPersonaKey } from '@/types'
import PersonaDashboard from '@/components/commercial/PersonaDashboard'
import { Loader2 } from 'lucide-react'

const personaLabels: Record<CommercialPersonaKey, string> = {
  pedro: 'Pedro · SDR',
  arthur: 'Arthur · Inside Sales',
  ruan: 'Ruan · Diagnósticos',
}

export default function Comercial() {
  const { viewablePersonas, isAdmin, loading } = useCommercialPersona()
  const [activeTab, setActiveTab] = useState<CommercialPersonaKey | null>(null)

  useEffect(() => {
    if (!activeTab && viewablePersonas.length > 0) {
      setActiveTab(viewablePersonas[0])
    }
  }, [viewablePersonas, activeTab])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    )
  }

  if (viewablePersonas.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Sem acesso ao módulo Comercial</h2>
          <p className="text-sm text-muted-foreground">
            Você não tem uma persona comercial atribuída. Fale com o admin para configurar.
          </p>
        </div>
      </div>
    )
  }

  // Single persona (Pedro, Arthur, or Ruan logged in): no tabs
  if (!isAdmin && viewablePersonas.length === 1) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Comercial</h1>
          <p className="text-sm text-muted-foreground">{personaLabels[viewablePersonas[0]]}</p>
        </div>
        <PersonaDashboard persona={viewablePersonas[0]} />
      </div>
    )
  }

  // Admin: tabs to switch between personas
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Comercial</h1>
        <p className="text-sm text-muted-foreground">Acompanhe metas, atividades e diagnósticos do time</p>
      </div>

      <Tabs value={activeTab ?? viewablePersonas[0]} onValueChange={(v) => setActiveTab(v as CommercialPersonaKey)}>
        <TabsList>
          {viewablePersonas.map((p) => (
            <TabsTrigger key={p} value={p}>{personaLabels[p]}</TabsTrigger>
          ))}
        </TabsList>
        {viewablePersonas.map((p) => (
          <TabsContent key={p} value={p} className="mt-4">
            <PersonaDashboard persona={p} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
