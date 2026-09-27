# Design system por template

> Formato, cores, fontes, zonas e regras de foto de cada template do motor (T5 Tweet, T6 Tweet com imagem, T7 Sistema, T8 Duelo, T9 Quadros, T10 Editorial) e as regras que valem para todos.

## Regras que valem para todos

- Formato 4:5, 1080 x 1350 px, vertical.
- Fundo só preto puro `#000000` ou branco puro `#FFFFFF`. Carvão, cinza e creme foram barrados.
- Acento da casa: dourado do logo SVI `#D0B870`. O azul só existe no selo de verificado.
- No feed, preto e branco se alternam: o carrossel e o estático do mesmo dia saem em cores opostas. A série "Se eu fosse" é toda preta.
- O bloco da lâmina (cabeçalho, texto, imagem) fica centralizado na vertical. Nada colado no topo com vazio embaixo.
- Assinatura "MÉTODO AORTA" no pé das lâminas, discreta (caixa alta, espaçada, cerca de 42% de opacidade).
- Texto nunca em cima de rosto. Imagem nunca cortada: se só cabe cortada, a lâmina fica sem imagem.
- Gerar a imagem já na proporção da caixa onde ela entra.
- Uma foto por lâmina, nenhuma repetida no acervo. Banco de fotos pago da casa (Freepik pelo Magnific).
- Negrito com função: segunda metade da frase, palavra que carrega. Nunca tudo em negrito.
- Sem emoji na arte.

## T5 · Tweet (modelo @clailtonluiz)

Uso: estático de frase (cena, dado de mercado, tweet de negócios) e carrossel de texto puro.
- Fundo branco com texto `#0F1419` e @ em `#6E767D`. Variante preta com texto branco e @ em `#A8A8A8`.
- Margens: 66 px nas laterais, 76 px em cima e embaixo. Bloco centralizado.
- Cabeçalho: foto redonda (78 px no carrossel, 96 px no estático com anel em degradê de story), nome em bold 31 px com selo azul, @ em 27 px. No carrossel, contador NN/NN à direita.
- Capa do carrossel: manchete em caixa alta, condensada, e uma linha de corpo embaixo.
- Corpo: Sora 41 px, entrelinha 1,46, negrito no que carrega.
- Estático de uma frase: a frase é o único elemento e cresce. 66 px até cerca de 110 caracteres, 56 px até 190, 42 px acima disso.
- Card de isca (modelo @doctorcreators): a promessa em cima (44 px), a palavra do comentário grande no meio (Anton 104 px em caixa escura com raio 14) e o que acontece depois embaixo (36 px, cinza). Um CTA só.

## T6 · Tweet com imagem

Uso: carrossel de história em texto corrido com imagem de prova (frameworks A, B, C, D).
- Fundo preto `#000000` com texto branco e @ `#A8A8A8`, ou branco com texto `#0F1419` e @ `#6E767D`.
- Quatro elementos só: avatar, nome, texto, imagem. Sem borda, logo nem contador desenhado.
- Margem lateral 56 px, largura útil 968 px, margem de cima cerca de 94 px, de baixo cerca de 90 px.
- Avatar de 140 px com anel em degradê. Nome em bold 30 px com selo. @ em 26 px.
- Fonte Sora. Título da capa em bold 40 px, até 2 linhas. Corpo regular 35 px, entrelinha 45 px, uma linha em branco entre parágrafos. Negrito só na capa. Nunca caixa alta.
- Imagem abaixo do texto, na mesma largura, altura natural com teto de 560 px, raio 24 px, sombra suave, `contain` (nunca corta). Na capa podem ir duas imagens lado a lado. A lâmina final não tem imagem.
- Quanto mais texto, menor a imagem. Lâmina de 85 a 95 palavras fica com imagem de cerca de 300 px.
- `>` no fim do último parágrafo de toda lâmina menos a final.

## T7 · Sistema (modelo @avilahenrique)

