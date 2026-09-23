/**
 * Vaga de gestor de tráfego (R$2.000 inicial) · desenhado em 23/09/2026.
 *
 * As perguntas técnicas NÃO são teste de decoreba. Cada uma pesca um vício
 * específico que já custou dinheiro na SVI, registrado no teste de 30 dias do
 * gestor anterior: recriar campanha em vez de reusar, pausar campeão por um dia
 * ruim, culpar o criativo quando o buraco é o atendimento, executar sem propor.
 * A alternativa errada é sempre plausível, porque é o que gestor mediano faz.
 *
 * Este arquivo vai pro NAVEGADOR (formulário público e tela do admin), então
 * NÃO pode ter gabarito nem critério de correção: candidato abriria o DevTools
 * e leria a resposta certa. Isso mora em `api/_lib/gabarito-trafego.ts`, que só
 * roda no servidor. Foi um vazamento real, pego na verificação do bundle.
 */

export interface Alternativa { id: string; texto: string }
export interface PerguntaTecnica {
  id: string
  pergunta: string
  contexto?: string
  alternativas: Alternativa[]
  peso: number
  pega: string
}
export interface PerguntaAberta {
  id: string
  pergunta: string
  ajuda: string
  dimensao: 'proatividade' | 'dono_do_erro' | 'autodidata' | 'antecipacao' | 'diagnostico'
  peso: number
}

export const TECNICAS: PerguntaTecnica[] = [
  {
    id: 't1',
    pergunta: 'Uma campanha que roda há 4 meses, com mais de 300 conversas de histórico, ficou cara nos últimos 5 dias. Qual a sua primeira ação?',
    alternativas: [
      { id: 'a', texto: 'Crio uma campanha nova, limpa, e subo os criativos de novo' },
      { id: 'b', texto: 'Entro na campanha que já existe, leio fadiga de criativo e troco a peça por dentro' },
      { id: 'c', texto: 'Pauso tudo e espero o custo normalizar' },
      { id: 'd', texto: 'Aumento o orçamento pra ela sair da fase de aprendizado' },
    ],
    peso: 12,
    pega: 'Recriar campanha em vez de reusar. Zera o aprendizado e o histórico de conversa. Foi a falha mais cara e mais repetida do gestor anterior (7 recriações).',
  },
  {
    id: 't2',
    pergunta: 'O seu melhor conjunto, que segura dois terços da verba, teve ONTEM o pior custo por conversa do mês. Hoje de manhã você:',
    alternativas: [
      { id: 'a', texto: 'Pauso o conjunto pra estancar o gasto' },
      { id: 'b', texto: 'Não mexo: um dia isolado não é sinal, e mexer reinicia o aprendizado' },
      { id: 'c', texto: 'Corto o orçamento dele pela metade' },
      { id: 'd', texto: 'Duplico o conjunto e pauso o original' },
    ],
    peso: 12,
    pega: 'Reagir a um dia ruim. Aconteceu aqui: o conjunto campeão foi pausado por um dia caro e a conta rodou dois dias a um terço da capacidade.',
  },
  {
    id: 't3',
    pergunta: 'O cliente diz que os leads estão vindo desqualificados. Qual a sua PRIMEIRA ação?',
    alternativas: [
      { id: 'a', texto: 'Troco o criativo, deve estar atraindo curioso' },
      { id: 'b', texto: 'Fecho mais o público e corto interesses' },
      { id: 'c', texto: 'Vejo como esse lead está sendo atendido: tempo de resposta e follow-up' },
      { id: 'd', texto: 'Peço pro cliente subir a verba pra ter mais volume' },
    ],
    peso: 10,
    pega: 'Aceitar a reclamação sem investigar. Na maioria das vezes o buraco é atendimento, não mídia. Quem corre pro criativo antes de olhar o WhatsApp conserta o lugar errado.',
  },
  {
    id: 't4',
    pergunta: 'O cliente jura que recebeu menos mensagem do que o painel mostra. Quem está certo?',
    alternativas: [
      { id: 'a', texto: 'O painel. É a fonte oficial e o cliente não sabe ler' },
      { id: 'b', texto: 'O cliente. A métrica conta quem ABRIU a conversa, não quem chegou a mandar mensagem' },
      { id: 'c', texto: 'Os dois. É bug conhecido da Meta' },
      { id: 'd', texto: 'É problema do WhatsApp do cliente' },
    ],
    peso: 10,
    pega: 'Defender o painel na frente do cliente. Quem não entende a diferença entre abrir conversa e mandar mensagem entrega relatório inflado e queima confiança.',
  },
  {
    id: 't5',
    pergunta: 'Clínica quer paciente chamando no WhatsApp. Verba de R$1.000 por mês. Qual objetivo de campanha?',
    alternativas: [
      { id: 'a', texto: 'Tráfego, pra levar o máximo de gente até o WhatsApp' },
      { id: 'b', texto: 'Engajamento com destino WhatsApp' },
      { id: 'c', texto: 'Reconhecimento, a clínica precisa ficar conhecida antes' },
      { id: 'd', texto: 'Alcance, pra aparecer pro máximo de pessoas da cidade' },
    ],
    peso: 8,
    pega: 'Escolher tráfego achando que clique vira conversa. Objetivo errado joga verba fora desde o primeiro dia.',
  },
  {
    id: 't6',
    pergunta: 'Você recebe uma ordem clara: pausar o anúncio A e manter o B. Analisando a conta, você tem certeza de que o certo é o contrário. O que você faz?',
    alternativas: [
      { id: 'a', texto: 'Faço do jeito que analisei. O resultado justifica depois' },
      { id: 'b', texto: 'Executo a ordem e mando junto a análise, propondo a troca com o número na mão' },
      { id: 'c', texto: 'Não mexo em nada até alguém me responder' },
      { id: 'd', texto: 'Pauso os dois, por segurança' },
    ],
    peso: 12,
    pega: 'Passar por cima do combinado. É a falha que mais se repetiu aqui: executar por conta própria, sem propor antes, inclusive desfazendo ordem direta. Autonomia sem aviso vira retrabalho e quebra de confiança.',
  },
]

