// Banco de Carrosséis Best-Sellers (Vick Machado), comprado no Hotmart Club e exportado
// do Notion em 04/10/2026. Arquivo GERADO por scripts/exportar_banco_carrosseis.py:
// não editar à mão, rodar o exportador de novo. Lâminas e pranchas em public/banco.

export interface ExemploBanco { id: string; numero: number; url: string; laminas: string[] }
export interface PassoBanco { slide: string; como: string }
export interface FormatoBanco {
  id: string
  nome: string
  /** CONEXÃO, CONVERSÃO ou CRESCIMENTO: para que serve a peça. */
  intencoes: string[]
  canva: string[]
  estrutura: string[]
  detalhamento: PassoBanco[]
  porqueFunciona: string
  prancha: string
  exemplos: ExemploBanco[]
}

export const BANCO: FormatoBanco[] = [
  {
    "id": "analise-opiniao-pessoal",
    "nome": "Análise + Opinião Pessoal",
    "intencoes": [
      "CONEXÃO"
    ],
    "canva": [
      "https://canva.link/zjr8zojkgvf5p9x"
    ],
    "estrutura": [
      "01 - Gancho cultural ou social (afirmação ou pergunta provocativa sobre um fenômeno reconhecível pelo público-alvo)",
      "02 a 0N - Desenvolvimento analítico (análise do fenômeno por camadas temáticas ou cronológicas — cada slide aprofunda um aspecto)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01. Gancho",
        "como": "Título grande com afirmação ou pergunta sobre um fenômeno cultural, comportamental ou de mercado que o público reconhece: \"[referência cultural, tendência ou comportamento conhecido] [fez/faz/representa] [algo surpreendente ou provocativo].\" Visual: imagem de referência do fenômeno analisado (pode ser frame de série, foto de produto, cena do cotidiano do nicho)."
      },
      {
        "slide": "SLIDES 02 a 0N. Desenvolvimento analítico (2 a 5 slides)",
        "como": "Cada slide analisa um aspecto, fase ou camada do fenômeno. Estrutura interna de cada slide: (A) título que nomeia o aspecto/fase — ex: \"[nome da fase ou problema]\"; (B) descrição objetiva do que caracteriza aquele aspecto — elementos visuais, comportamentos, padrões; (C) frase de interpretação em destaque — o que aquele aspecto comunica ou revela. Visual: imagens relacionadas ao fenômeno analisado (não do criador)."
      },
      {
        "slide": "SLIDE 0N+1. Opinião + conexão",
        "como": "O criador aparece na imagem ou a imagem muda de referência externa para o nicho do criador. Texto: identificação do que o fenômeno externo tem em comum com o problema que o criador resolve — \"Isso acontece com [área do criador] também: [paralelo direto].\" Seguido pela opinião central do criador sobre o que o fenômeno revela: \"[afirmação sobre o que realmente importa — não X, mas Y]\"."
      },
      {
        "slide": "SLIDE 0N+2. Fechamento",
        "como": "Foto do criador em contexto de trabalho ou posado. Frase reflexiva ou instrução: \"[diagnóstico aplicado ao leitor — se você está em situação X, então Y].\" CTA opcional: seguidores, link, contato. Tom: direto, sem pressão, orientado para o leitor."
      }
    ],
    "porqueFunciona": "O formato funciona porque usa um objeto externo — série, fenômeno cultural, comportamento de massa — como espelho do problema que o criador resolve no dia a dia.\nO leitor não sente que está recebendo um pitch de serviço: está lendo uma análise sobre algo que já conhece.\nQuando o criador faz a virada (\"isso acontece no meu nicho também\"), o movimento é percebido como insight, não como argumento de venda.\nA análise detalhada por slides cria a impressão de profundidade técnica — quem analisa fenômenos com esse nível de detalhe provavelmente sabe o que faz.\nO fechamento com foto do criador humaniza sem depender de narrativa pessoal, e o CTA implícito (seguir para aprender mais) emerge naturalmente da lacuna entre o problema identificado na análise e a solução que o criador oferece.",
    "prancha": "/banco/pranchas/analise-opiniao-pessoal.webp",
    "exemplos": [
      {
        "id": "DUlww4JEWHp",
        "numero": 1,
        "url": "https://www.instagram.com/p/DUlww4JEWHp/",
        "laminas": [
          "/banco/analise-opiniao-pessoal/DUlww4JEWHp-01.webp",
          "/banco/analise-opiniao-pessoal/DUlww4JEWHp-02.webp",
          "/banco/analise-opiniao-pessoal/DUlww4JEWHp-03.webp",
          "/banco/analise-opiniao-pessoal/DUlww4JEWHp-04.webp",
          "/banco/analise-opiniao-pessoal/DUlww4JEWHp-05.webp",
          "/banco/analise-opiniao-pessoal/DUlww4JEWHp-06.webp",
          "/banco/analise-opiniao-pessoal/DUlww4JEWHp-07.webp",
          "/banco/analise-opiniao-pessoal/DUlww4JEWHp-08.webp"
        ]
      },
      {
        "id": "DYPNkRHlsgy",
        "numero": 2,
        "url": "https://www.instagram.com/p/DYPNkRHlsgy/",
        "laminas": [
          "/banco/analise-opiniao-pessoal/DYPNkRHlsgy-01.webp",
          "/banco/analise-opiniao-pessoal/DYPNkRHlsgy-02.webp",
          "/banco/analise-opiniao-pessoal/DYPNkRHlsgy-03.webp",
          "/banco/analise-opiniao-pessoal/DYPNkRHlsgy-04.webp",
          "/banco/analise-opiniao-pessoal/DYPNkRHlsgy-05.webp",
          "/banco/analise-opiniao-pessoal/DYPNkRHlsgy-06.webp",
          "/banco/analise-opiniao-pessoal/DYPNkRHlsgy-07.webp",
          "/banco/analise-opiniao-pessoal/DYPNkRHlsgy-08.webp"
        ]
      }
    ]
  },
  {
    "id": "antes-de-depois",
    "nome": "Antes de Depois",
    "intencoes": [
      "CONVERSÃO"
    ],
    "canva": [
      "https://canva.link/fy2s9owfxub2035"
    ],
    "estrutura": [
      "01 a N-2 - Slides Antes/Depois (cada slide dividido em duas colunas lado a lado com o par de estados temporais)",
      "N-1 - Síntese ou virada narrativa (slide único sem divisão)",
      "N - CTA (opcional — presente no Exemplo 1, ausente no Exemplo 2)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDES 01 a N-2",
        "como": "Cada slide é dividido verticalmente em duas colunas de largura igual. Coluna esquerda (Antes): etiqueta \"Antes:\" em destaque tipográfico + frase descrevendo o estado de dificuldade, limitação ou dor — na 1ª pessoa ou na 3ª pessoa referindo-se ao criador. Coluna direita (Depois/Agora): etiqueta \"Agora:\" ou texto em posição equivalente + frase descrevendo o estado de resolução, clareza ou resultado. Cada coluna tem uma imagem de fundo que reforça o estado: para o Antes, imagem de tensão, esforço ou limitação; para o Depois, imagem de confiança, leveza ou conquista. As duas variantes de imagem documentadas nos exemplos são: (a) ilustrações — permite maior controle visual e anonimato; (b) fotos reais do criador em momentos distintos de vida — aumenta prova social e identificação pessoal."
      },
      {
        "slide": "SLIDE N (CTA, opcional)",
        "como": "Pergunta direcionada ao leitor que ativa o desejo de sair do Antes: \"Quer [verbo de resultado — transformar, deixar de, conseguir] [resultado final]?\" + CTA de conversão com palavra-chave ou link. Presente quando o carrossel apoia venda de produto ou serviço. Ausente quando o objetivo é engajamento/alcance."
      }
    ],
    "porqueFunciona": "O formato Antes e Depois é um dos mecanismos de identificação mais diretos: o leitor se vê no lado esquerdo de cada slide antes de ler qualquer argumento.\nA divisão visual simultânea (os dois estados na mesma tela) não força uma escolha sequencial — ela apresenta o contraste de uma vez, ativando simultaneamente o reconhecimento da dor e o desejo pelo resultado.\nA repetição do par Antes/Depois em múltiplos slides funciona como acúmulo de provas: cada slide adiciona uma dimensão nova ao contraste (tempo, dinheiro, confiança, ferramenta, presença) sem repetir o mesmo ponto.\nO slide de síntese encerra com a mensagem que justifica a sequência inteira e, quando seguido de CTA, converte quem chegou ao fim com a dor reativada e o resultado visível.",
    "prancha": "/banco/pranchas/antes-de-depois.webp",
    "exemplos": [
      {
        "id": "DL8VHF9Pr9M",
        "numero": 1,
        "url": "https://www.instagram.com/p/DL8VHF9Pr9M/",
        "laminas": [
          "/banco/antes-de-depois/DL8VHF9Pr9M-01.webp",
          "/banco/antes-de-depois/DL8VHF9Pr9M-02.webp",
          "/banco/antes-de-depois/DL8VHF9Pr9M-03.webp",
          "/banco/antes-de-depois/DL8VHF9Pr9M-04.webp",
          "/banco/antes-de-depois/DL8VHF9Pr9M-05.webp",
          "/banco/antes-de-depois/DL8VHF9Pr9M-06.webp",
          "/banco/antes-de-depois/DL8VHF9Pr9M-07.webp"
        ]
      },
      {
        "id": "DWbrdjXDf7v",
        "numero": 2,
        "url": "https://www.instagram.com/p/DWbrdjXDf7v/",
        "laminas": [
          "/banco/antes-de-depois/DWbrdjXDf7v-01.webp",
          "/banco/antes-de-depois/DWbrdjXDf7v-02.webp",
          "/banco/antes-de-depois/DWbrdjXDf7v-03.webp",
          "/banco/antes-de-depois/DWbrdjXDf7v-04.webp",
          "/banco/antes-de-depois/DWbrdjXDf7v-05.webp",
          "/banco/antes-de-depois/DWbrdjXDf7v-06.webp",
          "/banco/antes-de-depois/DWbrdjXDf7v-07.webp",
          "/banco/antes-de-depois/DWbrdjXDf7v-08.webp"
        ]
      }
    ]
  },
  {
    "id": "atendimento-como-diferencial",
    "nome": "Atendimento como diferencial",
    "intencoes": [
      "CONVERSÃO"
    ],
    "canva": [
      "https://canva.link/y22jcmj6khb8dtv"
    ],
    "estrutura": [
      "01 - Gancho de atendimento (declaração de práticas incomuns que ninguém acredita)",
      "02 a N-1 - Diferenciais do atendimento (cada slide nomeia e explica um diferencial específico, acompanhado de evidência)",
      "N - CTA (convite ao atendimento com palavra-chave ou contato direto)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Foto do criador — de rosto, em ambiente de trabalho ou em ação no atendimento. Texto sobreposto: \"Coisas que eu [não abro mão / faço] [no meu atendimento / com meus clientes / na minha [área]] — (e ninguém acredita)\" ou variante equivalente. O subtítulo entre parênteses ou travessão serve para aumentar o estranhamento positivo: o leitor para de scrollar por curiosidade sobre o que é inacreditável."
      },
      {
        "slide": "SLIDES 02 a N-1",
        "como": "Cada slide apresenta um diferencial numerado. Estrutura interna: número e nome do diferencial em destaque tipográfico — \"[0N]: [NOME DO DIFERENCIAL EM CAIXA ALTA]\" — seguido de 2 a 4 linhas de texto explicando o porquê daquele diferencial e o que ele gera na experiência do cliente/aluno. Foto do criador em contexto congruente com o diferencial descrito. Os diferenciais cobrem dimensões distintas: postura pessoal, experiência emocional, ferramentas/materiais, acessibilidade pós-atendimento, formatos extras. Depoimentos de clientes podem aparecer como cards sobrepostos no mesmo slide, validando o diferencial com voz externa."
      },
      {
        "slide": "SLIDE N (último)",
        "como": "Retorna à foto de rosto do criador (mesma energia do slide 1). Texto: \"[Gatilho de oferta ou resultado]\" + CTA direto com palavra-chave ou contato. Encerra com frase de acolhimento curta."
      }
    ],
    "porqueFunciona": "O gancho \"ninguém acredita\" posiciona os diferenciais como raros antes que o leitor leia qualquer um deles — o que cria abertura para receber cada detalhe como surpresa, não como promessa genérica.\nA estrutura numerada organiza a percepção de valor: cada slide adiciona um item à lista mental do leitor, e a progressão cria um efeito de acúmulo.\nA evidência integrada por depoimento transforma cada diferencial em prova, não em declaração. O CTA no último slide fecha o ciclo com a mesma energia afetiva do gancho: criador olhando no rosto, tom de acolhimento.\nO leitor que chegou ao fim está aquecido por uma combinação de curiosidade satisfeita, prova acumulada e proximidade com quem produz o conteúdo.",
    "prancha": "/banco/pranchas/atendimento-como-diferencial.webp",
    "exemplos": [
      {
        "id": "DLhhxDNOZQt",
        "numero": 1,
        "url": "https://www.instagram.com/p/DLhhxDNOZQt/",
        "laminas": [
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-01.webp",
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-02.webp",
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-03.webp",
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-04.webp",
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-05.webp",
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-06.webp",
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-07.webp",
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-08.webp",
          "/banco/atendimento-como-diferencial/DLhhxDNOZQt-09.webp"
        ]
      },
      {
        "id": "DYfl4IpoJTS",
        "numero": 2,
        "url": "https://www.instagram.com/p/DYfl4IpoJTS/",
        "laminas": [
          "/banco/atendimento-como-diferencial/DYfl4IpoJTS-01.webp",
          "/banco/atendimento-como-diferencial/DYfl4IpoJTS-02.webp",
          "/banco/atendimento-como-diferencial/DYfl4IpoJTS-03.webp",
          "/banco/atendimento-como-diferencial/DYfl4IpoJTS-04.webp",
          "/banco/atendimento-como-diferencial/DYfl4IpoJTS-05.webp"
        ]
      }
    ]
  },
  {
    "id": "comparacao-licao",
    "nome": "Comparação + Lição",
    "intencoes": [
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/fy2s9owfxub2035"
    ],
    "estrutura": [
      "01 a N-1 - Rounds de comparação (split screen: referência externa vs. abordagem do criador)",
      "N - Pivot de honestidade (reconhecimento de limitação real ou diferença de métrica)",
      "N+1 a N+2 - Lição(ões) (conclusão genérica extraída da comparação, em voz própria)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDES 01 a N-1 (rounds de comparação)",
        "como": "Cada slide = um split visual: lado esquerdo em foto colorida ou com fundo vivo (representando a [referência externa — outra criadora, guru, método reconhecido]) e lado direito em foto em preto e branco ou fundo neutro (representando quem produz o conteúdo). \nCada lado traz uma legenda de uma linha com o padrão: \"[Nome da referência] faz/diz que [prática ou crença da referência]\" vs. \"Eu [faço/acredito que] [prática ou posição contrária ou diferente]\". O contraste não precisa ser de oposição direta — pode ser de ênfase diferente, escala diferente ou complemento crítico."
      }
    ],
    "porqueFunciona": "O formato usa referências conhecidas do nicho como âncora de atenção — o leitor reconhece os nomes e imediatamente compara a posição de quem fala.\nA estrutura de split visual repete o mesmo padrão em rounds diferentes, criando ritmo e antecipação.\nO pivot de honestidade no meio do carrossel é o elemento que transforma o formato: em vez de fingir superioridade, o criador admite uma desvantagem real — o que desativa a resistência do leitor e torna as lições seguintes mais críveis.\nA lição final, por ser construída sobre evidência própria (resultado sem seguir as fórmulas), tem muito mais peso do que conselhos genéricos.",
    "prancha": "/banco/pranchas/comparacao-licao.webp",
    "exemplos": [
      {
        "id": "DI_4Ou9PNRE",
        "numero": 1,
        "url": "https://www.instagram.com/p/DI_4Ou9PNRE/",
        "laminas": [
          "/banco/comparacao-licao/DI_4Ou9PNRE-01.webp",
          "/banco/comparacao-licao/DI_4Ou9PNRE-02.webp",
          "/banco/comparacao-licao/DI_4Ou9PNRE-03.webp",
          "/banco/comparacao-licao/DI_4Ou9PNRE-04.webp",
          "/banco/comparacao-licao/DI_4Ou9PNRE-05.webp",
          "/banco/comparacao-licao/DI_4Ou9PNRE-06.webp"
        ]
      },
      {
        "id": "DGB4HfPvLTp",
        "numero": 2,
        "url": "https://www.instagram.com/p/DGB4HfPvLTp/",
        "laminas": [
          "/banco/comparacao-licao/DGB4HfPvLTp-01.webp",
          "/banco/comparacao-licao/DGB4HfPvLTp-02.webp",
          "/banco/comparacao-licao/DGB4HfPvLTp-03.webp",
          "/banco/comparacao-licao/DGB4HfPvLTp-04.webp",
          "/banco/comparacao-licao/DGB4HfPvLTp-05.webp",
          "/banco/comparacao-licao/DGB4HfPvLTp-06.webp",
          "/banco/comparacao-licao/DGB4HfPvLTp-07.webp",
          "/banco/comparacao-licao/DGB4HfPvLTp-08.webp"
        ]
      }
    ]
  },
  {
    "id": "daqui-a-10-anos",
    "nome": "Daqui a 10 anos…",
    "intencoes": [
      "CONVERSÃO"
    ],
    "canva": [
      "https://canva.link/qg1euniwqnclwdp"
    ],
    "estrutura": [
      "01 - Gancho temporal (âncora no futuro distante)",
      "02 a N-1 - Slides de conquistas futuras em ordem cronológica decrescente (do mais distante ao mais próximo)",
      "N - CTA (fechamento narrativo: conecta o futuro imaginado ao produto/evento/decisão do presente)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Texto em dois blocos sobrepostos à ilustração: \"Daqui a 10 anos...\" (em caixa de destaque) + \"é [dia da semana] de manhã, em [ano = hoje + 10].\" O cenário de abertura mostra o personagem em estado de tranquilidade e conquista — relaxando, sorrindo, no ambiente profissional ou doméstico dos sonhos. A ilustração é no estilo de personagem que representa a persona do criador (mesmo nicho, mesmo estilo visual). Esse slide não diz o que aconteceu — apenas situa o leitor 10 anos à frente e coloca um personagem feliz em cena."
      },
      {
        "slide": "SLIDES 02 a N-1",
        "como": "Cada slide descreve uma conquista específica, com ano exato em ordem decrescente (ex.: 2034, 2033, 2032...). Estrutura de cada slide: frase curta em 1ª ou 2ª pessoa descrevendo a conquista — \"Em [ano], você [ação concluída — lançou, bateu, comprou, deu, virou].\" + complemento de impacto — \"[resultado ou reconhecimento — ex.: nunca mais parou de ser chamado, vendendo bem e abrindo portas].\" Cada slide cobre uma dimensão diferente da vida ou negócio: patrimônio, audiência, autoridade, estilo de vida, família, produto. Ilustração de fundo congruente com o cenário descrito. Os slides mais próximos de 2025 são em P&B ou tom neutro; os mais distantes (2034-2035) são coloridos e vivos — recurso visual para marcar a diferença entre presente e futuro alcançado."
      },
      {
        "slide": "SLIDE N (último)",
        "como": "Fechamento com reversão temporal: \"E tudo [isso/começou] em [ano atual]. / Quando você [tomou a decisão que gerou tudo isso — comprou, se inscreveu, deu o primeiro passo].\" + CTA direto: \"Comenta [PALAVRA] aqui embaixo.\" ou link na bio. O slide reconecta toda a narrativa ao presente e à ação imediata, deixando claro que o futuro imaginado começa com a decisão de agora."
      }
    ],
    "porqueFunciona": "O formato inverte a lógica convencional de venda: em vez de descrever o produto e listar benefícios, coloca o leitor diretamente no futuro em que o produto já foi comprado e os resultados já chegaram.\nA experiência emocional antecede qualquer argumento racional. A progressão cronológica decrescente (de 2035 a 2026) cria um efeito de \"volta ao presente\" que aumenta a urgência à medida que os anos se aproximam do atual.\nO slide de fechamento que conecta o futuro imaginado à decisão de hoje completa o ciclo e transforma a fantasia em CTA: o leitor não \"compra um produto\" — ele \"começa a construir o futuro que acabou de ver\".",
    "prancha": "/banco/pranchas/daqui-a-10-anos.webp",
    "exemplos": [
      {
        "id": "DItStqUuPz5",
        "numero": 1,
        "url": "https://www.instagram.com/p/DItStqUuPz5/",
        "laminas": [
          "/banco/daqui-a-10-anos/DItStqUuPz5-01.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-02.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-03.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-04.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-05.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-06.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-07.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-08.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-09.webp",
          "/banco/daqui-a-10-anos/DItStqUuPz5-10.webp"
        ]
      },
      {
        "id": "DJJmBalOznu",
        "numero": 2,
        "url": "https://www.instagram.com/p/DJJmBalOznu/",
        "laminas": [
          "/banco/daqui-a-10-anos/DJJmBalOznu-01.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-02.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-03.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-04.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-05.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-06.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-07.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-08.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-09.webp",
          "/banco/daqui-a-10-anos/DJJmBalOznu-10.webp"
        ]
      }
    ]
  },
  {
    "id": "dualidade",
    "nome": "Dualidade",
    "intencoes": [
      "CONVERSÃO"
    ],
    "canva": [
      "https://canva.link/9pi0ku7bybymf13"
    ],
    "estrutura": [
      "01 a N-2 - Slides de dualidade (cada slide dividido em duas metades com o contraste A vs. B)",
      "N-1 - Síntese ou mensagem de posicionamento (slide de conclusão sem divisão visual)",
      "N - CTA (palavra-chave nos comentários)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDES 01 a N-2",
        "como": "Cada slide é dividido ao meio — horizontal (topo/baixo) ou vertical (esquerda/direita), com imagem de fundo diferente em cada metade para reforçar a distinção visual. Metade A: \"[Entidade A — conceito, pessoa, período, situação] + [afirmação sobre A]\". Metade B: \"[Entidade B] + [afirmação contrastante sobre B]\". \nAs afirmações podem ser definições (\"[entidade A] [verbo] [o que faz ou representa]\"), atributos opostos, ou estados temporais (antes/agora). O texto é curto — 1 a 2 linhas por metade. A progressão de slides mantém o mesmo par A/B mas apresenta ângulos diferentes do contraste a cada slide."
      },
      {
        "slide": "SLIDE N (último)",
        "como": "CTA direto com palavra-chave: \"Comenta [PALAVRA] que eu te mando [o que recebe] no direct.\" ou \"Comenta [PALAVRA] e [contexto de acesso]\". Slide sem a divisão visual — retorna ao layout de slide único, com fundo limpo ou foto do criador."
      }
    ],
    "porqueFunciona": "A divisão visual do slide em duas metades cria uma estrutura de comparação instantânea — o leitor não precisa ler dois slides para entender o contraste, ele vê os dois lados ao mesmo tempo. Isso acelera a compreensão e aumenta a força do argumento.\nO mecanismo funciona tanto para dualidades conceituais (esclarecer confusão entre dois termos do campo) quanto para dualidades temporais (mostrar que o estado atual de alguém admirado já foi diferente), porque ambas ativam o mesmo gatilho: reconhecimento.\nO leitor se situa em um dos lados e quer saber o que precisa mudar ou entender para alcançar o outro. Os slides de síntese e CTA capitalizam essa tensão criada.",
    "prancha": "/banco/pranchas/dualidade.webp",
    "exemplos": [
      {
        "id": "DXo6VgVFlX0",
        "numero": 1,
        "url": "https://www.instagram.com/p/DXo6VgVFlX0/",
        "laminas": [
          "/banco/dualidade/DXo6VgVFlX0-01.webp",
          "/banco/dualidade/DXo6VgVFlX0-02.webp",
          "/banco/dualidade/DXo6VgVFlX0-03.webp",
          "/banco/dualidade/DXo6VgVFlX0-04.webp",
          "/banco/dualidade/DXo6VgVFlX0-05.webp",
          "/banco/dualidade/DXo6VgVFlX0-06.webp",
          "/banco/dualidade/DXo6VgVFlX0-07.webp"
        ]
      },
      {
        "id": "DWHEltgFKV9",
        "numero": 2,
        "url": "https://www.instagram.com/p/DWHEltgFKV9/",
        "laminas": [
          "/banco/dualidade/DWHEltgFKV9-01.webp",
          "/banco/dualidade/DWHEltgFKV9-02.webp",
          "/banco/dualidade/DWHEltgFKV9-03.webp",
          "/banco/dualidade/DWHEltgFKV9-04.webp",
          "/banco/dualidade/DWHEltgFKV9-05.webp",
          "/banco/dualidade/DWHEltgFKV9-06.webp",
          "/banco/dualidade/DWHEltgFKV9-07.webp"
        ]
      }
    ]
  },
  {
    "id": "fofoquinha",
    "nome": "Fofoquinha",
    "intencoes": [
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/wj8o3a6m5b3yda3"
    ],
    "estrutura": [
      "01 - Hook de fofoca (nome de criador/celebridade + declaração provocativa + promessa de revelação)",
      "02 - Credenciais do sujeito (quem é essa pessoa + por que merece atenção)",
      "03 a N-1 - Lições extraídas (cada slide = uma estratégia ou padrão observado no sujeito, com evidência + princípio nomeado)",
      "N - Síntese em voz própria (quem produz o conteúdo resume o aprendizado, transicionando do sujeito para si mesmo) ou CTA"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Foto do sujeito em destaque (de evento, story, bastidor ou foto profissional reconhecível) + título em tom de fofoca ou revelação: \n\"O que [nome/papel do sujeito] faz que [reação provocativa — você devia copiar / ninguém fala / poucos percebem]\". Subtítulo ou complemento amplia o contexto com dado impressionante sobre o sujeito (número de empresas, seguidores, resultados). Tom: informal, empolgado, coloquial — quase como se fosse uma conversa de corredor. O nome do sujeito aparece explicitamente no slide."
      },
      {
        "slide": "SLIDE 02",
        "como": "Contextualização do sujeito para quem não conhece: 2 a 3 frases descrevendo quem é [a pessoa] + o que torna o caso dela notável ou paradoxal. \nPode incluir uma provocação inicial (\"Pra quem olha rápido, parece [impressão equivocada]. Mas é justamente o contrário.\"). Foto do sujeito em contexto cotidiano (gravando, trabalhando, em situação real)."
      },
      {
        "slide": "SLIDES 03 a N-1 (lições)",
        "como": "Cada slide extrai um padrão observável no comportamento do sujeito e transforma em princípio aplicável. \nEstrutura de cada slide: (1) observação sobre o sujeito em itálico ou destaque menor — \"Enquanto [outros fazem X], [o sujeito] faz Y\"; (2) nomeação do princípio em destaque tipográfico — \"[Nome da estratégia ou conceito]\"; (3) explicação de como quem lê pode aplicar — frase curta de generalização. Foto do sujeito ou imagem do contexto acompanha o texto. \nPode haver um slide intermediário que nomeia o conceito estratégico formalmente (ex: \"O nome disso é [termo]\")."
      },
      {
        "slide": "SLIDE N (síntese/CTA)",
        "como": "Quem produz o conteúdo assume a voz: foto própria + declaração que sintetiza o aprendizado tirado do sujeito, agora em primeira ou segunda pessoa — \"Isso é o que transforma [ação] em [resultado].\"\nPode incluir CTA de produto, comentário ou engajamento. A transição do sujeito para quem fala não é abrupta: a síntese ancora o sujeito como prova e generaliza o princípio."
      }
    ],
    "porqueFunciona": "O formato usa o nome de um terceiro como isca de atenção — o leitor clica porque reconhece o sujeito ou porque a promessa de \"segredo\" ativa curiosidade.\nO conteúdo real, porém, não é fofoca: é análise de comportamento com extração de lição. Isso transforma o formato em algo que performa bem no alcance (o nome do sujeito puxa o clique) e bem na retenção (a análise entrega valor concreto).\nQuem produz o conteúdo ganha autoridade sem precisar falar de si mesmo diretamente — usa um caso externo como evidência para seus próprios princípios.\nO slide de síntese no final fecha o ciclo posicionando quem fala como analista de estratégia, não como admirador.",
    "prancha": "/banco/pranchas/fofoquinha.webp",
    "exemplos": [
      {
        "id": "DSfTr2kDU5z",
        "numero": 1,
        "url": "https://www.instagram.com/p/DSfTr2kDU5z/",
        "laminas": [
          "/banco/fofoquinha/DSfTr2kDU5z-01.webp",
          "/banco/fofoquinha/DSfTr2kDU5z-02.webp",
          "/banco/fofoquinha/DSfTr2kDU5z-03.webp",
          "/banco/fofoquinha/DSfTr2kDU5z-04.webp",
          "/banco/fofoquinha/DSfTr2kDU5z-05.webp",
          "/banco/fofoquinha/DSfTr2kDU5z-06.webp"
        ]
      },
      {
        "id": "DR7UTTSDcYJ",
        "numero": 2,
        "url": "https://www.instagram.com/p/DR7UTTSDcYJ/",
        "laminas": [
          "/banco/fofoquinha/DR7UTTSDcYJ-01.webp",
          "/banco/fofoquinha/DR7UTTSDcYJ-02.webp",
          "/banco/fofoquinha/DR7UTTSDcYJ-03.webp",
          "/banco/fofoquinha/DR7UTTSDcYJ-04.webp",
          "/banco/fofoquinha/DR7UTTSDcYJ-05.webp",
          "/banco/fofoquinha/DR7UTTSDcYJ-06.webp"
        ]
      }
    ]
  },
  {
    "id": "frase-de-posicionamento",
    "nome": "Frase de Posicionamento",
    "intencoes": [
      "CONEXÃO"
    ],
    "canva": [
      "https://canva.link/ccnerds9aq7y5pr"
    ],
    "estrutura": [
      "01 a 0N - Slides de frase de posicionamento (afirmação direta e sem filtro do criador sobre uma crença do nicho)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDES 01 a 0N",
        "como": "Foto do criador em cenário editorial ou profissional + frase curta e direta, sem aspas, que afirma uma crença ou diagnóstico sobre o nicho. A frase domina o espaço visual do slide. Há duas variações estruturais: \n(A) Frase-âncora progressiva — a mesma estrutura base se repete em todos os slides, mudando só o complemento final: \"[Causa externa atribuída ao mercado] ou [causa interna que remete ao leitor]?\" — o carrossel acumula variações da mesma provocação, cada uma apontando para uma causa-raiz diferente; \n(B) Frase única — um ou poucos slides com uma única afirmação de posicionamento direta e polêmica o suficiente para gerar reação (\"Quem trabalha com [nicho] não pode [comportamento que contradiz o nicho]\"). Em ambas as variações, a frase não é suavizada nem colocada em contexto no slide — ela provoca primeiro, a legenda ou os slides seguintes explicam depois."
      },
      {
        "slide": "SLIDE DE EMPATIA (opcional, aparece quando há oferta no mesmo carrossel)",
        "como": "Após a sequência provocativa, um slide reconhece a dificuldade real do público sem culpá-lo, nomeando a causa estrutural do problema. Serve de ponte entre a provocação e a apresentação do produto: \"Best, eu entendo! [Contexto que justifica o comportamento criticado antes] — foi por isso que eu criei [produto].\""
      },
      {
        "slide": "SLIDE FINAL",
        "como": "Quando há oferta: descreve o que o público ganha e como acessar (comentar palavra-chave, link no direct). Quando não há oferta: encerra com afirmação de posicionamento definitiva que fecha o raciocínio da sequência anterior."
      }
    ],
    "porqueFunciona": "A frase de posicionamento opera por polarização deliberada: força o leitor a tomar partido — concordar ou discordar.\nQuem concorda sente que o criador nomeou algo que ninguém ousava dizer; quem discorda comenta para rebater — ambos os comportamentos geram alcance orgânico.\nA ausência de hedges é intencional: a frase sem filtro constrói autoridade e diferencia o criador de quem faz conteúdo neutro para agradar a todos.\nNas variações progressivas, a repetição da estrutura cria acúmulo de pressão: o leitor que se identifica com a primeira provocação avança para ver se a própria desculpa aparece nos slides seguintes.\nO CTA ao final aproveita o estado emocional gerado — o leitor já reconheceu o problema, e o produto aparece como resposta direta sem precisar ser vendido com esforço.",
    "prancha": "/banco/pranchas/frase-de-posicionamento.webp",
    "exemplos": [
      {
        "id": "DYFPkHOjeUk",
        "numero": 1,
        "url": "https://www.instagram.com/p/DYFPkHOjeUk/",
        "laminas": [
          "/banco/frase-de-posicionamento/DYFPkHOjeUk-01.webp",
          "/banco/frase-de-posicionamento/DYFPkHOjeUk-02.webp",
          "/banco/frase-de-posicionamento/DYFPkHOjeUk-03.webp",
          "/banco/frase-de-posicionamento/DYFPkHOjeUk-04.webp",
          "/banco/frase-de-posicionamento/DYFPkHOjeUk-05.webp",
          "/banco/frase-de-posicionamento/DYFPkHOjeUk-06.webp"
        ]
      },
      {
        "id": "DJsR9awAIj6",
        "numero": 2,
        "url": "https://www.instagram.com/p/DJsR9awAIj6/",
        "laminas": [
          "/banco/frase-de-posicionamento/DJsR9awAIj6-01.webp"
        ]
      }
    ]
  },
  {
    "id": "frases-compartilhaveis",
    "nome": "Frases compartilháveis",
    "intencoes": [
      "CONEXÃO"
    ],
    "canva": [
      "https://canva.link/ccnerds9aq7y5pr"
    ],
    "estrutura": [
      "01 - Capa (apresentação da coleção — quem produz o conteúdo + título que nomeia o conjunto ou abre com a primeira frase-âncora)",
      "02 a 0N - Frases independentes (cada slide = 1 frase + 1 imagem, sem conexão narrativa entre si — cada slide funciona como unidade autônoma para salvar ou compartilhar)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01. Capa",
        "como": "Foto do criador (posada ou editorial) ou imagem de ambiente que remete ao universo do nicho. Texto em duas partes, posicionadas em lados opostos da imagem ou em camadas: \n(A) frase de enquadramento — ex: \"[frases que eu precisei ouvir / frases sobre X / o que eu penso sobre Y] [nos últimos dias/essa semana/agora]\"; \n(B) nome ou assinatura do criador. Sem CTA. A capa funciona como convite para continuar passando os slides."
      },
      {
        "slide": "SLIDES 02 a 0N",
        "como": "Frases individuais. Cada slide é independente e deve funcionar isoladamente. \nA) imagem de ambiente, lifestyle ou do cotidiano do nicho — pode ser foto da cidade, natureza, objetos, espaços, pessoas em segundo plano, ou o próprio criador em situação casual; \n(B) texto em overlay com tipografia grande e legível: uma única frase de 1 a 3 linhas. As frases seguem um tom consistente ao longo do carrossel — pode ser reflexivo, bem-humorado, direto ou poético — mas cada uma é uma observação autônoma sobre [tema central do perfil: comportamento humano, área de expertise, vida cotidiana, relações, trabalho]. \nNão há progressão ou argumento que conecte os slides."
      }
    ],
    "porqueFunciona": "O formato é projetado para salvar e redistribuir: cada slide é uma unidade completa que o seguidor pode screenshottear, salvar ou repostar sem precisar do contexto dos demais.\nO algoritmo do Instagram favorece salvamentos, e esse formato maximiza essa métrica porque entrega múltiplos motivos de salvar em um só carrossel.\nA estrutura sem narrativa linear também significa que o leitor pode entrar no carrossel em qualquer ponto e imediatamente extrair valor — o que eleva o engajamento slide a slide e aumenta a chance de o carrossel ser visto inteiro.\nA capa com o criador posado ou em estilo editorial ancora a identidade visual e cria reconhecimento de formato: quando o seguidor aprende que esses carrosséis existem naquele perfil, começa a procurar por eles.",
    "prancha": "/banco/pranchas/frases-compartilhaveis.webp",
    "exemplos": [
      {
        "id": "DXUY5EbjQUf",
        "numero": 1,
        "url": "https://www.instagram.com/p/DXUY5EbjQUf/",
        "laminas": [
          "/banco/frases-compartilhaveis/DXUY5EbjQUf-01.webp",
          "/banco/frases-compartilhaveis/DXUY5EbjQUf-02.webp",
          "/banco/frases-compartilhaveis/DXUY5EbjQUf-03.webp",
          "/banco/frases-compartilhaveis/DXUY5EbjQUf-04.webp",
          "/banco/frases-compartilhaveis/DXUY5EbjQUf-05.webp",
          "/banco/frases-compartilhaveis/DXUY5EbjQUf-06.webp"
        ]
      },
      {
        "id": "DWz5YffDMTB",
        "numero": 2,
        "url": "https://www.instagram.com/p/DWz5YffDMTB/",
        "laminas": [
          "/banco/frases-compartilhaveis/DWz5YffDMTB-01.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-02.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-03.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-04.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-05.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-06.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-07.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-08.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-09.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-10.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-11.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-12.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-13.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-14.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-15.webp",
          "/banco/frases-compartilhaveis/DWz5YffDMTB-16.webp"
        ]
      }
    ]
  },
  {
    "id": "humor-relacionavel",
    "nome": "Humor Relacionável",
    "intencoes": [
      "CONEXÃO",
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/y22jcmj6khb8dtv"
    ],
    "estrutura": [
      "01 - Slide de tema (anuncia o contexto do carrossel e cria antecipação)",
      "02 a 0N - Slides de humor individual (cada meme é autônomo e relacionável)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Imagem cômica com forte apelo visual — animal com acessório fora de contexto, personagem de pelúcia em cenário real, figura absurda — acompanhada de título que anuncia o tema e amarra os slides seguintes a um universo específico: \n\"[Situações / problemas / pensamentos] que você só [passa a ter / entende / conhece] depois que [entra no nicho / começa a fazer X]\" ou \"[Personagem / animal] [em contexto do nicho]\". O título pode carregar um subtítulo irônico em fonte menor. Nenhum CTA neste slide — o objetivo é criar expectativa."
      },
      {
        "slide": "SLIDES 02 a 0N",
        "como": "Mesma estrutura visual em todos: \n(1) imagem cômica com apelo visual independente do texto — o leitor deve parar no scroll só pela imagem; \n(2) frase curta ou média sobreposta que descreve uma situação do cotidiano do nicho, escrita como monólogo interno (\"oi deus, sou eu de novo...\") ou observação direta (\"você já não vive, você raciocina em formato de Reels\"). \nPode ter segunda linha que adiciona a virada do humor. A situação descrita precisa ser reconhecível por quem está no nicho — específica o suficiente para gerar identificação imediata, mas não tão técnica que exclua iniciantes. Cada slide funciona como post isolado: pode ser salvo e repostado individualmente."
      },
      {
        "slide": "SLIDE FINAL",
        "como": "Segue o mesmo padrão dos slides intermediários (último meme da sequência). Nos exemplos analisados, não há CTA explícito de seguir ou salvar — o engajamento é gerado pelo compartilhamento espontâneo por identificação."
      }
    ],
    "porqueFunciona": "O humor relacionável opera por reconhecimento imediato: o leitor vê a situação descrita e pensa \"isso sou eu\", o que dispara compartilhamento impulsivo sem precisar de instrução.\nA imagem cômica funciona como parada de scroll independente do texto — o visual segura a atenção por um segundo antes de o texto ser lido.\nA combinação de imagem absurda com frase específica do nicho cria um duplo gatilho: o humor vem do visual, a identificação vem do texto.\nPor não ter utilidade prática nem argumentação, o formato não gera resistência em público frio.\nO carrossel potencializa o alcance porque cada slide pode viralizar individualmente quando salvo e repostado em stories, funcionando como distribuição orgânica de cada meme avulso.",
    "prancha": "/banco/pranchas/humor-relacionavel.webp",
    "exemplos": [
      {
        "id": "DJt8ZhAu1D5",
        "numero": 1,
        "url": "https://www.instagram.com/p/DJt8ZhAu1D5/",
        "laminas": [
          "/banco/humor-relacionavel/DJt8ZhAu1D5-01.webp",
          "/banco/humor-relacionavel/DJt8ZhAu1D5-02.webp",
          "/banco/humor-relacionavel/DJt8ZhAu1D5-03.webp",
          "/banco/humor-relacionavel/DJt8ZhAu1D5-04.webp",
          "/banco/humor-relacionavel/DJt8ZhAu1D5-05.webp",
          "/banco/humor-relacionavel/DJt8ZhAu1D5-06.webp",
          "/banco/humor-relacionavel/DJt8ZhAu1D5-07.webp"
        ]
      },
      {
        "id": "DSFsNAUjQq0",
        "numero": 2,
        "url": "https://www.instagram.com/p/DSFsNAUjQq0/",
        "laminas": [
          "/banco/humor-relacionavel/DSFsNAUjQq0-01.webp",
          "/banco/humor-relacionavel/DSFsNAUjQq0-02.webp",
          "/banco/humor-relacionavel/DSFsNAUjQq0-03.webp",
          "/banco/humor-relacionavel/DSFsNAUjQq0-04.webp",
          "/banco/humor-relacionavel/DSFsNAUjQq0-05.webp",
          "/banco/humor-relacionavel/DSFsNAUjQq0-06.webp"
        ]
      }
    ]
  },
  {
    "id": "linha-do-tempo",
    "nome": "Linha do Tempo",
    "intencoes": [
      "CONEXÃO"
    ],
    "canva": [
      "https://canva.link/y22jcmj6khb8dtv"
    ],
    "estrutura": [
      "01 a 0N - Slides de época (foto do criador + ano + evento ou comentário marcante daquele período, em ordem cronológica)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDES 01 a 0N",
        "como": "Foto do criador na época indicada — quanto maior o contraste visual com o presente, melhor. Ano em destaque no slide, grande e legível antes do texto. Texto que representa o que o criador ouvia ou vivia naquele período. \nO texto pode ser: (A) comentário ou crítica recebido de terceiros (entre aspas), representando resistência externa; (B) pensamento ou dúvida interna do criador na época; (C) evento objetivo que define aquele ano. \nO tom dos primeiros slides é de dificuldade, questionamento ou adversidade — quanto maior o contraste com o desfecho, mais potente o arco narrativo."
      },
      {
        "slide": "SLIDE DE VIRADA",
        "como": "Foto atual ou recente + ano mais próximo do presente + texto que representa reconhecimento, conquista ou mudança de tom no que as pessoas dizem. \nOnde antes havia crítica, agora há admiração. Onde havia dúvida, agora há resultado concreto. O slide não precisa explicar a virada — o contraste com os slides anteriores faz o trabalho."
      },
      {
        "slide": "SLIDE FINAL",
        "como": "Foto atual sem marcação de ano. Texto em primeira pessoa que nomeia o que tornou a trajetória possível, sem glamourizar: persistência, escolhas, noites sem dormir. \nPode encerrar com pergunta ou convite à identificação para quem está no início do processo. Não há CTA explícito de produto nos exemplos analisados — o encerramento é reflexivo."
      }
    ],
    "porqueFunciona": "A linha do tempo usa contraste temporal como prova social implícita: o criador não diz que é bom — mostra uma trajetória onde quem duvidava estava errado.\nO formato não pede confiança prévia: a progressão cronológica demonstra. O uso de fotos antigas cria intimidade que posts de conquista não criam — revela vulnerabilidade real.\nAs críticas e dúvidas nos primeiros slides espelham as vozes que o próprio leitor ouve, gerando identificação. A estrutura cronológica cria tensão narrativa que obriga a leitura de todos os slides: o leitor quer ver o desfecho.\nO fechamento sem data ancora o criador no presente e abre espaço para o leitor reconhecer sua própria história na trajetória narrada.",
    "prancha": "/banco/pranchas/linha-do-tempo.webp",
    "exemplos": [
      {
        "id": "DQAjYc5DdTv",
        "numero": 1,
        "url": "https://www.instagram.com/p/DQAjYc5DdTv/",
        "laminas": [
          "/banco/linha-do-tempo/DQAjYc5DdTv-01.webp",
          "/banco/linha-do-tempo/DQAjYc5DdTv-02.webp",
          "/banco/linha-do-tempo/DQAjYc5DdTv-03.webp",
          "/banco/linha-do-tempo/DQAjYc5DdTv-04.webp",
          "/banco/linha-do-tempo/DQAjYc5DdTv-05.webp",
          "/banco/linha-do-tempo/DQAjYc5DdTv-06.webp",
          "/banco/linha-do-tempo/DQAjYc5DdTv-07.webp"
        ]
      },
      {
        "id": "DQ-O_qPERbM",
        "numero": 2,
        "url": "https://www.instagram.com/p/DQ-O_qPERbM/",
        "laminas": [
          "/banco/linha-do-tempo/DQ-O_qPERbM-01.webp",
          "/banco/linha-do-tempo/DQ-O_qPERbM-02.webp",
          "/banco/linha-do-tempo/DQ-O_qPERbM-03.webp",
          "/banco/linha-do-tempo/DQ-O_qPERbM-04.webp",
          "/banco/linha-do-tempo/DQ-O_qPERbM-05.webp",
          "/banco/linha-do-tempo/DQ-O_qPERbM-06.webp",
          "/banco/linha-do-tempo/DQ-O_qPERbM-07.webp"
        ]
      },
      {
        "id": "DX6qabBlvmD",
        "numero": 3,
        "url": "https://www.instagram.com/p/DX6qabBlvmD/",
        "laminas": [
          "/banco/linha-do-tempo/DX6qabBlvmD-01.webp",
          "/banco/linha-do-tempo/DX6qabBlvmD-02.webp",
          "/banco/linha-do-tempo/DX6qabBlvmD-03.webp",
          "/banco/linha-do-tempo/DX6qabBlvmD-04.webp",
          "/banco/linha-do-tempo/DX6qabBlvmD-05.webp",
          "/banco/linha-do-tempo/DX6qabBlvmD-06.webp",
          "/banco/linha-do-tempo/DX6qabBlvmD-07.webp",
          "/banco/linha-do-tempo/DX6qabBlvmD-08.webp",
          "/banco/linha-do-tempo/DX6qabBlvmD-09.webp"
        ]
      }
    ]
  },
  {
    "id": "lista",
    "nome": "Lista",
    "intencoes": [
      "CONVERSÃO",
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/zjr8zojkgvf5p9x"
    ],
    "estrutura": [
      "01 - Hook numérico (capa com número + promessa + gancho de utilidade)",
      "02 a N-1 - Slides de itens (cada slide = 1 a 8 itens da lista, com ou sem organização por categoria)",
      "N - Fechamento (lição extraída da lista ou CTA direto para ação/produto)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Capa com número em destaque tipográfico + título que nomeia o que a lista contém + subtítulo com o benefício para quem vai ler. \nO número deve ser específico e alto o suficiente para comunicar volume de valor (de 5 a 31 nos exemplos). \nPode usar colagem visual ou foto do criador com elementos gráficos. A promessa no subtítulo é sempre prática e orientada ao leitor: \"[resolve X problema/situação]\" ou \"[para quem quer Y resultado]\"."
      },
      {
        "slide": "SLIDES 02 a N-1 (itens da lista)",
        "como": "Cada slide apresenta um lote de itens numerados sequencialmente. A organização pode ser por categoria (com título da categoria em caixa alta no topo do slide) ou linear (itens sequenciais sem agrupamento). \nA arquitetura de cada item varia pelo tipo de lista: em [listas de ferramentas ou recursos], o item traz nome/logo + papel que cumpre + como quem produz usa + opinião pessoal; em [listas de itens com objeção], o item traz nome + coluna com razão de rejeição + coluna com argumento de valor; em [listas de ideias ou perguntas], o item é só a ideia ou pergunta numerada. Pode incluir imagem, screenshot ou foto do item para reforço visual."
      },
      {
        "slide": "SLIDE N (fechamento)",
        "como": "Pode ser: \n(a) lição genérica derivada da lista — afirmação sobre o princípio por trás dos itens, em texto limpo; \n(b) CTA de engajamento — pedido para comentar, marcar alguém ou salvar; \n(c) CTA de produto — convite a acessar curso, template ou serviço relacionado ao tema da lista; ou \n(d) combinação de lição + CTA no mesmo slide. Nos exemplos com listas menores (4-5 slides), o CTA aparece no próprio último slide de itens, sem slide exclusivo."
      }
    ],
    "porqueFunciona": "O número específico no hook cria uma expectativa concreta: o leitor sabe exatamente quanto vai receber, o que reduz a fricção de entrada.\nListas são um dos formatos mais compartilháveis porque funcionam como recurso salvo — o leitor não precisa consumir tudo agora, pode guardar e usar depois, o que aumenta o save rate.\nA variação na arquitetura interna de cada item não quebra o formato porque o que o leitor reconhece não é a estrutura interna, mas a lógica de curadoria: alguém que sabe do assunto selecionou e organizou coisas relevantes em um lugar só.\nQuando os itens incluem opinião pessoal ou critério de quem os curou, o formato também funciona como construção de autoridade.",
    "prancha": "/banco/pranchas/lista.webp",
    "exemplos": [
      {
        "id": "DXwp0Sejdg2",
        "numero": 1,
        "url": "https://www.instagram.com/p/DXwp0Sejdg2/",
        "laminas": [
          "/banco/lista/DXwp0Sejdg2-01.webp",
          "/banco/lista/DXwp0Sejdg2-02.webp",
          "/banco/lista/DXwp0Sejdg2-03.webp",
          "/banco/lista/DXwp0Sejdg2-04.webp",
          "/banco/lista/DXwp0Sejdg2-05.webp",
          "/banco/lista/DXwp0Sejdg2-06.webp"
        ]
      },
      {
        "id": "DW9JWHsjdlp",
        "numero": 2,
        "url": "https://www.instagram.com/p/DW9JWHsjdlp/",
        "laminas": [
          "/banco/lista/DW9JWHsjdlp-01.webp",
          "/banco/lista/DW9JWHsjdlp-02.webp",
          "/banco/lista/DW9JWHsjdlp-03.webp",
          "/banco/lista/DW9JWHsjdlp-04.webp",
          "/banco/lista/DW9JWHsjdlp-05.webp",
          "/banco/lista/DW9JWHsjdlp-06.webp",
          "/banco/lista/DW9JWHsjdlp-07.webp"
        ]
      },
      {
        "id": "DUqDYjckc52",
        "numero": 3,
        "url": "https://www.instagram.com/p/DUqDYjckc52/",
        "laminas": [
          "/banco/lista/DUqDYjckc52-01.webp",
          "/banco/lista/DUqDYjckc52-02.webp",
          "/banco/lista/DUqDYjckc52-03.webp",
          "/banco/lista/DUqDYjckc52-04.webp",
          "/banco/lista/DUqDYjckc52-05.webp",
          "/banco/lista/DUqDYjckc52-06.webp",
          "/banco/lista/DUqDYjckc52-07.webp"
        ]
      },
      {
        "id": "DXenmWWFlWN",
        "numero": 4,
        "url": "https://www.instagram.com/p/DXenmWWFlWN/",
        "laminas": [
          "/banco/lista/DXenmWWFlWN-01.webp",
          "/banco/lista/DXenmWWFlWN-02.webp",
          "/banco/lista/DXenmWWFlWN-03.webp",
          "/banco/lista/DXenmWWFlWN-04.webp",
          "/banco/lista/DXenmWWFlWN-05.webp",
          "/banco/lista/DXenmWWFlWN-06.webp",
          "/banco/lista/DXenmWWFlWN-07.webp"
        ]
      },
      {
        "id": "DTlcW-rDuiX",
        "numero": 5,
        "url": "https://www.instagram.com/p/DTlcW-rDuiX/",
        "laminas": [
          "/banco/lista/DTlcW-rDuiX-01.webp",
          "/banco/lista/DTlcW-rDuiX-02.webp",
          "/banco/lista/DTlcW-rDuiX-03.webp",
          "/banco/lista/DTlcW-rDuiX-04.webp",
          "/banco/lista/DTlcW-rDuiX-05.webp"
        ]
      },
      {
        "id": "DWXKmeqlhEk",
        "numero": 6,
        "url": "https://www.instagram.com/p/DWXKmeqlhEk/",
        "laminas": [
          "/banco/lista/DWXKmeqlhEk-01.webp",
          "/banco/lista/DWXKmeqlhEk-02.webp",
          "/banco/lista/DWXKmeqlhEk-03.webp",
          "/banco/lista/DWXKmeqlhEk-04.webp",
          "/banco/lista/DWXKmeqlhEk-05.webp",
          "/banco/lista/DWXKmeqlhEk-06.webp",
          "/banco/lista/DWXKmeqlhEk-07.webp"
        ]
      }
    ]
  },
  {
    "id": "manchete",
    "nome": "Manchete",
    "intencoes": [
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/hna3xejg8jrhxr7"
    ],
    "estrutura": [
      "01 - Manchete (notícia real ou fato do setor formatado como titular de jornal)",
      "02 - O que aconteceu (detalhamento factual do evento noticiado)",
      "03 a N-1 - Análise do especialista (slides com contexto, dados de suporte, implicações — filtrados pela visão do criador)",
      "N - CTA (compartilhamento, engajamento ou oferta)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Titular em destaque tipográfico no estilo de capa de jornal ou revista: \"[Entidade/sujeito noticiado] + [verbo de ação ou descoberta] + [o que aconteceu].\" Pode incluir um card visual da notícia real (screenshot de manchete) sobreposto ao texto, reforçando que é fato, não opinião. Foto ou fundo de cor sólida relacionado ao tema. Subtítulo curto que adiciona dado de contraste ou provoca o leitor (\"E isso muda tudo.\" / \"Será? 👀\" / \"O país tem X mas só Y registrados.\")."
      },
      {
        "slide": "SLIDE 02",
        "como": "Detalhamento factual do evento: \"A [organização/entidade] [ação] um novo [marco/produto/centro/regulação]. / A mudança é resultado de [contexto temporal ou processual].\" Texto em formato de lead jornalístico — quem, o quê, quando, por quê. Foto de ambiente congruente com o tema (laboratório, fábrica, prédio institucional, etc.)."
      },
      {
        "slide": "SLIDES 03 a N-1",
        "como": "Cada slide aprofunda um aspecto da análise: impacto prático (\"O que muda?\"), contexto histórico do problema (\"Por que isso importa?\"), dados comparativos (\"Pra ter uma ideia do tamanho do problema:\"), dados de investimento ou tendência, análise de por que o leitor deveria se importar com isso. O tom é de especialista que filtra a notícia — não é repasse de informação, é interpretação com ponto de vista. Cada slide tem foto ou visual congruente; os dados ganham destaque tipográfico diferenciado."
      },
      {
        "slide": "SLIDE N (último)",
        "como": "CTA alinhado ao tom do carrossel. Duas variantes: (a) engajamento/alcance — \"Compartilha esse post com alguém que [se importa com o tema / precisa saber disso]\"; (b) conversão — \"Se você quer [aprender a navegar esse cenário / entender melhor], [produto/serviço] é pra você.\""
      }
    ],
    "porqueFunciona": "O formato aproveita o interesse que notícias geram naturalmente, mas entrega algo que portais de notícia não entregam: a interpretação de quem tem especialidade no assunto.\nA manchete na abertura filtra o público — quem avança já tem interesse no tema.\nOs slides seguintes posicionam o criador não como repórter, mas como analista: ele escolhe quais dados apresentar, qual contexto incluir, qual implicação destacar. Isso constrói autoridade de forma implícita: o leitor não recebe um CV, recebe evidência do raciocínio.\nO CTA de compartilhamento é especialmente eficiente nesse formato porque o leitor sente que está passando uma informação útil, não um post comercial.",
    "prancha": "/banco/pranchas/manchete.webp",
    "exemplos": [
      {
        "id": "DYQFIoJgMIV",
        "numero": 1,
        "url": "https://www.instagram.com/p/DYQFIoJgMIV/",
        "laminas": [
          "/banco/manchete/DYQFIoJgMIV-01.webp",
          "/banco/manchete/DYQFIoJgMIV-02.webp",
          "/banco/manchete/DYQFIoJgMIV-03.webp",
          "/banco/manchete/DYQFIoJgMIV-04.webp",
          "/banco/manchete/DYQFIoJgMIV-05.webp",
          "/banco/manchete/DYQFIoJgMIV-06.webp",
          "/banco/manchete/DYQFIoJgMIV-07.webp"
        ]
      },
      {
        "id": "DWXYSCFD7Fq",
        "numero": 2,
        "url": "https://www.instagram.com/p/DWXYSCFD7Fq/",
        "laminas": [
          "/banco/manchete/DWXYSCFD7Fq-01.webp",
          "/banco/manchete/DWXYSCFD7Fq-02.webp",
          "/banco/manchete/DWXYSCFD7Fq-03.webp",
          "/banco/manchete/DWXYSCFD7Fq-04.webp",
          "/banco/manchete/DWXYSCFD7Fq-05.webp",
          "/banco/manchete/DWXYSCFD7Fq-06.webp"
        ]
      },
      {
        "id": "DUoZBi_DRPo",
        "numero": 3,
        "url": "https://www.instagram.com/p/DUoZBi_DRPo/",
        "laminas": [
          "/banco/manchete/DUoZBi_DRPo-01.webp",
          "/banco/manchete/DUoZBi_DRPo-02.webp",
          "/banco/manchete/DUoZBi_DRPo-03.webp",
          "/banco/manchete/DUoZBi_DRPo-04.webp",
          "/banco/manchete/DUoZBi_DRPo-05.webp",
          "/banco/manchete/DUoZBi_DRPo-06.webp"
        ]
      }
    ]
  },
  {
    "id": "mudanca-de-perspectiva",
    "nome": "Mudança de perspectiva",
    "intencoes": [
      "CONEXÃO",
      "CONVERSÃO"
    ],
    "canva": [
      "https://canva.link/9pi0ku7bybymf13"
    ],
    "estrutura": [
      "01 - Crença limitante (gancho de identificação)",
      "02 - Reposicionamento (virada de perspectiva)",
      "03 - Repetição estrutural (2 a 3 viradas adicionais)",
      "04 - Provocação ou alerta (quebra de padrão)",
      "05 - Tese de fechamento (frame mental que fica)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Você [nunca/não] tinha achado [algo seu — vitrine, loja, conteúdo, atendimento] [adjetivo negativo brando — ruim, sem graça, fraco]…\nAté ver [gatilho externo específico — concorrente, influencer, timeline] [fazendo algo aspiracional ou performando]."
      },
      {
        "slide": "SLIDE 02",
        "como": "Você [nunca/não] tinha achado [outro aspecto seu] [adjetivo negativo brando]…\nAté ver [outro gatilho externo] [fazendo algo que parece estar dando certo]."
      },
      {
        "slide": "SLIDE 03",
        "como": "Você [nunca/não] achava [terceiro aspecto seu] [adjetivo negativo brando]…\nAté ver como [mecanismo de distorção — timeline, redes, mercado] [cria a ilusão de que todo mundo está performando]."
      },
      {
        "slide": "SLIDE 04",
        "como": "Será que [sua realidade/seu produto/seu trabalho] [está tão ruim/fraco/atrasado] assim…\nou só te convenceram disso pra você continuar [comportamento prejudicial — comprando sem pensar, dando desconto, se sabotando, copiando]?"
      },
      {
        "slide": "SLIDE 05",
        "como": "Cuidado: você pode acabar virando refém [da comparação / do espelho errado / do que os outros mostram], só porque [o que aparece pra fora] parece [adjetivo positivo] do que [a realidade interna do seu negócio/trabalho]."
      },
      {
        "slide": "SLIDE 06",
        "como": "[Frase de tese ampla — o que você consome influencia o que você acredita, e o que você acredita influencia o que você constrói].\n[Frase-virada em destaque — marca forte / negócio forte / criadora forte começa quando você para de [comportamento ruim] e começa a [comportamento estratégico]]."
      }
    ],
    "porqueFunciona": "Esse formato funciona porque opera em cima de uma única mecânica psicológica: pegar uma crença que o leitor acha que é verdade e virar ela do avesso na frente dele.",
    "prancha": "/banco/pranchas/mudanca-de-perspectiva.webp",
    "exemplos": [
      {
        "id": "DTfrb6mESlN",
        "numero": 1,
        "url": "https://www.instagram.com/p/DTfrb6mESlN/",
        "laminas": [
          "/banco/mudanca-de-perspectiva/DTfrb6mESlN-01.webp",
          "/banco/mudanca-de-perspectiva/DTfrb6mESlN-02.webp",
          "/banco/mudanca-de-perspectiva/DTfrb6mESlN-03.webp",
          "/banco/mudanca-de-perspectiva/DTfrb6mESlN-04.webp",
          "/banco/mudanca-de-perspectiva/DTfrb6mESlN-05.webp",
          "/banco/mudanca-de-perspectiva/DTfrb6mESlN-06.webp",
          "/banco/mudanca-de-perspectiva/DTfrb6mESlN-07.webp"
        ]
      },
      {
        "id": "DKQRlfJvgzQ",
        "numero": 2,
        "url": "https://www.instagram.com/p/DKQRlfJvgzQ/",
        "laminas": [
          "/banco/mudanca-de-perspectiva/DKQRlfJvgzQ-01.webp",
          "/banco/mudanca-de-perspectiva/DKQRlfJvgzQ-02.webp",
          "/banco/mudanca-de-perspectiva/DKQRlfJvgzQ-03.webp",
          "/banco/mudanca-de-perspectiva/DKQRlfJvgzQ-04.webp",
          "/banco/mudanca-de-perspectiva/DKQRlfJvgzQ-05.webp"
        ]
      }
    ]
  },
  {
    "id": "opiniao-sincera",
    "nome": "Opinião Sincera",
    "intencoes": [
      "CONEXÃO",
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/y22jcmj6khb8dtv"
    ],
    "estrutura": [
      "01 - Gancho de posicionamento (convite irreverente a \"falar mal\" / ter opinião)",
      "02 a 0N - Opiniões individuais do criador sobre temas/práticas do nicho (cada uma em slide próprio)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Foto do criador em ambiente cotidiano. Texto em destaque com gancho de posicionamento que usa uma metáfora social informal para sinalizar que o carrossel vai trazer opiniões diretas: \n\"Eu facilmente [ação social descontraída — sentar num bar, tomar um café, etc.] pra [falar mal de / dar minha opinião sincera sobre / jogar hate em]...\" — o texto termina com reticências ou emoji para criar antecipação."
      },
      {
        "slide": "SLIDES 02 a 0N",
        "como": "Cada slide traz uma opinião sobre um item do nicho. Há duas variações possíveis nos slides de conteúdo, que podem se alternar no mesmo carrossel: \n(A) Estrutura \"crença popular + refutação\": citação de uma crença, prática ou frase comum do nicho entre aspas + parágrafo com a opinião direta do criador, que pode ser um dado, argumento ou pergunta retórica; \n(B) Estrutura \"crítica direta\": afirmação de opinião sem citar uma crença adversária — o criador nomeia uma prática, perfil ou comportamento e descreve o que acha de forma direta, sem contraditório explícito. O tom varia de irônico a assertivo, mas nunca neutro."
      },
      {
        "slide": "SLIDE FINAL",
        "como": "Texto com CTA que fecha o loop narrativo do slide 1, devolvendo a voz ao público: \"E você? [Variação do cenário do gancho — entraria nesse café, sentaria nessa mesa, etc.]? [Pergunta sobre qual seria a opinião do leitor].\" A pergunta é aberta e convida comentário personalizado."
      }
    ],
    "porqueFunciona": "O gancho \"falar mal de\" funciona porque transforma o carrossel em uma conversa entre iguais — não é um especialista dando aula, é alguém tendo uma opinião em voz alta.\nO enquadramento de bar/café cria intimidade e sinaliza que o criador vai se posicionar de verdade, o que gera curiosidade nos slides seguintes.\nCada slide de opinião reforça o posicionamento do criador e filtra a audiência: quem concorda se identifica, quem discorda comenta — ambos geram engajamento.\nO CTA final converte o leitor de espectador em participante da conversa, aumentando a taxa de comentários.\nA estrutura inteira funciona como \"fofoca de nicho\": entrega opinião com a leveza de uma conversa, o que reduz a percepção de auto-promoção e aumenta a sensação de autenticidade.",
    "prancha": "/banco/pranchas/opiniao-sincera.webp",
    "exemplos": [
      {
        "id": "DKE7BPZR_Ll",
        "numero": 1,
        "url": "https://www.instagram.com/p/DKE7BPZR_Ll/",
        "laminas": [
          "/banco/opiniao-sincera/DKE7BPZR_Ll-01.webp",
          "/banco/opiniao-sincera/DKE7BPZR_Ll-02.webp",
          "/banco/opiniao-sincera/DKE7BPZR_Ll-03.webp",
          "/banco/opiniao-sincera/DKE7BPZR_Ll-04.webp",
          "/banco/opiniao-sincera/DKE7BPZR_Ll-05.webp",
          "/banco/opiniao-sincera/DKE7BPZR_Ll-06.webp",
          "/banco/opiniao-sincera/DKE7BPZR_Ll-07.webp",
          "/banco/opiniao-sincera/DKE7BPZR_Ll-08.webp"
        ]
      },
      {
        "id": "DObQy7QDdk_",
        "numero": 2,
        "url": "https://www.instagram.com/p/DObQy7QDdk_/",
        "laminas": [
          "/banco/opiniao-sincera/DObQy7QDdk_-01.webp",
          "/banco/opiniao-sincera/DObQy7QDdk_-02.webp",
          "/banco/opiniao-sincera/DObQy7QDdk_-03.webp",
          "/banco/opiniao-sincera/DObQy7QDdk_-04.webp",
          "/banco/opiniao-sincera/DObQy7QDdk_-05.webp",
          "/banco/opiniao-sincera/DObQy7QDdk_-06.webp"
        ]
      }
    ]
  },
  {
    "id": "pov",
    "nome": "POV",
    "intencoes": [
      "CONVERSÃO"
    ],
    "canva": [
      "https://canva.link/wj8o3a6m5b3yda3"
    ],
    "estrutura": [
      "01 - Gancho POV (projeção de cenário desejado)",
      "02 a N-1 - Benefício ou conteúdo revelado (demonstração com imagem de prova)",
      "N - CTA (palavra-chave nos comentários)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Abre com \"pov:\" seguido de uma frase curta que coloca o leitor dentro de um cenário já resolvido: \"pov: você [ação concluída ou hábito estabelecido — ex.: criou, organizou, aprendeu] [objeto — ferramenta, método, produto] e [resultado imediato que elimina uma dor — ex.: nunca mais se perdeu, parou de errar, economizou tempo]\". Pode incluir subtítulo entre parênteses reforçando a acessibilidade ou o valor do que está por vir. A variante sem o prefixo \"pov:\" usa \"Coisas [adjetivo positivo informal] que eu coloquei em [nome do produto/conteúdo]\" e funciona pelo mesmo mecanismo: o leitor se imagina acessando aquilo."
      },
      {
        "slide": "SLIDES 02 a N-1",
        "como": "Cada slide revela um benefício ou item específico do que foi apresentado no gancho. Estrutura interna de cada slide: título curto em destaque nomeando o benefício (\"[nome do recurso/funcionalidade] que [promessa direta]\"), seguido de 1 a 3 linhas explicando o problema que ele resolve e como resolve — em linguagem direta, sem genéricas. Sempre acompanhado de imagem de prova: screenshot da ferramenta, foto do produto aberto, tela do sistema, ou resultado visual concreto. O número de slides de desenvolvimento varia conforme a quantidade de benefícios ou itens a revelar (nos exemplos: 6 slides de desenvolvimento)."
      },
      {
        "slide": "SLIDE N (último)",
        "como": "CTA de conversão com palavra-chave nos comentários: \"comenta [PALAVRA] e [o que recebe — link, acesso, produto com condição]\". Foto do criador ou do produto em close, criando presença humana no fechamento. Sem texto de valor adicional — função exclusiva de conversão."
      }
    ],
    "porqueFunciona": "O formato POV ativa desejo por antecipação: antes de apresentar qualquer benefício específico, o primeiro slide coloca o leitor dentro de um cenário já resolvido — como se o resultado fosse presente, não futuro. Isso cria engajamento imediato porque o leitor não precisa \"decidir se quer\"; ele já está no cenário.\nOs slides de desenvolvimento funcionam como prova acumulativa: cada um entrega um benefício concreto com evidência visual, aumentando a credibilidade slide a slide e incentivando o avanço para ver mais.\nO CTA no último slide captura quem chegou até o fim com intenção ativada, convertendo através de fricção mínima (apenas comentar uma palavra).",
    "prancha": "/banco/pranchas/pov.webp",
    "exemplos": [
      {
        "id": "DN39yKMjSOU",
        "numero": 1,
        "url": "https://www.instagram.com/p/DN39yKMjSOU/",
        "laminas": [
          "/banco/pov/DN39yKMjSOU-01.webp",
          "/banco/pov/DN39yKMjSOU-02.webp",
          "/banco/pov/DN39yKMjSOU-03.webp",
          "/banco/pov/DN39yKMjSOU-04.webp",
          "/banco/pov/DN39yKMjSOU-05.webp",
          "/banco/pov/DN39yKMjSOU-06.webp",
          "/banco/pov/DN39yKMjSOU-07.webp",
          "/banco/pov/DN39yKMjSOU-08.webp"
        ]
      },
      {
        "id": "DX_uxAMln2b",
        "numero": 2,
        "url": "https://www.instagram.com/p/DX_uxAMln2b/",
        "laminas": [
          "/banco/pov/DX_uxAMln2b-01.webp",
          "/banco/pov/DX_uxAMln2b-02.webp",
          "/banco/pov/DX_uxAMln2b-03.webp",
          "/banco/pov/DX_uxAMln2b-04.webp",
          "/banco/pov/DX_uxAMln2b-05.webp",
          "/banco/pov/DX_uxAMln2b-06.webp",
          "/banco/pov/DX_uxAMln2b-07.webp"
        ]
      }
    ]
  },
  {
    "id": "se-ela-fez-voce-tambem-pode",
    "nome": "Se ela fez, você também pode",
    "intencoes": [
      "CONEXÃO",
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/9pi0ku7bybymf13"
    ],
    "estrutura": [
      "01 - Objeção/desculpa do público (gancho de identificação)",
      "02 - Case de referência que superou aquela mesma limitação (prova social)",
      "03 - [Repetição do par objeção + case] × N vezes",
      "04 - Slide de virada: verdade universal sobre o ponto de partida (reframe)",
      "05 - Fechamento: convite à ação ou declaração de posicionamento (CTA implícito)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Foto ou vídeo do criador + frase de objeção em destaque visual, escrita na primeira pessoa e entre aspas. A frase representa uma crença limitante comum ao público-alvo: \n\"[Desculpa ou crença limitante que o público-alvo tem sobre si mesmo — ex.: limitação de tempo, visibilidade, recurso ou identidade].\""
      },
      {
        "slide": "SLIDE 02",
        "como": "Imagem de uma referência conhecida no nicho + texto descritivo em dois blocos: (1) nome da referência em destaque + ação concreta que ela tomava quando estava na mesma situação; (2) resultado atual, com número ou indicador de escala. \nFormato: \"[Nome da referência] [fez/usava/começou com] [condição limitante equivalente]. [Resultado atual em números ou posição de mercado].\""
      },
      {
        "slide": "SLIDES 03–0N",
        "como": "Repetição do par objeção + case para cada crença limitante adicional. A objeção muda, o case muda, mas a estrutura visual e o padrão textual são idênticos ao par anterior. \nCada dupla de slides funciona de forma independente: o leitor reconhece a objeção antes de ver o case."
      },
      {
        "slide": "SLIDE FINAL",
        "como": "Frase de encerramento curta, com gancho de continuação ou CTA implícito: \n\"Mas só [resultado desejado — crescer, vender, aparecer, etc.] quem decide [ação necessária] mesmo assim.\" Sem call-to-action explícito — o peso está na frase."
      }
    ],
    "porqueFunciona": "O formato derruba objeções por espelho: em vez de argumentar racionalmente contra a desculpa do leitor, ele apresenta uma referência que tinha a mesma crença e chegou a um resultado que o leitor deseja.\nIsso usa prova social por identificação — não por aspiração de um perfil distante. Cada par objeção + case funciona como um loop de leitura autônomo, o que garante engajamento slide a slide mesmo que o leitor entre no carrossel pela metade.\nO slide de virada no fim coletiviza a experiência (\"todo mundo começa assim\"), removendo o senso de desvantagem individual, e o fechamento desloca a responsabilidade de condições externas para decisão interna — o que gera ressonância sem criar culpa.",
    "prancha": "/banco/pranchas/se-ela-fez-voce-tambem-pode.webp",
    "exemplos": [
      {
        "id": "DLKe95Hu5z-",
        "numero": 1,
        "url": "https://www.instagram.com/p/DLKe95Hu5z-/",
        "laminas": [
          "/banco/se-ela-fez-voce-tambem-pode/DLKe95Hu5z--01.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLKe95Hu5z--02.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLKe95Hu5z--03.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLKe95Hu5z--04.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLKe95Hu5z--05.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLKe95Hu5z--06.webp"
        ]
      },
      {
        "id": "DLM2bHiMNNq",
        "numero": 2,
        "url": "https://www.instagram.com/p/DLM2bHiMNNq/",
        "laminas": [
          "/banco/se-ela-fez-voce-tambem-pode/DLM2bHiMNNq-01.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLM2bHiMNNq-02.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLM2bHiMNNq-03.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLM2bHiMNNq-04.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLM2bHiMNNq-05.webp",
          "/banco/se-ela-fez-voce-tambem-pode/DLM2bHiMNNq-06.webp"
        ]
      }
    ]
  },
  {
    "id": "se-x-faca-y",
    "nome": "Se X, faça Y",
    "intencoes": [
      "CONVERSÃO"
    ],
    "canva": [
      "https://canva.link/9pi0ku7bybymf13",
      "https://canva.link/fy2s9owfxub2035"
    ],
    "estrutura": [
      "01 a 0N - Pares condição/recomendação (cada slide = 1 situação/perfil [X] + 1 solução/indicação do criador [Y])"
    ],
    "detalhamento": [
      {
        "slide": "SLIDES 01 a 0N",
        "como": "Pares Se/Então. Cada slide é autossuficiente e segue a mesma estrutura visual e textual: \n(A) imagem que representa a condição — pode ser foto de cliente real ou fictício, referência cultural (personagem de série/filme), cena do cotidiano do nicho, antes/depois, ou imagem do ambiente/contexto; \n(B) texto em overlay — linha 1 (topo ou centro): \"Se [condição, perfil, queixa ou situação do cliente/seguidor]\" — o X pode ser uma necessidade técnica, um estilo de vida, uma queixa, um desejo ou uma referência cultural; linha 2 (destaque/contraste): \"Você deveria considerar:\" / \"Eu recomendo:\" / \"A pedra ideal para você é:\" / \"Embrulhei a...\" — o Y é a recomendação específica e técnica do criador. Visual: fotografias de qualidade que mostram tanto o contexto (X) quanto o produto/solução (Y), idealmente lado a lado ou em corte vertical (2x1 ou antes/depois)."
      },
      {
        "slide": "SLIDE 0N+1",
        "como": "Fechamento. Foto do criador (profissional ou casual) ou imagem do ambiente de trabalho/nicho. Pergunta de engajamento que devolve a escolha para o leitor: \"[E você, concorda com [as minhas escolhas] / qual foi o seu favorito / qual você colocaria na sua cartinha]?\" Não precisa de CTA de seguir — a pergunta já gera o comentário."
      }
    ],
    "porqueFunciona": "O formato \"Se X, faça Y\" funciona porque é um motor de identificação: o leitor escaneia os slides procurando a condição que descreve a situação dele — e quando encontra, a recomendação parece personalizada, não genérica.\nCada par é uma demonstração discreta de expertise: o criador não afirma que é especialista, simplesmente mostra que sabe o que fazer quando a situação é X.\nA repetição do padrão por vários slides cria uma sensação de enciclopédia curada — \"esse perfil tem a resposta para tudo que acontece no meu nicho\" — o que gera seguidores e salvamentos. O fechamento com pergunta transfere a agência para o leitor, o que gera comentários sem precisar pedir explicitamente.\nO formato é altamente escalável: o mesmo carrossel pode ser refeito com outras condições (X) quantas vezes quiser, e cada versão parece conteúdo novo.",
    "prancha": "/banco/pranchas/se-x-faca-y.webp",
    "exemplos": [
      {
        "id": "DU5gstSkejn",
        "numero": 1,
        "url": "https://www.instagram.com/p/DU5gstSkejn/",
        "laminas": [
          "/banco/se-x-faca-y/DU5gstSkejn-01.webp",
          "/banco/se-x-faca-y/DU5gstSkejn-02.webp",
          "/banco/se-x-faca-y/DU5gstSkejn-03.webp",
          "/banco/se-x-faca-y/DU5gstSkejn-04.webp",
          "/banco/se-x-faca-y/DU5gstSkejn-05.webp"
        ]
      },
      {
        "id": "DRhlgMXkeEq",
        "numero": 2,
        "url": "https://www.instagram.com/p/DRhlgMXkeEq/",
        "laminas": [
          "/banco/se-x-faca-y/DRhlgMXkeEq-01.webp",
          "/banco/se-x-faca-y/DRhlgMXkeEq-02.webp",
          "/banco/se-x-faca-y/DRhlgMXkeEq-03.webp",
          "/banco/se-x-faca-y/DRhlgMXkeEq-04.webp"
        ]
      },
      {
        "id": "DSsvZgajbjq",
        "numero": 3,
        "url": "https://www.instagram.com/p/DSsvZgajbjq/",
        "laminas": [
          "/banco/se-x-faca-y/DSsvZgajbjq-01.webp",
          "/banco/se-x-faca-y/DSsvZgajbjq-02.webp",
          "/banco/se-x-faca-y/DSsvZgajbjq-03.webp",
          "/banco/se-x-faca-y/DSsvZgajbjq-04.webp",
          "/banco/se-x-faca-y/DSsvZgajbjq-05.webp",
          "/banco/se-x-faca-y/DSsvZgajbjq-06.webp"
        ]
      },
      {
        "id": "DXy5TOmFgQ1",
        "numero": 4,
        "url": "https://www.instagram.com/p/DXy5TOmFgQ1/",
        "laminas": [
          "/banco/se-x-faca-y/DXy5TOmFgQ1-01.webp",
          "/banco/se-x-faca-y/DXy5TOmFgQ1-02.webp",
          "/banco/se-x-faca-y/DXy5TOmFgQ1-03.webp",
          "/banco/se-x-faca-y/DXy5TOmFgQ1-04.webp",
          "/banco/se-x-faca-y/DXy5TOmFgQ1-05.webp",
          "/banco/se-x-faca-y/DXy5TOmFgQ1-06.webp"
        ]
      }
    ]
  },
  {
    "id": "situacao-comum",
    "nome": "Situação comum",
    "intencoes": [
      "CONEXÃO"
    ],
    "canva": [
      "https://canva.link/qg1euniwqnclwdp"
    ],
    "estrutura": [
      "01 - Cena de abertura (o gatilho do conflito)",
      "02 - Resposta evasiva (o adiamento que dói)",
      "03 - Confissão silenciosa (a verdade que ela não diz em voz alta)",
      "04 - Quebra da quarta parede (o criador falando direto com o leitor)",
      "05 - Cena de virada (a mesma situação inicial, agora resolvida)",
      "06 - Tese de fechamento (a redefinição do que importa)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Cena ilustrada da personagem em situação cotidiana, com [pessoa importante da vida dela — filho, parceiro, mãe, amiga] fazendo [pedido simples, banal, que qualquer um faria] em forma de pergunta direta.\nBalão de fala: \"[Pergunta cotidiana que envolve presença, tempo ou atenção da personagem]?\""
      },
      {
        "slide": "SLIDE 02",
        "como": "Mesma personagem, agora em close, com expressão de cansaço/culpa. Resposta morna, adiamento disfarçado de esforço.\nBalão de fala: \"[Resposta que tenta agradar mas já entrega que não vai rolar — \"vou tentar\", \"se der\", \"depende do dia\"]…\""
      },
      {
        "slide": "SLIDE 03",
        "como": "Personagem sozinha, em cena de exaustão silenciosa (sentada no chão, mão na cabeça, olhar perdido). A verdade que ela só admite pra si mesma.\nCaixa de texto sobre a cena (em destaque): \"[CONFISSÃO QUE EXPÕE O CONFLITO CENTRAL — abri/comecei/aceitei [coisa] por [motivo nobre], MAS [estou pagando um preço que não quero pagar].]\""
      },
      {
        "slide": "SLIDE 04",
        "como": "Quebra visual — personagem em estilo cartoon/meme apontando o dedo direto pro leitor. O criador assume a voz da consciência e fala com quem tá lendo.\nBalão de fala: \"Você não [começou/abriu/aceitou] [aquilo] pra [perder/abrir mão de] [o que mais importa pra você]. [Aquilo] que [consequência destrutiva específica] não é [palavra aspiracional — sonho, liberdade, propósito]. É [redefinição dura — prisão com vitrine, escravidão disfarçada, sequestro de identidade].\""
      },
      {
        "slide": "SLIDE 05",
        "como": "Volta à cena inicial, mas agora resolvida. Personagem feliz, em contato com a pessoa importante do slide 01, em ambiente leve (luz dourada, abraço, sorriso).\nBalão de fala: \"[Frase curta que mostra a virada — \"Hoje [o motivo de exaustão] não me impediu de ser [o papel que importa].\"]\""
      },
      {
        "slide": "SLIDE 06",
        "como": "Fundo de papel/textura, sem ilustração. Tese final em tipografia limpa.\nTexto: \"[Definição comum de sucesso — faturar alto, crescer rápido, ter muita coisa] não é [a coisa toda]. [Sucesso/realização/conquista] de verdade é [redefinição que coloca a pessoa e seus vínculos no centro].\""
      }
    ],
    "porqueFunciona": "Esse formato funciona porque opera em cima de uma mecânica narrativa rara em conteúdo de Instagram: micro-ficção com moral. Não é o criador falando da própria experiência, nem dando dica direta: é uma história curta com personagem, conflito e resolução, onde o leitor se vê de fora primeiro, e por isso baixa a guarda. Quando vem a quebra da quarta parede (slide 04), o leitor já tá emocionalmente investido - e a verdade dura entra sem resistência.",
    "prancha": "/banco/pranchas/situacao-comum.webp",
    "exemplos": [
      {
        "id": "DLFrp5hs6Zh",
        "numero": 1,
        "url": "https://www.instagram.com/p/DLFrp5hs6Zh/",
        "laminas": [
          "/banco/situacao-comum/DLFrp5hs6Zh-01.webp",
          "/banco/situacao-comum/DLFrp5hs6Zh-02.webp",
          "/banco/situacao-comum/DLFrp5hs6Zh-03.webp",
          "/banco/situacao-comum/DLFrp5hs6Zh-04.webp",
          "/banco/situacao-comum/DLFrp5hs6Zh-05.webp",
          "/banco/situacao-comum/DLFrp5hs6Zh-06.webp"
        ]
      },
      {
        "id": "DIgUwJfAsAN",
        "numero": 2,
        "url": "https://www.instagram.com/p/DIgUwJfAsAN/",
        "laminas": [
          "/banco/situacao-comum/DIgUwJfAsAN-01.webp",
          "/banco/situacao-comum/DIgUwJfAsAN-02.webp",
          "/banco/situacao-comum/DIgUwJfAsAN-03.webp",
          "/banco/situacao-comum/DIgUwJfAsAN-04.webp",
          "/banco/situacao-comum/DIgUwJfAsAN-05.webp",
          "/banco/situacao-comum/DIgUwJfAsAN-06.webp",
          "/banco/situacao-comum/DIgUwJfAsAN-07.webp"
        ]
      }
    ]
  },
  {
    "id": "tapa-na-cara",
    "nome": "Tapa na Cara",
    "intencoes": [
      "CONVERSÃO",
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/x1wsij2q0k0ujlh"
    ],
    "estrutura": [
      "01 - Afirmação de impacto (nomeia o erro ou a crença equivocada do leitor de forma direta e sem suavizar)",
      "02 - Desconstrução da crença (explica por que a lógica que o leitor usa está errada ou incompleta)",
      "03 - Exposição dos custos ocultos (lista ou descrição do que o leitor não está vendo e que está causando o problema)",
      "04 - Diagnóstico da raiz (nomeia o problema real de forma definitiva — sem culpar, sem consolar)",
      "05 - Reencuadramento (como o profissional de verdade pensa/faz — reposiciona o padrão correto)",
      "06 - CTA"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Texto tipográfico em formato editorial — fundo limpo (branco, bege ou foto editorial) com tipografia grande e mista (parte do texto em tamanho maior, palavra-chave do erro em itálico ou sublinhado em cor de destaque). \nA afirmação nomeia diretamente o comportamento equivocado do leitor: \"Você [faz X] e depois não entende por que [resultado negativo Y].\" ou \"Você [acredita em Z] / E isso é o que está [impedindo / custando / sabotando].\" Nenhuma suavização — o tom é de espelho, não de acusação."
      },
      {
        "slide": "SLIDE 02",
        "como": "Mesmo estilo tipográfico. Desconstrução da lógica usada pelo leitor: \"Você [raciocina assim]: [lógica interna do leitor]. / [Frase curta de ruptura em destaque — \"Só que essa conta não existe\" / \"Não é nada disso.\"]. / Porque [o que realmente acontece, em contraste com a crença].\""
      },
      {
        "slide": "SLIDE 03",
        "como": "Exposição dos custos ocultos ou consequências invisíveis. Pode ser em formato de lista com marcadores visuais negativos (X, traços) — \"Do seu [resultado que o leitor acha que tem], desconta: [lista de custos/fatores ignorados]. / [Pergunta retórica que deixa o leitor no vazio — \"Quanto sobrou agora?\"]\" — ou em formato de texto argumentativo descrevendo o encadeamento de causas e efeitos que o leitor não percebe."
      },
      {
        "slide": "SLIDE 04",
        "como": "Diagnóstico definitivo da raiz do problema: \"A maioria de [perfil do leitor] [acredita / faz / acha] que [crença equivocada]. / E só descobre o erro quando [consequência tardia e dolorosa]. / Aí culpa [fatores externos]. Mas o problema tava em [causa real] desde o começo.\""
      },
      {
        "slide": "SLIDE 05",
        "como": "Reenquadramento — como quem domina o assunto age: \"[Perfil de quem acertou] não [faz o que o leitor faz]. / [Ele/ela] [faz o oposto, descrito com precisão técnica]. / Isso não é [qualidade subjetiva — talento, sorte]. É [competência técnica nomeável — gestão, estratégia, processo].\""
      },
      {
        "slide": "SLIDE 06 (último)",
        "como": "CTA direto: \"Se você quer [resolver o problema nomeado no carrossel], [produto/serviço] é pra você. / Comenta [PALAVRA] que eu te mando [informações/link] no direct.\" Mesmo estilo tipográfico dos slides anteriores — sem foto, sem ornamentos."
      }
    ],
    "porqueFunciona": "O formato funciona porque nomeia o erro sem pedir permissão.\nA afirmação de abertura não é uma pergunta, não é suave, não diz \"muita gente acha que...\" — ela aponta direto para o leitor com \"você\".\nIsso cria dissonância cognitiva imediata: o leitor que se identifica é obrigado a continuar para confirmar ou refutar a acusação.\nCada slide seguinte aumenta a clareza do problema e diminui as saídas possíveis — até o slide de diagnóstico, quando o leitor já não tem como atribuir o problema a fatores externos. O reenquadramento no penúltimo slide oferece a saída: não com elogio, mas com a descrição objetiva de quem age diferente.\nO CTA chega quando o leitor está com a consciência do problema no pico e sem outra resposta disponível.",
    "prancha": "/banco/pranchas/tapa-na-cara.webp",
    "exemplos": [
      {
        "id": "DYcM9nLESQA",
        "numero": 1,
        "url": "https://www.instagram.com/p/DYcM9nLESQA/",
        "laminas": [
          "/banco/tapa-na-cara/DYcM9nLESQA-01.webp",
          "/banco/tapa-na-cara/DYcM9nLESQA-02.webp",
          "/banco/tapa-na-cara/DYcM9nLESQA-03.webp",
          "/banco/tapa-na-cara/DYcM9nLESQA-04.webp",
          "/banco/tapa-na-cara/DYcM9nLESQA-05.webp",
          "/banco/tapa-na-cara/DYcM9nLESQA-06.webp"
        ]
      },
      {
        "id": "DXPHOXtjlNn",
        "numero": 2,
        "url": "https://www.instagram.com/p/DXPHOXtjlNn/",
        "laminas": [
          "/banco/tapa-na-cara/DXPHOXtjlNn-01.webp",
          "/banco/tapa-na-cara/DXPHOXtjlNn-02.webp",
          "/banco/tapa-na-cara/DXPHOXtjlNn-03.webp",
          "/banco/tapa-na-cara/DXPHOXtjlNn-04.webp",
          "/banco/tapa-na-cara/DXPHOXtjlNn-05.webp",
          "/banco/tapa-na-cara/DXPHOXtjlNn-06.webp"
        ]
      }
    ]
  },
  {
    "id": "trajetoria",
    "nome": "Trajetória",
    "intencoes": [
      "CONEXÃO"
    ],
    "canva": [
      "https://canva.link/zjr8zojkgvf5p9x"
    ],
    "estrutura": [
      "01 - Dia um (contexto de origem — o ponto de partida humilde, o motivo real de ter começado)",
      "02 - Um dia (lista de conquistas — resultados concretos acumulados desde o dia um)",
      "03 - Encerramento com ensinamento (frase de fechamento — reflexão sobre o que o trabalho consistente entrega)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "Título grande: \"Dia um\". Foto(s) do criador na época de início — quanto mais diferente da aparência ou contexto atual, melhor o contraste. \nTexto em caixa sobreposta: [ação concreta que o criador estava tomando no início — ex: \"comecei a documentar meus estudos sobre [área] porque eu queria [objetivo prático e pessoal]\"]. O tom é factual, sem glamour — o objetivo é mostrar que o ponto de partida era ordinário."
      },
      {
        "slide": "SLIDE 02",
        "como": "Título grande: \"Um dia\". Foto(s) atual(is) do criador, ambiente de trabalho ou símbolos visuais de resultado. \nLista com três ou mais conquistas objetivas: \"+ de [número] [clientes/alunos/seguidores] em [produto/canal/plataforma]\". Cada linha usa o mesmo padrão de métrica + contexto. Sem adjetivos — só números e fatos."
      },
      {
        "slide": "SLIDE 03",
        "como": "Fundo neutro ou foto de trabalho em ação. Frase de encerramento em texto grande: \"[metáfora ou afirmação sobre o que o trabalho consistente entrega — ex: o trabalho te paga com juros e correção monetária]\". Sem CTA explícito — a frase é o fechamento."
      }
    ],
    "porqueFunciona": "O formato usa a oposição temporal \"Dia um / Um dia\" como eixo narrativo: o primeiro slide ancora o leitor num passado reconhecível e sem glamour, o segundo entrega os resultados de forma quantitativa e crível, e o terceiro generaliza a lição sem pregar.\nA lógica funciona porque o leitor que está no \"dia um\" (iniciante, inseguro, sem resultados) se vê no slide 01 e projeta o desejo no slide 02 — mas o que gera engajamento real é a ausência de moralização: o criador não instrui, apenas mostra.\nO fechamento com metáfora de juros reforça o mecanismo (consistência = acúmulo) sem usar linguagem de autoajuda.",
    "prancha": "/banco/pranchas/trajetoria.webp",
    "exemplos": [
      {
        "id": "DXzTiJcjXJC",
        "numero": 1,
        "url": "https://www.instagram.com/p/DXzTiJcjXJC/",
        "laminas": [
          "/banco/trajetoria/DXzTiJcjXJC-01.webp",
          "/banco/trajetoria/DXzTiJcjXJC-02.webp",
          "/banco/trajetoria/DXzTiJcjXJC-03.webp"
        ]
      }
    ]
  },
  {
    "id": "tutorial",
    "nome": "Tutorial",
    "intencoes": [
      "CONVERSÃO",
      "CRESCIMENTO"
    ],
    "canva": [
      "https://canva.link/zjr8zojkgvf5p9x"
    ],
    "estrutura": [
      "01 - Capa (título do tutorial + visual do contexto/nicho — apresenta o QUE será ensinado)",
      "02 - Premissa ou diferencial (explica O PORQUÊ ou a lógica por trás do método antes de mostrar os passos — presente nos dois exemplos)",
      "03 a 0N - Passos numerados (cada slide = 1 passo/princípio com número, nome, instrução operacional e imagem do criador)"
    ],
    "detalhamento": [
      {
        "slide": "SLIDE 01",
        "como": "\"Como [fazer X] [contexto específico]\" ou variação direta (\"O meu método para [tarefa]\"). Inclui nome/marca do criador. Tom: direto, promessa clara de entrega."
      },
      {
        "slide": "SLIDE 02",
        "como": "Premissa ou diferencial. Fundo neutro ou foto do criador trabalhando. T\nexto: \"A chave do meu método é: [insight ou premissa que diferencia a abordagem do criador]\". \nSeguido de explicação de por que essa premissa importa: \"[o que acontece quando você ignora essa premissa — dificuldade, erro comum]\". \nFinaliza com convite explícito para continuar: \"[Deixa eu te mostrar como faço / veja como aplicar nos próximos slides].\""
      },
      {
        "slide": "SLIDES 03 a 0N",
        "como": "Passos numerados.\n(A) título do passo em destaque: \"[Número]) [Nome do passo]\"; \n(B) instrução operacional — o que fazer, quando, como: \"[Descrição da ação + contexto de aplicação]\"; \n(C) resultado esperado daquele passo: \"[O que você ganha / o que isso resolve]\". Foto do criador — selfie casual, foto no ambiente de trabalho ou foto posada. \nCada passo é autossuficiente: o leitor deve entender a instrução sem precisar dos outros slides."
      },
      {
        "slide": "SLIDE 0N+1",
        "como": "Fechamento. Foto profissional ou editorial do criador. Frase-remate que sintetiza o princípio central do tutorial: \"[conclusão sobre o que o método revela no fundo]\". CTA direto: \"Me segue pra [benefício contínuo]\" ou convite para próximo passo (comentar, acessar link, aula ao vivo)."
      }
    ],
    "porqueFunciona": "O Tutorial funciona porque entrega instrução acionável em um formato que o leitor pode seguir imediatamente — o que gera salvamento.\nA estrutura numerada reduz o atrito de leitura: o leitor sabe que está no passo 2 de 4, sabe onde está e o que falta.\nA inclusão de uma premissa antes dos passos (slide 02) é o que diferencia esse formato de uma lista genérica: o criador apresenta a lógica por trás do método, o que eleva a percepção de expertise e justifica por que aquela sequência específica funciona.\nO fechamento com frase-remate e CTA transforma o conteúdo educativo em porta de entrada para o relacionamento — o leitor que aprendeu algo útil está num estado receptivo para um convite de seguir, comentar ou acessar mais.",
    "prancha": "/banco/pranchas/tutorial.webp",
    "exemplos": [
      {
        "id": "DXE0Px9jbaR",
        "numero": 1,
        "url": "https://www.instagram.com/p/DXE0Px9jbaR/",
        "laminas": [
          "/banco/tutorial/DXE0Px9jbaR-01.webp",
          "/banco/tutorial/DXE0Px9jbaR-02.webp",
          "/banco/tutorial/DXE0Px9jbaR-03.webp",
          "/banco/tutorial/DXE0Px9jbaR-04.webp",
          "/banco/tutorial/DXE0Px9jbaR-05.webp",
          "/banco/tutorial/DXE0Px9jbaR-06.webp",
          "/banco/tutorial/DXE0Px9jbaR-07.webp"
        ]
      },
      {
        "id": "DUa-sMgEePX",
        "numero": 2,
        "url": "https://www.instagram.com/p/DUa-sMgEePX/",
        "laminas": [
          "/banco/tutorial/DUa-sMgEePX-01.webp",
          "/banco/tutorial/DUa-sMgEePX-02.webp",
          "/banco/tutorial/DUa-sMgEePX-03.webp",
          "/banco/tutorial/DUa-sMgEePX-04.webp",
          "/banco/tutorial/DUa-sMgEePX-05.webp",
          "/banco/tutorial/DUa-sMgEePX-06.webp"
        ]
      }
    ]
  }
]
