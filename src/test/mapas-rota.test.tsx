import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { UserRole } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getVisibleNavigation } from '@/lib/navigation'
import { MAPAS_ROTA } from '@/lib/mapas'

// João, 12/10: Mapas é da equipe inteira (admin, manager, seller, executor,
// traffic, social). Papel de cliente não vê a rota nem o menu.
const fake = vi.hoisted(() => ({ role: 'client' }))
const hierarchy: Record<string, number> = { admin: 4, manager: 3, seller: 2, executor: 1 }
const canFor = (role: string) => (required: UserRole) => (hierarchy[role] || 0) >= (hierarchy[required] || 100)

vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ insert: async () => ({ error: null }) }) } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({
  defaultRouteForRole: () => '/',
  useAuth: () => ({
    user: { id: 'u1', email: 'teste@svi' }, profile: { name: 'Pessoa de teste' }, role: fake.role, signupStatus: null, loading: false,
    isClient: fake.role === 'client', isTraffic: fake.role === 'traffic', isSocial: fake.role === 'social',
    can: canFor(fake.role), signOut: vi.fn(),
  }),
}))

function renderRota(role: string) {
  fake.role = role
  return render(
    <MemoryRouter initialEntries={['/mapas']}>
      <Routes>
        <Route path="/mapas" element={<ProtectedRoute {...MAPAS_ROTA}><p>Área Mapas</p></ProtectedRoute>} />
        <Route path="/minha-area" element={<p>Minha área</p>} />
        <Route path="/content/social" element={<p>Postagens</p>} />
        <Route path="/operacional/trafego" element={<p>Tráfego</p>} />
        <Route path="/login" element={<p>Login</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('rota /mapas por papel', () => {
  it('cliente não entra: volta para a área dele', () => {
    renderRota('client')
    expect(screen.getByText('Minha área')).toBeInTheDocument()
    expect(screen.queryByText('Área Mapas')).toBeNull()
  })

  it.each(['client_admin', 'client_user', 'user'])('%s não entra', role => {
    renderRota(role)
    expect(screen.queryByText('Área Mapas')).toBeNull()
  })

  it.each(['admin', 'manager', 'seller', 'executor', 'traffic', 'social'])('%s entra', role => {
    renderRota(role)
    expect(screen.getByText('Área Mapas')).toBeInTheDocument()
  })
})

describe('item Mapas no menu', () => {
  const urlsFor = (role: string) => {
    const nav = getVisibleNavigation({ can: canFor(role), isTraffic: role === 'traffic', isSocial: role === 'social', isClient: role === 'client' })
    return [...nav.main, ...nav.footer].flatMap(a => a.items.map(i => i.url))
  }

  it.each(['admin', 'manager', 'seller', 'executor', 'traffic', 'social'])('%s vê /mapas', role => {
    expect(urlsFor(role)).toContain('/mapas')
  })

  it('cliente e papel sem nível não veem /mapas', () => {
    expect(urlsFor('client')).toEqual([])
    expect(urlsFor('client_admin')).not.toContain('/mapas')
    expect(urlsFor('user')).not.toContain('/mapas')
  })
})
