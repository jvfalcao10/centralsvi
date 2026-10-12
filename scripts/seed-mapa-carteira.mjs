#!/usr/bin/env node
/**
 * Semente do mapa "Carteira SVI · outubro/2026" na tabela mapas_mentais.
 *
 * Lê o markdown da carteira e faz upsert pelo slug. Roda com a service role
 * lida do ambiente em runtime; a chave nunca fica em arquivo.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-mapa-carteira.mjs
 *
 * Variáveis opcionais:
 *   SUPABASE_URL (ou VITE_SUPABASE_URL)  padrão: projeto qvkfcvcqlfamyzgqgnrq
 *   CARTEIRA_MD                          caminho do markdown
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SLUG = 'carteira-svi-outubro-2026'
const TITULO = 'Carteira SVI · outubro/2026'
const PASTA = 'carteira'
const ARQUIVO = process.env.CARTEIRA_MD || '/Users/joao/Dev/cadencia-svi/carteira-src/carteira.md'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qvkfcvcqlfamyzgqgnrq.supabase.co'
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!chave) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY no ambiente. Nada foi gravado.')
  process.exit(1)
}

let markdown
try {
  markdown = readFileSync(ARQUIVO, 'utf8')
} catch (e) {
  console.error(`Não consegui ler ${ARQUIVO}: ${e.message}`)
  process.exit(1)
}

// Garante que a primeira linha é "# <título>", que é a raiz do mapa.
const linhas = markdown.split('\n')
const primeira = linhas.findIndex(l => l.trim())
if (primeira >= 0 && /^#\s+/.test(linhas[primeira])) linhas[primeira] = `# ${TITULO}`
else linhas.unshift(`# ${TITULO}`, '')
markdown = linhas.join('\n')

const supabase = createClient(url, chave, { auth: { persistSession: false } })

const { data, error } = await supabase
  .from('mapas_mentais')
  .upsert({ slug: SLUG, titulo: TITULO, pasta: PASTA, markdown, atualizado_por: null }, { onConflict: 'slug' })
  .select('id, updated_at')
  .single()

if (error) {
  console.error(`Upsert falhou: ${error.message}`)
  process.exit(1)
}

console.log(`Mapa "${TITULO}" gravado.`)
console.log(`  id: ${data.id}`)
console.log(`  slug: ${SLUG}`)
console.log(`  pasta: ${PASTA}`)
console.log(`  tamanho: ${markdown.length} caracteres, ${linhas.length} linhas`)
console.log(`  updated_at (UTC): ${data.updated_at}`)
