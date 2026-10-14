import { describe, it, expect } from 'vitest'
import { videoParaArquivo } from '../../api/_lib/social-sync-domain'
import { versaoDoNome } from '../../api/_lib/social-drive'

// João, 14/10/2026: "vídeos que a Sarah também envia e eu envio nos grupos dos
// clientes, também é pra subir pro Drive" e "no Drive tá v1 e v2, quero somente
// o vídeo que de fato foi o último".
const GRUPO = '120363401223133759@g.us'
const msg = (extra: Record<string, unknown> = {}) => ({
  chatid: GRUPO, sender: '43229013668067@lid', id: 'ABC123', messageTimestamp: 1792378740,
  messageType: 'DocumentMessage',
  content: { fileName: 'Alpha - treino v2.MP4', mimetype: 'video/mp4', fileLength: 19854446 },
  ...extra,
})

describe('vídeo do grupo do cliente que vai pro Drive', () => {
  it('aceita o que o João manda', () => {
    const r = videoParaArquivo(msg(), GRUPO, 'Alpha Fitness')
    expect(r?.payload.client).toBe('Alpha Fitness')
    expect(r?.payload.name).toBe('Alpha - treino v2.MP4')
    expect(r?.payload.arquivo_apenas).toBe(true)
  })

  it('aceita o que a Sarah manda', () =>
    expect(videoParaArquivo(msg({ sender: '13868852076575@lid' }), GRUPO, 'Alpha Fitness')).toBeTruthy())

  it('ignora o cliente e qualquer outro número', () => {
    expect(videoParaArquivo(msg({ sender: '5594111111111@s.whatsapp.net' }), GRUPO, 'Alpha Fitness')).toBeNull()
    expect(videoParaArquivo(msg({ sender: '50217076449517@lid' }), GRUPO, 'Alpha Fitness'), 'Math entra pela fonte dele').toBeNull()
  })

  // O que o robô manda já está no Drive: reentrar seria cópia.
  it('ignora o que saiu pela própria API', () =>
    expect(videoParaArquivo(msg({ wasSentByApi: true }), GRUPO, 'Alpha Fitness')).toBeNull())

  it('ignora o que não é vídeo', () => {
    expect(videoParaArquivo(msg({ messageType: 'DocumentMessage',
      content: { fileName: 'Comprovante.pdf', mimetype: 'application/pdf' } }), GRUPO, 'Alpha Fitness')).toBeNull()
  })

  // Sem nome não dá pra saber qual peça é nem qual versão ele substitui.
  it('ignora vídeo sem nome de arquivo', () =>
    expect(videoParaArquivo(msg({ content: { mimetype: 'video/mp4', fileLength: 10 } }), GRUPO, 'Alpha Fitness')).toBeNull())

  // Virar card faria a Sofia reenviar a peça para o mesmo grupo de onde ela veio.
  it('marca que é arquivo e nunca peça do quadro', () => {
    const r = videoParaArquivo(msg(), GRUPO, 'Alpha Fitness')!
    expect(r.card_id.startsWith('arquivo-')).toBe(true)
    expect(r.key.startsWith('arq:')).toBe(true)
  })
})

describe('versão escrita no nome do arquivo', () => {
  it('lê o vN do fim do nome', () => {
    expect(versaoDoNome('Dr Brenno - vídeo 01 - outubro v2.MP4')).toMatchObject({ versao: 2 })
    expect(versaoDoNome('soraia - tons de rosa v4.mov').versao).toBe(4)
    expect(versaoDoNome('Alpha - outubro rosa.MP4').versao).toBe(1)
  })

  it('a base ignora acento, caixa e pontuação, que é como os nomes variam na prática', () => {
    expect(versaoDoNome('Norte Capital - video 02 .MP4').base)
      .toBe(versaoDoNome('Norte Capital - vídeo 02 v2.MP4').base)
  })

  // A decisão do João: só marcador explícito. LEGENDADO, CAPTIONS e FINAL NÃO
  // contam, porque juntar por semelhança arrisca apagar peça distinta.
  it('não trata etapa de edição como versão', () => {
    const a = versaoDoNome('01_idoso-teimoso_LEGENDADO.mp4')
    const b = versaoDoNome('01_idoso-teimoso_FINAL.mp4')
    expect(a.versao).toBe(1)
    expect(b.versao).toBe(1)
    expect(a.base).not.toBe(b.base)
  })

  it('peça diferente nunca compartilha base', () => {
    expect(versaoDoNome('Dra Esia - pré-natal v2.MP4').base)
      .not.toBe(versaoDoNome('Dra Esia - outubro rosa v3.MP4').base)
  })
})

// Achado na primeira volta, 14/10: o grupo chama a cliente de "Dra. Erika
// Figueiredo" e o quadro chama de "DRA ERIKA FIGUEIREDO". Sem alinhar, o mesmo
// cliente abre duas pastas no Drive no mesmo mês.
describe('nome da pasta do cliente', () => {
  const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const resolver = (nome: string, catalogo: string[]) => {
    const alvo = normalizar(nome)
    const exato = catalogo.find(c => normalizar(c) === alvo)
    if (exato) return exato
    const parciais = catalogo.filter(c => normalizar(c).includes(alvo) || alvo.includes(normalizar(c)))
    return parciais.length === 1 ? parciais[0] : nome
  }
  const CATALOGO = ['DRA ERIKA FIGUEIREDO', 'DRA. ÉSIA LOPES', 'Dra Enia', 'SPA NATURE', 'ALPHA FITNESS']

  it('casa ignorando acento, caixa e pontuação', () =>
    expect(resolver('Dra. Erika Figueiredo', CATALOGO)).toBe('DRA ERIKA FIGUEIREDO'))

  it('casa quando o quadro usa o nome mais longo', () =>
    expect(resolver('Dra. Ésia', CATALOGO)).toBe('DRA. ÉSIA LOPES'))

  it('empate não vira chute, fica o nome do grupo', () =>
    expect(resolver('Dra', ['Dra Enia', 'Dra Erika'])).toBe('Dra'))

  it('cliente que o quadro não conhece fica com o nome do grupo', () =>
    expect(resolver('Aerojet', CATALOGO)).toBe('Aerojet'))
})
