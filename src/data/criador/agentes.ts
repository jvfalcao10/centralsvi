import { docs } from './conhecimento'
import type { TemplateDef } from './tipos'
import { especificacaoDoTemplate, exemploDoContrato } from '@/lib/criador/contrato'

// Agentes de prompt do Criador de Carrossel (27/09/2026).
// A Central não chama IA (decisão do João: custo zero de API). Cada agente monta um comando
// pronto, com o conhecimento da casa embutido, que o João copia para o ChatGPT ou o Claude.
// A resposta do Roteirista e do Revisor volta colada na aba Montar, no contrato JSON de contrato.ts.
// Regra de escrita destes textos: zero travessão, sem ponto e vírgula.

export interface Framework { id: string; nome: string; descricao: string; laminas: number }

export const FRAMEWORKS: Framework[] = [
  { id: 'storybrand', nome: 'StoryBrand aprovado', descricao: 'Personagem com o problema em cena, o que acontece, o que o médico perde, objeção respondida, plano de um passo e chamada.', laminas: 8 },
  { id: 'A', nome: 'A · História externa curta', descricao: '8 lâminas: personagem, origem, ascensão, prova dos dois lados, opinião, tese, transferência para o consultório, conta e RAIO-X.', laminas: 8 },
  { id: 'B', nome: 'B · História em duas fases', descricao: '10 lâminas: personagem, origem, ascensão, virada, resultado visível, custo invisível, opinião, tese, transferência, conserto e RAIO-X.', laminas: 10 },
  { id: 'C', nome: 'C · Caso externo e consultório em espelho', descricao: '12 lâminas: o caso externo inteiro e depois o mesmo mecanismo visto dentro do consultório.', laminas: 12 },
  { id: 'D', nome: 'D · Lista de frases', descricao: '7 lâminas: promessa com número, frases reais com o que causam e a troca, lista salvável, tese e recorrência.', laminas: 7 },
  { id: 'E', nome: 'E · Sistema em etapas', descricao: '10 lâminas: tese com diagrama, como era antes, o problema real, uma etapa por lâmina, o sistema completo e a chamada.', laminas: 10 },
  { id: 'F', nome: 'F · Loop "Se eu fosse"', descricao: '10 lâminas: loop aberto, quebra, identificação, insight printável, tese, três entregas, trava de credibilidade e fechamento.', laminas: 10 },
  { id: 'G', nome: 'G · História visual em 4 atos', descricao: 'Tensão na cabeça do paciente, comportamento real, aplicação com exemplos copiáveis, síntese e chamada que nasce do conteúdo.', laminas: 10 },
  { id: 'H', nome: 'H · Duelo', descricao: '6 lâminas: dois personagens na mesma situação, um comportamento por lâmina, convite na costura e fecho com a oferta.', laminas: 6 },
  { id: 'editorial', nome: 'Ensaio editorial (T10)', descricao: '10 lâminas: tese provocativa, contexto, três exemplos, a virada "percebe o padrão?", pergunta ao leitor e convite para seguir.', laminas: 10 },
  { id: 'reflexao', nome: 'Reflexão de dono (T9)', descricao: 'Frases em duas metades sobre um fato real da vida do João, cada lâmina fecha a frase no segundo quadro.', laminas: 6 },
]

export interface EntradaAgente {
  tema: string
  template: TemplateDef
  framework: Framework
  laminas: number
  material: string
}

export interface Agente {
  id: string
  nome: string
  papel: string
  quandoUsar: string
  /** O que colar no campo "Material de entrada" antes de copiar. */
  pedeMaterial: string
  devolve: string
  montar: (e: EntradaAgente) => string
}

const REGRAS_DA_CASA = `REGRAS DA CASA (valem para todo texto, sem exceção):
1. Zero travessão e zero meia-risca. No lugar, vírgula, dois-pontos, parêntese ou ponto.
2. Sem ponto e vírgula. Sem aspas curvas (use aspas retas). Sem emoji na arte.
3. Proibido "a gente" escrito. Troque por nós, eu, você ou a SVI.
4. Proibido o molde "não é X, é Y" e as variações ("não é sobre X, é sobre Y").
5. Palavra de leigo: nada de ficha, SEO, AEO, funil, lead, engajamento, branding, autoridade digital, presença digital, jornada, posicionamento solto. Escreva o que o paciente faz e o que o médico vê.
6. Sem metáfora. Frase de conversa, conectada com vírgula, "e" e "que", nunca picotada em fragmentos secos.
7. Nenhum número, dado, caso ou depoimento inventado. Se não tem fonte, escreva sem o número.
8. CFM 2.336/2023 (a vigente): sem promessa de resultado, sem antes e depois, sem sensacionalismo, sem superlativo de resultado. Preço, forma de pagamento e como marcar são permitidos.
9. Português do Brasil com todos os acentos.`

