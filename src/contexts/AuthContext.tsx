import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

export type UserRole = 'admin' | 'manager' | 'seller' | 'executor' | 'client' | 'user'
export type SignupStatus = 'pending' | 'approved' | 'rejected' | null

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  signupStatus: SignupStatus
  loading: boolean
  signOut: () => Promise<void>
  /** Checa se o usuário atende ao role mínimo de staff (hierarquia). Client sempre retorna false. */
  can: (requiredRole: UserRole) => boolean
  /** True se o role atual é 'client' (usuário externo aprovado). */
  isClient: boolean
  /** True se é qualquer role de staff (admin/manager/seller/executor). */
  isStaff: boolean
  /** Força refetch de role + signup status (após aprovação, por exemplo). */
  refresh: () => Promise<void>
}

const STAFF_HIERARCHY: Record<string, number> = {
  admin: 4,
  manager: 3,
  seller: 2,
  executor: 1,
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  signupStatus: null,
  loading: true,
  signOut: async () => {},
  can: () => false,
  isClient: false,
  isStaff: false,
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [signupStatus, setSignupStatus] = useState<SignupStatus>(null)
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
      /* silently ignore */
    }
  }

  const fetchRole = async (userId: string) => {
    try {
      // SELECT direto de user_roles (RLS permite ler os próprios)
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)

      if (data && data.length > 0) {
        const roles = data.map((r: any) => r.role as UserRole)
        // Prioriza role de staff mais alta; se só tem 'client', usa 'client'
        const staffRoles = roles.filter(r => r in STAFF_HIERARCHY)
        if (staffRoles.length > 0) {
          const highest = staffRoles.reduce((best, curr) =>
            (STAFF_HIERARCHY[curr] ?? 0) > (STAFF_HIERARCHY[best] ?? 0) ? curr : best
          )
          setRole(highest)
        } else if (roles.includes('client')) {
          setRole('client')
        } else {
          setRole(roles[0])
        }
      } else {
        setRole(null) // sem role → ou pending aprovação, ou algo de errado
      }
    } catch (e) {
      console.error('[AUTH] fetchRole error:', e)
      setRole(null)
    }
  }

  const fetchSignupStatus = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('client_signup_requests')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle()
      setSignupStatus((data?.status as SignupStatus) ?? null)
    } catch {
      setSignupStatus(null)
    }
  }

  const hydrate = async (userId: string) => {
    await Promise.all([
      fetchProfile(userId),
      fetchRole(userId),
      fetchSignupStatus(userId),
    ])
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
      hydrate(user.id)
    } else {
      setProfile(null)
      setRole(null)
      setSignupStatus(null)
    }
  }, [user])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const can = (requiredRole: UserRole): boolean => {
    // Client role nunca tem acesso a rotas de staff
    if (!role || role === 'client' || role === 'user') return false
    return (STAFF_HIERARCHY[role] ?? 0) >= (STAFF_HIERARCHY[requiredRole] ?? 0)
  }

  const isClient = role === 'client'
  const isStaff = role ? role in STAFF_HIERARCHY : false

  const refresh = async () => {
    if (user) await hydrate(user.id)
  }

  return (
    <AuthContext.Provider
      value={{
        user, session, profile, role, signupStatus, loading,
        signOut, can, isClient, isStaff, refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
