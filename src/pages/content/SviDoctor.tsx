import { useEffect, useMemo, useState } from 'react'
import {
  User,
  BookOpen,
  CalendarDays,
  Megaphone,
  CheckSquare,
  Stethoscope,
  Target,
  Info,
  Radio,
  Palette,
  Globe,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Pillar = 'P' | 'U' | 'L' | 'S' | 'O' | 'Raiz' | 'Voz'
type Voice = 'SVI' | 'Ruan'
type Format = 'Carrossel' | 'Reel' | 'Estático'

interface PostItem {
  week: number
  day: 'Seg' | 'Qua' | 'Sex'
  pillar: Pillar
  format: Format
  voice: Voice
  headline: string
  cta: string
}

const PILLAR_LABEL: Record<Pillar, string> = {
  P: 'Presença',
  U: 'Urgência',
  L: 'Lead',
  S: 'Sistema',
  O: 'Otimização',
  Raiz: 'Raiz',
  Voz: 'Voz Ruan',
}

const PILLAR_COLOR: Record<Pillar, string> = {
  P: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  U: 'bg-red-500/10 text-red-600 border-red-500/20',
  L: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  S: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  O: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  Raiz: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  Voz: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
}

const CALENDAR: PostItem[] = [
  // Bloco 1 (1-4): Autoridade e filtro
  { week: 1, day: 'Seg', pillar: 'P', format: 'Reel', voice: 'Ruan', headline: 'A faculdade te preparou pra atender', cta: 'Comenta CLÍNICA' },
  { week: 1, day: 'Qua', pillar: 'P', format: 'Carrossel', voice: 'SVI', headline: 'Por que médico bom fica invisível', cta: 'Salva e manda pro sócio' },
  { week: 1, day: 'Sex', pillar: 'U', format: 'Estático', voice: 'Ruan', headline: 'Ontem alguém digitou seu nome no Google', cta: 'DM DIAGNÓSTICO' },
  { week: 2, day: 'Seg', pillar: 'P', format: 'Reel', voice: 'Ruan', headline: 'Existe uma regra silenciosa no mercado', cta: 'Comenta sua especialidade' },
  { week: 2, day: 'Qua', pillar: 'U', format: 'Carrossel', voice: 'SVI', headline: '7 sinais de marketing sangrando dinheiro', cta: 'Salva' },
  { week: 2, day: 'Sex', pillar: 'P', format: 'Reel', voice: 'Ruan', headline: 'Essa é a call que tive ontem', cta: 'DM RITMO' },
  { week: 3, day: 'Seg', pillar: 'U', format: 'Reel', voice: 'Ruan', headline: 'Convênio não é plano de saúde', cta: 'Comenta PARTICULAR' },
  { week: 3, day: 'Qua', pillar: 'P', format: 'Carrossel', voice: 'SVI', headline: 'O que paciente particular lê em 60s', cta: 'Audita com o checklist' },
  { week: 3, day: 'Sex', pillar: 'L', format: 'Estático', voice: 'Ruan', headline: 'Você não tem problema de marketing', cta: 'DM LEAD' },
  { week: 4, day: 'Seg', pillar: 'P', format: 'Reel', voice: 'Ruan', headline: 'Marketing médico que funciona parece chato', cta: 'Comenta se concorda' },
  { week: 4, day: 'Qua', pillar: 'U', format: 'Carrossel', voice: 'SVI', headline: '3 crenças da faculdade que travam consultório', cta: 'Compartilha com colega' },
  { week: 4, day: 'Sex', pillar: 'O', format: 'Reel', voice: 'Ruan', headline: 'Print de agenda de cliente real', cta: 'DM DIAGNÓSTICO' },
  // Bloco 2 (5-8): Método e cases
  { week: 5, day: 'Seg', pillar: 'S', format: 'Reel', voice: 'Ruan', headline: 'Seu gargalo não é lead, é o WhatsApp', cta: 'Comenta SCRIPT' },
  { week: 5, day: 'Qua', pillar: 'S', format: 'Carrossel', voice: 'SVI', headline: 'Por que a secretária é o elo mais fraco', cta: 'Manda pra sua gestora' },
  { week: 5, day: 'Sex', pillar: 'L', format: 'Reel', voice: 'Ruan', headline: 'Planilha que pedi ontem pra um cliente', cta: 'DM ORIGEM' },
  { week: 6, day: 'Seg', pillar: 'P', format: 'Reel', voice: 'Ruan', headline: 'O P do PULSO é Presença, não popularidade', cta: 'Comenta especialidade' },
  { week: 6, day: 'Qua', pillar: 'S', format: 'Carrossel', voice: 'SVI', headline: 'CRM de consultório em 5 campos', cta: 'Mostra pra secretária' },
  { week: 6, day: 'Sex', pillar: 'O', format: 'Estático', voice: 'Ruan', headline: 'Dashboard não é vaidade, é sono tranquilo', cta: 'DM NÚMEROS' },
  { week: 7, day: 'Seg', pillar: 'L', format: 'Reel', voice: 'Ruan', headline: 'Lead frio existe porque oferta é genérica', cta: 'Comenta OFERTA' },
  { week: 7, day: 'Qua', pillar: 'S', format: 'Carrossel', voice: 'SVI', headline: 'Script de WhatsApp pra consultório particular', cta: 'Adapta pra sua especialidade' },
  { week: 7, day: 'Sex', pillar: 'U', format: 'Reel', voice: 'Ruan', headline: 'Case anônimo: gastro em capital do Nordeste', cta: 'DM CASE' },
  { week: 8, day: 'Seg', pillar: 'S', format: 'Reel', voice: 'Ruan', headline: 'Não tem falta de tempo, tem falta de sistema', cta: 'Comenta SISTEMA' },
  { week: 8, day: 'Qua', pillar: 'L', format: 'Carrossel', voice: 'SVI', headline: '5 canais de captura pra consultório particular', cta: 'Salva' },
  { week: 8, day: 'Sex', pillar: 'O', format: 'Reel', voice: 'Ruan', headline: 'Reunião de otimização 4ª semana de cliente', cta: 'DM OTIMIZAÇÃO' },
  // Bloco 3 (9-12): Conversão e oferta
  { week: 9, day: 'Seg', pillar: 'O', format: 'Reel', voice: 'Ruan', headline: 'Agência que não mostra número tem medo', cta: 'Comenta DASHBOARD' },
  { week: 9, day: 'Qua', pillar: 'U', format: 'Carrossel', voice: 'SVI', headline: 'Por que a SVI recusa 7 de 10 médicos', cta: 'Salva' },
  { week: 9, day: 'Sex', pillar: 'L', format: 'Estático', voice: 'Ruan', headline: 'Diagnóstico SVI 45min gratuito filtrado', cta: 'DM DIAGNÓSTICO' },
  { week: 10, day: 'Seg', pillar: 'P', format: 'Reel', voice: 'Ruan', headline: 'Quem contrata SVI não quer aprender marketing', cta: 'Comenta se faz sentido' },
  { week: 10, day: 'Qua', pillar: 'O', format: 'Carrossel', voice: 'SVI', headline: 'Case completo uroginecologista cidade 400k', cta: 'Compara com seu consultório' },
  { week: 10, day: 'Sex', pillar: 'U', format: 'Reel', voice: 'Ruan', headline: 'Abril fecha com 3 vagas de Diagnóstico', cta: 'DM ABRIL' },
  { week: 11, day: 'Seg', pillar: 'S', format: 'Reel', voice: 'Ruan', headline: 'Esse é o onboarding de cliente novo', cta: 'Comenta ONBOARDING' },
  { week: 11, day: 'Qua', pillar: 'O', format: 'Carrossel', voice: 'SVI', headline: '9 indicadores que a SVI acompanha por cliente', cta: 'Cola na parede da secretária' },
  { week: 11, day: 'Sex', pillar: 'L', format: 'Estático', voice: 'Ruan', headline: 'Se você leu até aqui 11 semanas seguidas', cta: 'DM VIRADA' },
  { week: 12, day: 'Seg', pillar: 'P', format: 'Reel', voice: 'Ruan', headline: '12 semanas de conteúdo, 1 tese só', cta: 'Comenta a tese' },
  { week: 12, day: 'Qua', pillar: 'U', format: 'Carrossel', voice: 'SVI', headline: 'Por que maio vai ser o mês do especialista', cta: 'Decide essa semana' },
  { week: 12, day: 'Sex', pillar: 'O', format: 'Reel', voice: 'Ruan', headline: 'Fechamento do ciclo Diagnóstico SVI', cta: 'DM PULSO' },
]

interface HighlightItem {
  name: string
  cover: string
  content: string
}

const HIGHLIGHTS: HighlightItem[] = [
  { name: 'MÉTODO', cover: 'Letra "P" dourada grande, U.L.S.O em branco pequeno', content: '1 intro + 1 story por letra do PULSO + "o que NÃO é" + CTA' },
  { name: 'CASES', cover: 'Número "R$127k" dourado com seta pra cima', content: 'Print agenda, conversas tarjadas, antes/depois, depoimento 30s' },
  { name: 'BASTIDOR', cover: '"COMO" cursiva dourada, "fazemos" branco pequeno', content: 'Ruan gravando, time em reunião, ads configurando, viagens' },
  { name: 'ERROS', cover: 'X dourado grande, "médicos fazem" branco', content: '8-10 stories com 1 erro cada (agenda com 3 links, secretária 4h, ring light)' },
  { name: 'DIAGNÓSTICO', cover: '"COMEÇA" branco + "AQUI" dourado', content: 'O que é, ICP, como funciona a call 45min, CTA' },
  { name: 'TESES', cover: 'Aspas douradas grandes centradas', content: '5 teses centrais em cards estáticos, trocar ordem a cada 30 dias' },
]

const GRID_POSTS = [
  { pos: '1/1', format: 'Estático', pillar: 'Raiz' as Pillar, headline: 'Médico bom que ninguém acha não existe' },
  { pos: '1/2', format: 'Reel 38s', pillar: 'P' as Pillar, headline: 'Por que seu anúncio não funciona' },
  { pos: '1/3', format: 'Carrossel', pillar: 'S' as Pillar, headline: 'O gargalo não está nos anúncios' },
  { pos: '2/1', format: 'Reel 45s', pillar: 'U' as Pillar, headline: 'Paciente decide em 60 segundos' },
  { pos: '2/2 CENTRO', format: 'Estático', pillar: 'Raiz' as Pillar, headline: 'P.U.L.S.O' },
  { pos: '2/3', format: 'Reel 60s', pillar: 'L' as Pillar, headline: 'Google Ads pra médico não é Facebook' },
  { pos: '3/1', format: 'Carrossel', pillar: 'O' as Pillar, headline: 'Os 7 números que todo consultório ignora' },
  { pos: '3/2', format: 'Reel 52s', pillar: 'Voz' as Pillar, headline: 'Eu não ensino médico, eu faço POR ele' },
  { pos: '3/3', format: 'Estático', pillar: 'Raiz' as Pillar, headline: 'Se fatura R$80k comenta DIAGNÓSTICO' },
]

const SCRIPTS = [
  { n: '01', title: 'A Faculdade Não Te Preparou Pra Isso', duration: '60s', etapa: 'TOPO', tipo: 'Ruan confessional' },
  { n: '02', title: 'Ontem À Noite, Alguém Desistiu de Você', duration: '45s', etapa: 'TOPO', tipo: 'Ruan confessional' },
  { n: '03', title: 'Dra. A, Dermatologista, Marabá', duration: '45s', etapa: 'MEIO', tipo: 'Case anonimizado' },
  { n: '04', title: 'Dr. P, Gastroenterologista, Redenção', duration: '60s', etapa: 'MEIO/FUNDO', tipo: 'Case anonimizado' },
  { n: '05', title: 'VSL: Por Que Seu Marketing Não Escala', duration: '90s', etapa: 'FUNDO', tipo: 'VSL captura' },
  { n: '06', title: 'Crítica: A Agência Que Fala Bonito', duration: '45s', etapa: 'TOPO', tipo: 'Crítica direta' },
  { n: '07', title: 'Dentro do Diagnóstico P.U.L.S.O', duration: '60s', etapa: 'MEIO', tipo: 'Bastidor' },
  { n: '08', title: 'Se Você Fatura Menos, Desliga', duration: '30s', etapa: 'MEIO/FUNDO', tipo: 'Filtro' },
  { n: '09', title: 'A Secretária Vale Mais Que o Anúncio', duration: '60s', etapa: 'MEIO', tipo: 'Pilar S' },
  { n: '10', title: '73% Do Paciente Te Investiga Antes', duration: '45s', etapa: 'TOPO/MEIO', tipo: 'Autoridade técnica' },
]

const HOOKS: Record<Pillar, string[]> = {
  P: [
    '90% dos médicos postam errado',
    'Seu perfil vende em 60 segundos',
    'O anúncio mais burro do Instagram médico',
    'Ring light matou o seu criativo',
    'Paciente não quer ver estetoscópio',
    'Sua bio tá vendendo diploma',
    'Reels de médico que dão vergonha',
    'Por que seu criativo não converte',
  ],
  U: [
    'Médico invisível não existe',
    'Seu concorrente já está correndo',
    'Perdeu o paciente em 3 segundos',
    'Agenda vazia não espera',
    '2026 não perdoa médico tímido',
    'O relógio do consultório tá correndo',
    'Você não tem 6 meses sobrando',
    'Paciente decidiu sem te ver',
  ],
  L: [
    'Google Ads pra médico é outro jogo',
    'Landing page mata o lead',
    '70% do lead morre antes do WhatsApp',
    'Seu CPL tá escondendo dinheiro',
    'Meta Ads de médico é commoditizado',
    'Por que ninguém clica no seu link',
    'WhatsApp é o verdadeiro funil',
    'O lead barato que não converte',
  ],
  S: [
    'A secretária perdeu 47 leads',
    'Script de salão de beleza no consultório',
    'CRM vazio é consultório cego',
    'Sua agenda não é previsível, é sorte',
    'O gargalo mora no WhatsApp',
    'Treinar secretária não é luxo',
    'Agenda cheia sem sistema é acidente',
    'Kommo não é frescura, é oxigênio',
  ],
  O: [
    'Relatório bonito esconde prejuízo',
    'Você não sabe seu ROI',
    'CPL caindo, agenda vazia, por quê',
    'Os 7 números que você ignora',
    'Taxa de agendamento miserável',
    'Remarketing que você não liga',
    'A métrica que nenhuma agência mostra',
    'Otimizar não é mexer em anúncio',
  ],
  Raiz: [],
  Voz: [
    'Eu não ensino médico, eu faço POR ele',
    'Isso é o que a maioria das agências não conta',
  ],
}

interface ChecklistGroup {
  id: string
  title: string
  subtitle: string
  items: { id: string; label: string; owner?: string }[]
}

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    id: 'setup-perfil',
    title: 'Setup do Perfil (Semana 0)',
    subtitle: 'Fundação antes de começar a publicar',
    items: [
      { id: 'sp1', label: 'Definir e aplicar Bio (Variação A recomendada)', owner: 'Ruan' },
      { id: 'sp2', label: 'Foto de perfil refeita (fundo preto, halo dourado, camisa preta)', owner: 'Fotógrafo' },
      { id: 'sp3', label: 'Criar 6 destaques (Método, Cases, Bastidor, Erros, Diagnóstico, Teses)', owner: 'Sarah + Ruan' },
      { id: 'sp4', label: 'Criar link na bio (Beacons ou página própria) com 3 CTAs', owner: 'Letícia' },
      { id: 'sp5', label: 'Gravar e fixar vídeo âncora (72s, O Que Fazemos)', owner: 'Ruan + Editor' },
      { id: 'sp6', label: 'Produzir 9 primeiros posts do grid (pilares visuais + reels + carrosséis)', owner: 'Sarah + Editor' },
      { id: 'sp7', label: 'Configurar ManyChat com palavras-chave DIAGNÓSTICO, CLÍNICA, PULSO', owner: 'José Ricardo' },
      { id: 'sp8', label: 'Integrar Instagram → n8n → Kommo para leads qualificados', owner: 'José Ricardo' },
    ],
  },
  {
    id: 'producao-bloco1',
    title: 'Produção Bloco 1 — Semanas 1 a 4 (Autoridade e filtro)',
    subtitle: '12 posts (3/semana) com foco em Presença e Urgência',
    items: [
      { id: 'p1-1', label: 'Gravar 4 reels do Ruan (semanas 1-4)', owner: 'Ruan + Editor' },
      { id: 'p1-2', label: 'Produzir 4 carrosséis editoriais (S1 Invisibilidade, S2 7 Sinais, S3 60 Segundos, S4 3 Crenças)', owner: 'Designer' },
      { id: 'p1-3', label: 'Produzir 2 estáticos confessionais (S1 Google 22h, S4 Contrato 6 meses)', owner: 'Designer' },
      { id: 'p1-4', label: 'Agendar semana 1-2 no Metricool com copy e hashtags', owner: 'Sarah' },
      { id: 'p1-5', label: 'Monitorar taxa de gravação e save-rate após 1ª semana', owner: 'Letícia' },
    ],
  },
  {
    id: 'producao-bloco2',
    title: 'Produção Bloco 2 — Semanas 5 a 8 (Método e cases)',
    subtitle: '12 posts com peso em Sistema e Lead',
    items: [
      { id: 'p2-1', label: 'Obter autorização escrita de 2 clientes para cases anonimizados', owner: 'Ruan' },
      { id: 'p2-2', label: 'Gravar reels de bastidor (S5 planilha, S8 reunião otimização)', owner: 'Ruan + Editor' },
      { id: 'p2-3', label: 'Produzir carrossel S5 "Por que a secretária é o elo mais fraco" (8 slides)', owner: 'Designer' },
      { id: 'p2-4', label: 'Produzir carrossel S6 "CRM em 5 campos" + S7 Script WhatsApp + S8 5 canais', owner: 'Designer' },
      { id: 'p2-5', label: 'Gravar e publicar primeiro case com número (S7)', owner: 'Ruan + Editor' },
    ],
  },
  {
    id: 'producao-bloco3',
    title: 'Produção Bloco 3 — Semanas 9 a 12 (Conversão)',
    subtitle: '12 posts ativando oferta e escassez real',
    items: [
      { id: 'p3-1', label: 'Produzir carrossel S9 "Por que recusamos 7 de 10 médicos"', owner: 'Designer' },
      { id: 'p3-2', label: 'Gravar case completo uroginecologista (S10)', owner: 'Ruan + Editor' },
      { id: 'p3-3', label: 'Produzir carrossel S11 "9 indicadores" + S12 "Por que maio"', owner: 'Designer' },
      { id: 'p3-4', label: 'Anunciar vagas limitadas de Diagnóstico mensal (S10)', owner: 'Ruan' },
      { id: 'p3-5', label: 'Fechar ciclo com reel de recapitulação (S12)', owner: 'Ruan + Editor' },
    ],
  },
  {
    id: 'ads-semana1-2',
    title: 'Ads — Semanas 1 e 2 (R$ 4.500)',
    subtitle: 'Baseline topo + meio + validação de oferta',
    items: [
      { id: 'a12-1', label: 'Subir Meta Pixel + GA4 + evento Lead no Typeform', owner: 'Letícia' },
      { id: 'a12-2', label: 'Subir Roteiros 1, 2 e 6 em TOPO (R$ 2.000 semana 1)', owner: 'Letícia' },
      { id: 'a12-3', label: 'Subir Carrossel 1 + Carrossel 4 em paralelo', owner: 'Letícia' },
      { id: 'a12-4', label: 'Identificar 2 criativos campeões via CTR + taxa 75% (domingo semana 1)', owner: 'Letícia' },
      { id: 'a12-5', label: 'Semana 2: manter 2 topo + subir Roteiros 3, 7 (meio) + 8 (oferta)', owner: 'Letícia' },
      { id: 'a12-6', label: 'Carrosséis 2 e 3 rodando em meio', owner: 'Letícia' },
      { id: 'a12-7', label: 'Validar CPL qualificado < R$ 220', owner: 'Letícia' },
    ],
  },
  {
    id: 'ads-semana3-4',
    title: 'Ads — Semanas 3 e 4 (R$ 6.500)',
    subtitle: 'VSL + fundo agressivo + escala',
    items: [
      { id: 'a34-1', label: 'Subir Roteiro 5 (VSL 90s) em MEIO/FUNDO', owner: 'Letícia' },
      { id: 'a34-2', label: 'Subir Roteiro 4 (case Dr. P)', owner: 'Letícia' },
      { id: 'a34-3', label: 'Subir Conceito 8 (estático oferta) em FUNDO', owner: 'Letícia' },
      { id: 'a34-4', label: 'Carrossel 5 (case Dr. M) rodando', owner: 'Letícia' },
      { id: 'a34-5', label: 'Semana 4: subir Roteiros 9 e 10', owner: 'Letícia' },
      { id: 'a34-6', label: 'Escalar budget +50% nos 3 criativos vencedores', owner: 'Letícia' },
      { id: 'a34-7', label: 'Pausar qualquer criativo com frequência > 2,8', owner: 'Letícia' },
      { id: 'a34-8', label: 'Estabilizar CPL e show-up para mês 2', owner: 'Letícia' },
    ],
  },
  {
    id: 'crescimento-organico',
    title: 'Crescimento orgânico e DM',
    subtitle: 'Táticas diárias e semanais',
    items: [
      { id: 'co1', label: 'Pedro executa 50 perfis/dia de social selling (mapeamento + abordagem em 3 camadas)', owner: 'Pedro' },
      { id: 'co2', label: 'Comentar em 10 perfis de médicos por dia (substantivo, não elogio)', owner: 'Pedro' },
      { id: 'co3', label: 'Publicar 1 reel de "reação" a anúncio toda terça', owner: 'Ruan + Editor' },
      { id: 'co4', label: 'Fazer 1 collab por quinzena com médico cliente', owner: 'Sarah' },
      { id: 'co5', label: 'Organizar 1 live mensal com médico cliente + cortar em 4-6 reels', owner: 'Sarah' },
      { id: 'co6', label: 'Guest em podcast médico (1 por mês)', owner: 'Ruan' },
      { id: 'co7', label: 'Manter SLA de DM qualificado em 15min em horário comercial', owner: 'Ruan' },
      { id: 'co8', label: 'Stories diários: 6-10 por dia em 6 blocos horários', owner: 'Sarah' },
    ],
  },
  {
    id: 'metas-30-60-90',
    title: 'Metas 30/60/90 dias',
    subtitle: 'Números a perseguir e validar',
    items: [
      { id: 'm30-1', label: '30 dias: 1.200 seguidores, 40 DMs qualificadas, 12 reuniões, 2 fechamentos', owner: 'Time' },
      { id: 'm60-1', label: '60 dias: 3.500 seguidores, 80 DMs qualificadas, 25 reuniões, 4 fechamentos', owner: 'Time' },
      { id: 'm90-1', label: '90 dias: 7.500 seguidores, 140 DMs qualificadas, 45 reuniões, 6 fechamentos', owner: 'Time' },
      { id: 'm90-2', label: 'MRR atribuído ao perfil no dia 90: R$ 30k+ (6 × R$ 5k)', owner: 'Ruan' },
      { id: 'm90-3', label: 'Primeiro reel viral (100k+ views) até o fim do mês 2', owner: 'Sarah' },
      { id: 'm90-4', label: '3 cases públicos com antes/depois ao vivo até o fim do mês 3', owner: 'Ruan' },
    ],
  },
]

