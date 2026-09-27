import type { Campo, FotoCampo, SlideType, TemplateDef, TemplateId } from './tipos'

// Registro dos templates do Criador de Carrossel.
// Fonte da verdade visual: ~/Dev/conteudo-joao/carrosseis/templates.py (motor Python).
// Os limites de caracteres saíram das lâminas reais já publicadas em cada template.

const NEGRITO = 'Use **assim** para negrito.'
const DESTAQUE = 'Use ==assim== para o trecho em destaque dourado.'
const QUEBRA = 'Enter quebra a linha.'

const t = (chave: string, rotulo: string, limite: number, extra: Partial<Campo> = {}): Campo => ({ chave, rotulo, limite, tipo: 'texto', ...extra })
const lista = (chave: string, rotulo: string, limite: number, maxItens: number, extra: Partial<Campo> = {}): Campo => ({ chave, rotulo, limite, maxItens, tipo: 'lista', multiline: true, ...extra })
const foto = (chave: string, rotulo: string, proporcao: string, obrigatoria = true, foco: [number, number] = [50, 30]): FotoCampo => ({ chave, rotulo, proporcao, obrigatoria, foco })
const tipo = (tipo: string, nome: string, descricao: string, campos: Campo[], fotos: FotoCampo[] = []): SlideType => ({ tipo, nome, descricao, campos, fotos, usaFoto: fotos.length > 0 })

const A = (arquivo: string) => `/criador/amostras/${arquivo}`

