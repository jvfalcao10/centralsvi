import {describe,it,expect} from 'vitest'
import {agendaShareHTML} from '../../api/_lib/agenda-share'

// João, 09/10: o link no WhatsApp mostrava "Central Svi · Nossa central de
// acompanhamento de clientes", texto do app interno, para um prospect que vai
// marcar reunião.
describe('prévia do link da agenda',()=>{
 const casca=`<!doctype html><html lang="en"><head><title>Central Svi</title>
<meta name="description" content="Nossa central de acompanhamento de clientes">
<meta property="og:title" content="Central Svi">
<meta property="og:image" content="/velha.png">
</head><body><div id="root"></div></body></html>`
 const html=agendaShareHTML(casca)

 it('tira o texto do app interno',()=>{
  expect(html).not.toContain('Nossa central de acompanhamento')
  expect(html).not.toContain('/velha.png')
  expect(html.match(/<title>/g)||[]).toHaveLength(1)
 })

 it('põe título, descrição e banner da agenda',()=>{
  expect(html).toContain('Marque uma conversa com a SVI Company')
  expect(html).toContain('agenda-og.jpg')
  expect(html).toContain('<meta property="og:image:width" content="1200">')
  expect(html).toContain('<meta property="og:image:height" content="630">')
 })

 it('mantém o app, senão a página abriria vazia',()=>{
  expect(html).toContain('<div id="root"></div>')
  expect(html).toContain('lang="pt-BR"')
 })
})
