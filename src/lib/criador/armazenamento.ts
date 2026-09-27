import { supabase } from '@/lib/supabase'
import type { CarrosselDoc, OpcoesCarrossel, SlideDoc, TemplateId } from '@/data/criador/tipos'

// Rascunhos (tabela criador_carrosseis) e fotos (bucket privado criador-carrossel).
// RLS: só admin lê e escreve (migration 20260927_criador_carrossel.sql).

export const BUCKET = 'criador-carrossel'
const TABELA = 'criador_carrosseis'

export interface RascunhoResumo { id: string; titulo: string | null; template: string; atualizado_em: string }

interface Linha {
  id: string
  titulo: string | null
  template: string
  slides: { slides?: SlideDoc[] } | SlideDoc[] | null
  legenda: string | null
  opcoes: OpcoesCarrossel | null
}

export async function listarRascunhos(): Promise<RascunhoResumo[]> {
  const { data, error } = await supabase.from(TABELA).select('id, titulo, template, atualizado_em').order('atualizado_em', { ascending: false }).limit(100)
  if (error) throw error
  return (data || []) as RascunhoResumo[]
}

export async function carregarRascunho(id: string): Promise<CarrosselDoc> {
  const { data, error } = await supabase.from(TABELA).select('id, titulo, template, slides, legenda, opcoes').eq('id', id).single()
  if (error) throw error
  const l = data as Linha
  const slides = Array.isArray(l.slides) ? l.slides : (l.slides?.slides ?? [])
  return {
    id: l.id, titulo: l.titulo || '', template: l.template as TemplateId, legenda: l.legenda || '',
    slides: slides.map(s => ({ ...s, campos: s.campos || {}, fotos: s.fotos || {} })),
    opcoes: { assinatura: true, ...(l.opcoes || {}) },
  }
}

/** Salva o rascunho. Foto local (blob) não é salva: só foto que já está no bucket (path) ou amostra do app. */
export async function salvarRascunho(doc: CarrosselDoc): Promise<string> {
  const slides = doc.slides.map(s => ({
    ...s,
    fotos: Object.fromEntries(Object.entries(s.fotos).filter(([, f]) => f.path || (f.url && !f.url.startsWith('blob:')))
      .map(([k, f]) => [k, f.path ? { ...f, url: undefined } : f])),
  }))
  const linha = { titulo: doc.titulo || null, template: doc.template, slides, legenda: doc.legenda || null, opcoes: doc.opcoes, atualizado_em: new Date().toISOString() }
  if (doc.id) {
    const { error } = await supabase.from(TABELA).update(linha).eq('id', doc.id)
    if (error) throw error
    return doc.id
  }
  const { data, error } = await supabase.from(TABELA).insert(linha).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function excluirRascunho(id: string) {
  const { error } = await supabase.from(TABELA).delete().eq('id', id)
  if (error) throw error
}

/** Reduz a foto para no máximo 2160 px no lado maior (2x a lâmina) antes de subir. */
async function comprimir(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const maior = Math.max(bitmap.width, bitmap.height)
    if (maior <= 2160 && file.size < 2_500_000) return file
    const k = Math.min(1, 2160 / maior)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * k)
    canvas.height = Math.round(bitmap.height * k)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((ok) => canvas.toBlob(b => ok(b || file), 'image/jpeg', 0.9))
  } catch {
    return file
  }
}

export async function subirFoto(file: File, pasta: string): Promise<string> {
  const blob = await comprimir(file)
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${pasta || 'avulsas'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

/** URLs assinadas (1 hora) para as fotos do bucket privado. */
export async function urlsAssinadas(paths: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(paths.filter(Boolean))]
  if (!unicos.length) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unicos, 3600)
  if (error) throw error
  const out: Record<string, string> = {}
  for (const d of data || []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}