// ───────────── T10 · Editorial (colab SVI Médicos) ─────────────
const T10: TemplateDef = {
  id: 't10', codigo: 'T10', nome: 'Editorial',
  origem: '@leobrf_ em colaboração com @mkt.insider.ca',
  quandoUsar: 'Ensaio de raciocínio em 10 lâminas, estilo revista: tese, contexto, três exemplos, a virada, pergunta ao leitor e convite para seguir.',
  uso: 'Posts do @joaofalcao.svi em colaboração com @svi.mktmedico.',
  estrutura: ['capa', 'texto', 'texto', 'texto', 'foto', 'foto', 'lista', 'foto', 'texto', 'fecho'],
  assinaturaPadrao: false,
  slideTypes: [
    tipo('capa', 'Capa com foto cheia', 'Foto escura de ponta a ponta, pílulas da colab, título em serifa centralizado, apoio e "Arrasta para o lado".',
      [t('titulo', 'Título', 100, { obrigatorio: true, multiline: true, ajuda: QUEBRA }), t('apoio', 'Apoio', 120, { multiline: true })],
      [foto('fundo', 'Foto de fundo', '1080x1350', true, [55, 20])]),
    tipo('foto', 'Foto cheia (virada)', 'Foto escura inteira com o título em serifa no pé, alinhado à esquerda. Para a virada e o exemplo forte.',
      [t('titulo', 'Título', 100, { obrigatorio: true, multiline: true }), t('apoio', 'Apoio', 170, { multiline: true })],
      [foto('fundo', 'Foto de fundo', '1080x1350', true, [55, 25])]),
    tipo('texto', 'Lâmina branca', 'Título serifado preto, apoio em cinza e foto em caixa arredondada que preenche o espaço que o texto deixa, acima ou abaixo. Sem foto, o texto cresce e centraliza.',
      [t('titulo', 'Título', 130, { obrigatorio: true, multiline: true }), t('apoio', 'Apoio', 200, { multiline: true }),
        t('forte', 'Frase forte (pergunta ao leitor)', 90, { multiline: true }),
        t('onde', 'Posição da foto', 10, { tipo: 'opcao', padrao: 'abaixo', opcoes: [{ valor: 'abaixo', rotulo: 'Foto abaixo do texto' }, { valor: 'acima', rotulo: 'Foto acima do texto' }, { valor: 'sem', rotulo: 'Sem foto' }] })],
      [foto('caixa', 'Foto em caixa', '952 de largura, altura do espaço livre (paisagem)', false, [50, 35])]),
    tipo('lista', 'Lâmina com lista', 'Título, apoio e lista com marcadores. Foto opcional sangrando no topo, ocupando o espaço que o texto deixa.',
      [t('titulo', 'Título', 80, { obrigatorio: true, multiline: true }), t('apoio', 'Apoio', 80),
        lista('itens', 'Itens (um por linha)', 70, 5, { obrigatorio: true })],
      [foto('faixa', 'Foto no topo', '1080 de largura, altura do espaço livre (paisagem)', false, [50, 22])]),
    tipo('fecho', 'Fecho com foto cheia', 'Foto escura, pílulas da colab e o convite para seguir. A data vai no rodapé.',
      [t('titulo', 'Título', 110, { obrigatorio: true, multiline: true })],
      [foto('fundo', 'Foto de fundo', '1080x1350', true, [50, 20])]),
  ],
  exemplo: [
    { tipo: 'capa', campos: { titulo: 'O paciente que mais custa caro para o seu consultório é o que nunca chegou a ligar.', apoio: 'Ele pesquisou, comparou e desistiu antes do primeiro alô. E você nem ficou sabendo.' }, fotos: { fundo: { url: A('terno.jpg'), x: 55, y: 20 } } },
    { tipo: 'texto', campos: { titulo: 'Hoje o paciente consegue pesquisar o seu nome, ler o que outros pacientes escreveram e comparar três médicos antes de marcar.', apoio: 'E quanto mais ele consegue comparar, mais motivos encontra para escolher outro.', onde: 'abaixo' }, fotos: { caixa: { url: A('noite-a.jpg'), x: 70, y: 30 } } },
    { tipo: 'texto', campos: { titulo: 'Durante anos, a indicação bastava. O paciente chegava com o seu nome e ligava direto.', apoio: 'Hoje ele recebe o seu nome e pesquisa antes de ligar. A indicação ganhou uma etapa no meio.', onde: 'acima' }, fotos: { caixa: { url: A('reuniao.jpg'), x: 50, y: 18 } } },
    { tipo: 'texto', campos: { titulo: 'O primeiro lugar em que isso acontece é o Google. Ele digita o que sente e aparecem três nomes.', apoio: 'O horário, a foto e a resposta ao último comentário de paciente contam antes do seu currículo.', onde: 'acima' }, fotos: { caixa: { url: A('noite-b.jpg'), x: 50, y: 40 } } },
    { tipo: 'foto', campos: { titulo: 'Só que existe um detalhe: o paciente decide em silêncio.', apoio: '' }, fotos: { fundo: { url: A('perfil.jpg'), x: 55, y: 25 } } },
    { tipo: 'foto', campos: { titulo: 'O segundo lugar é o WhatsApp.', apoio: 'Ele pergunta o valor às 22h. Se a resposta chega no dia seguinte, ou vem um "só pessoalmente", ele já está conversando com outro consultório.' }, fotos: { fundo: { url: A('board-a.jpg'), x: 55, y: 30 } } },
    { tipo: 'lista', campos: { titulo: 'Agora, o terceiro ponto é o mais silencioso.', apoio: 'Porque ele acontece depois da consulta:', itens: 'o retorno que ficou para depois e ninguém marcou\no exame pedido que o paciente nunca trouxe\na indicação que ele faria, se alguém tivesse pedido\no comentário que ele escreveria, se alguém tivesse lembrado' }, fotos: { faixa: { url: A('consulta.jpg'), x: 50, y: 30 } } },
    { tipo: 'foto', campos: { titulo: 'Percebe o padrão? A sua medicina continua a mesma. O paciente se perde no caminho até ela.', apoio: 'Na pesquisa, na primeira mensagem e no retorno. São três momentos em que ninguém do consultório está olhando, e é justamente ali que o paciente desiste sem avisar.' }, fotos: { fundo: { url: A('caderno.jpg'), x: 50, y: 0 } } },
    { tipo: 'texto', campos: { titulo: 'O caminho tem conserto, e começa por olhar para ele.', apoio: 'Pesquise hoje a sua especialidade com a sua cidade, mande uma mensagem para o seu WhatsApp como se fosse paciente e veja quantos retornos do último mês foram marcados.', forte: 'Em qual desses três pontos o seu consultório perde mais gente?', onde: 'abaixo' }, fotos: { caixa: { url: A('board-b.jpg'), x: 55, y: 30 } } },
    { tipo: 'fecho', campos: { titulo: 'Se esse tipo de conteúdo faz sentido para você, segue o perfil para acompanhar os próximos.' }, fotos: { fundo: { url: A('joao-up.jpg'), x: 50, y: 20 } } },
  ],
}

