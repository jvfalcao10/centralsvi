import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  Megaphone,
  Workflow,
  CheckSquare,
  Sparkles,
  Target,
  Radio,
  Info,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Pillar = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'
type Voice = 'SVI' | 'João'
type Format = 'Carrossel' | 'Reel' | 'Estático'

interface PostItem {
  week: number
  day: 'Seg' | 'Qua' | 'Sex'
  pillar: Pillar
  format: Format
  voice: Voice
  hook: string
  cta: string
}

const PILLAR_LABEL: Record<Pillar, string> = {
  A: 'Crítica de mercado',
  B: 'Bastidor de método',
  C: 'Repertório',
  D: 'Tese contraintuitiva',
  E: 'Filtro e seletividade',
  F: 'Sofisticação técnica',
  G: 'Território',
  H: 'Filosofia',
  I: 'Verticais complementares',
}

const PILLAR_COLOR: Record<Pillar, string> = {
  A: 'bg-red-500/10 text-red-600 border-red-500/20',
  B: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  C: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  D: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  E: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  F: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  G: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  H: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  I: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
}

const CALENDAR: PostItem[] = [
  // Semana 1
  { week: 1, day: 'Seg', pillar: 'A', format: 'Carrossel', voice: 'SVI', hook: 'Mídia não é o seu gargalo', cta: 'Comenta AUDITORIA' },
  { week: 1, day: 'Qua', pillar: 'E', format: 'Reel', voice: 'João', hook: 'Recusei 3 clientes semana passada', cta: 'Comenta SVI' },
  { week: 1, day: 'Sex', pillar: 'H', format: 'Estático', voice: 'SVI', hook: 'Não temos 240 clientes. Temos 24.', cta: 'Salva' },
  // Semana 2
  { week: 2, day: 'Seg', pillar: 'A', format: 'Carrossel', voice: 'SVI', hook: 'Resultado em 30 dias é mentira', cta: 'Comenta CICLO' },
  { week: 2, day: 'Qua', pillar: 'D', format: 'Reel', voice: 'João', hook: 'Criativo bonito não vende nada', cta: 'Comenta CRM' },
  { week: 2, day: 'Sex', pillar: 'F', format: 'Carrossel', voice: 'SVI', hook: 'Os 7 pontos do nosso diagnóstico', cta: 'Comenta DIAGNÓSTICO' },
  // Semana 3
  { week: 3, day: 'Seg', pillar: 'G', format: 'Carrossel', voice: 'João', hook: 'Por que saí de SP e voltei pro Pará', cta: 'Comenta TERRITÓRIO' },
  { week: 3, day: 'Qua', pillar: 'C', format: 'Reel', voice: 'SVI', hook: 'Pediatra em cidade de 45 mil habitantes', cta: 'Comenta PROTOCOLO' },
  { week: 3, day: 'Sex', pillar: 'B', format: 'Carrossel', voice: 'SVI', hook: 'Os primeiros 15 dias sem anunciar', cta: 'Comenta MERGULHO' },
  // Semana 4
  { week: 4, day: 'Seg', pillar: 'E', format: 'Carrossel', voice: 'SVI', hook: 'Por que só aceitamos 2 por mês', cta: 'Comenta SELEÇÃO' },
  { week: 4, day: 'Qua', pillar: 'A', format: 'Reel', voice: 'João', hook: 'Agência bonita não é agência boa', cta: 'Comenta 1' },
  { week: 4, day: 'Sex', pillar: 'H', format: 'Estático', voice: 'João', hook: 'Contrato de 6 meses protege você', cta: 'Salva' },
  // Semana 5
  { week: 5, day: 'Seg', pillar: 'B', format: 'Carrossel', voice: 'SVI', hook: 'Como a SVI estrutura o primeiro mês', cta: 'Comenta PLAYBOOK' },
  { week: 5, day: 'Qua', pillar: 'F', format: 'Reel', voice: 'João', hook: 'IA não é futuro, é presente', cta: 'Comenta IA' },
  { week: 5, day: 'Sex', pillar: 'C', format: 'Carrossel', voice: 'SVI', hook: '7 anos operando solar no Pará', cta: 'Comenta ESCALA' },
  // Semana 6
  { week: 6, day: 'Seg', pillar: 'D', format: 'Carrossel', voice: 'João', hook: 'Tráfego sem CRM é dinheiro na rua', cta: 'Comenta CRM' },
  { week: 6, day: 'Qua', pillar: 'B', format: 'Reel', voice: 'SVI', hook: 'Reunião interna gravada', cta: 'Comenta CRITÉRIO' },
  { week: 6, day: 'Sex', pillar: 'I', format: 'Carrossel', voice: 'SVI', hook: 'CRM não é planilha avançada', cta: 'Comenta CRM' },
  // Semana 7
  { week: 7, day: 'Seg', pillar: 'C', format: 'Carrossel', voice: 'SVI', hook: 'Pavers em Orlando faturando em dólar', cta: 'Comenta FLÓRIDA' },
  { week: 7, day: 'Qua', pillar: 'C', format: 'Reel', voice: 'João', hook: 'Clínica estética que virou referência regional', cta: 'Comenta CLÍNICA' },
  { week: 7, day: 'Sex', pillar: 'F', format: 'Carrossel', voice: 'SVI', hook: 'ORION, nosso sistema de copy', cta: 'Comenta ORION' },
  // Semana 8
  { week: 8, day: 'Seg', pillar: 'B', format: 'Carrossel', voice: 'SVI', hook: 'Como auditamos um cliente novo', cta: 'Comenta AUDITORIA' },
  { week: 8, day: 'Qua', pillar: 'D', format: 'Reel', voice: 'João', hook: 'Cliente que pede desconto já era', cta: 'Comenta DESCONTO' },
  { week: 8, day: 'Sex', pillar: 'G', format: 'Carrossel', voice: 'João', hook: 'Redenção, Xinguara, Orlando, Fort Myers', cta: 'Comenta BINACIONAL' },
  // Semana 9
  { week: 9, day: 'Seg', pillar: 'E', format: 'Carrossel', voice: 'SVI', hook: 'Os 4 filtros da call com a SVI', cta: 'Comenta CALL' },
  { week: 9, day: 'Qua', pillar: 'C', format: 'Reel', voice: 'João', hook: 'O cliente que triplicou em 6 meses', cta: 'Comenta TRIPLICOU' },
  { week: 9, day: 'Sex', pillar: 'B', format: 'Carrossel', voice: 'SVI', hook: 'Estrutura de reunião semanal com cliente', cta: 'Comenta REUNIÃO' },
  // Semana 10
  { week: 10, day: 'Seg', pillar: 'C', format: 'Carrossel', voice: 'SVI', hook: 'Médico especialista em Redenção', cta: 'Comenta MÉDICO' },
  { week: 10, day: 'Qua', pillar: 'I', format: 'Reel', voice: 'João', hook: 'Aviação agrícola e marketing de precisão', cta: 'Comenta AGRO' },
  { week: 10, day: 'Sex', pillar: 'A', format: 'Carrossel', voice: 'SVI', hook: 'Por que agência de influência não funciona', cta: 'Comenta AGÊNCIA' },
  // Semana 11
  { week: 11, day: 'Seg', pillar: 'E', format: 'Reel', voice: 'João', hook: 'Abrimos 2 vagas pra maio', cta: 'Comenta MAIO' },
  { week: 11, day: 'Qua', pillar: 'C', format: 'Carrossel', voice: 'SVI', hook: 'Centro de reabilitação que cresceu 40%', cta: 'Comenta SAÚDE' },
  { week: 11, day: 'Sex', pillar: 'H', format: 'Carrossel', voice: 'João', hook: 'Por que não uso o termo funil', cta: 'Comenta FUNIL' },
  // Semana 12
  { week: 12, day: 'Seg', pillar: 'E', format: 'Carrossel', voice: 'SVI', hook: 'Como aplicar pra ser cliente SVI', cta: 'Comenta APLICAR' },
  { week: 12, day: 'Qua', pillar: 'D', format: 'Reel', voice: 'João', hook: 'O erro de quem quer virar cliente SVI', cta: 'Comenta ABORDAGEM' },
  { week: 12, day: 'Sex', pillar: 'B', format: 'Carrossel', voice: 'SVI', hook: 'Fechando o trimestre, 3 lições internas', cta: 'Comenta TRIMESTRE' },
]

