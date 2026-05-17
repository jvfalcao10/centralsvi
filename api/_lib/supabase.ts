import { createClient } from '@supabase/supabase-js';

// Admin client (service role) — usado em Vercel Functions.
// NUNCA expor pro browser.
export function createAdminClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase env vars (URL or SERVICE_ROLE_KEY)');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Cliente que respeita RLS do user logado (extrai JWT do header Authorization).
 * Usar pra qualquer endpoint que precisa rodar como o user, não como service.
 */
export function createUserClient(authHeader: string | null) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing Supabase env vars (URL or ANON_KEY)');
  }
  const token = authHeader?.replace(/^Bearer\s+/i, '') || '';
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
