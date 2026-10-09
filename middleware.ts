import {next,rewrite} from '@vercel/edge'

/**
 * O domínio da agenda precisa de prévia própria.
 *
 * No Vercel a reescrita do vercel.json só vale DEPOIS da checagem de arquivo,
 * e "/" já casa com o index.html do app, então a regra nunca disparava e o
 * link ia pro prospect com o texto do app interno. O middleware roda antes do
 * arquivo e é o único lugar onde dá para trocar isso.
 *
 * Só o "/" desse domínio passa por aqui. Todo o resto segue direto.
 */
export const config={matcher:['/']}

export default function middleware(req:Request) {
 const url=new URL(req.url)
 if(url.hostname==='agenda.svicompany.com.br')
  return rewrite(new URL('/api/r?__rota=agenda-share',url))
 return next()
}