interface ChecklistGroup {
  id: string
  title: string
  subtitle: string
  items: { id: string; label: string; owner?: string }[]
}

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    id: 'decisoes',
    title: '7 Decisões-chave para aprovação',
    subtitle: 'Fechar antes de iniciar a Semana 1',
    items: [
      { id: 'd1', label: 'Aprovar cobrar Diagnóstico Estratégico a R$ 1.500 com abatimento no contrato', owner: 'João' },
      { id: 'd2', label: 'Aprovar stack do site: Next.js 14 + Sanity + Vercel', owner: 'João + José Ricardo' },
      { id: 'd3', label: 'Confirmar CRM: Pipedrive interno + Kommo para clientes', owner: 'João + Ruan' },
      { id: 'd4', label: 'Aprovar idioma EN-US desde o início (site, Typeform, ads)', owner: 'João + Ruan' },
      { id: 'd5', label: 'Escolher cidade do primeiro jantar fechado: Redenção, Goiânia ou Orlando', owner: 'João' },
      { id: 'd6', label: 'Escolher nome da área privada: SVI Inner ou A Sala', owner: 'João' },
      { id: 'd7', label: 'Aprovar contratação de dev Next.js sênior + designer editorial externos', owner: 'João + Letícia' },
    ],
  },
  {
    id: 'semana-1-2',
    title: 'Semana 1-2: Fundação conceitual + Design',
    subtitle: 'Copy final e protótipo Figma',
    items: [
      { id: 's1-1', label: 'Copy final de todas as 10 seções da Home', owner: 'João' },
      { id: 's1-2', label: 'Copy final de /metodo, /para-quem, /diagnostico', owner: 'João + Ruan' },
      { id: 's1-3', label: 'Briefing do Typeform aprovado', owner: 'Letícia' },
      { id: 's1-4', label: 'Moodboard e definição visual (tipografia, grade, paleta)', owner: 'Designer externo' },
      { id: 's2-1', label: 'Protótipo Figma completo (desktop + mobile)', owner: 'Designer externo' },
      { id: 's2-2', label: 'Design system documentado (tokens, componentes, estados)', owner: 'Designer externo' },
      { id: 's2-3', label: 'Storyboard dos 6 VSLs por segmento', owner: 'Sarah + João' },
      { id: 's2-4', label: 'Aprovação visual final', owner: 'João + Ruan' },
    ],
  },
  {
    id: 'semana-3-4',
    title: 'Semana 3-4: Dev frontend + Typeform',
    subtitle: 'Site e form qualificador',
    items: [
      { id: 's3-1', label: 'Setup Next.js + Sanity + Vercel + i18n', owner: 'Dev externo' },
      { id: 's3-2', label: 'Home completa em PT + EN', owner: 'Dev externo' },
      { id: 's3-3', label: '/metodo, /para-quem, /diagnostico em PT + EN', owner: 'Dev externo' },
      { id: 's3-4', label: 'Componente VSL player (Mux)', owner: 'Dev externo' },
      { id: 's4-1', label: '/trabalhos + /insights + /manifesto + /contato + /verticais', owner: 'Dev externo' },
      { id: 's4-2', label: 'Mini-app Diagnóstico Digital Interativo (6 perguntas + score)', owner: 'Dev externo' },
      { id: 's4-3', label: 'Calculadora de Perda por Follow-up (MVP)', owner: 'Dev externo' },
      { id: 's4-4', label: 'Typeform PT completo com lógica condicional', owner: 'Letícia' },
      { id: 's4-5', label: 'Typeform EN mirror completo', owner: 'Letícia + Ruan' },
    ],
  },
  {
    id: 'semana-5-6',
    title: 'Semana 5-6: Automações n8n + Tracking',
    subtitle: 'Fluxos ponta a ponta',
    items: [
      { id: 's5-1', label: 'Fluxo 1: lead qualificado (score ≥70) → Pipedrive → WhatsApp → Cal.com', owner: 'José Ricardo' },
      { id: 's5-2', label: 'Fluxo 2: lead descartado → sequência 5 emails em 30 dias', owner: 'José Ricardo' },
      { id: 's5-3', label: 'Fluxo 3: lead marginal (40-69) → Pedro revisa em 2h úteis', owner: 'José Ricardo + Pedro' },
      { id: 's5-4', label: 'Scoring validado com 10 leads de teste', owner: 'Pedro' },
      { id: 's6-1', label: 'Fluxo 4: pós-diagnóstico com PandaDoc integrado', owner: 'José Ricardo' },
      { id: 's6-2', label: 'Fluxo 5: onboarding 15 dias com ClickUp template', owner: 'Pedro' },
      { id: 's6-3', label: 'GTM + GA4 + Meta Pixel + CAPI + LinkedIn Insight', owner: 'Letícia' },
      { id: 's6-4', label: 'Dashboard Looker Studio inicial (funil completo)', owner: 'Letícia' },
      { id: 's6-5', label: 'Consent mode v2 (LGPD + CCPA)', owner: 'José Ricardo' },
    ],
  },
  {
    id: 'semana-7-8',
    title: 'Semana 7-8: QA + Lançamento',
    subtitle: 'Soft launch + tráfego pago',
    items: [
      { id: 's7-1', label: 'QA: 25 cenários end-to-end no Typeform', owner: 'Time completo' },
      { id: 's7-2', label: 'QA Performance: Core Web Vitals (LCP ≤ 2s, INP ≤ 200ms)', owner: 'Dev externo' },
      { id: 's7-3', label: 'QA Acessibilidade (WCAG AA + Axe audit)', owner: 'Dev externo' },
      { id: 's7-4', label: 'QA SEO: schema, sitemap, hreflang, OG images', owner: 'Letícia' },
      { id: 's7-5', label: 'Soft launch: primeiros 10-15 leads orgânicos para calibrar', owner: 'Pedro' },
      { id: 's8-1', label: 'Campanhas Meta Ads BR + EUA ativadas', owner: 'Letícia' },
      { id: 's8-2', label: 'Google Ads marca + cauda longa', owner: 'Letícia' },
      { id: 's8-3', label: 'LinkedIn Ads para Calculadora Follow-up', owner: 'Letícia' },
      { id: 's8-4', label: 'Post de lançamento IG + LinkedIn (João e SVI)', owner: 'João + Sarah' },
      { id: 's8-5', label: 'Email para base existente comunicando novo site', owner: 'Letícia' },
      { id: 's8-6', label: 'Primeira roda de outbound com novo link', owner: 'Pedro + José Ricardo' },
    ],
  },
  {
    id: 'producao-conteudo',
    title: 'Produção de conteúdo (primeiro mês)',
    subtitle: 'Material de mídia + orgânico',
    items: [
      { id: 'p1', label: 'Gravar Roteiro 01: "O Boleto da Agência" (55s João)', owner: 'João + Editor' },
      { id: 'p2', label: 'Gravar Roteiro 02: "Me ligaram num domingo" (João 60s)', owner: 'João + Editor' },
      { id: 'p3', label: 'Gravar Roteiro 05: VSL 90s "O Diagnóstico"', owner: 'João + Editor' },
      { id: 'p4', label: 'Gravar Roteiro 03: "Pediatra de Xinguara" (case)', owner: 'João + Editor' },
      { id: 'p5', label: 'Gravar Roteiro 04: "Contractor de Pavers" Orlando', owner: 'Ruan + Editor' },
      { id: 'p6', label: 'Produzir Carrossel 01: "7 Sinais que seu funil está quebrado"', owner: 'Designer' },
      { id: 'p7', label: 'Produzir Carrossel 02: "Anatomia do funil SVI"', owner: 'Designer' },
      { id: 'p8', label: 'Produzir Carrossel 05: "R$ 9.000 e 47 leads mortos"', owner: 'Designer' },
      { id: 'p9', label: 'Produzir Conceito 08 estático: convite Diagnóstico', owner: 'Designer' },
      { id: 'p10', label: 'Produzir Conceito 07 Cinematic: Redenção-Orlando', owner: 'Videomaker' },
    ],
  },
  {
    id: 'testes-ads',
    title: 'Plano de teste A/B de ads (4 semanas)',
    subtitle: 'R$ 51.000 em teste + operação',
    items: [
      { id: 't1', label: 'Teste 1 (Semana 1): Hook vs Hook (3 variantes, R$ 4.500)', owner: 'Letícia' },
      { id: 't2', label: 'Teste 2 (Semana 2): Oferta vs Oferta (3 variantes, R$ 3.600)', owner: 'Letícia' },
      { id: 't3', label: 'Teste 3 (Semana 3): Público vs Público (3 variantes, R$ 6.000)', owner: 'Letícia' },
      { id: 't4', label: 'Teste 4 (Semana 4): Formato vs Formato (3 variantes, R$ 4.500)', owner: 'Letícia' },
      { id: 't5', label: 'Teste 5 (Semana 4): CTA vs CTA (3 variantes, R$ 2.400)', owner: 'Letícia' },
      { id: 't6', label: 'Pausar criativos com CTR <0,6% após R$ 800 gastos', owner: 'Letícia' },
      { id: 't7', label: 'Escalar +30% criativos com CPA 40% abaixo da meta por 14 dias', owner: 'Letícia' },
    ],
  },
  {
    id: 'diferenciadores',
    title: '5 diferenciadores foda (pós-lançamento)',
    subtitle: 'Fase 2, a partir da Semana 9',
    items: [
      { id: 'df1', label: 'Mini-app SVI Score (6 perguntas antes do Typeform)', owner: 'Dev externo' },
      { id: 'df2', label: 'VSL condicional por segmento (6 versões)', owner: 'Sarah + João + Editor' },
      { id: 'df3', label: 'Calculadora de Perda por Follow-up (gated LinkedIn)', owner: 'Dev externo + Letícia' },
      { id: 'df4', label: 'Primeiro jantar fechado em Redenção (Semana 10)', owner: 'Letícia + João' },
      { id: 'df5', label: 'SVI Inner lançamento MVP para 24 clientes ativos (Semana 12)', owner: 'Pedro + Dev' },
    ],
  },
]