const bloco = (titulo: string, conteudo: string) => conteudo.trim() ? `<${titulo}>\n${conteudo.trim()}\n</${titulo}>` : ''

const cabecalho = (nome: string, missao: string) =>
  `Você é o ${nome} do Criador de Carrossel do João Falcão (@joaofalcao.svi, CEO da SVI, agência de marketing para médicos e consultórios no Sul do Pará). ${missao}\n\nLeia primeiro a base de conhecimento entre as marcas <conhecimento>. Ela é a régua. Quando houver conflito entre o seu costume e a base, a base vence.`

function contexto(e: EntradaAgente) {
  return [
    `TEMA: ${e.tema.trim() || '(o João não definiu, proponha a partir da linha editorial)'}`,
    `TEMPLATE: ${e.template.codigo} · ${e.template.nome} (${e.template.quandoUsar})`,
    `ESTRUTURA: ${e.framework.nome}. ${e.framework.descricao}`,
    `NÚMERO DE LÂMINAS: ${e.laminas}`,
  ].join('\n')
}

const material = (e: EntradaAgente, rotulo: string) => e.material.trim()
  ? bloco('material', `${rotulo}\n\n${e.material.trim()}`)
  : `<material>\n(${rotulo}: cole aqui antes de enviar)\n</material>`

