// Moldes de post e os posts feitos em cada um. Arquivo GERADO por conteudo-joao/carrosseis/exportar_moldes_central.py:
// não editar à mão, rodar o exportador de novo. Lista = molde. Lâminas em public/moldes (540x675, webp).

export interface Molde { id: string; nome: string; descricao: string; opcoes: string; tipo: string }
export interface PostMolde { id: string; molde: string; cliente: string; titulo: string; laminas: string[] }

export const MOLDES: Molde[] = [
  {
    "id": "tweet",
    "nome": "Tweet",
    "descricao": "Post no formato do X: perfil, frase e, se quiser, foto ou print embaixo. Um molde só, o que muda é a copy.",
    "opcoes": "Opções: fundo preto ou branco · sem mídia, foto ou print · 1 lâmina ou carrossel · destaque colorido",
    "tipo": "carrossel e estático"
  },
  {
    "id": "quadros",
    "nome": "Quadros",
    "descricao": "Duas fotos com uma linha curta em cada. Funciona em uma lâmina ou em carrossel.",
    "opcoes": "Opções: 1 ou 2 fotos · linha sobre a foto ou em caixa · 1 lâmina ou carrossel",
    "tipo": "carrossel e estático"
  },
  {
    "id": "duelo",
    "nome": "Duelo",
    "descricao": "Um contra o outro: dois lados comparados lado a lado.",
    "opcoes": "Opções: colunas de texto ou duas fotos",
    "tipo": "carrossel"
  },
  {
    "id": "preto",
    "nome": "Preto com perfil",
    "descricao": "Fundo preto puro, perfil acima do título em toda lâmina e seta pra passar. Aceita foto e print da fonte ou só tipografia.",
    "opcoes": "Opções: com foto e print ou só texto · destaque amarelo",
    "tipo": "carrossel"
  },
  {
    "id": "editorial",
    "nome": "Editorial",
    "descricao": "Revista: foto grande, título e texto corrido, com lista quando precisa.",
    "opcoes": "Opções: lâmina clara ou escura · paleta da marca",
    "tipo": "carrossel"
  },
  {
    "id": "seeu",
    "nome": "Se eu fosse",
    "descricao": "Cartões numerados com um passo por lâmina e caixa de destaque.",
    "opcoes": "Opções: número de passos · cor da marca",
    "tipo": "carrossel"
  },
  {
    "id": "manual",
    "nome": "Manual numerado",
    "descricao": "Lista numerada com tabela e regra por lâmina, fundo escuro.",
    "opcoes": "",
    "tipo": "carrossel"
  },
  {
    "id": "recuso",
    "nome": "Eu me recuso",
    "descricao": "Carrossel de valores: cada lâmina diz uma coisa que o profissional se recusa a fazer, numa caixa de borda fina ligada por um fio ao texto de apoio. Capa com a frase em duas partes, a segunda numa caixa clara. Cenas reais do profissional no ambiente dele, em tom quente e escuro, com o texto no espaço vazio da foto, alternando com lâminas lisas.",
    "opcoes": "Regra: foto é cena real (trabalhando, de lado, detalhe da mão ou do instrumento), nunca retrato de estúdio · TEXTO NUNCA EM CIMA DO ROSTO: o gerador detecta o rosto e reprova a lâmina · cor e fundo da marca · bloco em cima ou embaixo, à esquerda, à direita ou no centro",
    "tipo": "carrossel"
  }
]