// DESIGN SYSTEM
interface ColorToken {
  token: string
  hex: string
  function: string
  usage: string
}

const COLOR_TOKENS: ColorToken[] = [
  { token: 'svi.black', hex: '#0A0A0A', function: 'Fundo primário (nunca #000 puro)', usage: '70%' },
  { token: 'svi.gold', hex: '#C9A227', function: 'Destaque principal, assinatura', usage: '15%' },
  { token: 'svi.gold.light', hex: '#E8C968', function: 'Sublinhado, brilho em serifa', usage: '3%' },
  { token: 'svi.gold.deep', hex: '#8A6E14', function: 'Sombra de dourado, gradiente', usage: '2%' },
  { token: 'svi.white', hex: '#F5F2EA', function: 'Corpo de texto (branco quente)', usage: '8%' },
  { token: 'svi.graphite', hex: '#2A2A2A', function: 'Vinheta, divisores', usage: '2%' },
  { token: 'svi.blood', hex: '#7A1515', function: 'Acento raro (urgência, erro)', usage: '<1%' },
]

interface TypeToken {
  hierarchy: string
  font: string
  weight: string
  size: string
  leading: string
  tracking: string
}

const TYPE_TOKENS: TypeToken[] = [
  { hierarchy: 'Display H1', font: 'Playfair Display', weight: 'Black Italic (900)', size: '96-128pt', leading: '0.95', tracking: '-20' },
  { hierarchy: 'Palavra-chave destaque', font: 'Playfair Display', weight: 'Black Italic + sublinhado 3px', size: 'mesmo H1', leading: '0.95', tracking: '-15' },
  { hierarchy: 'Subtítulo H2', font: 'Inter Tight', weight: 'Semibold (600)', size: '34-42pt', leading: '1.2', tracking: '0' },
  { hierarchy: 'Corpo', font: 'Inter Tight', weight: 'Regular (400)', size: '24-28pt', leading: '1.4', tracking: '+10' },
  { hierarchy: 'Assinatura SVI Doctor', font: 'Playfair Display', weight: 'Italic (400)', size: '22pt', leading: '1.0', tracking: '+20' },
  { hierarchy: 'Microcopy CTA', font: 'Inter Tight', weight: 'Medium UPPERCASE', size: '16pt', leading: '1.0', tracking: '+120' },
  { hierarchy: 'Número grande', font: 'Playfair Display', weight: 'Black (900)', size: '180-240pt', leading: '0.85', tracking: '-40' },
]

