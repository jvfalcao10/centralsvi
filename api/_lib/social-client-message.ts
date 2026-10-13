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

const NUMERO = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez']
const ORDEM = ['', 'o primeiro', 'o segundo', 'o terceiro', 'o quarto', 'o quinto', 'o sexto', 'o sétimo', 'o oitavo', 'o nono', 'o décimo']
const porExtenso = (n: number) => NUMERO[n] || String(n)
const naOrdem = (n: number) => ORDEM[n] || `o ${n}º`

/** Como chamar a peça na conversa, pelo que o cliente vai abrir. */
export function comoChamar(video: boolean, arquivos: number) {
 if (video) return { um: 'vídeo novo', varios: 'vídeos novos', esse: 'esse vídeo' }
 if (arquivos > 1) return { um: 'carrossel novo', varios: 'carrosséis novos', esse: 'esse carrossel' }
 return { um: 'arte nova', varios: 'artes novas', esse: 'essa arte' }
}

export function mensagemDeAprovacao(p: {
 client: string; title: string; url: string
 altaUrl?: string | null; video?: boolean; arquivos?: number; agora?: number
 /** Posição dentro do lote que vai para o mesmo grupo agora, começando em 1. */
 posicao?: number
 /** Quantas peças vão nesse lote. */
 total?: number
}) {
 // O título do card é escrito para a equipe e carrega data de fila, tag do
 // cliente e jargão de produção. A página de aprovação já limpava isso; a
 // mensagem não, e o cliente lia "Dra Enia · Dra Enia - primeira consulta".
 const video = !!p.video, arquivos = p.arquivos || 1
 const titulo = clientFacingTitle(p.client, p.title, video, arquivos)
 const nome = comoChamar(video, arquivos)
 const total = Math.max(1, p.total || 1)
 const posicao = Math.min(Math.max(1, p.posicao || 1), total)
 const linhas: string[] = []

 // João, 13/10/2026, vendo duas mensagens iguais no grupo da Alpha no mesmo
 // minuto: "pode melhorar dms a Sofia". Duas peças no mesmo lote viravam dois
 // "Boa tarde!" colados, que é a cara de robô despejando arquivo. A saudação
 // abre o lote uma vez; as seguintes continuam a conversa.
 if (posicao === 1) {
  linhas.push(`${saudacao(p.agora)}, pessoal!`, '')
  linhas.push(total === 1
   ? `Separei ${nome.um} pra vocês: *${titulo}*`
   : `Separei ${porExtenso(total)} ${nome.varios} pra vocês. O primeiro é *${titulo}*`)
  linhas.push('', 'Dá uma olhada e me diz se pode ir ou se quer ajustar alguma coisa:', p.url)
 } else {
  const ultima = posicao === total
  linhas.push(ultima && total > 2 ? `E o último é *${titulo}*` : `${naOrdem(posicao)[0].toUpperCase()}${naOrdem(posicao).slice(1)} é *${titulo}*`)
  linhas.push('', 'Aprova ou pede ajuste por aqui:', p.url)
 }

 // O link de alta qualidade entra só quando existe de verdade. Prometer
 // download e mandar endereço que pede acesso é pior que não mandar nada.
 if (p.altaUrl) linhas.push('', posicao === 1 ? 'Se quiser o arquivo em alta qualidade:' : 'Arquivo em alta:', p.altaUrl)
 return linhas.join('\n').trim()
}

/**
 * O aviso de que a peça foi ao ar, com o link do post.
 *
 * João, 13/10/2026: "avisar no grupo quando a peça for ao ar, com o link do
 * post, fecha o ciclo e dá sensação de entrega". Hoje o cliente aprova e
 * nunca mais ouve falar: a entrega acontece e ninguém conta.
 */
export function mensagemNoAr(p: {
 client: string; title: string; url: string
 video?: boolean; arquivos?: number; agora?: number; posicao?: number; total?: number
 /** A peça foi só para o story, que sai do ar em 24h. */
 soStory?: boolean
}) {
 const titulo = clientFacingTitle(p.client, p.title, !!p.video, p.arquivos || 1)
 const total = Math.max(1, p.total || 1)
 const posicao = Math.min(Math.max(1, p.posicao || 1), total)
 // Story sai do ar em 24h, então o aviso diz onde a peça está para o cliente
 // não procurar no feed e não achar.
 const onde = p.soStory ? 'está no ar nos stories' : 'está no ar'
 const linhas: string[] = []
 if (posicao === 1) {
  linhas.push(`${saudacao(p.agora)}, pessoal!`, '')
  linhas.push(total === 1 ? `*${titulo}* ${onde} 🎉` : `Subiu tudo. A primeira é *${titulo}*`)
 } else {
  linhas.push(posicao === total && total > 2 ? `E a última é *${titulo}*` : `Essa é *${titulo}*`)
 }
 if (posicao > 1 && p.soStory) linhas[linhas.length - 1] += ' (nos stories)'
 linhas.push('', p.url)
 return linhas.join('\n').trim()
}