export const POSTS: PostMolde[] = [
  {
    "id": "tweet-1",
    "molde": "tweet",
    "cliente": "João Falcão",
    "titulo": "Frase única, fundo preto",
    "laminas": [
      "/moldes/tw-1.webp",
      "/moldes/tw-2.webp"
    ]
  },
  {
    "id": "tweet-2",
    "molde": "tweet",
    "cliente": "Geraldo",
    "titulo": "Geraldo no molde Tweet (1)",
    "laminas": [
      "/moldes/tw-cli-gerald-0.webp"
    ]
  },
  {
    "id": "tweet-3",
    "molde": "tweet",
    "cliente": "João Falcão",
    "titulo": "Fundo branco com destaque",
    "laminas": [
      "/moldes/twm-1.webp"
    ]
  },
  {
    "id": "tweet-4",
    "molde": "tweet",
    "cliente": "João Falcão",
    "titulo": "Carrossel de frases",
    "laminas": [
      "/moldes/t5-1.webp",
      "/moldes/t5-2.webp"
    ]
  },
  {
    "id": "tweet-5",
    "molde": "tweet",
    "cliente": "João Falcão",
    "titulo": "Com print embaixo",
    "laminas": [
      "/moldes/twi-1.webp"
    ]
  },
  {
    "id": "tweet-6",
    "molde": "tweet",
    "cliente": "João Falcão",
    "titulo": "Com foto ou busca do Google",
    "laminas": [
      "/moldes/t6-1.webp",
      "/moldes/t6-2.webp"
    ]
  },
  {
    "id": "tweet-7",
    "molde": "tweet",
    "cliente": "Exatta",
    "titulo": "Exatta no molde Tweet",
    "laminas": [
      "/moldes/t6-cli-exatta-0.webp"
    ]
  },
  {
    "id": "tweet-8",
    "molde": "tweet",
    "cliente": "Geraldo",
    "titulo": "Geraldo no molde Tweet (2)",
    "laminas": [
      "/moldes/t6-cli-gerald-0.webp"
    ]
  },
  {
    "id": "tweet-9",
    "molde": "tweet",
    "cliente": "João Falcão",
    "titulo": "Série com foto",
    "laminas": [
      "/moldes/ep-1.webp",
      "/moldes/ep-2.webp"
    ]
  },
  {
    "id": "quadros-1",
    "molde": "quadros",
    "cliente": "João Falcão",
    "titulo": "Carrossel",
    "laminas": [
      "/moldes/t9c-1.webp",
      "/moldes/t9c-2.webp"
    ]
  },
  {
    "id": "quadros-2",
    "molde": "quadros",
    "cliente": "João Falcão",
    "titulo": "Estático",
    "laminas": [
      "/moldes/t9e-1.webp"
    ]
  },
  {
    "id": "quadros-3",
    "molde": "quadros",
    "cliente": "João Falcão",
    "titulo": "Uma foto com reflexão",
    "laminas": [
      "/moldes/t9r-1.webp"
    ]
  },
  {
    "id": "quadros-4",
    "molde": "quadros",
    "cliente": "João Falcão",
    "titulo": "Rótulo em caixa branca",
    "laminas": [
      "/moldes/t9esc-1.webp",
      "/moldes/t9esc-2.webp"
    ]
  },
  {
    "id": "duelo-1",
    "molde": "duelo",
    "cliente": "João Falcão",
    "titulo": "Colunas de texto",
    "laminas": [
      "/moldes/t8-1.webp",
      "/moldes/t8-2.webp",
      "/moldes/t8-3.webp"
    ]
  },
  {
    "id": "duelo-2",
    "molde": "duelo",
    "cliente": "Geraldo",
    "titulo": "Geraldo no molde Duelo",
    "laminas": [
      "/moldes/t8-cli-gerald-0.webp"
    ]
  },
  {
    "id": "preto-1",
    "molde": "preto",
    "cliente": "João Falcão",
    "titulo": "Com foto e print da fonte",
    "laminas": [
      "/moldes/t13-1.webp",
      "/moldes/t13-2.webp",
      "/moldes/t13-3.webp"
    ]
  },
  {
    "id": "preto-2",
    "molde": "preto",
    "cliente": "João Falcão",
    "titulo": "Só tipografia com destaque",
    "laminas": [
      "/moldes/t15-1.webp",
      "/moldes/t15-2.webp",
      "/moldes/t15-3.webp"
    ]
  },
  {
    "id": "editorial-1",
    "molde": "editorial",
    "cliente": "João Falcão",
    "titulo": "Editorial",
    "laminas": [
      "/moldes/t10-1.webp",
      "/moldes/t10-2.webp",
      "/moldes/t10-3.webp"
    ]
  },
  {
    "id": "editorial-2",
    "molde": "editorial",
    "cliente": "Felipe",
    "titulo": "Felipe no molde Editorial",
    "laminas": [
      "/moldes/t10-cli-felipe-0.webp"
    ]
  },
  {
    "id": "editorial-3",
    "molde": "editorial",
    "cliente": "Geraldo",
    "titulo": "Geraldo no molde Editorial",
    "laminas": [
      "/moldes/t10-cli-gerald-0.webp"
    ]
  },
  {
    "id": "seeu-1",
    "molde": "seeu",
    "cliente": "João Falcão",
    "titulo": "Se eu fosse",
    "laminas": [
      "/moldes/t7-1.webp",
      "/moldes/t7-2.webp",
      "/moldes/t7-3.webp"
    ]
  },
  {
    "id": "manual-1",
    "molde": "manual",
    "cliente": "João Falcão",
    "titulo": "Manual",
    "laminas": [
      "/moldes/t2-1.webp",
      "/moldes/t2-2.webp",
      "/moldes/t2-3.webp"
    ]
  },
  {
    "id": "recuso-brenno",
    "molde": "recuso",
    "cliente": "Dr. Brenno Cangussu",
    "titulo": "Eu me recuso · ortopedia e dor",
    "laminas": [
      "/moldes/recuso-brenno-s01.webp",
      "/moldes/recuso-brenno-s02.webp",
      "/moldes/recuso-brenno-s03.webp",
      "/moldes/recuso-brenno-s04.webp",
      "/moldes/recuso-brenno-s05.webp",
      "/moldes/recuso-brenno-s06.webp",
      "/moldes/recuso-brenno-s07.webp"
    ]
  },
  {
    "id": "recuso-daniel",
    "molde": "recuso",
    "cliente": "Dr. Daniel Peralba",
    "titulo": "Eu me recuso · saúde íntima",
    "laminas": [
      "/moldes/recuso-daniel-s01.webp",
      "/moldes/recuso-daniel-s02.webp",
      "/moldes/recuso-daniel-s03.webp",
      "/moldes/recuso-daniel-s04.webp",
      "/moldes/recuso-daniel-s05.webp",
      "/moldes/recuso-daniel-s06.webp"
    ]
  }
]
