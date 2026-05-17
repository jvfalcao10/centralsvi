import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { PainelClient } from '@/lib/painel/types'

/**
 * Carrega o client (org) pelo slug + valida acesso do user atual.
 * Retorna { data, isLoading, hasAccess, isOwnerOrStaff }.
 */
export function usePainelOrg(slug: string | undefined) {
  const { user, isStaff } = useAuth()

  const query = useQuery({
    queryKey: ['painel-org', slug, user?.id],
    enabled: !!slug && !!user,
    queryFn: async (): Promise<{
      client: PainelClient | null
      isMember: boolean
      isStaff: boolean
    }> => {
      if (!slug || !user) return { client: null, isMember: false, isStaff }

      const { data: client } = await supabase
        .from('clients')
        .select('id, name, slug, company, brand_color, painel_active')
        .eq('slug', slug)
        .maybeSingle()

      if (!client) return { client: null, isMember: false, isStaff }

      const { data: member } = await supabase
        .from('painel_members')
        .select('role')
        .eq('client_id', client.id)
        .eq('user_id', user.id)
        .maybeSingle()

      return {
        client: client as PainelClient,
        isMember: !!member,
        isStaff,
      }
    },
  })

  const hasAccess =
    !!query.data?.client && (query.data.isMember || query.data.isStaff)

  return {
    client: query.data?.client ?? null,
    isMember: query.data?.isMember ?? false,
    hasAccess,
    isOwnerOrStaff: hasAccess,
    isLoading: query.isLoading,
    error: query.error,
  }
}