// ───────────── T9 · Quadros ─────────────
const T9: TemplateDef = {
  id: 't9', codigo: 'T9', nome: 'Quadros',
  origem: '@alfredosoares',
  quandoUsar: 'Reflexão de dono em frases curtas: dois fotogramas da mesma cena por lâmina, cada um com uma linha de legenda de cinema. A frase só fecha no segundo quadro.',
  estrutura: ['quadros', 'quadros', 'quadros', 'quadros', 'quadros', 'quadros'],
  assinaturaPadrao: true,
  slideTypes: [
    tipo('quadros', 'Dois quadros', 'Dois fotogramas empilhados (1080x672 cada), legenda no terço de baixo de cada um. Parte da frase em negrito.',
      [t('linhaA', 'Legenda do quadro de cima', 70, { obrigatorio: true, ajuda: NEGRITO }), t('linhaB', 'Legenda do quadro de baixo', 70, { obrigatorio: true, ajuda: NEGRITO }),
        t('cta', 'Botão no quadro de baixo (opcional)', 30)],
      [foto('a', 'Quadro de cima', '1080x672', true, [50, 35]), foto('b', 'Quadro de baixo', '1080x672', true, [50, 35])]),
  ],
  exemplo: [
    { tipo: 'quadros', campos: { linhaA: 'Às 22h, com dor, **o paciente não liga para ninguém.**', linhaB: '**Ele pega o celular e pesquisa no Google.**' }, fotos: { a: { url: A('noite-a.jpg'), x: 100, y: 50 }, b: { url: A('noite-a.jpg'), x: 100, y: 19, z: 1.3 } } },
    { tipo: 'quadros', campos: { linhaA: 'Aparecem três médicos, **com estrelas e comentários de pacientes.**', linhaB: '**Ele escolhe um deles ali mesmo.**' }, fotos: { a: { url: A('noite-b.jpg'), x: 100, y: 50 }, b: { url: A('noite-b.jpg'), x: 72, y: 80, z: 1.3 } } },
    { tipo: 'quadros', campos: { linhaA: 'Se o seu nome não está nessa lista, **ele nem sabe que você existe.**', linhaB: '**E marca com quem apareceu.**' }, fotos: { a: { url: A('reuniao.jpg'), x: 50, y: 24 }, b: { url: A('faixa.jpg'), x: 50, y: 24, z: 1.25 } } },
    { tipo: 'quadros', campos: { linhaA: 'Quer saber o que o paciente encontra **quando pesquisa você?**', linhaB: '**Comenta RAIO-X que eu te mando.**' }, fotos: { a: { url: A('board-a.jpg'), x: 60, y: 30, z: 1.18 }, b: { url: A('board-a.jpg'), x: 60, y: 30, z: 1.5 } } },
  ],
}

