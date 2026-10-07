import {describe,it,expect} from 'vitest'
import {readFile} from 'node:fs/promises'

/**
 * As rotas do domínio de aprovação.
 *
 * "/:slug/:token" é genérica o bastante para engolir "/api/social", com
 * slug="api" e token="social". Foi o que aconteceu: a página abria, pedia as
 * peças à API e recebia HTML onde esperava JSON. O navegador mostrava um erro
 * que não dizia nada ao cliente.
 */
describe('rotas do domínio de aprovação',()=>{
 const ler=async()=>JSON.parse(await readFile('vercel.json','utf8')).rewrites as {source:string;has?:{value:string}[];destination:string}[]
 const doAprovar=(r:{has?:{value:string}[]})=>r.has?.some(h=>h.value==='aprovar.svicompany.com.br')

 it('as rotas de API vêm antes da regra genérica',async()=>{
  const rotas=await ler()
  const api=rotas.findIndex(r=>doAprovar(r)&&r.source.startsWith('/api/'))
  const generica=rotas.findIndex(r=>doAprovar(r)&&r.source==='/:slug/:token')
  expect(api,'nenhuma rota de API presa ao domínio de aprovação').toBeGreaterThanOrEqual(0)
  expect(api).toBeLessThan(generica)
 })

 it('a regra genérica está presa ao domínio de aprovação',async()=>{
  // Sem o host, "/:slug/:token" capturaria caminhos da Central inteira.
  for(const r of await ler())
   if(r.source==='/:slug/:token'||r.source==='/:slug/:token/preview.jpg')
    expect(doAprovar(r),`${r.source} precisa estar presa ao host`).toBe(true)
 })
})
