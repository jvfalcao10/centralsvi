import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAdminClient } from '../../_lib/supabase.js';

/**
 * Acesso PUBLICO do relatorio pelo slug (link que vai pro cliente).
 * Sem login. Usa service role e so devolve relatorios com status = 'published'.
 * Nunca expoe client_id, created_by nem nada interno.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const slug = String(req.query.slug || '').trim();
  if (!slug) return res.status(400).json({ error: 'missing_slug' });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('google_reports')
    .select('slug, client_name, period_label, metrics, analysis, review_messages, status, updated_at')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'load_failed' });
  if (!data) return res.status(404).json({ error: 'not_found' });

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({ report: data });
}
