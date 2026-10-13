import { clientFacingTitle } from './social-client-title.js'

/**
 * A mensagem que o cliente recebe no WhatsApp quando a peça vai para aprovação.
 *
 * Vive sozinha, e não dentro da rota, porque é texto que fala com o cliente:
 * precisa de teste próprio e de um lugar só para mudar.
 */

/**
 * Cumprimento pela hora de Brasília.
 *
 * João, 13/10/2026: "sempre que mandar ter um bom dia ou tarde, não enviar no
 * seco". Mensagem que abre com o nome da peça soa como robô despejando arquivo.
 */
export function saudacao(agora: number = Date.now()) {
 const hora = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', hourCycle: 'h23' }).format(agora))
 if (hora >= 5 && hora < 12) return 'Bom dia'
 if (hora >= 12 && hora < 18) return 'Boa tarde'
 return 'Boa noite'
}

export function mensagemDeAprovacao(p: {
 client: string; title: string; url: string
 altaUrl?: string | null; video?: boolean; arquivos?: number; agora?: number
}) {
 // O título do card é escrito para a equipe e carrega data de fila, tag do
 // cliente e jargão de produção. A página de aprovação já limpava isso; a
 // mensagem não, e o cliente lia "Dra Enia · Dra Enia - primeira consulta".
 const titulo = clientFacingTitle(p.client, p.title, !!p.video, p.arquivos || 1)
 const linhas = [`${saudacao(p.agora)}!`, '', `*${titulo}*`, '',
  'Para aprovar ou pedir alteração, é só abrir:', p.url]
 // O link de alta qualidade entra só quando existe de verdade. Prometer
 // download e mandar endereço que pede acesso é pior que não mandar nada.
 if (p.altaUrl) linhas.push('', 'Se quiser o arquivo em alta qualidade:', p.altaUrl)
 return linhas.join('\n').trim()
}
