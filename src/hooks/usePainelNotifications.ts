import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export type PainelNotification = {
  id: string
  user_id: string
  client_id: string | null
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  link: string | null
  read: boolean
  created_at: string
}

export function usePainelNotifications(opts?: { clientId?: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['painel-notifications', user?.id, opts?.clientId ?? 'all'],
    enabled: !!user,
    queryFn: async (): Promise<PainelNotification[]> => {
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (opts?.clientId) q = q.eq('client_id', opts.clientId)
      const { data } = await q
      return (data as PainelNotification[]) || []
    },
    refetchInterval: 60_000, // poll a cada minuto
  })

  // Realtime subscription (Supabase Realtime, sem overhead grande)
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['painel-notifications'] })
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user, qc])

  async function markRead(ids: string[]) {
    await supabase.rpc('painel_mark_notifications_read', { p_ids: ids })
    qc.invalidateQueries({ queryKey: ['painel-notifications'] })
  }

  async function markAllRead() {
    await supabase.rpc('painel_mark_all_notifications_read')
    qc.invalidateQueries({ queryKey: ['painel-notifications'] })
  }

  const unreadCount = (query.data || []).filter(n => !n.read).length

  return {
    notifications: query.data || [],
    unreadCount,
    isLoading: query.isLoading,
    markRead,
    markAllRead,
  }
}
