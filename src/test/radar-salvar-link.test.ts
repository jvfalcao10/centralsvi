import { describe, expect, it } from 'vitest'
import { lerEnderecoDoPost, normalizarUm } from '../../api/_lib/radar-salvar-link'

// João colou https://www.instagram.com/reel/DaVEm67qmCM/?psln=NDBlMm54dmVnMXBo
// no campo do radar em 22/10/2026 e a tela respondeu que não achava o perfil,
// porque a função de perfil lê o primeiro pedaço do endereço e ali ele é "reel".
describe('endereço do post', () => {
  it('lê reel, carrossel, foto e tv, e joga fora o rastreador da query', () => {
    expect(lerEnderecoDoPost('https://www.instagram.com/reel/DaVEm67qmCM/?psln=NDBlMm54dmVnMXBo'))
      .toEqual({ codigo: 'DaVEm67qmCM', url: 'https://www.instagram.com/reel/DaVEm67qmCM/', tipo: 'reel' })
    expect(lerEnderecoDoPost('instagram.com/p/C9xYz_1AbCd/')?.tipo).toBe('post')
    expect(lerEnderecoDoPost('https://instagram.com/reels/AbCdEf123/')?.codigo).toBe('AbCdEf123')
    expect(lerEnderecoDoPost('https://www.instagram.com/drmaurochoi/reel/DaVEm67qmCM/')?.codigo).toBe('DaVEm67qmCM')
  })

  it('recusa o que não é post, inclusive o perfil puro', () => {
    for (const entrada of ['https://www.instagram.com/drmaurochoi/', '@drmaurochoi', 'drmaurochoi', '', 'https://tiktok.com/@x/video/123'])
      expect(lerEnderecoDoPost(entrada)).toBeNull()
  })
})

describe('leitura do post', () => {
  it('vídeo guarda visualização e aponta para /reel/', () => {
    const lido = normalizarUm({
      shortCode: 'DaVEm67qmCM', ownerUsername: 'temulher', type: 'Video',
      videoPlayCount: 182340, likesCount: 9120, commentsCount: 304,
      videoDuration: 41.2, timestamp: '2026-10-19T14:00:00.000Z',
      displayUrl: 'https://scontent.cdninstagram.com/capa.jpg', videoUrl: 'https://v.cdninstagram.com/a.mp4',
      caption: 'o gancho',
    })
    expect(lido).toMatchObject({
      external_id: 'DaVEm67qmCM', handle: 'temulher', tipo: 'video', views: 182340,
      likes: 9120, comments: 304, url: 'https://www.instagram.com/reel/DaVEm67qmCM/',
    })
  })

  // Carrossel e foto não têm visualização no Instagram. Melhor campo vazio do
  // que número inventado: o card mostra curtida e comentário.
  it('carrossel entra sem visualização e aponta para /p/', () => {
    const lido = normalizarUm({
      shortCode: 'C9xYz_1AbCd', ownerUsername: 'drmaurochoi', type: 'Sidecar',
      likesCount: 942, commentsCount: 292, timestamp: '2026-10-18T10:00:00.000Z',
      displayUrl: 'https://scontent.cdninstagram.com/slide1.jpg', caption: '53% das pessoas',
    })
    expect(lido).toMatchObject({ tipo: 'imagem', views: null, likes: 942, comments: 292 })
    expect(lido?.url).toBe('https://www.instagram.com/p/C9xYz_1AbCd/')
  })

  it('devolve nada quando o leitor volta sem código ou sem dono', () => {
    expect(normalizarUm(null)).toBeNull()
    expect(normalizarUm({ shortCode: 'abc' })).toBeNull()
    expect(normalizarUm({ ownerUsername: 'x' })).toBeNull()
  })
})