// ───────────── T7 · Sistema ─────────────
const T7: TemplateDef = {
  id: 't7', codigo: 'T7', nome: 'Sistema',
  origem: '@avilahenrique ("A nova forma de conseguir clientes")',
  quandoUsar: 'Série "Se eu fosse" e método em etapas: frase grande que puxa a próxima, apoio pequeno, caixa de lista só quando a lista é o valor. Fundo preto com grão, serifa e caixa dourada.',
  estrutura: ['capa_foto', 'frase', 'duas_buscas', 'frase', 'cartao', 'frase', 'frase', 'whats', 'frase', 'fecho'],
  assinaturaPadrao: true,
  slideTypes: [
    tipo('capa_foto', 'Capa com foto', 'Rótulo da série, título com destaque dourado, foto em caixa e "arrasta pro lado".',
      [t('rotulo', 'Rótulo da série', 30), t('titulo', 'Título', 80, { obrigatorio: true, multiline: true, ajuda: `${DESTAQUE} ${QUEBRA}` }), t('sub', 'Subtítulo', 120, { multiline: true })],
      [foto('capa', 'Foto da capa', '952x640', true, [50, 30])]),
    tipo('frase', 'Frase grande', 'Uma frase grande centralizada, apoio pequeno e, só quando a lista é o valor, uma caixa com pílulas.',
      [t('titulo', 'Frase', 110, { obrigatorio: true, multiline: true, ajuda: `${DESTAQUE} ${QUEBRA}` }), t('apoio', 'Apoio', 160, { multiline: true }),
        t('caixaTitulo', 'Título da caixa', 40), lista('itens', 'Pílulas da caixa (uma por linha)', 50, 5), t('miudo', 'Nota miúda da caixa', 90)]),
    tipo('duas_buscas', 'Duas buscas', 'Barras de busca empilhadas com o que o paciente digita.',
      [t('titulo', 'Frase', 60, { obrigatorio: true, multiline: true }), lista('consultas', 'Buscas (uma por linha)', 40, 3, { obrigatorio: true }), t('apoio', 'Apoio', 120, { multiline: true })]),
    tipo('busca', 'Busca com resultados', 'Barra de busca e até três resultados. Cada linha: título | descrição | estrelas (opcional).',
      [t('titulo', 'Frase', 70, { obrigatorio: true, multiline: true }), t('consulta', 'Busca digitada', 40, { obrigatorio: true }), lista('resultados', 'Resultados (título | descrição | estrelas)', 110, 3), t('apoio', 'Apoio', 110)]),
    tipo('whats', 'Tela de WhatsApp', 'Conversa curta. Cada linha começa com P: (paciente) ou C: (consultório). Hora opcional no fim entre parênteses.',
      [t('titulo', 'Frase', 60, { obrigatorio: true, multiline: true }), lista('mensagens', 'Mensagens (P: ou C:)', 140, 4, { obrigatorio: true }), t('apoio', 'Apoio', 110)]),
    tipo('cartao', 'Cartão de título', 'Cartão branco com um título de post, para comparar duas maneiras de dizer a mesma coisa.',
      [t('titulo', 'Frase', 60, { obrigatorio: true, multiline: true }), t('rotulo', 'Rótulo do cartão', 20), t('texto', 'Texto do cartão', 90, { obrigatorio: true }), t('apoio', 'Apoio', 130)]),
    tipo('linha', 'Linha do tempo', 'Pontos na horizontal com rótulos. Comece um item com * para deixá-lo dourado.',
      [t('titulo', 'Frase', 70, { obrigatorio: true, multiline: true }), lista('etapas', 'Etapas (uma por linha)', 22, 6, { obrigatorio: true }), t('apoio', 'Apoio', 120)]),
    tipo('dividida', 'Tela dividida', 'Dois lados com rótulo e frases curtas.',
      [t('titulo', 'Frase', 60, { obrigatorio: true, multiline: true }), t('rotuloEsq', 'Rótulo da esquerda', 20), lista('esquerda', 'Frases da esquerda', 40, 4),
        t('rotuloDir', 'Rótulo da direita', 20), lista('direita', 'Frases da direita', 40, 4), t('apoio', 'Apoio', 110)]),
    tipo('fecho', 'Fechamento', 'Primeira linha, segunda maior na caixa dourada, pílulas opcionais e a chamada.',
      [t('linha1', 'Primeira linha', 50, { obrigatorio: true }), t('linha2', 'Segunda linha (caixa dourada)', 70, { obrigatorio: true, multiline: true, ajuda: QUEBRA }),
        lista('pilulas', 'Pílulas (opcional)', 30, 5), t('cta', 'Chamada', 150, { multiline: true }), t('cta2', 'Chamada secundária', 100)]),
  ],
  exemplo: [
    { tipo: 'capa_foto', campos: { rotulo: 'Se eu fosse… | ep. 01', titulo: '==Se eu fosse urologista,==\nfaria isso para atrair\nmais pacientes.', sub: '' }, fotos: { capa: { url: A('reuniao.jpg'), x: 50, y: 20 } } },
    { tipo: 'frase', campos: { titulo: 'Eu começaria fazendo uma busca\nque não leva o meu nome.', apoio: 'Do jeito que o paciente faz: no celular, sem login, com a palavra dele.' }, fotos: {} },
    { tipo: 'duas_buscas', campos: { titulo: 'Duas portas.\nEu conferiria as duas.', consultas: 'urologista em [cidade]\ndor pra urinar homem', apoio: 'Uma pede a especialidade, a outra pede uma resposta.' }, fotos: {} },
    { tipo: 'frase', campos: { titulo: 'O que eu olharia em cada resultado.', apoio: 'O Google ordena por relevância, distância e destaque. Eu cuido do que está escrito.', itens: 'endereço certo\nhorário de verdade\no que você atende, em uma linha\num próximo passo: telefone, WhatsApp ou agenda' }, fotos: {} },
    { tipo: 'whats', campos: { titulo: 'Quando perguntam o valor,\neu responderia.', mensagens: 'P: Boa noite, qual o valor da consulta? (21h12)\nC: Boa noite! A consulta particular custa R$ [valor]. Posso ver os horários disponíveis pra você? (21h13)\nP: Pode sim. (21h13)', apoio: 'Preço respondido, próximo passo oferecido. Sem negociação.' }, fotos: {} },
    { tipo: 'fecho', campos: { linha1: 'Se eu fosse urologista,', linha2: 'começaria pela busca\nque não leva o meu nome.', cta: 'Quer essa busca feita com o seu nome e a sua especialidade? Comenta RAIO-X que eu te mando o retrato.' }, fotos: {} },
  ],
}

