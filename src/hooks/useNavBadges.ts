import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export interface NavBadges {
  approvals: number       // /admin/approvals — solicitações pending
  team: number            // /team — convites não aceitos
  deliveries: number      // /deliveries — entregas atrasadas
  invoices: number        // /financial — faturas vencidas
  clients: number         // /clients — clientes em risco/inadimplente
}

const ZERO: NavBadges = { approvals: 0, team: 0, deliveries: 0, invoices: 0, clients: 0 }

export function useNavBadges(): NavBadges {
  const [badges, setBadges] = useState<NavBadges>(ZERO)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    async function load() {
      const today = new Date().toISOString().split('T')[0]

      const [approvalsRes, invitesRes, deliveriesRes, invoicesRes, clientsRes] = await Promise.all([
        supabase.from('client_signup_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('accepted', false),
        supabase.from('deliveries').select('id, status, prazo'),
        supabase.from('invoices').select('id, status, vencimento'),
        supabase.from('clients').select('id, status'),
      ])

      if (cancelled) return

      const lateDeliveries = (deliveriesRes.data || []).filter(
        (d: any) => d.status !== 'entregue' && d.prazo && d.prazo < today
      ).length

      const overdueInvoices = (invoicesRes.data || []).filter(
        (i: any) => i.status === 'atrasado' || (i.status === 'pendente' && i.vencimento && i.vencimento < today)
      ).length

      const riskyClients = (clientsRes.data || []).filter(
        (c: any) => c.status === 'risco' || c.status === 'inadimplente'
      ).length

      setBadges({
        approvals: approvalsRes.count ?? 0,
        team: invitesRes.count ?? 0,
        deliveries: lateDeliveries,
        invoices: overdueInvoices,
        clients: riskyClients,
      })
    }

    load()
    return () => { cancelled = true }
  }, [location.pathname])

  return badges
}
