import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CommercialPersona, CommercialPersonaKey } from '@/types'

/**
 * Returns the commercial persona of the current user (if any),
 * plus a flag indicating whether the user can edit goals (admin or persona='ruan').
 */
export function useCommercialPersona() {
  const { user, role } = useAuth()
  const [persona, setPersona] = useState<CommercialPersona | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setPersona(null); setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('commercial_personas')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!cancelled) {
        setPersona((data as CommercialPersona | null) ?? null)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const isAdmin = role === 'admin'
  const canEditGoals = isAdmin || persona?.persona === 'ruan'

  // Determines which dashboards user can view
  const viewablePersonas: CommercialPersonaKey[] = isAdmin
    ? ['pedro', 'arthur', 'ruan']
    : persona ? [persona.persona] : []

  return { persona, isAdmin, canEditGoals, viewablePersonas, loading }
}
