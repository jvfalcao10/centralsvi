import { useEffect, useRef } from 'react'
import {
  ArrowRight, Check, MessageCircle, Kanban, Sparkles,
  CheckCircle2, Users, LogOut, AlertCircle, Eye, FileText, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

/**
 * svi.ai · Sistema de Vendas Inteligente
 * Landing pública premium. Paleta dourado + preto + cream.
 * Copy validada por Brand Guardian + Ad Creative Strategist.
 */
export default function ProdutoLanding() {
  const mockupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (mockupRef.current) {
        const xVal = (e.clientX / window.innerWidth - 0.5) * 2
        const yVal = (e.clientY / window.innerHeight - 0.5) * 2
        mockupRef.current.style.transform = `perspective(1500px) rotateY(${xVal * 1.5}deg) rotateX(${-yVal * 1.5}deg)`
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="bg-[#0A0A0A] text-[#F5EFE0] min-h-screen overflow-x-hidden font-sans antialiased">
      <style>{`
        @keyframes appear { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes appear-zoom { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.75; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .animate-appear { animation: appear 0.8s ease-out forwards; }
        .animate-appear-zoom { animation: appear-zoom 1s ease-out forwards; }
        .animate-marquee { animation: marquee 32s linear infinite; }
        .animate-pulse-glow { animation: pulse-glow 5s ease-in-out infinite; }
        .gold-text {
          background: linear-gradient(135deg, #F5EFE0 0%, #D4AF37 45%, #A8851F 65%, #F5EFE0 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shimmer 8s linear infinite;
        }
        .cream-text {
          background: linear-gradient(180deg, #F5EFE0 0%, #F5EFE0 60%, rgba(245,239,224,0.55) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .delay-150 { animation-delay: 150ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-450 { animation-delay: 450ms; }
        .delay-600 { animation-delay: 600ms; }
        .delay-800 { animation-delay: 800ms; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(212,175,55,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.06) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 50%, transparent 100%);
        }
      `}</style>

      {/* Top nav */}
      <nav className="relative z-50 flex items-center justify-between max-w-7xl mx-auto px-6 py-5">
        <Link to="/produto" className="flex items-center gap-2.5">
          <img src="/svi-logo.png" alt="svi.ai" className="h-8 w-auto" />
          <span className="font-semibold tracking-tight text-[#F5EFE0]">svi.ai</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <a href="#features" className="hidden sm:inline text-sm text-[#F5EFE0]/70 hover:text-[#D4AF37] transition-colors px-3 py-2">
            Produto
          </a>
          <Link to="/precos" className="hidden sm:inline text-sm text-[#F5EFE0]/70 hover:text-[#D4AF37] transition-colors px-3 py-2">
            Preço
          </Link>
          <Link to="/login">
            <Button variant="ghost" className="text-[#F5EFE0]/80 hover:text-[#F5EFE0] hover:bg-[#D4AF37]/10">
              Entrar
            </Button>
          </Link>
          <Link to="/login">
            <Button className="bg-[#D4AF37] text-[#0A0A0A] hover:bg-[#A8851F] hover:text-[#F5EFE0] font-semibold shadow-lg shadow-[#D4AF37]/20">
              Quero ser fundador<ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-12 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 grid-bg" />
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[#D4AF37]/15 blur-[140px] animate-pulse-glow" />
          <div className="absolute left-1/2 top-40 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#A8851F]/12 blur-[120px] animate-pulse-glow" style={{ animationDelay: '2.5s' }} />
        </div>

        <div className="relative max-w-6xl mx-auto flex flex-col items-center text-center gap-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#D4AF37]/8 border border-[#D4AF37]/30 backdrop-blur-sm rounded-full pl-1.5 pr-4 py-1 text-sm animate-appear opacity-0">
            <span className="bg-gradient-to-r from-[#D4AF37] to-[#A8851F] text-[#0A0A0A] px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
              Fundador
            </span>
            <span className="text-[#F5EFE0]/85">10 vagas travadas em R$ 197/mês pra sempre</span>
          </div>

          {/* Headline */}
          <h1 className="animate-appear delay-150 opacity-0 gold-text text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-4xl">
            Vender deixa
            <br />de ser sorte.
          </h1>

          {/* Subheadline */}
          <p className="animate-appear delay-300 opacity-0 max-w-2xl text-lg sm:text-xl text-[#F5EFE0]/65 leading-relaxed">
            Inbox WhatsApp, CRM e inteligência de conteúdo num painel só, pronto pra rodar
            no seu WhatsApp em 24 horas.
          </p>

          {/* CTAs */}
          <div className="animate-appear delay-450 opacity-0 flex flex-wrap justify-center gap-3 pt-2">
            <Link to="/login">
              <Button size="lg" className="bg-[#D4AF37] text-[#0A0A0A] hover:bg-[#A8851F] hover:text-[#F5EFE0] font-semibold shadow-2xl shadow-[#D4AF37]/30">
                Travar minha vaga<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="outline" className="border-[#F5EFE0]/20 bg-[#F5EFE0]/5 text-[#F5EFE0] hover:bg-[#F5EFE0]/10 backdrop-blur-sm font-semibold">
                Ver como funciona
              </Button>
            </a>
          </div>

          <p className="text-xs text-[#F5EFE0]/45 -mt-2 animate-appear delay-450 opacity-0">
            14 dias grátis, sem cartão, sem setup, sem fidelidade.
          </p>

          {/* Social proof */}
          <div className="animate-appear delay-600 opacity-0 w-full max-w-4xl mt-12">
            <p className="text-[#F5EFE0]/40 text-xs uppercase tracking-[0.18em] mb-5 font-medium">
              PMEs reais operando dentro do svi.ai todos os dias
            </p>
            <div className="relative overflow-hidden h-10">
              <div className="flex animate-marquee whitespace-nowrap items-center gap-16 text-[#F5EFE0]/40 font-semibold text-lg">
                {Array.from({ length: 2 }).map((_, k) => (
                  <div key={k} className="flex items-center gap-16">
                    <span>EXATTA SOLAR</span><span className="text-[#D4AF37]/30">◆</span>
                    <span>SPA NATURE</span><span className="text-[#D4AF37]/30">◆</span>
                    <span>DRA. ÉSIA LOPES</span><span className="text-[#D4AF37]/30">◆</span>
                    <span>IPER</span><span className="text-[#D4AF37]/30">◆</span>
                    <span>NORTE CAPITAL</span><span className="text-[#D4AF37]/30">◆</span>
                    <span>MJC CABINETS</span><span className="text-[#D4AF37]/30">◆</span>
                    <span>MEDCAIXA</span><span className="text-[#D4AF37]/30">◆</span>
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0A0A0A] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0A0A0A] to-transparent" />
            </div>
          </div>

          {/* Mockup */}
          <div className="relative w-full pt-10">
            <div
              ref={mockupRef}
              className="animate-appear-zoom delay-800 opacity-0 mx-auto max-w-5xl rounded-xl overflow-hidden border border-[#D4AF37]/20 shadow-[0_0_140px_-20px_rgba(212,175,55,0.4)] transition-transform duration-300 ease-out"
            >
              <div className="grid md:grid-cols-2 bg-gradient-to-br from-[#1A1A1A] via-[#0A0A0A] to-black">
                {/* Inbox */}
                <div className="p-5 border-b md:border-b-0 md:border-r border-[#D4AF37]/10">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-lg bg-[#00875A]/10 border border-[#00875A]/30 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-[#00875A]" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Inbox WhatsApp</div>
                      <div className="text-[10px] text-[#F5EFE0]/40">12 conversas · 3 não lidas</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'Maria Silva', msg: 'Quanto fica a consulta?', time: 'agora', unread: true },
                      { name: 'João Pereira', msg: 'Tem horário amanhã?', time: '2 min', unread: true },
                      { name: 'Ana Costa', msg: 'Obrigada pelo atendimento!', time: '15 min' },
                      { name: 'Roberto', msg: 'Vou pensar e te respondo', time: '1h' },
                      { name: 'Cliente A', msg: 'Aceita Pix?', time: '3h' },
                    ].map((c, i) => (
                      <div key={i} className={`p-2.5 rounded-md border ${c.unread ? 'bg-[#D4AF37]/8 border-[#D4AF37]/30' : 'bg-[#F5EFE0]/3 border-[#F5EFE0]/5'}`}>
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <span className="text-xs font-medium">{c.name}</span>
                          <span className="text-[10px] text-[#F5EFE0]/35 shrink-0">{c.time}</span>
                        </div>
                        <p className="text-[11px] text-[#F5EFE0]/55 truncate">{c.msg}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kanban + Insight */}
                <div className="p-5 bg-black/40">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
                        <Kanban className="w-4 h-4 text-[#D4AF37]" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Pipeline</div>
                        <div className="text-[10px] text-[#F5EFE0]/40">8 leads · R$ 42k em aberto</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {['Novo', 'Contato', 'Proposta'].map((s, idx) => (
                      <div key={s} className="bg-[#F5EFE0]/3 rounded-md p-2 border border-[#F5EFE0]/5">
                        <div className="text-[10px] uppercase tracking-wider text-[#F5EFE0]/45 mb-2">{s}</div>
                        {Array.from({ length: 3 - idx }).map((_, i) => (
                          <div key={i} className="bg-black/40 rounded p-1.5 mb-1 border border-[#F5EFE0]/5">
                            <div className="text-[10px] font-medium truncate">Lead {String.fromCharCode(65 + i)}</div>
                            <div className="text-[9px] text-[#D4AF37] tabular-nums font-semibold">R$ {(3000 + i * 1500).toLocaleString('pt-BR')}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="bg-gradient-to-r from-[#D4AF37]/12 to-[#A8851F]/10 border border-[#D4AF37]/30 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-0.5">Insight IA</p>
                        <p className="text-[11px] text-[#F5EFE0]/75 leading-relaxed">CFM publicou nova resolução. 3 ideias de conteúdo prontas pra postar hoje.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dor x Virada */}
      <section id="como-funciona" className="relative py-24 px-6 border-t border-[#D4AF37]/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37] font-semibold mb-3">Antes e depois</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight cream-text">
              Sua operação hoje
              <br />vs. sua operação no svi.ai.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Dor */}
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#B8451F] font-semibold mb-1">Hoje sem painel</div>
              {[
                { icon: AlertCircle, title: 'WhatsApp espalhado', desc: 'Cada vendedor com um chip, cada lead num celular, nada conversa com nada e cliente bom some.' },
                { icon: Eye, title: '"E aquele cliente?"', desc: 'Você perde tempo perguntando status, cobrando follow-up e descobrindo proposta esquecida há duas semanas.' },
                { icon: FileText, title: 'Conteúdo refém de você', desc: 'Designer mandando arte no WhatsApp pessoal, aprovação travada, post atrasa e o feed fica mudo.' },
              ].map((card, i) => {
                const Icon = card.icon
                return (
                  <div key={i} className="bg-[#1A1A1A]/60 border border-[#B8451F]/20 rounded-xl p-5 hover:border-[#B8451F]/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#B8451F]/15 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#B8451F]" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 text-[#F5EFE0]">{card.title}</h3>
                        <p className="text-sm text-[#F5EFE0]/55 leading-relaxed">{card.desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Virada */}
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#D4AF37] font-semibold mb-1">Com o svi.ai</div>
              {[
                { icon: MessageCircle, title: 'Tudo num inbox só', desc: 'Todo WhatsApp da empresa entra num painel, qualquer pessoa do time responde e nada cai no esquecimento.' },
                { icon: Kanban, title: 'Kanban honesto', desc: 'Você abre o painel e vê quem tá quente, quem tá frio e o que travou, em dez segundos.' },
                { icon: Sparkles, title: 'Conteúdo no piloto', desc: 'Designer manda, você aprova com um clique, IA sugere pauta do seu nicho, feed nunca mais para.' },
              ].map((card, i) => {
                const Icon = card.icon
                return (
                  <div key={i} className="bg-gradient-to-br from-[#D4AF37]/8 to-transparent border border-[#D4AF37]/30 rounded-xl p-5 hover:border-[#D4AF37]/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#D4AF37]" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 text-[#F5EFE0]">{card.title}</h3>
                        <p className="text-sm text-[#F5EFE0]/65 leading-relaxed">{card.desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-24 px-6 border-t border-[#D4AF37]/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37] font-semibold mb-3">O que vai dentro</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight cream-text">
              Pronto pra rodar.
              <br />Sem implementação eterna.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: MessageCircle, verb: 'Centralize', title: 'Inbox WhatsApp', desc: 'Centraliza todas as conversas da empresa num painel único, com histórico, etiquetas e respostas rápidas.' },
              { icon: Kanban, verb: 'Organize', title: 'CRM Kanban', desc: 'Arraste o lead pela etapa real do funil e enxergue dinheiro parado em cada coluna.' },
              { icon: Sparkles, verb: 'Antecipe', title: 'IA de Nicho', desc: 'Receba insights diários sobre o seu setor, pauta de conteúdo e ideias prontas pra usar.' },
              { icon: CheckCircle2, verb: 'Aprove', title: 'Aprovação de Posts', desc: 'Designer envia, você aprova ou comenta em um clique e a fila do conteúdo nunca trava.' },
              { icon: Users, verb: 'Distribua', title: 'Time multi-usuário', desc: 'Adicione vendedores, secretária e sócio com permissão separada e visão clara de quem responde o quê.' },
              { icon: LogOut, verb: 'Saia', title: 'Sem lock-in', desc: 'Cancela quando quiser, exporta seus dados quando quiser, sem contrato anual e sem letra miúda.' },
            ].map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="bg-[#F5EFE0]/[0.025] border border-[#D4AF37]/12 rounded-xl p-6 hover:bg-[#F5EFE0]/[0.04] hover:border-[#D4AF37]/30 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center group-hover:bg-[#D4AF37]/15">
                      <Icon className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[#D4AF37]/60 font-semibold">{f.verb}</span>
                  </div>
                  <h3 className="font-semibold mb-2 text-[#F5EFE0]">{f.title}</h3>
                  <p className="text-sm text-[#F5EFE0]/60 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="relative py-24 px-6 border-t border-[#D4AF37]/10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-[#D4AF37]/10 blur-[140px]" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37] font-semibold mb-3">Preço de fundador</p>
          <h2 className="text-4xl md:text-5xl font-bold cream-text mb-4">
            R$ 197 por mês.
            <br />Travado pra sempre.
          </h2>
          <p className="text-[#F5EFE0]/65 text-lg max-w-xl mx-auto">
            Custa menos que meio dia de vendedor parado e devolve cliente que você já tava perdendo.
            Quando lotar as 10 vagas, sobe pra R$ 297 cheio.
          </p>

          <div className="mt-12 inline-flex flex-col bg-gradient-to-br from-[#D4AF37]/8 to-transparent border border-[#D4AF37]/30 rounded-2xl p-8 text-left max-w-sm shadow-[0_0_60px_-15px_rgba(212,175,55,0.4)] w-full">
            <div className="text-sm text-[#D4AF37] mb-1 font-semibold uppercase tracking-wider">Plano fundador</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-bold tabular-nums text-[#F5EFE0]">R$ 197</span>
              <span className="text-sm text-[#F5EFE0]/55">/ mês</span>
            </div>
            <p className="text-xs text-[#F5EFE0]/45 mb-6">10 vagas. Quem entra agora trava esse preço pra sempre.</p>
            <ul className="space-y-2.5 mb-8 text-sm">
              {[
                'Inbox WhatsApp ilimitado',
                'CRM Kanban + Lista',
                'IA de nicho diária',
                'Aprovação de posts',
                'Até 5 usuários do time',
                'Setup feito pela equipe',
                'Suporte humano no WhatsApp',
              ].map((feat, i) => (
                <li key={i} className="flex items-center gap-2 text-[#F5EFE0]/80">
                  <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>
            <Link to="/login">
              <Button size="lg" className="w-full bg-[#D4AF37] text-[#0A0A0A] hover:bg-[#A8851F] hover:text-[#F5EFE0] font-semibold">
                Travar minha vaga<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="text-[10px] text-[#F5EFE0]/45 text-center mt-3">14 dias grátis, sem cartão</p>
          </div>

          <div className="mt-8">
            <Link to="/precos" className="text-sm text-[#D4AF37] hover:text-[#A8851F] underline underline-offset-4 inline-flex items-center gap-1">
              Ver detalhes do plano e FAQ<ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#D4AF37]/10 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37] font-semibold mb-3">Perguntas</p>
            <h2 className="text-3xl md:text-4xl font-bold cream-text">
              O que dono pergunta antes de assinar.
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: 'Preciso instalar alguma coisa no meu celular ou no do vendedor?',
                a: 'Não. Tudo roda no navegador, no computador e no celular. Conecta seu WhatsApp uma vez e cada pessoa do time entra com o login dela.',
              },
              {
                q: 'Meu WhatsApp atual continua funcionando normal?',
                a: 'Continua. Seus clientes seguem te mandando mensagem pro mesmo número de sempre. A diferença é que agora tudo cai num painel organizado em vez de sumir no celular.',
              },
              {
                q: 'Tem fidelidade ou contrato anual?',
                a: 'Não tem. Você paga mensal, cancela quando quiser e leva seus dados na saída. Se não fizer diferença na sua operação em 30 dias, é só sair.',
              },
              {
                q: 'Funciona pra qualquer tipo de negócio?',
                a: 'Funciona pra qualquer PME que vende ou atende por WhatsApp. Hoje tem clínica, advogado, imobiliária, igreja, agro, energia solar, móveis planejados e estética rodando dentro.',
              },
              {
                q: 'E se eu não souber configurar sozinho?',
                a: 'Você não vai precisar. A equipe configura sua conta, conecta o WhatsApp, importa seus contatos e te mostra como usar numa call de 30 minutos. Tudo incluso, sem taxa extra.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-[#F5EFE0]/[0.025] border border-[#D4AF37]/10 rounded-xl p-6 hover:border-[#D4AF37]/25 transition-colors">
                <h3 className="font-semibold mb-2 text-[#F5EFE0]">{item.q}</h3>
                <p className="text-sm text-[#F5EFE0]/65 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative border-t border-[#D4AF37]/10 py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-[#D4AF37]/12 blur-[140px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <Zap className="w-8 h-8 text-[#D4AF37] mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-bold gold-text mb-4">
            Sua operação merece
            <br />sair do celular.
          </h2>
          <p className="text-[#F5EFE0]/65 mb-10 text-lg">
            Trave sua vaga de fundador por R$ 197 antes das 10 cadeiras acabarem.
          </p>
          <Link to="/login">
            <Button size="lg" className="bg-[#D4AF37] text-[#0A0A0A] hover:bg-[#A8851F] hover:text-[#F5EFE0] font-semibold shadow-2xl shadow-[#D4AF37]/30 text-base px-8 h-12">
              Quero ser fundador<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D4AF37]/10 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#F5EFE0]/45">
          <div className="flex items-center gap-2.5">
            <img src="/svi-logo.png" alt="svi.ai" className="h-6 w-auto opacity-80" />
            <span>© svi.ai · {new Date().getFullYear()} · por SVI Company</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/precos" className="hover:text-[#D4AF37] transition-colors">Preços</Link>
            <Link to="/login" className="hover:text-[#D4AF37] transition-colors">Entrar</Link>
            <span className="text-[#F5EFE0]/35">Software brasileiro, com IA brasileira</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