// ───────────── T8 · Duelo ─────────────
const T8: TemplateDef = {
  id: 't8', codigo: 'T8', nome: 'Duelo',
  origem: '@g4.business ("Vendedor preguiçoso vs Vendedor insuportável")',
  quandoUsar: 'Dois personagens na mesma situação, um comportamento por lâmina. O contraste é de comportamento, nunca de valor da pessoa. 6 lâminas.',
  estrutura: ['capa', 'duelo', 'duelo', 'duelo', 'duelo', 'fecho'],
  assinaturaPadrao: true,
  slideTypes: [
    tipo('capa', 'Capa dividida', 'Duas fotos lado a lado, os dois nomes em serifa caixa alta com o VS dourado e um lema.',
      [t('esquerda', 'Lado A', 22, { obrigatorio: true, multiline: true }), t('direita', 'Lado B', 22, { obrigatorio: true, multiline: true }), t('lema', 'Lema', 50)],
      [foto('a', 'Foto do lado A', '466x699', true, [50, 25]), foto('b', 'Foto do lado B', '466x699', true, [50, 25])]),
    tipo('duelo', 'Duelo', 'Foto A em cima e foto B embaixo, com a faixa de legenda no pé de cada foto (rótulo dourado e frase).',
      [t('rotuloA', 'Rótulo A', 22, { obrigatorio: true }), t('textoA', 'Frase A', 130, { obrigatorio: true }), t('rotuloB', 'Rótulo B', 22, { obrigatorio: true }), t('textoB', 'Frase B', 130, { obrigatorio: true }),
        t('convite', 'Convite (caixa clara no pé)', 70),
        t('posA', 'Faixa da foto A', 5, { tipo: 'opcao', padrao: 'base', opcoes: [{ valor: 'base', rotulo: 'No pé da foto' }, { valor: 'topo', rotulo: 'No topo da foto' }] }),
        t('posB', 'Faixa da foto B', 5, { tipo: 'opcao', padrao: 'base', opcoes: [{ valor: 'base', rotulo: 'No pé da foto' }, { valor: 'topo', rotulo: 'No topo da foto' }] })],
      [foto('a', 'Foto A', '940x529', true, [50, 30]), foto('b', 'Foto B', '940x529', true, [50, 30])]),
    tipo('fecho', 'Fecho claro', 'Fundo branco, título em serifa com trecho dourado em itálico, apoio, foto e chamada.',
      [t('titulo', 'Título', 90, { obrigatorio: true, multiline: true, ajuda: `${DESTAQUE} ${QUEBRA}` }), t('sub', 'Apoio', 130, { multiline: true }), t('cta', 'Chamada', 70, { obrigatorio: true })],
      [foto('foto', 'Foto real do João', '520x520', true, [50, 30])]),
  ],
  exemplo: [
    { tipo: 'capa', campos: { esquerda: 'Médico\nocupado', direita: 'Médico\nprocurado', lema: 'De qual lado está o seu perfil?' }, fotos: { a: { url: A('noite-a.jpg'), x: 60, y: 30 }, b: { url: A('terno.jpg'), x: 50, y: 20 } } },
    { tipo: 'duelo', campos: { rotuloA: 'Médico ocupado:', textoA: 'o paciente pesquisa o sintoma no Google e encontra o perfil dele com o horário antigo e nenhuma foto do consultório.', rotuloB: 'Médico procurado:', textoB: 'o perfil no Google tem o horário certo, fotos da recepção e resposta nos comentários dos pacientes.', posA: 'base', posB: 'base' }, fotos: { a: { url: A('noite-b.jpg'), x: 50, y: 30 }, b: { url: A('board-a.jpg'), x: 50, y: 30 } } },
    { tipo: 'duelo', campos: { rotuloA: 'Médico ocupado:', textoA: 'a mensagem que o paciente mandou às 22h fica sem resposta até alguém lembrar.', rotuloB: 'Médico procurado:', textoB: 'a mensagem da noite tem resposta cedo, com o próximo horário livre.', convite: 'Qual dos dois o paciente encontra quando pesquisa você?', posA: 'base', posB: 'base' }, fotos: { a: { url: A('noite-a.jpg'), x: 50, y: 30 }, b: { url: A('board-b.jpg'), x: 50, y: 30 } } },
    { tipo: 'fecho', campos: { titulo: 'Os dois atendem bem.\n==Só um deixou isso visível\nantes da consulta.==', sub: 'O RAIO-X mostra o que o paciente encontra sobre você hoje no Google, no ChatGPT e no seu Instagram.', cta: 'Comenta RAIO-X que eu te mando o retrato.' }, fotos: { foto: { url: A('joao-up.jpg'), x: 50, y: 30 } } },
  ],
}