interface Template {
  code: string
  name: string
  size: string
  description: string
  variations: string[]
}

const TEMPLATES: Template[] = [
  {
    code: 'A',
    name: 'Capa de Reel',
    size: '1080x1920',
    description: 'Foto/IA 100%, gradiente preto no rodapé, headline em 1200-1600px, assinatura em 1700-1850px',
    variations: ['A1 — Headline inteira', 'A2 — Tese fracionada (subtítulo sans + headline serif + palavra dourada)', 'A3 — Número em destaque (dourado italic 180pt+)'],
  },
  {
    code: 'B',
    name: 'Capa de Carrossel',
    size: '1080x1350',
    description: 'Igual A. Indicador "+8 SLIDES →" canto superior direito. Seta dourada no rodapé.',
    variations: ['Mesmas lógicas A1, A2, A3 adaptadas para 4:5'],
  },
  {
    code: 'C',
    name: 'Slide Interno Carrossel',
    size: '1080x1350',
    description: 'Número topo dourado 240pt. Título branco 64pt máx 2 linhas. Corpo branco 28pt. Consequência dourada italic 38pt.',
    variations: ['C1 — Dado (número gigante + contexto)', 'C2 — Lista (título + 3 bullet dourado)', 'C3 — Citação (aspas serif gigantes)', 'C4 — CTA final (pergunta + call DM)'],
  },
  {
    code: 'D',
    name: 'Manifesto Estático',
    size: '1080x1350',
    description: 'Fundo preto com grain 4%. Frase única Playfair Black Italic 88pt centralizada. Palavra-chave dourada italic sublinhada. Nada mais.',
    variations: ['Variação única: só tipografia'],
  },
  {
    code: 'E',
    name: 'Story',
    size: '1080x1920',
    description: '5 variações oficiais, cada uma com posição e estrutura específicas',
    variations: ['E1 Abertura de dia', 'E2 Bastidor (letterbox)', 'E3 Educação rápida', 'E4 Prova/Case (número colorido)', 'E5 CTA (pergunta + caixa de resposta)'],
  },
  {
    code: 'F',
    name: 'Capa de Destaque',
    size: '1080x1920 (crop circular 512px)',
    description: 'Ícone dourado 140px no topo + nome em Playfair Italic 28pt. 6 categorias.',
    variations: ['MÉTODO (coluna grega)', 'CASES (gráfico alta)', 'BASTIDOR (claquete)', 'ERROS (X em círculo)', 'DIAGNÓSTICO (estetoscópio estilizado)', 'TESES (aspas)'],
  },
]

