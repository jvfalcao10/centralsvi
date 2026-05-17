import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateInsightsForAllClients } from '../../_lib/ai/insights-worker';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const result = await generateInsightsForAllClients();
  return res.status(200).json({ ok: true, ...result });
}

export const config = { maxDuration: 300 };