// ───────────── T6 · Tweet com imagem ─────────────
const T6: TemplateDef = {
  id: 't6', codigo: 'T6', nome: 'Tweet com imagem',
  origem: '@oestevaosouza',
  quandoUsar: 'História contada em cards de texto com uma imagem colada no pé (ou duas lado a lado). Frameworks A, B, C e D. Termina cada card com ">", menos o último.',
  estrutura: ['capa', 'card', 'card', 'card', 'card', 'card', 'card', 'fim'],
  fundoPadrao: 'preto',
  assinaturaPadrao: true,
  slideTypes: [
    tipo('capa', 'Capa', 'Título e subtítulo em negrito, promessa em regular terminando em ">", uma ou duas imagens.',
      [t('titulo', 'Título (negrito)', 90, { obrigatorio: true }), t('subtitulo', 'Subtítulo (negrito)', 90), t('promessa', 'Promessa', 90, { obrigatorio: true })],
      [foto('a', 'Imagem', '968x420', true, [50, 40]), foto('b', 'Segunda imagem (opcional)', '476x420', false, [50, 40])]),
    tipo('card', 'Card com imagem', 'Parágrafos (linha em branco separa) e imagem no pé ocupando o que sobra.',
      [t('texto', 'Texto', 330, { obrigatorio: true, multiline: true, ajuda: 'Linha em branco separa parágrafos.' })],
      [foto('a', 'Imagem', '968x420', false, [50, 40]), foto('b', 'Segunda imagem (opcional)', '476x420', false, [50, 40])]),
    tipo('fim', 'Card final', 'Sem imagem, centralizado, sem ">".',
      [t('texto', 'Texto', 400, { obrigatorio: true, multiline: true, ajuda: 'Linha em branco separa parágrafos.' })]),
  ],
  exemplo: [
    { tipo: 'capa', campos: { titulo: 'Às 22h, com dor, o paciente não compara currículos.', subtitulo: 'Escolhe entre os três que o Google mostrou na primeira tela.', promessa: 'O que acontece nos minutos entre a dor e a ligação' }, fotos: { a: { url: A('noite-a.jpg'), x: 50, y: 40 } } },
    { tipo: 'card', campos: { texto: 'Eu faço essa busca em cidade atrás de cidade, no celular, sem login, do jeito que o paciente faz.\n\nA primeira tela vem inteira de nomes de consultório. Nenhum site aparece antes deles' }, fotos: { a: { url: A('noite-b.jpg'), x: 50, y: 40 } } },
    { tipo: 'fim', campos: { texto: 'Agora coloca o seu nome nessa busca. Especialidade e a sua cidade, no celular, sem login.\n\nVocê aparece nos três? Se aparece, o que ele vê quando abre?' }, fotos: {} },
  ],
}