const STORAGE_KEY = 'svi-company-checklist-v1'

export default function SviCompany() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setChecked(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked))
    } catch {}
  }, [checked])

  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }))

  const totalItems = useMemo(
    () => CHECKLIST_GROUPS.reduce((acc, g) => acc + g.items.length, 0),
    []
  )
  const doneItems = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  )
  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0

  const postsByWeek = useMemo(() => {
    const map = new Map<number, PostItem[]>()
    for (const p of CALENDAR) {
      if (!map.has(p.week)) map.set(p.week, [])
      map.get(p.week)!.push(p)
    }
    return map
  }, [])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">SVI Company</h1>
            <Badge variant="outline" className="ml-2">Conteúdos e Funil</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Linha editorial, calendário, estratégia de anúncios e checklist operacional do funil bi-nacional.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="text-xs text-muted-foreground">Progresso total</div>
            <div className="text-lg font-semibold">{doneItems} / {totalItems}</div>
          </div>
          <div className="w-48">
            <Progress value={progress} />
            <div className="text-xs text-muted-foreground mt-1 text-right">{progress}%</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="editorial" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="editorial" className="gap-1">
            <BookOpen className="h-4 w-4" /> <span className="hidden md:inline">Linha Editorial</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1">
            <CalendarDays className="h-4 w-4" /> <span className="hidden md:inline">Calendário</span>
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1">
            <Megaphone className="h-4 w-4" /> <span className="hidden md:inline">Ads</span>
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1">
            <Workflow className="h-4 w-4" /> <span className="hidden md:inline">Funil</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1">
            <CheckSquare className="h-4 w-4" /> <span className="hidden md:inline">Checklist</span>
          </TabsTrigger>
        </TabsList>

        {/* LINHA EDITORIAL */}
        <TabsContent value="editorial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Missão editorial</CardTitle>
              <CardDescription>Filtro antes de ser mídia. Não publicamos para agradar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>
                A SVI publica para separar, não para agradar. Cada peça atrai o dono de negócio que fatura sério e quer arquitetura comercial, e repele o curioso que procura agência barata ou promessa mágica.
              </p>
              <p>
                Tese central: mídia não é gargalo de quem fatura bem. Por isso o conteúdo mostra o que está por trás do botão de impulsionar. Processo, atendimento, follow-up, CRM, IA operacional, relacionamento.
              </p>
              <p>
                A missão não é educar o mercado em geral. É educar os 24 donos certos que vão ocupar os 24 slots ativos da operação.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Persona 1 (primário)</CardTitle>
                <CardDescription>Dono Maduro de Operação Local</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>38-55 anos, fatura R$ 80k a R$ 800k/mês.</p>
                <p>Já passou por 2-3 agências. Desconfia de promessa. Compra relacionamento.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Persona 2 (secundário)</CardTitle>
                <CardDescription>Operador Digital Avançado</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>35-48 anos, tráfego rodando, time 3-10 pessoas.</p>
                <p>Quer IA aplicada, integração, virar CEO de verdade. Consome bastidor técnico.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Persona 3 (estratégica)</CardTitle>
                <CardDescription>Par de Mercado</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>Agências, consultores, operadores sênior.</p>
                <p>Não vira cliente. Vira parceiro de indicação e constrói reputação técnica da SVI.</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Arquitetura de formatos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Formato</TableHead>
                      <TableHead>Mix</TableHead>
                      <TableHead>Uso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell>Carrossel</TableCell><TableCell>40%</TableCell><TableCell className="text-xs">Bastidor, tese, repertório, crítica</TableCell></TableRow>
                    <TableRow><TableCell>Reel</TableCell><TableCell>30%</TableCell><TableCell className="text-xs">João pessoal, provocação rápida</TableCell></TableRow>
                    <TableRow><TableCell>Estático</TableCell><TableCell>15%</TableCell><TableCell className="text-xs">Frase de tese, manifesto, número</TableCell></TableRow>
                    <TableRow><TableCell>Vídeo longo</TableCell><TableCell>10%</TableCell><TableCell className="text-xs">Clipe 2-4min, podcast cortado</TableCell></TableRow>
                    <TableRow><TableCell>Ao vivo</TableCell><TableCell>5%</TableCell><TableCell className="text-xs">Mensal, 25min com João</TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pilares temáticos (36 posts)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {(Object.keys(PILLAR_LABEL) as Pillar[]).map(p => (
                    <div key={p} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={PILLAR_COLOR[p]}>{p}</Badge>
                        <span>{PILLAR_LABEL[p]}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {p === 'A' && '15% (5 posts)'}
                        {p === 'B' && '18% (7 posts)'}
                        {p === 'C' && '15% (5 posts)'}
                        {p === 'D' && '14% (5 posts)'}
                        {p === 'E' && '11% (4 posts)'}
                        {p === 'F' && '8% (3 posts)'}
                        {p === 'G' && '8% (3 posts)'}
                        {p === 'H' && '6% (2 posts)'}
                        {p === 'I' && '5% (2 posts)'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regras rígidas de linguagem</CardTitle>
              <CardDescription>Obrigatório seguir em toda peça publicada.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-red-600 mb-2">Proibido</div>
                <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                  <li>Em-dash (—) dentro de frases</li>
                  <li>Bullet points em legendas</li>
                  <li>Marketingues ("transforme", "descubra o segredo")</li>
                  <li>Promessa vaga sem ancoragem</li>
                  <li>Emoji decorativo</li>
                  <li>Hashtag em excesso (máx 3-5)</li>
                  <li>Usar "a gente"</li>
                </ul>
              </div>
              <div>
                <div className="text-sm font-medium text-emerald-600 mb-2">Obrigatório</div>
                <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                  <li>Linha em branco entre pontos de legenda</li>
                  <li>H1 máx 8 palavras</li>
                  <li>H2 em linha própria</li>
                  <li>Roteiro como fala natural</li>
                  <li>CTA específico com filtro</li>
                  <li>Números quebrados (27 não 25)</li>
                  <li>Especificidade em vez de generalidade</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teses centrais da marca</CardTitle>
              <CardDescription>Combustível de todo conteúdo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2 text-sm">
              <div className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Gargalo raramente é mídia. É atendimento, follow-up, processo.</span></div>
              <div className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Resultado sério leva 60-120 dias. Quem promete antes, mente.</span></div>
              <div className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Escala mata profundidade.</span></div>
              <div className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Dono local precisa de agência que entende território.</span></div>
              <div className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Sistema vence criatividade.</span></div>
              <div className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Relacionamento é arquitetura, não planilha.</span></div>
              <div className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>IA aplicada é presente operacional, não futuro.</span></div>
              <div className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Contrato longo protege cliente mais que agência.</span></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDÁRIO */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendário 12 semanas</CardTitle>
              <CardDescription>
                36 posts. 3 por semana (Seg / Qua / Sex). Arco: posicionamento (S1-4) → autoridade (S5-8) → conversão (S9-12).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {Array.from(postsByWeek.entries()).map(([week, posts]) => (
                  <AccordionItem key={week} value={`week-${week}`}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">Semana {week}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {week <= 4 && 'Posicionamento e filtro'}
                          {week >= 5 && week <= 8 && 'Autoridade técnica'}
                          {week >= 9 && 'Conversão e oferta'}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Dia</TableHead>
                              <TableHead className="w-20">Pilar</TableHead>
                              <TableHead className="w-24">Formato</TableHead>
                              <TableHead className="w-20">Voz</TableHead>
                              <TableHead>Hook</TableHead>
                              <TableHead className="w-48">CTA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {posts.map((p, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{p.day}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={PILLAR_COLOR[p.pillar]}>
                                    {p.pillar}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{p.format}</TableCell>
                                <TableCell>
                                  <Badge variant={p.voice === 'João' ? 'default' : 'secondary'}>
                                    {p.voice}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{p.hook}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{p.cta}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADS */}
        <TabsContent value="ads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Arquitetura de funil de mídia paga</CardTitle>
              <CardDescription>
                Otimizado para densidade de ficha (lead premium), não para CPL baixo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Topo</Badge>
                    <span className="text-sm font-medium">50% do budget</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Autoridade + filtro + marcação de território.</p>
                  <p className="text-xs">Formatos: Reel João, cinematic de marca, tese contraintuitiva.</p>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Meio</Badge>
                    <span className="text-sm font-medium">30% do budget</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Aprofundar método, bastidor, casos com número.</p>
                  <p className="text-xs">Formatos: VSL 90s, estudo de caso, carrossel educativo.</p>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Fundo</Badge>
                    <span className="text-sm font-medium">20% do budget</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Conversão em Diagnóstico Estratégico.</p>
                  <p className="text-xs">Formatos: oferta direta, filtro, depoimento, escassez real.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Oferta principal</CardTitle>
                <CardDescription>Diagnóstico Estratégico SVI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="font-medium">Duração:</span> 90 minutos com João ou Ruan.</p>
                <p><span className="font-medium">Investimento:</span> R$ 1.500 (BR) / US$ 400 (EUA).</p>
                <p><span className="font-medium">Entrega:</span> 3 maiores gargalos + plano de 90 dias.</p>
                <p><span className="font-medium">Abatimento:</span> valor descontado no primeiro mês se fechar.</p>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">
                  Filtra curioso, posiciona valor desde o primeiro contato, converte 35-45% para contrato.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Plataformas e alocação</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>% Budget</TableHead>
                      <TableHead>Etapa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell>Meta (IG + FB)</TableCell><TableCell>55%</TableCell><TableCell className="text-xs">Todas</TableCell></TableRow>
                    <TableRow><TableCell>Google</TableCell><TableCell>25%</TableCell><TableCell className="text-xs">Fundo + Topo</TableCell></TableRow>
                    <TableRow><TableCell>LinkedIn</TableCell><TableCell>12%</TableCell><TableCell className="text-xs">Meio + Fundo</TableCell></TableRow>
                    <TableRow><TableCell>TikTok</TableCell><TableCell>8%</TableCell><TableCell className="text-xs">Topo</TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orçamento e resultado esperado</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cenário</TableHead>
                    <TableHead>Budget/mês</TableHead>
                    <TableHead>Diagnósticos</TableHead>
                    <TableHead>Fechamentos</TableHead>
                    <TableHead>ROI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Mínimo viável</TableCell>
                    <TableCell>R$ 18.000</TableCell>
                    <TableCell>35-50</TableCell>
                    <TableCell>2-4</TableCell>
                    <TableCell>8-12x</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Ideal</TableCell>
                    <TableCell>R$ 45.000</TableCell>
                    <TableCell>120-180</TableCell>
                    <TableCell>8-12</TableCell>
                    <TableCell>15-22x</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Excedente de diagnósticos (acima de 2 clientes novos/mês) vira lista de espera, produto complementar ou indicação para parceiros.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">10 roteiros prontos para gravar</CardTitle>
              <CardDescription>Referência em SVI_ADS_STRATEGY.md</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  { n: '01', t: 'O Boleto da Agência', d: '55s', v: 'João confessional' },
                  { n: '02', t: 'Me ligaram num domingo', d: '60s', v: 'João confessional' },
                  { n: '03', t: 'Pediatra de Xinguara', d: '60s', v: 'Case anonimizado' },
                  { n: '04', t: 'Contractor de Pavers', d: '60s', v: 'Case bi-nacional' },
                  { n: '05', t: 'VSL O Diagnóstico', d: '90s', v: 'VSL captura' },
                  { n: '06', t: 'Dois Territórios', d: '45s', v: 'Cinematic BR+EUA' },
                  { n: '07', t: 'A agência que só manda print', d: '50s', v: 'Crítica de mercado' },
                  { n: '08', t: 'Quadro Branco', d: '60s', v: 'Bastidor de método' },
                  { n: '09', t: 'Duas Vagas por Mês', d: '45s', v: 'Filtro e seletividade' },
                  { n: '10', t: 'A Sofia não dorme', d: '75s', v: 'Autoridade técnica' },
                ].map(r => (
                  <div key={r.n} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                    <Badge variant="outline" className="font-mono">{r.n}</Badge>
                    <div className="flex-1">
                      <div className="font-medium">{r.t}</div>
                      <div className="text-xs text-muted-foreground">{r.v}</div>
                    </div>
                    <Badge variant="secondary">{r.d}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FUNIL */}
        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Arquitetura end-to-end</CardTitle>
              <CardDescription>Funil calibrado para filtrar, não para atrair.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  'Tráfego (pago + orgânico + indicação + outbound)',
                  'Landing svicompany.com',
                  'CTA: Solicitar Diagnóstico',
                  'Typeform 13 perguntas (4-6 min) + scoring n8n',
                  'Roteamento: Qualificado ≥70 / Marginal 40-69 / Descartado <40',
                  'Pipedrive + WhatsApp UazAPI (automático em 2 min)',
                  'Cal.com (round-robin João/Ruan)',
                  'Diagnóstico Estratégico (90 min)',
                  'Proposta PandaDoc em 48h',
                  'Clicksign + Asaas/Stripe (contrato 6 meses)',
                  'Onboarding 15 dias sem anunciar',
                  'Ciclo operacional (sprints quinzenais, review mensal)',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded border">
                    <Badge variant="outline" className="font-mono w-8 justify-center">{i + 1}</Badge>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Site svicompany.com</CardTitle>
                <CardDescription>Next.js 14 + Sanity + Vercel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>10 seções de Home com copy final aprovada.</p>
                <p>Páginas: /metodo, /trabalhos, /para-quem, /diagnostico, /manifesto, /insights, /verticais, /contato.</p>
                <p>i18n completo PT-BR + EN-US (mirror).</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Core Web Vitals alvo: LCP ≤ 2s, INP ≤ 200ms, CLS ≤ 0,05. WCAG 2.1 AA.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Typeform qualificador</CardTitle>
                <CardDescription>13 perguntas com scoring automático</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Scoring ponderado: cargo, segmento, geo, faturamento, tempo, gargalo, experiência, investimento, meta, origem.</p>
                <p>Bloqueio automático: faturamento abaixo de R$ 30k/mês vai para ending educativa.</p>
                <p>Branches por geografia (Brasil/EUA/Ambos/Outro país).</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Typeform PT e EN duplicados com mesmos IDs para o n8n normalizar.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stack técnica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                {[
                  ['Site', 'Next.js 14 + Sanity + Vercel'],
                  ['Form', 'Typeform Business'],
                  ['Orquestração', 'n8n self-hosted (EasyPanel)'],
                  ['CRM interno', 'Pipedrive'],
                  ['CRM cliente', 'Kommo (produto vendido)'],
                  ['WhatsApp', 'UazAPI + Evolution API'],
                  ['Agendamento', 'Cal.com Team (round-robin)'],
                  ['Proposta', 'PandaDoc'],
                  ['Contrato', 'Clicksign'],
                  ['Pagamento', 'Asaas (BR) / Stripe (EUA)'],
                  ['Tracking', 'GTM + GA4 + Meta CAPI + LinkedIn'],
                  ['Dashboard', 'Looker Studio'],
                  ['Vídeo', 'Mux.com (sem branding YouTube)'],
                  ['Área membros', 'Circle + Notion + Clerk SSO'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">5 diferenciadores planejados</CardTitle>
              <CardDescription>Elevam o funil de "bom" para "referência".</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { i: 1, t: 'Mini-app SVI Score', d: '6 perguntas rápidas antes do Typeform. Gera score 0-100 + insight editorial imediato. +30% conversão Home → Typeform.' },
                { i: 2, t: 'VSL condicional por segmento', d: '6 VSLs (saúde, construção, solar, agro, investimento, hospitalidade). +20% show-up na reunião.' },
                { i: 3, t: 'Calculadora de Perda por Follow-up', d: 'Mini-app em /calculadora-follow-up. Gated. Canal paralelo de 30-50 leads qualificados/mês.' },
                { i: 4, t: 'Jantares fechados trimestrais', d: 'Redenção, Goiânia, Orlando. 6-8 donos por mesa. Sem pitch. Ativo de marca irreplicável.' },
                { i: 5, t: 'SVI Inner', d: 'Área privada para os 24 clientes ativos. Dashboard, biblioteca ORION, community, casos confidenciais. +40% retenção pós-6m.' },
              ].map(d => (
                <div key={d.i} className="flex gap-3 p-3 rounded border">
                  <Badge variant="outline" className="font-mono h-fit">{d.i}</Badge>
                  <div>
                    <div className="font-medium text-sm">{d.t}</div>
                    <div className="text-xs text-muted-foreground mt-1">{d.d}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">CAPEX inicial estimado</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>Designer editorial externo (4 sem)</TableCell><TableCell className="text-right">R$ 18-25k</TableCell></TableRow>
                  <TableRow><TableCell>Dev Next.js sênior externo (5 sem)</TableCell><TableCell className="text-right">R$ 30-45k</TableCell></TableRow>
                  <TableRow><TableCell>Produção 6 VSLs</TableCell><TableCell className="text-right">R$ 12-18k</TableCell></TableRow>
                  <TableRow><TableCell>Licenças anuais</TableCell><TableCell className="text-right">R$ 18-24k</TableCell></TableRow>
                  <TableRow><TableCell>Primeiro jantar fechado</TableCell><TableCell className="text-right">R$ 10-15k</TableCell></TableRow>
                  <TableRow><TableCell>Mídia paga (primeiros 30 dias)</TableCell><TableCell className="text-right">R$ 40-80k</TableCell></TableRow>
                  <TableRow className="bg-accent/40 font-semibold">
                    <TableCell>Total inicial</TableCell>
                    <TableCell className="text-right">R$ 128-207k</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHECKLIST */}
        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Checklist operacional</CardTitle>
                  <CardDescription>
                    Progresso salvo localmente no seu navegador.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{doneItems}/{totalItems} ({progress}%)</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>

          <div className="rounded-lg border bg-blue-500/5 p-3 flex gap-2 text-sm text-blue-900 dark:text-blue-200">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Marque as tarefas conforme avançar. O estado fica salvo neste navegador. Para reset, limpe o cache do site.
            </p>
          </div>

          <Accordion type="multiple" defaultValue={['decisoes']} className="w-full space-y-2">
            {CHECKLIST_GROUPS.map(group => {
              const groupDone = group.items.filter(i => checked[i.id]).length
              const groupTotal = group.items.length
              const groupProgress = Math.round((groupDone / groupTotal) * 100)
              return (
                <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-3">
                  <AccordionTrigger>
                    <div className="flex-1 flex items-center justify-between pr-4">
                      <div className="text-left">
                        <div className="font-medium">{group.title}</div>
                        <div className="text-xs text-muted-foreground">{group.subtitle}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={groupDone === groupTotal ? 'default' : 'secondary'}>
                          {groupDone}/{groupTotal}
                        </Badge>
                        <div className="w-20">
                          <Progress value={groupProgress} className="h-2" />
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pb-2">
                      {group.items.map(item => (
                        <label
                          key={item.id}
                          className="flex items-start gap-3 p-2 rounded hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={!!checked[item.id]}
                            onCheckedChange={() => toggle(item.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm ${checked[item.id] ? 'line-through text-muted-foreground' : ''}`}>
                              {item.label}
                            </div>
                            {item.owner && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Responsável: {item.owner}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  )
}
