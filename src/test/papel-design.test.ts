import { describe, it, expect, vi } from 'vitest'
import { getVisibleNavigation, DESIGN_AREAS } from '../lib/navigation'

// O AuthContext puxa o cliente do Supabase, que exige as envs do navegador.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { defaultRouteForRole } = await import('../contexts/AuthContext')

// João, 15/10/2026: "acesso de design pra ele, pra ver os moldes, postagens e
// etc". O José monta as artes e não publica, então o papel dele não é o da
// social media: pauta, datas e as senhas das contas dos clientes não são dele.
const urls = (areas: ReturnType<typeof getVisibleNavigation>['main']) =>
  areas.flatMap(a => a.items.map(i => i.url))

describe('papel design', () => {
 it('vê postagens, moldes, cadência, acessos e mapas', () => {
  const nav = getVisibleNavigation({ can: () => false, isDesign: true })
  // O designer monta a arte do que está atrasado, então vê a cadência também.
  expect(urls(nav.main).sort()).toEqual(['/acessos', '/content/cadencia', '/content/moldes', '/content/social', '/mapas'])
  expect(nav.footer).toEqual([])
 })

 it('não vê datas, radar nem as senhas dos clientes', () => {
  const nav = getVisibleNavigation({ can: () => false, isDesign: true })
  for (const fora of ['/content/datas', '/content/radar', '/senhas'])
   expect(urls(nav.main), fora).not.toContain(fora)
 })

 it('é papel lateral: não herda nada da escada de staff', () => {
  // can() falso em tudo e a navegação continua inteira, igual a traffic e social.
  expect(getVisibleNavigation({ can: () => false, isDesign: true }).main).toHaveLength(DESIGN_AREAS.length)
 })

 it('cai no quadro das peças depois do login', () => {
  expect(defaultRouteForRole('design')).toBe('/content/social')
 })

 it('não se mistura com o papel da social media', () => {
  const design = urls(getVisibleNavigation({ can: () => false, isDesign: true }).main)
  const social = urls(getVisibleNavigation({ can: () => false, isSocial: true }).main)
  expect(social).toContain('/senhas')
  expect(design).not.toContain('/senhas')
 })
})
