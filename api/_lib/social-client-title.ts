// O título da peça é escrito para a equipe, dentro da tarefa do ClickUp, e carrega
// coisas que não são do cliente: a data da fila ("28/09 ·", "AMANHÃ 18h ·"), a tag
// do cliente em colchetes, o formato de produção ("Estático + carrossel:",
// "Carrossel 3 slides ·"), jargão de mídia ("ANUNCIO Meta:") e recado interno entre
// parênteses ("(pedido da diretora)", "(AGOSTO)"). Isso aparecia no card do WhatsApp
// e na página que o cliente abre. Aqui fica a limpeza, num lugar só.

const FORMATOS = 'carross?[eé]is?|carrossel|est[aá]ti[ck]os?|v[ií]deos?|reels?|stor(?:y|ies)|flyer|post|arte|an[uú]ncios?|anuncio|criativos?|tipogr[aá]fico|trend'

function semAcento(value: string) {
 return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function clientFacingTitle(client: string, title: string, video = false, files = 1) {
 // Peça sem cliente ou sem título ainda precisa de um nome, e nunca pode derrubar
 // a página nem a prévia por causa de um campo vazio.
 // O genérico nunca mente: descreve o que a pessoa vai abrir.
 const generico = video ? 'Vídeo para aprovação' : files > 1 ? `Carrossel de ${files} artes para aprovação` : 'Arte para aprovação'
 let t = String(title || '').replace(/\s+/g, ' ').trim()

 // 1. Data ou urgência da fila interna, no começo: "28/09 ·", "HOJE ·", "QUI 24/09 ·", "AMANHÃ 18h ·".
 t = t.replace(/^(?:\p{Lu}{3,}\s+)?(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*)?(?:\d{1,2}h\d{0,2}\s*)?[·\-|–—:]\s*/u, '')
 // 2. Marcador de retrabalho e emoji solto no começo.
 t = t.replace(/^(?:altera[çc][aã]o|refa[çc][aã]o|urgente|novo|v\d+)\s*[·\-|–—:]\s*/i, '')
 // Só emoji e pontuação de separação. Tirar "qualquer coisa que não é letra" comia
 // o "<" de um título hostil e mudava o texto que o escape do preview recebe.
 t = t.replace(/^(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]|[\s·•\-|–—:>]|\p{Zs})+/u, '')
 // 3. Tag do cliente em colchetes: "[COLÉGIO CHRISTO REI]".
 t = t.replace(/^\[[^\]]{2,60}\]\s*[·\-|–—:]?\s*/, '')
 // 4. Sobra de data depois da tag: "[DR BRENNO] Out · Estático · ..."
 t = t.replace(/^(?:\p{Lu}[\p{Ll}]{2}\.?|\d{1,2}\/\d{1,2})\s*[·\-|–—:]\s*/u, '')
 // 5. Formato de produção e jargão de mídia, até os dois pontos ou o ponto médio.
 //    "Estático + carrossel:", "Carrossel 3 slides ·", "Estatico ANUNCIO Meta:".
 const formato = new RegExp(`^(?:(?:${FORMATOS})(?:\\s+[A-Z]{1,4}\\d{0,3}|\\s+\\d{1,3})?(?:\\s+slides?)?(?:\\s+(?:meta|google|feed|ads?|ia))?[\\s+/e,]*){1,4}[·\\-|–—:]\\s*`, 'iu')
 t = t.replace(formato, '')
 // 6. Nome do cliente usado como prefixo: "Alice Salazar - necessaire da mãe".
 const alvo = semAcento(client).replace(/[^a-z0-9]+/g, ' ').trim()
 if (alvo.length > 2) {
  const termos = alvo.split(' ').filter(p => p.length > 2)
  for (const corte of [alvo, ...termos]) {
   const re = new RegExp(`^${corte.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*[·\\-|–—:]\\s*`, 'i')
   if (re.test(semAcento(t))) { t = t.slice(t.length - (semAcento(t).replace(re, '').length)); break }
  }
 }
 // 7. Recado interno no fim: "(pedido da diretora)", "(AGOSTO)", "(ia)", "(versão para...)".
 t = t.replace(/\s*\((?:[^)]{0,60})\)\s*$/u, '').trim()
 t = t.replace(/[\s·\-|–—:]+$/u, '').trim()

 // 8. Se sobrou pouco, ou só o nome do cliente, ou só um formato solto, usa o genérico.
 const nu = semAcento(t).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
 if (nu.length < 4) return generico
 if (nu === alvo || alvo.includes(nu) || new RegExp(`^(?:${FORMATOS})(?:\\s+\\d+)?$`, 'i').test(nu)) return generico
 // "DOUTORA ÉRIKA" para a cliente "Dra. Érika" não diz nada ao cliente: é o nome dele.
 // Tira tratamento e os termos do próprio cliente; se não sobrar assunto, usa o genérico.
 const TRATAMENTO = /^(?:dr|dra|drs|doutor|doutora|sr|sra|clinica|cl[ií]nica|col[ée]gio|espa[çc]o|instituto|centro|dr[ºª]?)$/
 const termosCliente = new Set(alvo.split(' ').filter(Boolean))
 const assunto = nu.split(' ').filter(p => p && !TRATAMENTO.test(p) && !termosCliente.has(p) && !/^\d{1,3}$/.test(p))
 if (!assunto.join('').length || assunto.join('').length < 4) return generico
 if (!/[\p{Ll}]{3}/u.test(t) && t.length < 12) return generico

 return t.charAt(0).toUpperCase() + t.slice(1)
}
