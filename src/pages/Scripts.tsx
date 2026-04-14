import { useState, useMemo } from 'react'
import { Copy, Search, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Script { id: string; title: string; when: string; body: string; category: string }

const SCRIPTS: Script[] = [
  // DM
  { id: 'dm-a', category: 'dm', title: 'DM - Gancho pelo conteúdo', when: 'Quando o médico posta conteúdo clínico ou educativo',
    body: 'Doutor(a) [NOME], vi seu post sobre [TEMA]. Achei muito relevante, principalmente pra [CIDADE] onde [OBSERVAÇÃO].\n\nTrabalho com médicos especialistas aqui no Sul do Pará ajudando a transformar essa presença online em agenda cheia de forma previsível.\n\nPosso te mostrar como funciona em 2 minutos?' },
  { id: 'dm-b', category: 'dm', title: 'DM - Gancho por sinal observado', when: 'Sinal claro de mudança (novo consultório, contratação)',
    body: 'Doutor(a) [NOME], percebi que você [SINAL]. A gente trabalha exatamente nesse momento com médicos especialistas do Sul do Pará — quando o profissional quer crescer mas não tem tempo pra cuidar do marketing no dia a dia.\n\nFazemos tudo POR você. Posso te explicar rapidamente como funciona?' },
  { id: 'dm-c', category: 'dm', title: 'DM - Gancho por referência', when: 'Tem cliente/caso próximo como prova social (com autorização)',
    body: 'Doutor(a) [NOME], a gente trabalha com o(a) Dr(a). [REFERÊNCIA] aqui em [CIDADE] e os resultados têm sido excelentes.\n\nVi que você também atua com [ESPECIALIDADE] na região e achei que poderia fazer sentido uma conversa rápida.\n\nTem 5 minutos essa semana?' },
  // Respostas
  { id: 'resp-mais', category: 'respostas', title: '"Me conta mais"', when: 'Quando o médico demonstra interesse inicial',
    body: 'Claro, Doutor(a)!\n\nEm resumo: a gente cuida de TUDO do marketing do seu consultório. Anúncios no Google e Instagram, criativos, página de captura, e o mais importante — treinamos sua secretária pra converter os contatos em consultas agendadas.\n\nChamamos de método P.U.L.S.O porque trabalha 5 frentes ao mesmo tempo: presença online, urgência pra agendar, captação de leads, sistema de atendimento e otimização contínua.\n\nPosso te mandar um resumo rápido por WhatsApp? Fica mais fácil de visualizar.' },
  { id: 'resp-preco', category: 'respostas', title: '"Quanto custa"', when: 'Quando o médico pergunta preço na DM',
    body: 'Boa pergunta, Doutor(a). Vou ser direto:\n\nO investimento total fica em torno de R$ 5 mil por mês — inclui toda a gestão, criativos, anúncios e treinamento da sua equipe. Sem taxa de setup nem surpresa.\n\nA maioria dos médicos que atendemos recupera o valor já no primeiro mês só com pacientes novos pelo Google e Instagram.\n\nMas antes de falar em valor, vale entender se faz sentido pro seu momento. Posso te fazer 3 perguntas rápidas?' },
  { id: 'resp-agencia', category: 'respostas', title: '"Já tenho agência"', when: 'Quando o médico já tem alguém cuidando das redes',
    body: 'Entendo, Doutor(a). É bom que já investe nisso.\n\nSó por curiosidade: o resultado está vindo em forma de agenda cheia ou mais em curtidas e seguidores?\n\nA diferença do que fazemos é que não paramos no post bonito. Criamos o anúncio, montamos a página de captura, e treinamos sua secretária pra fechar o agendamento.\n\nSe algum dia quiser comparar resultados, fico à disposição.' },
  { id: 'resp-nao', category: 'respostas', title: '"Não tenho interesse"', when: 'Quando o médico recusa — nunca insistir',
    body: 'Sem problema nenhum, Doutor(a). Respeito totalmente.\n\nSe em algum momento quiser entender como outros médicos da região estão lotando agenda pelo digital, pode me chamar sem compromisso.\n\nSucesso no consultório!' },
  { id: 'resp-info', category: 'respostas', title: '"Manda mais informações"', when: 'Quando o médico pede material',
    body: 'Mando sim! Me passa seu WhatsApp que envio um resumo rápido e visual.\n\nOu se preferir, meu número é [TELEFONE]. Me chama lá que já te encaminho.' },
  { id: 'resp-trans', category: 'respostas', title: 'Transição DM → WhatsApp', when: 'Quando o médico demonstrou interesse — hora de migrar',
    body: 'Doutor(a), pra ficar mais fácil e eu poder te mandar um resumo visual, vamos continuar por WhatsApp?\n\nMeu número é [TELEFONE]. Ou se preferir, me passa o seu que te chamo.' },
  // WhatsApp
  { id: 'wpp-1', category: 'whatsapp', title: 'Qualificação 1 — Estrutura', when: 'Primeira mensagem após aceitar diagnóstico',
    body: 'Dr. [NOME], obrigado por responder. Prefiro continuar aqui no WhatsApp — fica mais fácil.\n\nMe conta: você atende só na [CIDADE] ou tem algum dia em outra cidade também?' },
  { id: 'wpp-2', category: 'whatsapp', title: 'Qualificação 2 — Origem', when: 'Após resposta da primeira',
    body: 'Entendo. E hoje, quando chega um paciente novo, como ele normalmente fica sabendo de você? É mais indicação ou está chegando por outros caminhos também?' },
  { id: 'wpp-3', category: 'whatsapp', title: 'Qualificação 3 — Histórico', when: 'Mapear tentativas anteriores',
    body: 'Indicação é ótimo, mas tem um limite natural, né? Você já tentou alguma coisa pra trazer paciente por fora — tráfego pago, conteúdo, parceria?' },
  { id: 'wpp-4', category: 'whatsapp', title: 'Qualificação 4 — Urgência', when: 'Entender capacidade de absorção',
    body: 'E como está a agenda hoje — você consegue absorver mais pacientes particulares se começar a chegar, ou tem limitação de espaço/horário?' },
  { id: 'wpp-5', category: 'whatsapp', title: 'Qualificação 5 — Equipe', when: 'Qualificador técnico de conversão',
    body: 'Quando chega mensagem nova no WhatsApp ou Instagram do consultório, você mesmo responde ou tem alguém que faz esse atendimento?' },
  { id: 'wpp-6', category: 'whatsapp', title: 'Qualificação 6 — Decisão', when: 'Separar decisão de pesquisa',
    body: 'Última pergunta: você está pensando em montar uma estrutura de marketing agora, ou ainda na fase de entender o que faz sentido pra sua realidade?' },
  // Call
  { id: 'call-abertura', category: 'call', title: 'Abertura da Call', when: 'Primeiros 2-3 minutos da call',
    body: 'Dr. [NOME], obrigado por separar esse tempo. Eu já vi as informações que você me mandou no WhatsApp, e fiz uma análise rápida do seu perfil digital antes dessa call. Então não vou ficar perguntando o básico — já tenho um ponto de partida.\n\nSe no final eu achar que não somos o encaixe certo pra você agora, vou dizer isso. Faz sentido?' },
  { id: 'call-custo', category: 'call', title: 'Pergunta de Custo de Inação', when: 'Após diagnóstico — a pergunta mais importante',
    body: 'Se você mantiver exatamente como está hoje por mais 12 meses — o que acontece com a sua agenda? Com o seu faturamento? Com a posição que você ocupa na sua cidade?' },
  { id: 'call-invest', category: 'call', title: 'Apresentação do Investimento', when: 'Após construir estado futuro',
    body: 'O investimento na SVI é R$ 5.000 por mês — sendo R$ 3.000 de gestão e R$ 2.000 de verba de tráfego pago que vai direto pra plataforma, não fica com a gente.\n\nPara colocar em perspectiva: [NÚMERO] consultas particulares por mês pagam o investimento inteiro.' },
  { id: 'call-fecha', category: 'call', title: 'Fechamento', when: 'Pergunta que não parece fechamento',
    body: 'Você acha que faz sentido a gente avançar? Ou tem alguma parte do diagnóstico que preciso desenvolver melhor antes disso?' },
  { id: 'call-caro', category: 'call', title: 'Objeção "Tá caro"', when: 'Nunca defenda o preço — volte para o custo',
    body: 'Quando você diz que é muito — você está comparando com o quê?\n\nA pergunta não é se R$ 5.000 é caro no absoluto. A pergunta é: R$ 5.000 é caro comparado com [VALOR] que você está perdendo por mês em consultas que não acontecem?' },
  { id: 'call-pensar', category: 'call', title: 'Objeção "Vou pensar"', when: 'Mapear o que está faltando',
    body: 'Claro, faz todo sentido. O que você precisa pensar? É algo sobre a proposta em si, sobre o timing, ou tem alguma dúvida que ficou sem resposta?' },
  { id: 'call-ruim', category: 'call', title: 'Objeção "Experiência ruim"', when: 'Nunca diga "mas a gente é diferente"',
    body: 'Conta pra mim o que aconteceu.\n\n[Ouvir]\n\nFaz todo sentido você estar cético. O que quero fazer é diferente de rebater isso — quero entender especificamente o que deu errado pra poder te dizer honestamente se o problema que você teve existe na SVI também.' },
  // Secretária
  { id: 'sec-atend', category: 'secretaria', title: 'Primeiro Atendimento', when: 'Responder em até 15 minutos — MÁXIMO 30',
    body: 'Olá, [NOME]! Tudo bem?\nAqui é a [SECRETÁRIA], da clínica do(a) Dr(a). [MÉDICO].\nVi que você entrou em contato. Como posso te ajudar?\n\n[Após resposta:]\nEntendi! O(a) Dr(a). [MÉDICO] é especialista em [ÁREA] e pode te ajudar com isso.\n\nA consulta particular custa R$ [VALOR] e tem duração de aproximadamente [TEMPO] minutos.\n\nTemos horários [DIA 1] às [HORA 1] ou [DIA 2] às [HORA 2]. Qual funciona melhor pra você?' },
  { id: 'sec-confirm', category: 'secretaria', title: 'Confirmação de Consulta', when: 'Enviar 24h antes da consulta',
    body: 'Olá, [NOME]! Aqui é a [SECRETÁRIA], da clínica do(a) Dr(a). [MÉDICO].\n\nConfirmando sua consulta amanhã, [DIA], às [HORA].\nEndereço: [ENDEREÇO]\n\nPosso confirmar sua presença?' },
  { id: 'sec-pos', category: 'secretaria', title: 'Pós-consulta', when: '24-48h após a consulta',
    body: 'Olá, [NOME]! Espero que sua consulta tenha sido boa!\n\nSe tiver dúvida sobre o tratamento, estou por aqui.\n\nObrigada pela confiança!' },
  { id: 'sec-reativa', category: 'secretaria', title: 'Reativação de Lead', when: 'Lead que sumiu após 7 dias',
    body: 'Oi, [NOME]! Tudo bem?\nVocê entrou em contato sobre [PROCEDIMENTO].\nFicou alguma dúvida?\n\nTemos horários essa semana se quiser agendar. Sem compromisso.' },
]

const CATEGORIES = [
  { id: 'dm', label: 'DM Abordagem' },
  { id: 'respostas', label: 'Respostas' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'call', label: 'Call Diagnóstico' },
  { id: 'secretaria', label: 'Secretária' },
]

const PLACEHOLDER_RE = /\[([A-ZÁÉÍÓÚÃÕÇÊ\s/]+)\]/g

export default function Scripts() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('dm')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [fields, setFields] = useState({ NOME: '', ESPECIALIDADE: '', CIDADE: '', TELEFONE: '' })

  function personalize(text: string) {
    let result = text
    if (fields.NOME) result = result.replace(/\[NOME\]/g, fields.NOME)
    if (fields.ESPECIALIDADE) result = result.replace(/\[ESPECIALIDADE\]/g, fields.ESPECIALIDADE)
    if (fields.CIDADE) result = result.replace(/\[CIDADE\]/g, fields.CIDADE)
    if (fields.TELEFONE) result = result.replace(/\[TELEFONE\]/g, fields.TELEFONE)
    return result
  }

  function renderBody(text: string) {
    const personalized = personalize(text)
    return personalized.split('\n').map((line, i) => {
      const parts = line.split(PLACEHOLDER_RE)
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1
              ? <span key={j} className="text-amber-400 font-medium bg-amber-500/10 px-1 rounded">[{part}]</span>
              : <span key={j}>{part}</span>
          )}
          {i < personalized.split('\n').length - 1 && <br />}
        </span>
      )
    })
  }

  async function copyScript(script: Script) {
    const text = personalize(script.body)
    await navigator.clipboard.writeText(text)
    setCopiedId(script.id)
    toast({ title: 'Copiado!' })
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filtered = useMemo(() => {
    return SCRIPTS.filter(s => {
      if (s.category !== tab) return false
      if (search && !`${s.title} ${s.body}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [tab, search])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Personalization bar */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3 font-medium">Personalização automática — preencha e todos os scripts atualizam em tempo real</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input placeholder="Nome do Médico" value={fields.NOME} onChange={e => setFields({...fields, NOME: e.target.value})} />
            <Input placeholder="Especialidade" value={fields.ESPECIALIDADE} onChange={e => setFields({...fields, ESPECIALIDADE: e.target.value})} />
            <Input placeholder="Cidade" value={fields.CIDADE} onChange={e => setFields({...fields, CIDADE: e.target.value})} />
            <Input placeholder="Seu Telefone" value={fields.TELEFONE} onChange={e => setFields({...fields, TELEFONE: e.target.value})} />
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar script..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {CATEGORIES.map(c => (
            <TabsTrigger key={c.id} value={c.id} className="text-xs sm:text-sm">
              {c.label}
              <Badge variant="secondary" className="ml-1.5 text-xs">{SCRIPTS.filter(s => s.category === c.id).length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map(cat => (
          <TabsContent key={cat.id} value={cat.id} className="space-y-4 mt-4">
            {filtered.map(script => (
              <Card key={script.id} className="border-border bg-card hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{script.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{script.when}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyScript(script)} className="shrink-0">
                      {copiedId === script.id ? <Check className="h-3.5 w-3.5 mr-1 text-green-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                      {copiedId === script.id ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                    {renderBody(script.body)}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Nenhum script encontrado.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
