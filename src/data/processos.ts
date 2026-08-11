/**
 * Processos de entrega da SVI, do contrato assinado ao go-live.
 *
 * Mora aqui e não no ClickUp por decisão do João (11/08/2026): a meta é sair
 * do ClickUp até nov/26, então processo novo lá dentro só aumenta a migração.
 * E vira ativo de produto: agência que compra a Central leva os processos junto.
 *
 * Conteúdo fiel ao que a casa faz hoje. O que é recomendação minha e ainda não
 * é prática está marcado com `proposto: true` pra não virar doutrina por engano.
 */

export type Passo = {
  texto: string
  proposto?: boolean
}

export type Fase = {
  n: string
  titulo: string
  prazo: string
  dono: string
  passos: Passo[]
  saida: string
  alerta?: string
}

export type Processo = {
  id: string
  nome: string
  resumo: string
  preco: string
  prazo: string
  cor: 'primary' | 'info' | 'success'
  escopo: string[]
  doutrina?: { titulo: string; texto: string }
  fases: Fase[]
  rotina?: { quando: string; oque: string; quem: string }[]
}

export const PROCESSOS: Processo[] = [
  {
    id: 'assessoria',
    nome: 'Assessoria Completa',
    resumo: 'Conteúdo, tráfego, presença no Google e site. A operação de marketing inteira.',
    preco: 'Mensalidade conforme contrato',
    prazo: '15 dias até o go-live',
    cor: 'primary',
    escopo: [
      '5 a 8 peças de conteúdo por mês',
      'Gestão de tráfego no Meta',
      'Google Meu Negócio',
      'Site com blog e artigos',
      'Relatório semanal ao cliente',
      'Google Ads só com maturidade e verba',
    ],
    fases: [
      {
        n: '0', titulo: 'Fechamento', prazo: 'D0', dono: 'João',
        passos: [
          { texto: 'Preencher svicompany.com.br/onboarding: razão social, CNPJ ou CPF, valor mensal, dia de pagamento, duração e grupo de WhatsApp' },
          { texto: 'Se o contrato for escalonado, informar valor de referência, escalonamento e verba de anúncio' },
          { texto: 'Automático: contrato gerado, PDF, Autentique, e a Sofia manda o link no PV do João' },
          { texto: 'Automático: cria a lista no ClickUp, cadastra na Central e liga a cobrança recorrente' },
          { texto: 'João encaminha o link de assinatura ao cliente (a Autentique não envia sozinha de propósito)' },
        ],
        alerta: 'O dia de vencimento não pode ir errado. É ele que faz a fatura nascer sozinha todo dia 1 na Central.',
        saida: 'Contrato assinado, lista no ClickUp, cliente na Central com cobrança ativa',
      },
      {
        n: '1', titulo: 'Entrada e acessos', prazo: 'D1 a D3', dono: 'João e Letícia',
        passos: [
          { texto: 'Sofia posta as boas-vindas no grupo, apresenta o time e manda o link do kickoff' },
          { texto: 'Cliente preenche svicompany.com.br/kickoff (11 blocos)' },
          { texto: 'Meta: BM SVI 3597385227141196 solicita acesso à página e à conta de anúncio' },
          { texto: 'Google Ads: MCC 4600212754 solicita vínculo' },
          { texto: 'Google Meu Negócio: adicionar svicompanyy@gmail.com como gerente' },
          { texto: 'Criar a pasta do cliente no Drive' },
        ],
        alerta: 'Pedir parceria, nunca senha. Quando não tiver jeito, guardar no Cofre de Senhas e rotacionar no fim do projeto.',
        saida: 'Kickoff respondido, acessos concedidos, pasta criada',
      },
      {
        n: '2', titulo: 'Estratégia', prazo: 'D4 a D7', dono: 'João',
        passos: [
          { texto: 'Ler o kickoff em svicompany.com.br/admin-kickoff' },
          { texto: 'Definir avatar, oferta, ângulo e as 3 dores que fazem a pessoa agir' },
          { texto: 'Cruzar com as Datas Estratégicas do período' },
          { texto: 'Montar o plano do mês com cada peça amarrada em uma data e uma dor' },
          { texto: 'Decidir se entra Google Ads: só se a empresa já anuncia e tem verba. Senão vira roadmap' },
        ],
        alerta: 'Peça só de data é munição, guarda pro dia. Peça sem dor não converte.',
        saida: 'Plano de conteúdo do mês e briefing pro time',
      },
      {
        n: '3', titulo: 'Produção', prazo: 'D8 a D12', dono: 'Time',
        passos: [
          { texto: 'João faz roteiro e grava' },
          { texto: 'Sarah ou Matheus edita, conforme o João definir por peça: 9:16 sem crop, gancho nos 3 primeiros segundos' },
          { texto: 'José faz as artes e flyers' },
          { texto: 'Aleilson monta a campanha e os criativos, João valida' },
          { texto: 'Arthur cria ou otimiza a ficha do Google Meu Negócio' },
          { texto: 'Primeira leva de 10 artigos no blog, quando o site faz parte' },
          { texto: 'Cada peça entra no Pipeline de Conteúdo com o link do Drive e o print de prévia' },
        ],
        alerta: 'Vídeo não sobe pro sistema. Fica no Drive pela qualidade e pelo peso, e o card leva o link mais o print.',
        saida: 'Primeira leva pronta, aguardando o cliente',
      },
      {
        n: '4', titulo: 'Aprovação e go-live', prazo: 'D13 a D15', dono: 'Sarah e Sofia',
        passos: [
          { texto: 'Mover a peça para "Com o cliente" no Pipeline de Conteúdo' },
          { texto: 'Sofia manda o link de aprovação. O cliente abre sem login, vê a prévia e assiste o vídeo em qualidade' },
          { texto: 'Cliente aprova ou escreve o que mudar, e a etapa muda sozinha' },
          { texto: 'Subir a campanha' },
        ],
        alerta: 'O sistema recusa mandar sem arquivo nem print. Aprovar no escuro é o que fazia a aprovação vazar pro WhatsApp e voltar sem rastro.',
        saida: 'Primeiro post publicado e campanha rodando. Fecham os 15 dias',
      },
    ],
    rotina: [
      { quando: 'Todo dia 7h50', oque: 'Brief do dia chega no WhatsApp', quem: 'Sofia' },
      { quando: 'Diário', oque: 'Lê os grupos, responde e sobe tarefa pra pessoa certa', quem: 'Letícia' },
      { quando: 'Sexta 15h', oque: 'Relatório no grupo do cliente. Canal e horário únicos', quem: 'Arthur' },
      { quando: 'Todo dia 1', oque: 'Fatura do mês nasce sozinha na Central', quem: 'Automático' },
      { quando: 'Todo dia 20', oque: 'Brief de datas do mês seguinte, com 10 dias pra produzir', quem: 'Sofia' },
      { quando: 'Quinzenal', oque: 'Análise de carteira e temperatura do cliente', quem: 'CS' },
    ],
  },

  {
    id: 'crm',
    nome: 'CRM (Kommo)',
    resumo: 'Funil desenhado pro negócio, base migrada, time treinado e relatório que o dono lê.',
    preco: 'R$ 3.000 + R$ 300/mês · licença Kommo à parte',
    prazo: '15 dias até o go-live',
    cor: 'info',
    escopo: [
      'Discovery comercial completo',
      'Funil, campos e tags modelados',
      'Migração da base com deduplicação',
      'Treinamento do time do cliente',
      'Régua de follow-up',
      'Licença Kommo repassada sem marcação (~R$ 150/mês por usuário)',
    ],
    doutrina: {
      titulo: 'Jornada é etapa, processo é campo',
      texto: 'JORNADA são as ETAPAS do funil: progressivas, o lead entra numa e caminha pra próxima. PROCESSO são os CAMPOS do card: condições que podem ser verdadeiras ou falsas a qualquer momento. O erro nº 1 do mercado é condição virando etapa. Quando "Aguardando retorno" vira coluna, o lead fica pingando pra frente e pra trás, a conversão perde o sentido e ninguém confia mais no relatório.',
    },
    fases: [
      {
        n: '0', titulo: 'Fechamento', prazo: 'D0', dono: 'João',
        passos: [{ texto: 'Mesmo formulário e mesma automação da assessoria: onboarding gera contrato, Autentique, cobrança e lista' }],
        saida: 'Contrato assinado e cliente provisionado',
      },
      {
        n: '1', titulo: 'Discovery comercial', prazo: 'D1 a D3', dono: 'João',
        passos: [
          { texto: 'Cliente preenche svicompany.com.br/kickoff-crm, 11 seções de discovery comercial' },
          { texto: 'Mapear como o lead chega hoje e por quantas mãos passa' },
          { texto: 'Achar onde ele morre, que é quase sempre o follow-up' },
          { texto: 'Levantar quem vende, quantos são e se cada um tem processo próprio' },
          { texto: 'Registrar ticket, ciclo de venda e recompra' },
          { texto: 'Ver o que já existe: planilha, WhatsApp solto ou outro CRM' },
        ],
        saida: 'Discovery respondido e o funil atual desenhado',
      },
      {
        n: '2', titulo: 'Modelagem', prazo: 'D4 a D6', dono: 'João',
        passos: [
          { texto: 'Desenhar as etapas do funil, da entrada ao fechado, mais o motivo de perda' },
          { texto: 'Definir os campos do card: o que precisa ser verdade pra avançar' },
          { texto: 'Definir as tags, lembrando que no Kommo tag é presa ao workflow' },
          { texto: 'Definir quem enxerga o quê: vendedor vê o dele, gestor vê tudo' },
          { texto: 'Montar a régua de follow-up: quantos toques, em quantos dias, por qual canal' },
          { texto: 'Aprovar o desenho com o cliente ANTES de virar configuração' },
        ],
        alerta: 'Nesta fase não se toca no Kommo. Aprovar no papel é mais barato que refazer depois.',
        saida: 'Desenho do funil aprovado pelo cliente',
      },
      {
        n: '3', titulo: 'Construção', prazo: 'D7 a D10', dono: 'João',
        passos: [
          { texto: 'Montar o funil no Kommo com as etapas aprovadas' },
          { texto: 'Criar os campos personalizados' },
          { texto: 'Criar tags e automações do Digital Pipeline' },
          { texto: 'Criar usuários com o acesso certo' },
          { texto: 'Integrar a origem dos leads: formulário, WhatsApp ou anúncio' },
        ],
        alerta: 'Gotcha do Kommo: update é PATCH, não PUT. E query sem filter de updated_at traz a base inteira e estoura o limite.',
        saida: 'Funil configurado e integrado',
      },
      {
        n: '4', titulo: 'Migração da base', prazo: 'D11 a D12', dono: 'João',
        passos: [
          { texto: 'Exportar o que existe: planilha, CRM antigo ou contatos do WhatsApp' },
          { texto: 'Deduplicar ANTES de subir' },
          { texto: 'Importar com a origem preenchida, pra não perder a atribuição histórica' },
          { texto: 'Conferir na mão uma amostra de 10 leads' },
        ],
        alerta: 'Base migrada com duplicata nasce podre e o time desconfia dela no primeiro dia.',
        saida: 'Base dentro do CRM, limpa e conferida',
      },
      {
        n: '5', titulo: 'Treinamento', prazo: 'D13 a D14', dono: 'João',
        passos: [
          { texto: 'Treinar o time do cliente, não só o dono' },
          { texto: 'Ensinar como o lead entra e o que fazer no primeiro toque' },
          { texto: 'Deixar claro quando muda de etapa e quando NÃO muda' },
          { texto: 'Explicar o que preencher e por quê, mostrando que o campo alimenta o relatório dele' },
          { texto: 'Ensinar a registrar perda com motivo' },
        ],
        alerta: 'CRM não morre pela ferramenta, morre porque o vendedor não vê valor em preencher. O treinamento responde "o que eu ganho", não só "onde clicar".',
        saida: 'Time usando o funil',
      },
      {
        n: '6', titulo: 'Go-live e acompanhamento', prazo: 'D15', dono: 'João',
        passos: [
          { texto: 'Funil no ar com o time usando de verdade' },
          { texto: 'Primeira semana com acompanhamento diário: ver se o card anda ou empaca' },
          { texto: 'Ajuste fino do que a realidade mostrar diferente do desenho' },
        ],
        saida: 'CRM operando. A mensalidade cobre manter a configuração viva e o relatório de pé',
      },
    ],
  },

  {
    id: 'crm-agente',
    nome: 'CRM + Agente de IA',
    resumo: 'Tudo do CRM, mais um agente que atende, qualifica e agenda sozinho no WhatsApp.',
    preco: 'CRM R$ 3.000 + Agente R$ 3.000 · R$ 800/mês somados',
    prazo: '25 dias até o go-live',
    cor: 'success',
    escopo: [
      'Tudo do processo de CRM',
      'Base de conhecimento do agente',
      'Regras de qualificação e handoff',
      'Integração WhatsApp escrevendo no funil',
      'Teste com conversa real antes de subir',
      'Operação mensal, que é o que impede o agente de apodrecer',
      'IA e infra repassadas sem marcação (~R$ 100 a 250/mês)',
    ],
    doutrina: {
      titulo: 'Nunca entregar agente sem mensalidade',
      texto: 'Mínimo R$ 500/mês, e o argumento não é aluguel, é segurança: o mensal garante que o agente continua respondendo certo e melhorando. Sem operação ele apodrece, porque o negócio muda, o preço muda, entra serviço novo, e ele segue respondendo o de seis meses atrás. Em saúde, o risco de falar o que o CFM não permite volta pro cliente. Agente sem operação é construir uma máquina de R$ 3.000 e operá-la de graça pra sempre.',
    },
    fases: [
      {
        n: '0-6', titulo: 'Todo o processo de CRM', prazo: 'D0 a D15', dono: 'João',
        passos: [{ texto: 'O agente entra depois do funil de pé, nunca antes. Agente jogando lead num CRM mal desenhado só acelera a bagunça' }],
        saida: 'CRM operando',
      },
      {
        n: '7', titulo: 'Base de conhecimento', prazo: 'D16 a D18', dono: 'João',
        passos: [
          { texto: 'Serviços, o que cada um resolve, e o que a empresa NÃO faz' },
          { texto: 'Política de preço: fala, não fala, ou fala faixa' },
          { texto: 'Endereço, horário, formas de pagamento e convênios' },
          { texto: 'As 10 perguntas que mais chegam, com a resposta do jeito que o dono responderia' },
          { texto: 'A lista do que o agente nunca pode dizer' },
        ],
        alerta: 'Cliente de saúde: a resolução vigente é a CFM 2.336/2023, não a 1.974/2011. Ela liberou falar preço, forma de pagamento e desconto. Continua proibido promessa de resultado, antes e depois, sensacionalismo e autopromoção.',
        saida: 'Base escrita e revisada pelo cliente',
      },
      {
        n: '8', titulo: 'Qualificação e handoff', prazo: 'D19 a D20', dono: 'João',
        passos: [
          { texto: 'Definir as perguntas de qualificação, as mesmas que o dono usaria' },
          { texto: 'Definir quando o agente agenda sozinho' },
          { texto: 'Definir o que ele grava no CRM: card, origem e etapa' },
          { texto: 'Listar o que passa pra humano na hora: reclamação, negociação fora da faixa, cancelamento, assunto clínico e pedido explícito de falar com gente' },
        ],
        alerta: 'Handoff não é falha do agente, é feature. Agente que insiste em resolver o que não é dele queima o cliente numa conversa só.',
        saida: 'Regras de decisão e de passagem definidas',
      },
      {
        n: '9', titulo: 'Integração', prazo: 'D21 a D22', dono: 'João',
        passos: [
          { texto: 'Conectar o número de WhatsApp' },
          { texto: 'Agente criando o card, preenchendo origem e movendo a etapa' },
          { texto: 'Se vier de anúncio, o rastreio precisa sobreviver até o card' },
          { texto: 'Alertar o time quando acontecer handoff' },
        ],
        alerta: 'Sem rastreio até o card, você paga por lead e não sabe de qual criativo veio.',
        saida: 'Agente conversando e escrevendo no funil',
      },
      {
        n: '10', titulo: 'Teste com conversa real', prazo: 'D23 a D25', dono: 'João',
        passos: [
          { texto: 'Rodar no mínimo 20 conversas simuladas', proposto: true },
          { texto: 'Cobrir: lead ideal, o que pergunta preço de cara, o que enrola, o que reclama, o que pergunta o que o agente não sabe, e o que puxa pra assunto proibido', proposto: true },
          { texto: 'Ler as respostas uma a uma e corrigir a base', proposto: true },
          { texto: 'Uma semana em modo sombra: o agente responde e um humano lê tudo antes de considerar fechado', proposto: true },
        ],
        alerta: 'Não sobe agente sem isto.',
        saida: 'Agente aprovado pra atender sozinho',
      },
      {
        n: '11', titulo: 'Go-live e operação', prazo: 'Contínuo', dono: 'João',
        passos: [
          { texto: 'Ler as conversas da semana procurando o que o agente errou' },
          { texto: 'Ajustar a base quando o negócio mudar: preço novo, serviço novo, horário novo' },
          { texto: 'Entregar o relatório do mês: atendidos, qualificados, agendados e quantos foram pra humano' },
          { texto: 'Revisar a trava de CFM sempre que a comunicação mudar' },
        ],
        alerta: 'Auditar todo mês em cliente de saúde. É a diferença entre uma automação que ajuda e um processo no conselho.',
        saida: 'Agente operando com acompanhamento mensal',
      },
    ],
  },
]
