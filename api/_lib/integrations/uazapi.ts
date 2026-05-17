type UazCreds = { base_url: string; instance_token: string };

export async function sendWhatsApp(creds: UazCreds, to: string, text: string) {
  try {
    const res = await fetch(`${creds.base_url}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: creds.instance_token },
      body: JSON.stringify({ number: to, text }),
    });
    return { ok: res.ok, error: res.ok ? undefined : `uazapi_${res.status}` };
  } catch {
    return { ok: false, error: 'uazapi_network' };
  }
}

export type IncomingWhatsApp = {
  from: string; text: string; message_id: string; is_group: boolean; timestamp: number;
};

export function parseUazWebhook(body: any): IncomingWhatsApp | null {
  if (!body) return null;
  const msg = body.message || body.data || body;
  const text = msg?.text || msg?.message?.text || msg?.body || msg?.conversation || '';
  const from = msg?.from || msg?.sender || msg?.key?.remoteJid || msg?.chat_id || '';
  if (!text || !from) return null;
  const isGroup = String(from).includes('@g.us') || !!msg?.is_group;
  if (isGroup) return null;
  const cleanPhone = String(from).replace(/@.*/, '').replace(/\D/g, '');
  return {
    from: cleanPhone, text: String(text).slice(0, 4000),
    message_id: msg?.id || msg?.key?.id || `${Date.now()}`,
    is_group: false, timestamp: Number(msg?.timestamp || Date.now()),
  };
}
