import { describe, it, expect, vi, afterEach } from 'vitest'

// João, 20/10/2026: "rafael melo conectado". O Instagram dele
// (@rafaelmelo.advogadoss, 17841404899804112) entrou no Business Manager como
// página de CLIENTE, respondia pela API, e a Central continuava dizendo
// "escolha uma conta conectada", porque a lista vinha só de /me/accounts.
const resposta = (porEdge: Record<string, unknown>) => {
 vi.stubEnv('SOCIAL_IG_ACCESS_TOKEN', 't')
 // jsdom não tem AbortSignal.timeout e sem o stub tudo cai no catch, que
 // devolveria lista vazia e deixaria o teste verde sem testar nada.
 if (!AbortSignal.timeout) vi.stubGlobal('AbortSignal', { ...AbortSignal, timeout: () => new AbortController().signal })
 vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  const chave = Object.keys(porEdge).find(k => String(url).includes(k))
  if (!chave) return { ok: false, json: async () => ({ error: { code: 100, message: 'edge desconhecida' } }) }
  return { ok: true, json: async () => porEdge[chave] }
 }))
}
const propria = { data: [{ id: 'p1', name: 'Dr. Felipe', instagram_business_account: { id: '1', username: 'dr.felipebranco' } }] }

describe('contas que a Central oferece para publicar', () => {
 afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

 it('soma a página de cliente à lista das próprias', async () => {
  resposta({ 'me/accounts': propria, 'client_pages': { data: [
   { name: 'Rafael Melo Advogado & Associados', connected_instagram_account: { id: '17841404899804112', username: 'rafaelmelo.advogadoss' } },
  ] } })
  const { publicationAccounts } = await import('../../api/_lib/social-publication-meta')
  const contas = await publicationAccounts()
  expect(contas.map(c => c.username)).toEqual(['dr.felipebranco', 'rafaelmelo.advogadoss'])
 })

 it('não duplica quem aparece nas duas listas', async () => {
  resposta({ 'me/accounts': propria, 'client_pages': { data: [
   { name: 'Dr. Felipe', instagram_business_account: { id: '1', username: 'dr.felipebranco' } },
  ] } })
  const { publicationAccounts } = await import('../../api/_lib/social-publication-meta')
  expect(await publicationAccounts()).toHaveLength(1)
 })

 // Tropeço no Business Manager não pode apagar da tela as contas da casa.
 it('falha nas páginas de cliente não derruba a lista', async () => {
  resposta({ 'me/accounts': propria })
  const { publicationAccounts } = await import('../../api/_lib/social-publication-meta')
  expect((await publicationAccounts()).map(c => c.username)).toEqual(['dr.felipebranco'])
 })
})