interface CoverItem {
  n: string
  week: number
  headline: string
  goldWord: string
  template: string
  type: string
}

const COVER_LIBRARY: CoverItem[] = [
  { n: '01', week: 1, headline: 'Marketing médico que funciona parece chato.', goldWord: 'chato', template: 'D', type: 'Manifesto' },
  { n: '02', week: 1, headline: 'Esse ortopedista torrou R$ 47k com tráfego genérico em 6 meses.', goldWord: 'R$ 47k / genérico', template: 'A', type: 'IA editorial' },
  { n: '03', week: 2, headline: 'Peguei o perfil dele com 2 mil. Entreguei 180 leads em 41 dias.', goldWord: '180 leads', template: 'A', type: 'Foto Ruan' },
  { n: '04', week: 2, headline: 'O paciente particular já decidiu sobre você antes de clicar no botão.', goldWord: 'já decidiu', template: 'A', type: 'IA editorial' },
  { n: '05', week: 3, headline: '5 letras que explicam por que o médico top 1% não disputa preço.', goldWord: 'top 1%', template: 'B', type: 'Tipográfica P.U.L.S.O' },
  { n: '06', week: 3, headline: 'Se o seu bio diz "cuidando com amor", você já perdeu.', goldWord: 'já perdeu', template: 'A', type: 'IA editorial' },
  { n: '07', week: 4, headline: 'Tráfego sem presença é gasolina em fogo apagado.', goldWord: 'fogo apagado', template: 'A', type: 'IA editorial' },
  { n: '08', week: 4, headline: 'Dermato do Pará: de 3 leads/semana pra 47 em 60 dias.', goldWord: '47', template: 'A3', type: 'Número destaque' },
  { n: '09', week: 5, headline: '60 segundos. É o tempo que o paciente particular te dá.', goldWord: '60 segundos', template: 'A', type: 'IA editorial (relógio)' },
  { n: '10', week: 5, headline: 'Recusei 3 médicos esse mês. Vou te contar o porquê.', goldWord: 'Recusei', template: 'A', type: 'Foto Ruan / IA' },
  { n: '11', week: 6, headline: '73% dos médicos no Pará não têm nenhum sistema de marketing.', goldWord: '73%', template: 'C1', type: 'Dado' },
  { n: '12', week: 6, headline: 'Agência de marketing não é o mesmo que sistema de aquisição.', goldWord: 'não é o mesmo', template: 'D', type: 'Tipográfica comparação' },
  { n: '13', week: 7, headline: 'Seu diploma não te diferencia. Sua presença sim.', goldWord: 'presença', template: 'D', type: 'Manifesto' },
  { n: '14', week: 7, headline: 'Dentro do consultório da Dra. Luiza no dia do lançamento.', goldWord: 'lançamento', template: 'A', type: 'IA editorial' },
  { n: '15', week: 8, headline: 'Se você ainda usa ring light e fundo branco, pare agora.', goldWord: 'pare agora', template: 'A', type: 'IA editorial' },
  { n: '16', week: 8, headline: 'O especialista que não se posicionar em 2026 vira comoditie em 2027.', goldWord: 'comoditie', template: 'A', type: 'IA editorial (areia)' },
  { n: '17', week: 9, headline: 'Cheguei em Belém às 5h. Às 9h tinha fechado o 12º médico do ano.', goldWord: '12º', template: 'A', type: 'Foto real Ruan' },
  { n: '18', week: 10, headline: '9 erros que fazem o médico top perder paciente particular.', goldWord: '9 erros', template: 'B', type: 'Carrossel capa' },
  { n: '19', week: 11, headline: '"Em 90 dias, deixei de depender do convênio. Primeira vez em 12 anos."', goldWord: '12 anos', template: 'C3', type: 'Depoimento' },
  { n: '20', week: 12, headline: 'Você não precisa de mais conteúdo. Precisa de sistema.', goldWord: 'sistema', template: 'D', type: 'Manifesto CTA' },
]

const MICROCOPY_CTAS = [
  'SALVA ESSE. VOCÊ VAI PRECISAR ↑',
  'COMPARTILHA COM QUEM TRAVOU ↑',
  'LEIA DE NOVO. É O PONTO. ↑',
  'MARCA O COLEGA QUE IGNORA ISSO ↑',
]

// LANDING PAGE
interface LandingSection {
  n: string
  title: string
  h1: string
  subcopy: string
  elements: string
  cta?: string
}

