/**
 * Quando a Sofia cumprimenta, e quando ela só continua a conversa.
 *
 * João, 15/10/2026, com o grupo da Alpha na tela: às 08:05 ela mandou
 * "Bom dia, pessoal! Separei vídeo novo pra vocês", o cliente conversou por
 * duas horas, pediu ajuste, aprovou, e às 10:55 ela voltou com "Bom dia,
 * pessoal! Dia do professor está no ar". Dois bons dias na mesma manhã, no
 * mesmo grupo, com conversa no meio. Pessoa nenhuma faz isso.
 *
 * A decisão é no ENVIO, não na hora de enfileirar: a mensagem pode ficar
 * minutos na fila, e quem responde isso é o estado do grupo na hora de falar.
 */
const UAZ = 'https://svicompany.uazapi.com'

/** O cumprimento que a casa usa, sempre na primeira linha e sozinho. */
const SAUDACAO = /^(Bom dia|Boa tarde|Boa noite)[^\n]{0,20}!\s*\n\n/

export function semSaudacao(texto: string) {
 const limpo = String(texto || '').replace(SAUDACAO, '')
 // Se sobrar texto, usa o texto sem cumprimento. Mensagem que É só o
 // cumprimento continua inteira, porque vazia não serve.
 return limpo.trim() ? limpo : texto
}

/** Hoje em Brasília, no formato aaaa-mm-dd. */
const diaDeBrasilia = (ms: number) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10)

/**
 * A Sofia já falou nesse grupo hoje?
 *
 * Lê o histórico do próprio WhatsApp em vez de guardar estado: é a mesma fonte
 * que a pessoa olharia, e não há o que dessincronizar. Falha de leitura devolve
 * `false`, ou seja, cumprimenta: repetir um bom dia é menos ruim que abrir uma
 * mensagem no seco.
 */
export async function jaFalamosHoje(jid: string, agora = Date.now(), prazo = 10000) {
 const token = process.env.SOCIAL_UAZ_TOKEN || ''
 if (!token || !jid) return false
 try {
  const r = await fetch(UAZ + '/message/find', {
   method: 'POST', headers: { token, 'Content-Type': 'application/json' },
   body: JSON.stringify({ chatid: jid, limit: 30, offset: 0 }),
   signal: AbortSignal.timeout(prazo),
  })
  if (!r.ok) return false
  const d = await r.json() as { messages?: Record<string, unknown>[] }
  if (!Array.isArray(d.messages)) return false
  const hoje = diaDeBrasilia(agora)
  return d.messages.some(m => {
   if (!m.fromMe) return false
   const bruto = Number(m.messageTimestamp)
   if (!Number.isFinite(bruto) || bruto <= 0) return false
   return diaDeBrasilia(bruto < 1e12 ? bruto * 1000 : bruto) === hoje
  })
 } catch { return false }
}
