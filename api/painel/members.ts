import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createUserClient, createAdminClient } from '../_lib/supabase';
import { humanizeDbError } from '../_lib/errors';

const inviteSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email().max(120),
  role: z.enum(['client_admin', 'client_user']),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }

  const userClient = createUserClient(req.headers.authorization as string | null);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  // Só svi_team pode convidar (RLS bloqueia o insert em painel_members caso contrário)
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  const admin = createAdminClient();
  const appUrl = process.env.VITE_APP_URL || `https://${req.headers.host}`;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  let userId = invited?.user?.id;
  if (!userId) {
    const { data: existing } = await admin.from('profiles').select('user_id').eq('email', parsed.data.email).maybeSingle();
    userId = (existing as any)?.user_id;
  }
  if (!userId) {
    const { message } = humanizeDbError(inviteError as any);
    return res.status(400).json({ error: 'invite_failed', message });
  }

  // Adiciona como painel_member (RLS exige svi_team — admin client ignora RLS mas mantém consistência)
  const { error: memberError } = await admin.from('painel_members').upsert({
    client_id: parsed.data.clientId, user_id: userId, role: parsed.data.role,
  });
  if (memberError) {
    const { code, message } = humanizeDbError(memberError);
    return res.status(400).json({ error: code, message });
  }

  // Adiciona role 'client' em user_roles pra que defaultRouteForRole leve pra /cliente/:slug
  await admin.from('user_roles').upsert({ user_id: userId, role: 'client' }, { onConflict: 'user_id,role' });

  return res.status(200).json({ ok: true });
}
