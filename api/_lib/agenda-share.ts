import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import type {VercelRequest,VercelResponse} from '@vercel/node'

const SITE='https://agenda.svicompany.com.br'
/** O WhatsApp guarda a prévia por muito tempo: a versão força releitura. */
const IMAGEM=`${SITE}/agenda-og.jpg?v=1`
const TITULO='Marque uma conversa com a SVI Company'
const DESCRICAO='Trinta minutos por chamada de vídeo com João Vitor Falcão, para entender como sua empresa pode atrair mais clientes. Escolha o horário que te serve.'

const esc=(v:string)=>v.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string))

/**
 * A casca do app com a prévia certa.
 *
 * O link ia para o cliente mostrando "Central Svi · Nossa central de
 * acompanhamento de clientes", que é o texto do app interno e não diz nada a
 * quem vai marcar reunião. O WhatsApp não roda JavaScript, então a prévia tem
 * de vir pronta do servidor; trocar no navegador não resolveria.
 */
export function agendaShareHTML(shell:string) {
 const tags=`<title>${esc(TITULO)}</title>
<meta name="description" content="${esc(DESCRICAO)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SVI Company">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(TITULO)}">
<meta property="og:description" content="${esc(DESCRICAO)}">
<meta property="og:url" content="${esc(SITE)}">
<meta property="og:image" content="${esc(IMAGEM)}">
<meta property="og:image:secure_url" content="${esc(IMAGEM)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Agenda da SVI Company para marcar uma conversa de 30 minutos">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(TITULO)}">
<meta name="twitter:description" content="${esc(DESCRICAO)}">
<meta name="twitter:image" content="${esc(IMAGEM)}">`
 return shell
  .replace(/<html\s+lang="[^"]*"/i,'<html lang="pt-BR"')
  .replace(/<title>[\s\S]*?<\/title>/gi,'')
  .replace(/<meta\b[^>]*(?:property|name)=["'](?:og:[^"']*|twitter:[^"']*|description|robots)["'][^>]*>/gi,'')
  .replace('</head>',`${tags}\n</head>`)
}

export async function handleAgendaShare(req:VercelRequest,res:VercelResponse) {
 if(!['GET','HEAD'].includes(req.method||'')){res.setHeader('Allow','GET, HEAD');return res.status(405).end()}
 try{
  const shell=await readFile(join(process.cwd(),'dist/index.html'),'utf8')
  res.setHeader('Content-Type','text/html; charset=utf-8')
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300')
  return req.method==='HEAD'?res.status(200).end():res.status(200).send(agendaShareHTML(shell))
 }catch{
  // Sem a casca, o melhor é deixar o app carregar normalmente.
  return res.status(302).setHeader('Location','/index.html').end()
 }
}