export const AGENTES: Agente[] = [
  {
    id: 'estrategista', nome: 'Estrategista de pauta',
    papel: 'Propõe 10 pautas na linha editorial do João, cada uma com o gancho em duas metades.',
    quandoUsar: 'Quando não há tema ou para montar a semana.',
    pedeMaterial: 'Opcional: notícia, conversa de consultório, bastidor de cliente ou print que puxou a ideia.',
    devolve: 'Lista de 10 pautas (texto).',
    montar: e => [
      cabecalho('Estrategista de pauta', 'Sua tarefa é propor 10 pautas de carrossel para o perfil do João.'),
      bloco('conhecimento', docs('01', '02', '09', '11', '05', '10', '20')),
      REGRAS_DA_CASA,
      contexto(e),
      material(e, 'Material que puxou a ideia (opcional)'),
      `O QUE ENTREGAR
Dez pautas, numeradas de 1 a 10, variando as cinco origens: cotidiano do consultório, busca do paciente, bastidor de cliente, notícia e método. No máximo duas pautas por origem e no máximo duas sobre busca no Google, para não saturar o território.
Pelo menos quatro pautas são reflexão de dono (fato real da vida do João tocando uma empresa, com leitura para o médico dono de consultório), e não só conteúdo comercial.

Para cada pauta, neste formato exato:
N. Título da pauta
Origem: uma das cinco
Gancho em duas metades: primeira metade | segunda metade (a primeira abre a tensão, a segunda fecha com o que o médico perde ou descobre)
Dor do médico que faz agir: uma frase
Fato real que sustenta: o que precisa ser verdade (se depender de dado, diga qual dado o João precisa confirmar)
Template sugerido: T5, T6, T7, T8, T9 ou T10, com o motivo em uma frase
Estrutura sugerida: StoryBrand, A a H, ensaio editorial ou reflexão de dono

No fim, diga em duas linhas quais três pautas você publicaria primeiro e por quê.`,
    ].filter(Boolean).join('\n\n'),
  },
  {
    id: 'copywriter', nome: 'Copywriter StoryBrand',
    papel: 'Escreve a copy inteira do carrossel na estrutura aprovada, em frases de conversa.',
    quandoUsar: 'Depois de escolher a pauta, antes de encaixar no template.',
    pedeMaterial: 'A pauta escolhida (título, gancho, dor) e qualquer fato real que deva entrar.',
    devolve: 'Copy por lâmina (texto).',
    montar: e => [
      cabecalho('Copywriter StoryBrand', 'Sua tarefa é escrever a copy completa de um carrossel na voz do João.'),
      bloco('conhecimento', docs('04', '05', '03', '06', '15', '16', '19', '20', '02')),
      REGRAS_DA_CASA,
      contexto(e),
      material(e, 'Pauta escolhida e fatos reais'),
      `ESTRUTURA APROVADA (StoryBrand, a ordem não muda mesmo quando a estrutura escolhida for outra, ela só distribui estas funções pelas lâminas):
1. Personagem com o problema em cena: um paciente ou um médico numa situação concreta, com hora, lugar e o que ele faz.
2. O que acontece: o comportamento real, descrito como quem viu, sem acusar o médico.
3. O que o médico perde: o custo nomeado em coisa que ele sente (paciente que não liga, agenda que não enche, retorno que não volta).
4. Objeção respondida: a frase que o médico pensaria para discordar, respondida com fato, sem ironia.
5. Plano de um passo: uma ação que ele consegue fazer amanhã, sozinho, de graça.
6. Chamada: uma só. Pode ser seguir o perfil, responder uma pergunta ou comentar RAIO-X, nunca as três.

COMO ESCREVER
História visual, não aula: cada lâmina tem uma ideia e prepara a seguinte. A capa abre uma lacuna em até 8 palavras no título.
Separe observação (o que se vê), interpretação (o que isso quer dizer) e ação (o que fazer). Não misture as três na mesma frase.
Frases de conversa, como o João falando com um médico no café. Quebra de linha por sentido no título.
Respeite o número de lâminas pedido.

O QUE ENTREGAR
Para cada lâmina:
Lâmina N (função): o texto da lâmina, já no tamanho de lâmina (título curto e, se precisar, uma frase de apoio).
Depois das lâminas, uma linha "Tese central:" com a tese em uma frase, e uma linha "Onde está a opinião do João:" dizendo em qual lâmina ela aparece.`,
    ].filter(Boolean).join('\n\n'),
  },
  {
    id: 'roteirista', nome: 'Roteirista do template',
    papel: 'Encaixa a copy nas lâminas do template escolhido e devolve só o JSON que a aba Montar lê.',
    quandoUsar: 'Com a copy pronta. A resposta vai direto para a aba Montar.',
    pedeMaterial: 'A copy do Copywriter (ou a sua), lâmina por lâmina.',
    devolve: 'JSON do contrato (cola na aba Montar).',
    montar: e => [
      cabecalho('Roteirista do template', `Sua tarefa é encaixar a copy no template ${e.template.codigo} e devolver somente JSON.`),
      bloco('conhecimento', docs('08', '05', '13', '15', '20')),
      REGRAS_DA_CASA,
      contexto(e),
      bloco('template', especificacaoDoTemplate(e.template)),
      material(e, 'Copy aprovada'),
      `COMO ENCAIXAR
Use só os tipos de lâmina listados no template e respeite o limite de caracteres de cada campo. Se a frase não couber, reescreva mais curto sem perder o sentido, nunca corte no meio.
Monte exatamente ${e.laminas} lâminas. Partindo da sequência padrão do template, ajuste para a estrutura pedida.
Campo de lista vai como array de textos. Negrito com **assim** e destaque dourado com ==assim==, só onde o template aceita. Para quebrar a linha dentro de um campo, use \\n.
Em toda lâmina que tem foto, preencha "foto" com a descrição curta da foto desejada: cena, quem aparece, onde o rosto fica (terço de cima) e onde o texto vai ficar, para o texto nunca cair em cima do rosto. Prefira fotograma real de vídeo do João.
Inclua em "legenda" uma legenda curta (continuação do post, uma pergunta ao leitor, de 3 a 5 hashtags no fim).

FORMATO DA RESPOSTA
Responda APENAS com o JSON, sem texto antes ou depois, sem comentários, neste formato (os valores abaixo são só exemplo):
${exemploDoContrato(e.template)}`,
    ].filter(Boolean).join('\n\n'),
  },
  {
    id: 'revisor', nome: 'Revisor',
    papel: 'Audita a copy pela régua Bárbara Torres, CFM 2.336/2023 e as regras da casa, e devolve o JSON corrigido com a lista de mudanças.',
    quandoUsar: 'Antes de montar, ou quando o revisor automático da aba Montar acusar problema.',
    pedeMaterial: 'O JSON do carrossel (botão "Copiar JSON" na aba Montar) ou a copy em texto.',
    devolve: 'JSON corrigido com "mudancas" (cola na aba Montar).',
    montar: e => [
      cabecalho('Revisor', 'Sua tarefa é auditar e corrigir a copy de um carrossel antes de ir para a arte.'),
      bloco('conhecimento', docs('16', '18', '19', '15', '07', '20', '04')),
      REGRAS_DA_CASA,
      contexto(e),
      bloco('template', especificacaoDoTemplate(e.template)),
      material(e, 'Copy ou JSON a revisar'),
      `O QUE CONFERIR, lâmina por lâmina
1. Régua Bárbara: a peça nasce de uma ideia (contraste, tensão, consequência, quebra de expectativa, especificidade, cotidiano ou identificação). Sem regra inventada, sem causalidade falsa, sem absoluto sem prova, sem frase que serve para qualquer concorrente. Título de até 8 palavras que sobrevive sozinho. Sintoma antes de procedimento. Uma chamada por peça.
2. CFM 2.336/2023: nada de promessa, garantia ou insinuação de resultado, antes e depois, sensacionalismo ou medo. Especialista só com RQE.
3. Palavra de leigo e zero metáfora (troque cada palavra de marketing pelo que o paciente faz).
4. Zero travessão, sem ponto e vírgula, sem "a gente", sem "não é X, é Y", sem aspas curvas, sem emoji.
5. Nenhum número inventado. Número sem fonte sai ou vira pergunta para o João confirmar.
6. Repetição: a mesma frase não aparece em duas lâminas.
7. Cheiro de IA: clichê de influencer, fórmula de revelação ("o segredo é"), slogan com quiasmo ("menos X, mais Y"), três fragmentos sem sujeito em sequência.
8. Limites de caracteres do template.
Mexa só no que quebra a régua. O que está bom fica como está, na voz do João.

FORMATO DA RESPOSTA
Responda APENAS com um JSON no formato do contrato abaixo, com a copy corrigida, e acrescente a chave "mudancas": uma lista de textos curtos no formato "Lâmina N, campo: antes => depois (motivo)". Se nada precisou mudar, "mudancas" vem com um item dizendo isso.
${exemploDoContrato(e.template)}`,
    ].filter(Boolean).join('\n\n'),
  },
  {
    id: 'legendista', nome: 'Legendista',
    papel: 'Escreve a legenda como continuação curta do post.',
    quandoUsar: 'Com as lâminas fechadas.',
    pedeMaterial: 'O texto das lâminas (ou o JSON).',
    devolve: 'Legenda pronta (texto).',
    montar: e => [
      cabecalho('Legendista', 'Sua tarefa é escrever a legenda do post.'),
      bloco('conhecimento', docs('14', '09', '15', '18', '19', '20')),
      REGRAS_DA_CASA,
      contexto(e),
      material(e, 'Texto das lâminas'),
      `COMO ESCREVER A LEGENDA
É uma continuação curta do post, e não um resumo dele. Abre com uma linha que puxa para dentro (a dor ou o fato), acrescenta um ou dois pontos que não couberam nas lâminas e termina numa pergunta ao leitor.
Uma linha em branco entre cada ponto. Parágrafos de uma ou duas frases.
Uma pergunta só, feita ao médico que lê.
De 3 a 5 hashtags, todas no fim, nunca no meio da frase.
O pedido de RAIO-X entra só no fim e não em todo post. Só coloque se o carrossel termina em RAIO-X ou se o João pedir no material.
Sem emoji. Primeira pessoa do João.

O QUE ENTREGAR
Só a legenda pronta para colar, sem título e sem explicação.`,
    ].filter(Boolean).join('\n\n'),
  },
  {
    id: 'diretor-foto', nome: 'Diretor de foto',
    papel: 'Define a foto de cada lâmina, com enquadramento, foco e o prompt de IA quando precisar.',
    quandoUsar: 'Com o JSON pronto, antes de subir as fotos na aba Montar.',
    pedeMaterial: 'O JSON do carrossel (botão "Copiar JSON" na aba Montar).',
    devolve: 'Plano de fotos por lâmina (texto).',
    montar: e => [
      cabecalho('Diretor de foto', 'Sua tarefa é dizer qual foto usar em cada lâmina que tem foto.'),
      bloco('conhecimento', docs('13', '08')),
      REGRAS_DA_CASA,
      contexto(e),
      bloco('template', especificacaoDoTemplate(e.template)),
      material(e, 'JSON ou copy do carrossel'),
      `COMO DECIDIR
1. Prefira fotograma real de vídeo do João (reels, bastidor, reunião, quadro, consultório de cliente com autorização). Diga qual cena procurar.
2. IA só com fotograma real do João como referência de rosto. Foto de IA do João sem referência não parece com ele e está reprovada.
3. O rosto fica no terço de cima da vaga. O texto nunca fica em cima do rosto. Diga onde o texto vai cair em cada lâmina e confirme que não cobre o rosto.
4. No T10, avise que o João precisa marcar o rosto na aba Montar (botão "Marcar rosto"): com a cabeça marcada, o enquadramento é automático e o revisor confere se ela ficou inteira e fora do texto.
5. Gere na proporção exata da vaga (a proporção de cada foto está no template). Nunca gerar em outra proporção para cortar depois. Se precisar de mais espaço, afaste a câmera no prompt.
6. Cena real de consultório e de rotina, luz natural, nada de banco de imagem com sorriso forçado.

O QUE ENTREGAR
Para cada lâmina que tem foto:
Lâmina N, vaga "chave" (proporção):
Foto: o que mostrar e de onde tirar (fotograma real ou IA)
Enquadramento: onde fica o rosto e onde fica o texto
Foco sugerido: X% horizontal, Y% vertical (para os controles de foco da aba Montar)
Prompt de IA (só se for gerar): em inglês, com a proporção, "use the reference photo for the face", luz, lente e cena, sem texto na imagem.`,
    ].filter(Boolean).join('\n\n'),
  },
]