// ───────────── T5 · Tweet ─────────────
const T5: TemplateDef = {
  id: 't5', codigo: 'T5', nome: 'Tweet',
  origem: '@clailtonluiz',
  quandoUsar: 'Opinião em cards de texto puro, cabeçalho de perfil com selo e contador. Manchete condensada só na capa, negrito só no que carrega a frase.',
  estrutura: ['capa', 'texto', 'texto', 'texto', 'texto', 'texto', 'texto', 'texto', 'texto', 'isca'],
  fundoPadrao: 'branco',
  assinaturaPadrao: true,
  slideTypes: [
    tipo('capa', 'Capa com manchete', 'Manchete condensada em caixa alta (até 4 linhas) e uma linha de corpo.',
      [t('manchete', 'Manchete', 90, { obrigatorio: true }), t('corpo', 'Corpo', 120, { ajuda: NEGRITO })]),
    tipo('texto', 'Card de texto', 'Cabeçalho e parágrafos. Linha em branco separa parágrafos, Enter simples empilha linhas.',
      [t('texto', 'Texto', 420, { obrigatorio: true, multiline: true, ajuda: `${NEGRITO} Linha em branco separa parágrafos.` })]),
    tipo('isca', 'Card de isca', 'A promessa, a palavra grande para comentar e o que acontece depois.',
      [t('chamada', 'Chamada', 140, { obrigatorio: true, multiline: true, ajuda: NEGRITO }), t('palavra', 'Palavra', 12, { obrigatorio: true }), t('detalhe', 'Detalhe', 110)]),
  ],
  exemplo: [
    { tipo: 'capa', campos: { manchete: '"É um absurdo um médico pior que eu aparecer na minha frente no Google."', corpo: 'Ok. Então faz o seguinte: preenche.' }, fotos: {} },
    { tipo: 'texto', campos: { texto: 'Abre o seu perfil do Google.\nConfere a categoria.\nBota o endereço certo.\n\nAgora **responde avaliação**,\nposta **foto de dentro**,\nescreve **o que você trata**.' }, fotos: {} },
    { tipo: 'isca', campos: { chamada: 'Quer saber o que o paciente encontra quando pesquisa **o seu nome**? Comenta a palavra:', palavra: 'RAIO-X', detalhe: 'Eu te mando o retrato do que aparece hoje.' }, fotos: {} },
  ],
}

export const TEMPLATES: TemplateDef[] = [T10, T9, T7, T8, T6, T5]

export const TEMPLATE_POR_ID: Record<TemplateId, TemplateDef> = Object.fromEntries(TEMPLATES.map(tp => [tp.id, tp])) as Record<TemplateId, TemplateDef>

export function tipoDoSlide(template: TemplateId, tipo: string): SlideType | undefined {
  return TEMPLATE_POR_ID[template]?.slideTypes.find(s => s.tipo === tipo)
}

export const TEMPLATE_IDS = TEMPLATES.map(tp => tp.id) as [TemplateId, ...TemplateId[]]
