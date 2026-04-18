import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean).join(', ')

  const msg = `Variáveis de ambiente faltando: ${missing}. ` +
    `Configure no Vercel (Settings → Environment Variables) e faça um novo deploy.`

  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background:#0f0f0f;color:#fafafa;font-family:system-ui,sans-serif;">
        <div style="max-width:520px;text-align:center;">
          <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
          <h1 style="font-size:1.25rem;margin-bottom:0.5rem;">Configuração incompleta</h1>
          <p style="color:#a0a0a0;font-size:0.9rem;line-height:1.5;">${msg}</p>
          <p style="color:#666;font-size:0.75rem;margin-top:1.5rem;">SVI.Co · Central</p>
        </div>
      </div>
    `
  }
  throw new Error(msg)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
})