Uso: Método AORTA como sistema (framework E) e série "Se eu fosse" (framework F).
- Fundo preto com grão de papel leve.
- Título em Instrument Serif: 90 px na capa e no fecho, 82 px nas internas, cor `#E8E4DA`. A frase de destaque vai numa caixa dourada `#D0B870` com texto preto.
- Subtítulo em serifa de 36 a 38 px, `#D3CFC6`, logo abaixo do título.
- Coluna única centralizada nos dois eixos.
- Pílula do perfil no topo de todas as lâminas (avatar 44 px, "João Falcão | Marketing Médico", selo) e contador N/10 à direita.
- Etapa: traços de progresso (o ativo em dourado) e rótulo ETAPA 0N DE 05 em Sora 18 px caixa alta.
- Caixa de etapa: borda dourada de 2 px, raio 26, pílulas Sora 24 px, a última dourada cheia.
- Pé: pílula AORTA dourada e barra de progresso.
- Capa com foto na série "Se eu fosse": foto 952 x 640 (3:2), raio 26, sombra, gerada já em 3:2 e em plano aberto. O gancho visual é o objeto que identifica a especialidade. Sem tarja de IA.
- Tipos de lâmina para ritmo visual: busca simulada, bio antes e depois, tela de WhatsApp, linha do tempo, tela dividida, formulário curto, cartão de título.

## T8 · Duelo (modelo @g4.business)

Uso: framework H.
- Casca do T7 (preto com grão, pílula do perfil, contador, pé com AORTA).
- Capa: duas fotos 2:3 lado a lado (466 x 699, raio 26, degradê escuro no pé), os dois títulos em serifa 66 px caixa alta e o VS numa caixa dourada entre eles. Lema em serifa itálica 34 px.
- Duelo: duas fotos 16:9 empilhadas (940 x 529, raio 26, 14 px entre elas). A faixa de legenda fica dentro da foto (fundo preto 84%, raio 14, Sora 27 px) no pé da imagem, longe do rosto. Rótulo do personagem em dourado.
- Convite: caixa clara `#F3F1EC` com texto `#111` na costura das fotos, só no último duelo.
- Fecho: fundo branco puro, título em serifa 72 px com trecho em dourado escuro itálico `#9A7F3A`, apoio Sora 29 px `#444`, foto real do João quadrada com raio 26, CTA em serifa 40 px.
- Personagens por IA: uma foto base 2:3 por personagem, depois cada cena 16:9 com a base como referência, para o rosto ser o mesmo em todos os duelos.

## T9 · Quadros (modelo @alfredosoares)

Uso: estático e carrossel StoryBrand, reflexão de dono. É o formato de feed que o João escolheu.
- Lâmina preta 1080 x 1350 com dois quadros de 1080 x 672 empilhados e 6 px de preto entre eles.
- Os dois quadros são recortes da mesma cena (aberto e fechado), como fotogramas seguidos de um filme.
- Rosto no terço de cima de cada quadro. Legenda no terço de baixo.
- Legenda: Inter Tight 48 px, branca, regular com o trecho forte em bold, centralizada, sombra suave e degradê preto no pé. A frase começa no quadro de cima e fecha no de baixo.
- Sem pílula de perfil. Só a assinatura Método AORTA no pé.
- Fotos com o rosto real do João (fotogramas dos vídeos) ou IA com fotogramas reais como referência. Ver documento 13.

## T10 · Editorial (modelo @leobrf_ em colab com @mkt.insider.ca)

Uso: carrossel de 10 lâminas com cara de revista, posts em colaboração do @joaofalcao.svi com o perfil SVI Médicos.
- Alterna foto escura de ponta a ponta (capa, virada, fecho) com lâmina branca.
- Fontes: Newsreader (serifa) nos títulos e Inter no apoio.
- Capa: foto inteira com degradê escuro no pé, pílulas das duas contas da colab, título em serifa 66 px centralizado, apoio 27 px e "Arrasta para o lado" em itálico.
- Lâmina de foto cheia: título em serifa 62 px alinhado à esquerda no pé, apoio 27 px.
- Lâmina branca: título em serifa 58 px `#111`, apoio 26 px cinza `#555`, frase forte final em serifa 32 px (a pergunta ao leitor), foto em caixa de 952 px com raio 20 e sombra, acima ou abaixo do texto.
- Lâmina de lista: marcadores de 26 px, com faixa de foto de 300 px no topo quando couber.
- Contador N/10 em pílula no canto de cima. Rodapé em pílula clara com a assinatura da colab.
- Fecho: foto escura inteira, pílulas da colab e o convite para seguir.

## Estáticos por cara (quem usa qual template)

- Frase de cena em duas metades: T5 ou T9.
- Dado de mercado: T5 branco, segunda metade em negrito, fecho curto.
- Reflexão de dono: T9 com fotograma real.
- Frase motivadora: fundo branco, frase de 5 a 12 palavras, segunda metade em vermelho, só o @ embaixo, sem foto e sem cabeçalho.
- Tweet de negócios: T5 com cabeçalho, segunda metade em negrito.
