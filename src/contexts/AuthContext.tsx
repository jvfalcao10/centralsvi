import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

export type UserRole = 'admin' | 'manager' | 'seller' | 'executor' | 'user'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  can: (requiredRole: UserRole) => boolean
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  manager: 3,
  seller: 2,
  executor: 1,
  user: 0,
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  signOut: async () => {},
  can: () => false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
      if (data) setProfile(data)
    } catch {
      // silently ignore
    }
  }

  const fetchRole = async (userId: string) => {
    try {
      // Usa RPC get_my_role (bypassa RLS via SECURITY DEFINER)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_role')

      console.log('[AUTH] get_my_role data:', rpcData, 'error:', rpcError)

      if (rpcData && typeof rpcData === 'string') {
        setRole(rpcData as UserRole)
        return
      }

      // Fallback: SELECT direto
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)

      console.log('[AUTH] fallback data:', data, 'error:', error)

      if (data && data.length > 0) {
        const roles = data.map((r: any) => r.role as UserRole)
        const highest = roles.reduce((best, current) => {
          return (ROLE_HIERARCHY[current] ?? 0) > (ROLE_HIERARCHY[best] ?? 0) ? current : best
        }, roles[0])
        setRole(highest)
      } else {
        setRole('executor')
      }
    } catch (e) {
      console.log('[AUTH] exception:', e)
      setRole('executor')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      fetchProfile(user.id)
      fetchRole(user.id)
    } else {
      setProfile(null)
      setRole(null)
    }
  }, [user])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const can = (requiredRole: UserRole): boolean => {
    if (!role) return false
    return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signOut, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