export const ABERTAS: PerguntaAberta[] = [
  {
    id: 'a1',
    pergunta: 'Conte uma situação em que você tomou uma iniciativa sem que ninguém pedisse, e o resultado melhorou.',
    ajuda: 'Conte o que era, o que você fez e qual indicador mudou.',
    dimensao: 'proatividade',
    peso: 10,
  },
  {
    id: 'a2',
    pergunta: 'Conte sobre uma decisão sua que não saiu como esperado. O que aconteceu depois?',
    ajuda: 'Interessa como você percebeu, o que fez em seguida e o que mudou na sua rotina depois disso.',
    dimensao: 'dono_do_erro',
    peso: 8,
  },
  {
    id: 'a3',
    pergunta: 'O que você aprendeu nos últimos 60 dias sem ninguém mandar? Onde aprendeu e onde aplicou?',
    ajuda: 'Pode ser curso, documentação, um teste na própria conta ou uma conversa. Conte também onde aplicou.',
    dimensao: 'autodidata',
    peso: 8,
  },
  {
    id: 'a4',
    pergunta: 'A conta está indo bem e não há demanda urgente. É segunda-feira de manhã. O que você faz?',
    ajuda: 'Não existe resposta certa. Queremos entender como você organiza a sua semana.',
    dimensao: 'antecipacao',
    peso: 8,
  },
  {
    id: 'a5',
    pergunta: 'Uma conta investe R$ 40 por dia, gera 12 conversas na semana e nenhum agendamento. Onde você olha primeiro e por quê?',
    ajuda: 'Descreva o seu raciocínio na ordem em que investigaria.',
    dimensao: 'diagnostico',
    peso: 10,
  },
]

export const PESO_TECNICO = TECNICAS.reduce((s, q) => s + q.peso, 0)   // 64
export const PESO_ABERTO = ABERTAS.reduce((s, q) => s + q.peso, 0)     // 44

export const FAIXAS_VERBA = [
  'Nunca geri verba sozinho',
  'Até R$ 3 mil por mês',
  'R$ 3 mil a R$ 10 mil',
  'R$ 10 mil a R$ 50 mil',
  'Acima de R$ 50 mil',
]
export const SITUACAO_ATUAL = [
  'Não estou trabalhando no momento',
  'Sou contratado em uma empresa ou agência',
  'Atendo clientes próprios como freelancer',
  'Trabalho em outra área e quero migrar',
]
export const SE_ENTRAR = [
  'Encerro o que atendo hoje e fico dedicado à SVI',
  'Mantenho um ou dois e encerro o restante',
  'Mantenho tudo que atendo hoje e concilio',
  'Não atendo ninguém hoje, entro dedicado',
]
export const HORAS_DIA = [
  'Período integral, 8 horas',
  'Cerca de 6 horas por dia',
  'Cerca de 4 horas por dia',
  'Menos de 4 horas por dia',
]

export const FAIXAS_CONTAS = ['1 conta', '2 a 4 contas', '5 a 10 contas', 'Mais de 10 contas']
export const VERTICAIS = [
  'Médico ou clínica', 'Odontologia', 'Estética', 'Varejo local',
  'Academia ou fitness', 'Serviço (advogado, contador)', 'Infoproduto', 'E-commerce', 'Outro',
]