const LANDING_SECTIONS: LandingSection[] = [
  { n: '01', title: 'Nav Fixa', h1: 'Logo SVI Doctor + Menu: Método / Cases / Diagnóstico', subcopy: 'Translúcida no hero, solidifica em preto após 80vh', elements: 'Logo lockup dourado. Botão dourado "Solicitar diagnóstico"' },
  { n: '02', title: 'Hero', h1: 'Especialista com agenda oscilando para de oscilar em 90 dias.', subcopy: 'O método P.U.L.S.O transforma presença digital em previsibilidade de consulta particular. Sem promessa vazia. Sem marketingues. Sem agência que entrega relatório bonito.', elements: 'Foto do Ruan em três quartos + 3 números dourados (38 consultórios / R$ 2,7mi / 87 dias)', cta: 'Solicitar diagnóstico gratuito' },
  { n: '03', title: 'Prova Numérica', h1: '38 especialistas. 6 estados. Zero promessa de resultado fora do que está documentado.', subcopy: '', elements: '3 blocos: 91% (ocupação de agenda) / R$ 224 (CAC médio) / 70% (leads que morrem na secretária)' },
  { n: '04', title: 'Diagnóstico do Mercado', h1: 'Paciente particular não escolhe pela técnica.', subcopy: 'Escolhe pelo que consegue ler em 60 segundos de presença digital. Você passou 10 anos na residência. Seu concorrente que formou ontem está na frente no Google porque pagou R$ 400 para uma agência que nunca atendeu um médico antes.', elements: 'Ilustração editorial de agenda com gaps à direita' },
  { n: '05', title: 'Método P.U.L.S.O', h1: 'P.U.L.S.O é um sistema, não uma lista de entregáveis.', subcopy: 'Cinco frentes que operam ao mesmo tempo. A ordem importa. A medida importa.', elements: '5 blocos (P/U/L/S/O) com letra gigante dourada + descrição + entregável com número' },
  { n: '06', title: 'Cases com Números', h1: 'Três especialistas. Três cenários. Números documentados.', subcopy: 'Nomes preservados por NDA. Métricas auditáveis em call.', elements: 'Dr. M (38%→91% em 87d), Dra. A (+R$38k/mês em 96d), Dr. P (CAC R$1.545→R$224 em 90d)' },
  { n: '07', title: 'Para Quem É / Não É', h1: 'Este método não é para todo médico.', subcopy: '', elements: '2 colunas. Esquerda dourada (é). Direita cinza (não é). Filtro R$80k+/mês e 2+ anos de consultório.' },
  { n: '08', title: 'Como Funciona o Diagnóstico', h1: 'O diagnóstico dura 45 minutos e não custa nada.', subcopy: 'Call com o Ruan. Câmera aberta. Zero venda empurrada. Se não fizer sentido, o plano de 90 dias é seu mesmo assim.', elements: '4 passos com número dourado: 01 Formulário / 02 Auditoria / 03 Call / 04 Decisão', cta: 'Solicitar diagnóstico gratuito' },
  { n: '09', title: 'Sobre o Ruan', h1: 'Ruan opera o P.U.L.S.O pessoalmente nos primeiros 30 dias de cada contrato.', subcopy: 'Sócio fundador do braço SVI Doctor. Responsável direto pelos três cases. 4 anos dentro do consultório de 38 especialistas. Não assina contrato que não opera pessoalmente no primeiro mês.', elements: 'Foto do Ruan à esquerda + frase dourada "O cliente não fala com atendimento. Fala comigo."' },
  { n: '10', title: 'FAQ', h1: 'Perguntas que o médico sempre faz na primeira call.', subcopy: '', elements: 'Acordeão com 8 perguntas (garantia, preço, 90 dias, agência atual, IG diário, fora do PA, filtro R$80k, anonimato)' },
  { n: '11', title: 'CTA Final', h1: 'Se você faturou R$ 80 mil no mês passado, a próxima call é sua.', subcopy: '45 minutos, câmera aberta, zero venda empurrada. Se não for fit, você sai com o plano de 90 dias no email mesmo assim.', elements: 'Full bleed preto com textura dourada. Botão gigante dourado.', cta: 'Solicitar diagnóstico gratuito' },
  { n: '12', title: 'Footer', h1: '3 colunas: Logo+endereço / Nav+política / Contato+redes', subcopy: 'SVI Doctor é braço da SVI Company. Respeita CFM 1974/2011 e LGPD.', elements: 'Compliance visível, CNPJ, links legais' },
]

interface FAQItem {
  q: string
  a: string
}

const FAQ: FAQItem[] = [
  { q: 'Vocês garantem número de pacientes?', a: 'Não. Qualquer agência que garanta número absoluto de paciente está violando CFM ou mentindo. O que entregamos é processo auditável e métrica transparente: CPL, taxa de agendamento, show rate e receita atribuída. O resultado emerge do processo, não de promessa.' },
  { q: 'Quanto custa?', a: 'R$ 3 mil por mês de gestão, mais R$ 2 mil por mês de verba de tráfego que fica na sua conta e é paga direto pelas plataformas. Contrato mínimo 90 dias. Total R$ 15 mil no primeiro trimestre, dos quais R$ 6 mil são mídia que volta em forma de consulta.' },
  { q: 'Por que 90 dias de contrato mínimo?', a: '30 dias é setup. 60 dias é calibrar CPL. Só no terceiro mês a agenda começa a preencher de forma previsível. Contrato mais curto prejudicaria o médico, não a agência.' },
  { q: 'E se eu já tenho agência hoje?', a: 'A auditoria do diagnóstico inclui análise da agência atual. Em 60% dos casos o que a agência entrega é pauta genérica de saúde e boost de post. Isso não é marketing médico, é mensalidade.' },
  { q: 'Preciso estar no Instagram todo dia?', a: 'Precisa gravar 40 minutos uma vez a cada 15 dias. Roteiro vai pronto. Corte, legenda e publicação são da equipe. Consultório seguro ao invés de médico exausto.' },
  { q: 'Vocês atendem fora do Sul do Pará?', a: 'Sim. Base em Redenção e apoio nos EUA. Carteira ativa em 6 estados. Método é o mesmo, calibragem é regional.' },
  { q: 'Por que o filtro de R$ 80 mil por mês?', a: 'Abaixo desse patamar o método não entrega ROI em 90 dias, e o médico se frustra. Preferimos dizer não antes do contrato do que no sexto mês.' },
  { q: 'Meu nome vai aparecer em algum lugar?', a: 'Só se você autorizar. Os 3 cases públicos estão anonimizados por padrão. Autorização explícita de imagem e número é parte separada do contrato.' },
]

const STORAGE_KEY = 'svi-doctor-checklist-v1'

