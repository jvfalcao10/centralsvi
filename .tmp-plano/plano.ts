import { readFileSync, writeFileSync } from 'node:fs'
import { baseDaPeca } from '../api/_lib/social-delivery.js'

const key = readFileSync('/tmp/.srk', 'utf8').trim()
const base = 'https://qvkfcvcqlfamyzgqgnrq.supabase.co/rest/v1'
const h = { apikey: key, Authorization: `Bearer ${key}` }
type C = { id:string; client:string; title:string; stage:string; version:number; created_at:string; assets:{name?:string}[] }
const cards = await (await fetch(`${base}/central_social_cards?select=id,client,title,stage,version,created_at,assets&limit=800`, { headers: h })).json() as C[]

const abertos = cards.filter(c => !['arquivado','postado'].includes(c.stage))
const grupos = new Map<string, C[]>()
for (const c of abertos) {
 const k = `${c.client.toLowerCase().trim()}|${baseDaPeca(c.title)}`
 grupos.set(k, [...(grupos.get(k) || []), c])
}
const plano: {id:string;version:number;title:string;client:string}[] = []
console.log('duplicados ABERTOS pela regra de verdade (fica o mais recente):\n')
for (const [k, vs] of grupos) {
 if (vs.length < 2) continue
 vs.sort((a,b) => a.created_at.localeCompare(b.created_at))
 console.log(k.split('|')[0].toUpperCase())
 for (const c of vs.slice(0,-1)) {
  console.log(`  SAI   ${c.created_at.slice(0,16)} | ${c.stage.padEnd(11)} | ${c.assets.map(a=>a.name).join(', ')}`)
  plano.push({ id: c.id, version: c.version, title: c.title, client: c.client })
 }
 const f = vs.at(-1)!
 console.log(`  fica  ${f.created_at.slice(0,16)} | ${f.stage.padEnd(11)} | ${f.assets.map(a=>a.name).join(', ')}\n`)
}
writeFileSync('/tmp/arquivar.json', JSON.stringify(plano))
console.log('cards a arquivar:', plano.length)