export default function SviDoctor() {
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
            <Stethoscope className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">SVI Doctor</h1>
            <Badge variant="outline" className="ml-2">@svimedicos · Método P.U.L.S.O</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Marketing e vendas para médicos especialistas. Instagram, conteúdo, ads, funil.
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

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-7">
          <TabsTrigger value="setup" className="gap-1">
            <User className="h-4 w-4" /> <span className="hidden md:inline">Setup</span>
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-1">
            <Palette className="h-4 w-4" /> <span className="hidden md:inline">Design</span>
          </TabsTrigger>
          <TabsTrigger value="editorial" className="gap-1">
            <BookOpen className="h-4 w-4" /> <span className="hidden md:inline">Editorial</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1">
            <CalendarDays className="h-4 w-4" /> <span className="hidden md:inline">Calendário</span>
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1">
            <Megaphone className="h-4 w-4" /> <span className="hidden md:inline">Ads</span>
          </TabsTrigger>
          <TabsTrigger value="landing" className="gap-1">
            <Globe className="h-4 w-4" /> <span className="hidden md:inline">Landing</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1">
            <CheckSquare className="h-4 w-4" /> <span className="hidden md:inline">Checklist</span>
          </TabsTrigger>
        </TabsList>

        {/* SETUP */}
        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bio do perfil (3 variações)</CardTitle>
              <CardDescription>Variação A recomendada para primeiros 30 dias.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>A</Badge>
                  <span className="text-xs font-medium text-primary">RECOMENDADA</span>
                </div>
                <pre className="text-sm whitespace-pre-wrap font-mono">{`Lotamos agenda de médico especialista.
Método P.U.L.S.O | 90 dias | Redenção/PA + EUA
Diagnóstico gratuito abaixo.`}</pre>
                <p className="text-xs text-muted-foreground mt-2">138 caracteres. Verbo plural "lotamos" (faço POR você). Nomeia método. Ancora geografia.</p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2"><Badge variant="secondary">B</Badge><span className="text-xs">Prova + Filtro</span></div>
                <pre className="text-sm whitespace-pre-wrap font-mono">{`R$ 80k/mês e agenda imprevisível?
Viramos o WhatsApp do seu consultório em 90 dias.
P.U.L.S.O | Ortopedia, Gastro, Derma, Uro`}</pre>
                <p className="text-xs text-muted-foreground mt-2">147 caracteres. Abre com filtro de ICP.</p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2"><Badge variant="secondary">C</Badge><span className="text-xs">Contra-intuitiva (após 15+ posts)</span></div>
                <pre className="text-sm whitespace-pre-wrap font-mono">{`Médico bom que ninguém acha não é humilde, é inacessível.
Resolvemos isso com o método P.U.L.S.O.
Redenção/PA + EUA`}</pre>
                <p className="text-xs text-muted-foreground mt-2">139 caracteres. Hook parado.</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Foto de perfil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Sujeito:</strong> Ruan, peito pra cima, 15° à direita, rosto frontal.</p>
                <p><strong>Expressão:</strong> boca fechada, leve tensão no canto. Olhar direto.</p>
                <p><strong>Figurino:</strong> camisa preta lisa, sem logo, sem relógio, sem corrente.</p>
                <p><strong>Fundo:</strong> preto absoluto #000000 com halo dourado atrás da cabeça.</p>
                <p><strong>Luz:</strong> key lateral 45° esquerda. Backlight dourado. Fill com refletor preto.</p>
                <p className="text-xs text-muted-foreground mt-2">Nunca ring light frontal. Nunca fundo clínico branco.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Paleta oficial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-black border" />
                  <div>
                    <p className="text-sm font-medium">Preto #000000</p>
                    <p className="text-xs text-muted-foreground">Fundo padrão</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded" style={{ backgroundColor: '#C9A227' }} />
                  <div>
                    <p className="text-sm font-medium">Dourado #C9A227</p>
                    <p className="text-xs text-muted-foreground">Destaques, números, ganchos</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-white border" />
                  <div>
                    <p className="text-sm font-medium">Branco #FFFFFF</p>
                    <p className="text-xs text-muted-foreground">Corpo de texto</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">6 Destaques fixados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {HIGHLIGHTS.map(h => (
                  <div key={h.name} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">{h.name}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1"><strong>Capa:</strong> {h.cover}</p>
                    <p className="text-xs"><strong>Conteúdo:</strong> {h.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Primeiros 9 posts (grid fixado)</CardTitle>
              <CardDescription>Leitura diagonal: posts 1, 5, 9 são pilares visuais. Diagonal lê "problema → método → conversão".</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {GRID_POSTS.map((p, i) => (
                  <div key={i} className={`aspect-square rounded border-2 p-2 flex flex-col justify-between ${p.pos.includes('CENTRO') ? 'border-primary bg-primary/10' : 'border-border bg-black/5'}`}>
                    <div className="flex items-start justify-between gap-1">
                      <Badge variant="outline" className={`${PILLAR_COLOR[p.pillar]} text-[10px]`}>{p.pillar}</Badge>
                      <span className="text-[10px] text-muted-foreground">{p.pos}</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{p.format}</p>
                      <p className="text-xs font-medium leading-tight mt-1">{p.headline}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vídeo âncora (fixado no topo) — 72s</CardTitle>
              <CardDescription>O que fazemos. Capa: "O QUE FAZEMOS" com "FAZEMOS" dourado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { t: '0-6s', b: 'HOOK', c: '"Se você é médico especialista e sua agenda oscila entre semana cheia e semana morta, esse vídeo é pra você."' },
                { t: '6-18s', b: 'PROBLEMA', c: 'Insert de anúncio tarjado. "O problema não é falta de anúncio. Gargalo em 3 pontos que quase ninguém olha."' },
                { t: '18-42s', b: 'OS 3 GARGALOS', c: '01 criativo genérico. 02 perfil que não resolve em 60s. 03 secretária que responde em 4h ou usa script de salão. Os 3 fazem perder 70% dos leads.' },
                { t: '42-58s', b: 'MÉTODO P.U.L.S.O', c: '"Resolvo com 5 pilares. Em 90 dias o médico sai com agenda previsível."' },
                { t: '58-72s', b: 'CTA', c: '"Se fatura R$80k+/mês e tem 2+ anos de operação, comenta DIAGNÓSTICO. Eu mesmo chamo você no direct."' },
              ].map((b, i) => (
                <div key={i} className="flex gap-3 p-2 rounded border">
                  <Badge variant="outline" className="font-mono h-fit">{b.t}</Badge>
                  <div>
                    <p className="text-sm font-medium">{b.b}</p>
                    <p className="text-xs text-muted-foreground mt-1">{b.c}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EDITORIAL */}
        <TabsContent value="editorial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Missão editorial</CardTitle>
              <CardDescription>Tese única, voz do Ruan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-relaxed">
              <p>
                A SVI Doctor publica para um médico específico: especialista 35-50 anos que já provou a competência e agora precisa provar a previsibilidade do próprio consultório.
              </p>
              <p>
                Tese única: paciente particular não escolhe médico pela técnica, escolhe pelo que lê em 60 segundos de presença digital.
              </p>
              <p>
                Voz institucional é do Ruan. Aparece de rosto, fala em primeira pessoa, assume opinião. Não ensina marketing. Mostra como pensa quem opera por dentro.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mix de formatos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Formato</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Racional</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell>Reel</TableCell><TableCell>50%</TableCell><TableCell className="text-xs">Porta para alcance frio</TableCell></TableRow>
                    <TableRow><TableCell>Carrossel</TableCell><TableCell>25%</TableCell><TableCell className="text-xs">Autoridade + save</TableCell></TableRow>
                    <TableRow><TableCell>Estático</TableCell><TableCell>15%</TableCell><TableCell className="text-xs">Pilares do grid</TableCell></TableRow>
                    <TableRow><TableCell>Stories</TableCell><TableCell>8%</TableCell><TableCell className="text-xs">Alimenta base</TableCell></TableRow>
                    <TableRow><TableCell>Live</TableCell><TableCell>2%</TableCell><TableCell className="text-xs">Mensal com cliente</TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição P.U.L.S.O</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {(['P', 'U', 'L', 'S', 'O'] as Pillar[]).map(p => (
                    <div key={p} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={PILLAR_COLOR[p]}>{p}</Badge>
                        <span>{PILLAR_LABEL[p]}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {p === 'P' && '30%'}
                        {p === 'U' && '20%'}
                        {p === 'L' && '15%'}
                        {p === 'S' && '20%'}
                        {p === 'O' && '15%'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Biblioteca de hooks (42 ganchos)</CardTitle>
              <CardDescription>Padrão anti-guru, contra-intuitivo, observacional.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {(['P', 'U', 'L', 'S', 'O', 'Voz'] as Pillar[]).map(p => (
                  HOOKS[p].length > 0 && (
                    <AccordionItem key={p} value={p}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={PILLAR_COLOR[p]}>{p}</Badge>
                          <span>{PILLAR_LABEL[p]}</span>
                          <span className="text-xs text-muted-foreground">({HOOKS[p].length} hooks)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ol className="space-y-1 text-sm list-decimal list-inside">
                          {HOOKS[p].map((h, i) => (
                            <li key={i} className="text-muted-foreground">{h}</li>
                          ))}
                        </ol>
                      </AccordionContent>
                    </AccordionItem>
                  )
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regras rígidas de linguagem</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-red-600 mb-2">Proibido</div>
                <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                  <li>Em-dash (—) em frases</li>
                  <li>Bullet em legenda</li>
                  <li>Marketingues</li>
                  <li>Promessa vaga</li>
                  <li>Emoji decorativo</li>
                  <li>Hashtag excesso (máx 3-5)</li>
                  <li>Usar "a gente"</li>
                  <li>Ring light frontal / fundo clínico / estetoscópio como ícone</li>
                </ul>
              </div>
              <div>
                <div className="text-sm font-medium text-emerald-600 mb-2">Obrigatório</div>
                <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                  <li>Linha em branco entre pontos</li>
                  <li>H1 máx 8 palavras</li>
                  <li>Roteiro como fala natural</li>
                  <li>CTA com filtro específico</li>
                  <li>Números quebrados (47, 27)</li>
                  <li>Especificidade</li>
                  <li>Tom respeitoso</li>
                  <li>Narrativa "faço POR você" (não ensino)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ganchos anti-guru de referência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>"A faculdade te preparou pra atender. Ninguém te preparou pra aparecer."</span></p>
              <p className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>"Existe uma regra silenciosa: ganha quem aparece primeiro, não quem é o melhor."</span></p>
              <p className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>"Marketing médico que funciona parece chato."</span></p>
              <p className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>"Ontem à noite, alguém digitou seu nome no Google. E desistiu de ligar pra você."</span></p>
              <p className="flex gap-2"><Target className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>"Convênio não é plano de saúde. É plano de estagnação financeira pro médico."</span></p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDÁRIO */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendário 12 semanas (36 posts)</CardTitle>
              <CardDescription>
                3 posts por semana (Seg / Qua / Sex). Arco: autoridade e filtro (S1-4) → método e cases (S5-8) → conversão (S9-12).
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
                          {week <= 4 && 'Autoridade e filtro'}
                          {week >= 5 && week <= 8 && 'Método e cases'}
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
                              <TableHead>Headline</TableHead>
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
                                  <Badge variant={p.voice === 'Ruan' ? 'default' : 'secondary'}>
                                    {p.voice}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{p.headline}</TableCell>
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
              <CardTitle>Arquitetura de mídia paga</CardTitle>
              <CardDescription>
                Otimizada para diagnóstico qualificado, não CPL bruto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Topo</Badge>
                    <span className="text-sm font-medium">50% budget</span>
                  </div>
                  <p className="text-xs text-muted-foreground">ThruPlay + Engajamento. Reels Ruan, cinematográfico, carrosséis.</p>
                  <p className="text-xs">Meta: CPM R$25, taxa 75% 18%+</p>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Meio</Badge>
                    <span className="text-sm font-medium">30% budget</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Tráfego + VSL. Retargeting vídeo 50%+, LAL 3%.</p>
                  <p className="text-xs">Meta: CTR 1,8%+, tempo 90s+</p>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Fundo</Badge>
                    <span className="text-sm font-medium">20% budget</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Lead qualificado. Estático direto, Reel oferta 30s, Search RSA.</p>
                  <p className="text-xs">Meta: CPL &lt; R$180</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Oferta: Diagnóstico P.U.L.S.O</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="font-medium">Duração:</span> 45 minutos com Ruan.</p>
                <p><span className="font-medium">Investimento:</span> Gratuito (filtro no Typeform).</p>
                <p><span className="font-medium">Entrega:</span> Auditoria + plano de 90 dias escrito na call.</p>
                <p><span className="font-medium">Requisito:</span> Especialista R$ 80k+/mês, consultório 2+ anos.</p>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">
                  Filtra curioso. Posiciona valor. Plano de 90 dias é do médico, feche ou não feche com a SVI.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Plataformas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>% Budget</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell>Meta (IG + FB)</TableCell><TableCell>60%</TableCell></TableRow>
                    <TableRow><TableCell>Google (Search + YouTube)</TableCell><TableCell>30%</TableCell></TableRow>
                    <TableRow><TableCell>LinkedIn</TableCell><TableCell>10%</TableCell></TableRow>
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">TikTok fora. Médico 35-50 não consome profissional.</p>
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
                    <TableHead>MRR novo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Mínimo viável</TableCell>
                    <TableCell>R$ 3.000</TableCell>
                    <TableCell>12-18</TableCell>
                    <TableCell>3-5</TableCell>
                    <TableCell>R$ 9-15k</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Ideal</TableCell>
                    <TableCell>R$ 8.000</TableCell>
                    <TableCell>35-50</TableCell>
                    <TableCell>10-15</TableCell>
                    <TableCell>R$ 30-45k</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Premissas: CPL qualificado R$150-220. Show-up 65%. Taxa fechamento em diagnóstico 30-35%. LTV 12m = R$36k. Payback 2,5 meses.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">10 roteiros prontos para gravar</CardTitle>
              <CardDescription>Referência completa em SVI_DOCTOR_ADS_ESTRATEGIA.md</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {SCRIPTS.map(r => (
                  <div key={r.n} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                    <Badge variant="outline" className="font-mono">{r.n}</Badge>
                    <div className="flex-1">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.tipo}</div>
                    </div>
                    <Badge variant="secondary">{r.duration}</Badge>
                    <Badge variant="outline" className="text-[10px]">{r.etapa}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">KPIs e critérios de decisão</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Métrica</TableHead>
                    <TableHead>Alvo</TableHead>
                    <TableHead>Pausar</TableHead>
                    <TableHead>Escalar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>CPM topo</TableCell><TableCell>R$20-28</TableCell><TableCell>{'>'}R$40</TableCell><TableCell>{'<'}R$22</TableCell></TableRow>
                  <TableRow><TableCell>CTR único</TableCell><TableCell>{'>'}1,5%</TableCell><TableCell>{'<'}0,7% em 48h</TableCell><TableCell>{'>'}2,5%</TableCell></TableRow>
                  <TableRow><TableCell>CPL qualificado</TableCell><TableCell>R$150-220</TableCell><TableCell>{'>'}R$300</TableCell><TableCell>{'<'}R$130</TableCell></TableRow>
                  <TableRow><TableCell>Show-up diagnóstico</TableCell><TableCell>60%+</TableCell><TableCell>{'<'}45%</TableCell><TableCell>{'>'}75%</TableCell></TableRow>
                  <TableRow><TableCell>Frequência criativo</TableCell><TableCell>≤2,8</TableCell><TableCell>{'>'}3,5</TableCell><TableCell>—</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DESIGN */}
        <TabsContent value="design" className="space-y-4">
          <div className="rounded-lg border bg-amber-500/5 p-3 flex gap-2 text-sm text-amber-900 dark:text-amber-200">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Briefing modelado em <a href="https://www.instagram.com/doctorcreators/" target="_blank" rel="noreferrer" className="font-medium underline">@doctorcreators</a>. Referência visual aprovada pelo cliente. Documento completo em SVI_DOCTOR_BRIEFING_DESIGNER.md
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sistema de Design</CardTitle>
              <CardDescription>Paleta de cores com % de uso e função.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Cor</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Hex</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Uso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COLOR_TOKENS.map(c => (
                    <TableRow key={c.token}>
                      <TableCell>
                        <div className="w-8 h-8 rounded border" style={{ backgroundColor: c.hex }} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.token}</TableCell>
                      <TableCell className="font-mono text-xs">{c.hex}</TableCell>
                      <TableCell className="text-xs">{c.function}</TableCell>
                      <TableCell className="text-right font-medium">{c.usage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Regra: nenhuma capa carrega mais de 3 cores simultâneas. Preto + dourado + branco é default. Preto nunca é #000 puro.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipografia (Playfair Display + Inter Tight)</CardTitle>
              <CardDescription>Google Fonts. Padrão de destaque: dourado + italic + sublinhado 3px.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hierarquia</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Leading</TableHead>
                    <TableHead>Tracking</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TYPE_TOKENS.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-xs">{t.hierarchy}</TableCell>
                      <TableCell className="text-xs">{t.font}</TableCell>
                      <TableCell className="text-xs">{t.weight}</TableCell>
                      <TableCell className="text-xs">{t.size}</TableCell>
                      <TableCell className="text-xs">{t.leading}</TableCell>
                      <TableCell className="text-xs">{t.tracking}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assinatura de canto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Texto:</strong> SVI Doctor</p>
                <p><strong>Fonte:</strong> Playfair Display Italic</p>
                <p><strong>Tamanho:</strong> 22pt (capa 1080x1350), 28pt (reel)</p>
                <p><strong>Cor:</strong> #C9A227 | Tracking: +20</p>
                <p><strong>Posição:</strong> canto inferior direito. Margem 60px à direita, 80px ao rodapé.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Microcopy CTA (rotacionar)</CardTitle>
                <CardDescription>Inter Tight Medium UPPERCASE 16pt tracking +120</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {MICROCOPY_CTAS.map((m, i) => (
                    <div key={i} className="p-2 rounded border font-mono text-xs">
                      {m}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">6 Templates Mestres</CardTitle>
              <CardDescription>Estrutura por formato. Designer monta no Figma uma vez e reaproveita sempre.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {TEMPLATES.map(t => (
                  <AccordionItem key={t.code} value={t.code}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="font-mono">{t.code}</Badge>
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">{t.size}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm mb-3">{t.description}</p>
                      <div className="space-y-1">
                        {t.variations.map((v, i) => (
                          <div key={i} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-primary">•</span>
                            <span>{v}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Biblioteca de 20 capas prontas</CardTitle>
              <CardDescription>Cada capa já mapeada com headline, palavra-chave em dourado, template e tipo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-14">Sem</TableHead>
                    <TableHead>Headline</TableHead>
                    <TableHead className="w-32">Dourado</TableHead>
                    <TableHead className="w-16">Tpl</TableHead>
                    <TableHead className="w-36">Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COVER_LIBRARY.map(c => (
                    <TableRow key={c.n}>
                      <TableCell className="font-mono text-xs">{c.n}</TableCell>
                      <TableCell className="text-xs">S{c.week}</TableCell>
                      <TableCell className="text-xs">{c.headline}</TableCell>
                      <TableCell className="text-xs font-medium" style={{ color: '#C9A227' }}>{c.goldWord}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">{c.template}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Briefing de foto do Ruan</CardTitle>
              <CardDescription>5 setups. Fotógrafo com portfolio editorial executivo (GQ/Forbes/Vogue).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { s: 'Setup 1 — Estúdio cinza infinito (PILAR)', c: 'Fundo #4A4A4A. Softbox 120x90cm 45° esquerda. Camisa preta sem gola. Busto, expressão neutra séria. 20 fotos.' },
                { s: 'Setup 2 — Interior com abajur', c: 'Poltrona de couro + abajur tungstênio. Suéter tricô preto/marrom. Sentado, olhar de lado, xícara. 15 fotos.' },
                { s: 'Setup 3 — Rua urbana noturna', c: 'Rua com poste amarelo. Jaqueta couro preta + camisa branca. Caminhando, parado. 15 fotos.' },
                { s: 'Setup 4 — Bastidor real (viagens)', c: 'Carro, avião, hotel, reunião cliente. Luz disponível + LED. Flagrantes. 30 fotos ao longo de 2 meses.' },
                { s: 'Setup 5 — Retrato hero ultra-próximo', c: 'Fundo preto absoluto. Beauty dish 80cm frontal alto. Terno preto + camisa preta. Só rosto e ombros. 10 fotos.' },
              ].map((s, i) => (
                <div key={i} className="p-3 rounded border">
                  <div className="text-sm font-medium">{s.s}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.c}</div>
                </div>
              ))}
              <div className="p-3 rounded border-2 border-dashed border-red-500/30 bg-red-500/5">
                <div className="text-sm font-medium text-red-700 dark:text-red-400">Banido em qualquer setup</div>
                <div className="text-xs mt-1">Polegar pra cima, braços cruzados corporativo, mãos em V, qualquer pose de LinkedIn tradicional.</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Budget: R$ 4.500 a R$ 8.000 por sessão 4h com 30 imagens tratadas. Entrega: 90 fotos RAW+JPG com preset Lightroom SVI Doctor (teal/orange split, grain leve, contraste +35).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sprint 1 — Checklist do designer (14 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                {[
                  'Dias 1-2: setup Figma master + fontes + design system + estilos de texto',
                  'Dias 3-5: componentes base (assinatura, microcopy CTA, indicador slides, ícones)',
                  'Dias 6-8: templates A + B + C + D + E + F',
                  'Dias 9-11: 20 capas da biblioteca (priorizar as 9 primeiras) + 6 destaques',
                  'Dias 12-14: export PNG/PDF + mockup grid 3x3 + preset Lightroom + handoff',
                ].map((item, i) => (
                  <div key={i} className="flex gap-2 p-2 rounded border">
                    <Badge variant="outline" className="font-mono shrink-0">{i + 1}</Badge>
                    <span className="text-xs">{item}</span>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="rounded-lg border bg-emerald-500/5 p-3">
                <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-1">Budget Sprint 1</div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span>Designer sênior (Figma + social)</span><span className="font-mono">R$ 6.000 – 9.000</span></div>
                  <div className="flex justify-between"><span>Sessão foto Ruan (Setup 1, 2, 5)</span><span className="font-mono">R$ 5.000 – 7.500</span></div>
                  <div className="flex justify-between"><span>Créditos Midjourney/Flux (30 imagens)</span><span className="font-mono">R$ 300</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-semibold"><span>Total</span><span className="font-mono">R$ 11.300 – 16.800</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Elementos proibidos (reforço)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                {[
                  'Ring light frontal (tentação grande, não ceda)',
                  'Fundo clínico branco',
                  'Ícone de estetoscópio ou coração',
                  'Templates Canva genéricos',
                  'Emoji decorativo',
                  'Posar com dedo em V ou polegar pra cima',
                ].map((item, i) => (
                  <div key={i} className="flex gap-2 items-center p-2 rounded border border-red-500/20 bg-red-500/5 text-xs">
                    <Badge variant="destructive" className="text-[10px]">✕</Badge>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LANDING */}
        <TabsContent value="landing" className="space-y-4">
          <div className="rounded-lg border bg-blue-500/5 p-3 flex gap-2 text-sm text-blue-900 dark:text-blue-200">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Landing modelada em <a href="https://doctorcreator.com.br/" target="_blank" rel="noreferrer" className="font-medium underline">doctorcreator.com.br</a>. URL final: <code className="font-mono">svimedicos.com.br</code>. Documento completo em SVI_DOCTOR_LANDING_PAGE.md
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Arquitetura da landing</CardTitle>
              <CardDescription>
                Single-page longa com 12 seções. Stack: Next.js 14 + Sanity + Vercel. Compliance CFM 1974/2011.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  { label: 'Total de seções', value: '12' },
                  { label: 'Cenário', value: 'Single-page' },
                  { label: 'Stack', value: 'Next.js 14' },
                  { label: 'Prazo de dev', value: '2 semanas' },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg border p-3 text-center">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-lg font-semibold mt-1">{s.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">12 seções com copy final</CardTitle>
              <CardDescription>H1/subcopy prontos. Sem placeholder. Dev executa direto.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {LANDING_SECTIONS.map(s => (
                  <AccordionItem key={s.n} value={s.n}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="font-mono">{s.n}</Badge>
                        <span className="font-medium">{s.title}</span>
                        {s.cta && <Badge variant="secondary" className="text-[10px]">CTA</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">H1/Headline</div>
                          <div className="font-medium">{s.h1}</div>
                        </div>
                        {s.subcopy && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Subcopy</div>
                            <div className="text-xs">{s.subcopy}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Elementos</div>
                          <div className="text-xs">{s.elements}</div>
                        </div>
                        {s.cta && (
                          <div className="mt-2 p-2 rounded bg-primary/10 border border-primary/20">
                            <div className="text-xs text-primary font-medium">CTA: {s.cta}</div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Typeform de qualificação (13 perguntas)</CardTitle>
              <CardDescription>Scoring automático. Score ≥ 80 qualifica e abre Cal.com. 40-79 revisão manual. &lt;60 nurturing.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Pergunta</TableHead>
                    <TableHead className="w-48">Scoring / Regra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { q: 'Nome completo', r: 'short text, obrigatório' },
                    { q: 'Especialidade', r: 'Ortopedia/Gastro/Procto/Derma/Uro/Gineco = +20. Oftalmo/Cardio = +10' },
                    { q: 'Estado e cidade', r: 'short text' },
                    { q: 'Tempo de consultório', r: '<1 ano DESCARTA. 1-2 = +5. 2-5 = +15. +5 = +20' },
                    { q: 'Faturamento mensal', r: '<R$40k DESCARTA. 80-150k = +20. 150-300k = +25' },
                    { q: 'Já investiu em marketing?', r: 'Sim = +15. Não = +5' },
                    { q: 'Se sim, resultado?', r: 'long text condicional, sem scoring' },
                    { q: 'Principal gargalo hoje', r: '5 primeiras opções = +10' },
                    { q: 'Instagram profissional', r: 'short text = +5' },
                    { q: 'Disposição pra operar junto', r: 'Não = DESCARTA. Sim = +15' },
                    { q: 'Expectativa de início', r: '2 semanas = +15. Próximo mês = +10' },
                    { q: 'WhatsApp', r: 'phone, obrigatório' },
                    { q: 'Email', r: 'email, obrigatório' },
                  ].map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">Q{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{item.q}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.r}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stack técnica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><strong>Frontend:</strong> Next.js 14 (App Router)</p>
                <p><strong>CMS:</strong> Sanity.io</p>
                <p><strong>Hosting:</strong> Vercel Edge</p>
                <p><strong>Styling:</strong> Tailwind CSS</p>
                <p><strong>Form:</strong> Typeform Business</p>
                <p><strong>Orquestração:</strong> n8n</p>
                <p><strong>CRM:</strong> Pipedrive</p>
                <p><strong>WhatsApp:</strong> UazAPI</p>
                <p><strong>Agenda:</strong> Cal.com</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Core Web Vitals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span>LCP</span><span className="font-mono text-emerald-600">&lt; 2.0s</span></div>
                <div className="flex justify-between"><span>INP</span><span className="font-mono text-emerald-600">&lt; 150ms</span></div>
                <div className="flex justify-between"><span>CLS</span><span className="font-mono text-emerald-600">&lt; 0.05</span></div>
                <div className="flex justify-between"><span>Lighthouse Perf</span><span className="font-mono">≥ 92</span></div>
                <div className="flex justify-between"><span>Lighthouse SEO</span><span className="font-mono">≥ 95</span></div>
                <div className="flex justify-between"><span>Lighthouse A11y</span><span className="font-mono">≥ 95</span></div>
                <div className="flex justify-between"><span>TTFB</span><span className="font-mono">&lt; 400ms</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">10 eventos de tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-xs font-mono">
                  <div>view_hero</div>
                  <div>scroll_metodo</div>
                  <div>scroll_cases</div>
                  <div>click_cta_hero</div>
                  <div>click_cta_comofunciona</div>
                  <div>click_cta_final</div>
                  <div>typeform_start</div>
                  <div>typeform_submit</div>
                  <div className="text-emerald-600 font-semibold">qualified_lead</div>
                  <div className="text-emerald-600 font-semibold">booked_call</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">FAQ (8 perguntas com respostas prontas)</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {FAQ.map((item, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-sm font-medium">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roadmap de dev (2 semanas)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-medium mb-2">Semana 1</div>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>Setup Next + Sanity + Vercel + esqueleto</li>
                    <li>Hero + 3 primeiras seções</li>
                    <li>Typeform rascunho</li>
                    <li>Tracking GTM base</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-medium mb-2">Semana 2</div>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>Demais seções</li>
                    <li>Animações e transições</li>
                    <li>Integrações n8n + Pipedrive + UazAPI + Cal.com</li>
                    <li>Tracking completo + QA + deploy</li>
                  </ul>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">Entregáveis paralelos:</strong> 3 fotos do Ruan (enquadramentos diferentes) + ilustração editorial de agenda oscilando + ícone P.U.L.S.O em lettering + OG image 1200x630 + favicon.
              </div>
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
                    Progresso salvo localmente no navegador.
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

          <Accordion type="multiple" defaultValue={['setup-perfil']} className="w-full space-y-2">
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
