import { useEffect, useRef } from 'react'
import { ArrowRight, Sparkles, MessageCircle, Kanban, Zap, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

/**
 * Landing page killer pro produto SaaS (estilo Linear/Vercel/Stripe).
 * Gerado via 21st.dev Magic + portado pra Tailwind v3 + shadcn.
 * Rota: /produto
 */
export default function ProdutoLanding() {
  const mockupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (mockupRef.current) {
        const xVal = (e.clientX / window.innerWidth - 0.5) * 2
        const yVal = (e.clientY / window.innerHeight - 0.5) * 2
        mockupRef.current.style.transform = `perspective(1500px) rotateY(${xVal * 2}deg) rotateX(${-yVal * 2}deg)`
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="bg-black text-white min-h-screen overflow-x-hidden">
      <style>{`
        @keyframes appear { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes appear-zoom { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }
        .animate-appear { animation: appear 0.8s ease-out forwards; }
        .animate-appear-zoom { animation: appear-zoom 1s ease-out forwards; }
        .animate-marquee { animation: marquee 30s linear infinite; }
        .animate-pulse-glow { animation: pulse-glow 4s ease-in-out infinite; }
        .gradient-text {
          background: linear-gradient(180deg, #fff 0%, #fff 60%, rgba(255,255,255,0.55) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .delay-150 { animation-delay: 150ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-450 { animation-delay: 450ms; }
        .delay-600 { animation-delay: 600ms; }
        .delay-800 { animation-delay: 800ms; }
      `}</style>

      {/* Top nav minimalista */}
      <nav className="relative z-50 flex items-center justify-between max-w-7xl mx-auto px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
            S
          </div>
          <span className="font-semibold tracking-tight">svi.ai</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/precos" className="text-sm text-gray-300 hover:text-white">
            Preços
          </Link>
          <Link to="/login">
            <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10">
              Entrar
            </Button>
          </Link>
          <Link to="/login">
            <Button className="bg-white text-black hover:bg-gray-200">
              Quero ser fundador<ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative pt-12 pb-20 px-6 overflow-hidden">
        {/* Glow background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-blue-500/20 blur-[120px] animate-pulse-glow" />
          <div className="absolute left-1/2 top-32 -translate-x-1/2 w-[500px] h-[400px] rounded-full bg-purple-500/15 blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative max-w-6xl mx-auto flex flex-col items-center text-center gap-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-sm rounded-full pl-1.5 pr-4 py-1 text-sm animate-appear opacity-0">
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider">
              Fundador
            </span>
            <span className="text-gray-300">Primeiros 10 clientes pagam R$ 197/mês pra sempre</span>
          </div>

          {/* Headline */}
          <h1 className="animate-appear delay-150 opacity-0 gradient-text text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-4xl">
            Sistema de Vendas
            <br />Inteligente.
          </h1>

          {/* Subheadline */}
          <p className="animate-appear delay-300 opacity-0 max-w-2xl text-lg sm:text-xl text-gray-400 leading-relaxed">
            Inbox WhatsApp, CRM Kanban e IA de mercado no mesmo painel.
            Substitui Kommo, Trello e ChatGPT por uma assinatura só, no idioma do Brasil.
          </p>

          {/* CTAs */}
          <div className="animate-appear delay-450 opacity-0 flex flex-wrap justify-center gap-3 pt-2">
            <Link to="/login">
              <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold shadow-2xl shadow-white/10">
                Quero ser fundador<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/precos">
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm font-semibold">
                Ver preço e comparativo
              </Button>
            </Link>
          </div>

          {/* Social proof bar */}
          <div className="animate-appear delay-600 opacity-0 w-full max-w-4xl mt-12">
            <p className="text-gray-500 text-xs uppercase tracking-[0.18em] mb-5 font-medium">
              Já em uso por agências e clínicas no Brasil
            </p>
            <div className="relative overflow-hidden h-10">
              <div className="flex animate-marquee whitespace-nowrap items-center gap-16 text-gray-500 font-semibold text-lg opacity-60">
                {Array.from({ length: 2 }).map((_, k) => (
                  <div key={k} className="flex items-center gap-16">
                    <span>SVI · DOCTOR</span><span>•</span>
                    <span>IPER</span><span>•</span>
                    <span>NORTE CAPITAL</span><span>•</span>
                    <span>EXATTA SOLAR</span><span>•</span>
                    <span>MJC CABINETS</span><span>•</span>
                    <span>DRA. ÉSIA LOPES</span><span>•</span>
                    <span>MEDCAIXA</span><span>•</span>
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent" />
            </div>
          </div>

          {/* Mockup */}
          <div className="relative w-full pt-10">
            <div
              ref={mockupRef}
              className="animate-appear-zoom delay-800 opacity-0 mx-auto max-w-5xl rounded-xl overflow-hidden border border-white/10 shadow-[0_0_120px_-20px_rgba(59,130,246,0.45)] transition-transform duration-300 ease-out"
            >
              <div className="grid md:grid-cols-2 bg-gradient-to-br from-gray-900 via-gray-950 to-black">
                {/* Inbox lado esquerdo */}
                <div className="p-5 border-b md:border-b-0 md:border-r border-white/5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Inbox WhatsApp</div>
                      <div className="text-[10px] text-gray-500">12 conversas · 3 não lidas</div>
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
                      <div key={i} className={`p-2.5 rounded-md border ${c.unread ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white/5 border-white/5'}`}>
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <span className="text-xs font-medium">{c.name}</span>
                          <span className="text-[10px] text-gray-500 shrink-0">{c.time}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">{c.msg}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kanban + Insights lado direito */}
                <div className="p-5 bg-black/40">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Kanban className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Pipeline</div>
                        <div className="text-[10px] text-gray-500">8 leads · R$ 42k</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {['Novo', 'Contato', 'Proposta'].map((s, idx) => (
                      <div key={s} className="bg-white/5 rounded-md p-2 border border-white/5">
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{s}</div>
                        {Array.from({ length: 3 - idx }).map((_, i) => (
                          <div key={i} className="bg-black/40 rounded p-1.5 mb-1 border border-white/5">
                            <div className="text-[10px] font-medium truncate">Lead {String.fromCharCode(65 + i)}</div>
                            <div className="text-[9px] text-emerald-400 tabular-nums">R$ {(3000 + i * 1500).toLocaleString('pt-BR')}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/20 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-blue-300 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-0.5">Insight IA</p>
                        <p className="text-[11px] text-gray-300 leading-relaxed">CFM publicou nova resolução. 3 ideias de conteúdo prontas pra postar hoje.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-400 font-semibold mb-3">Recursos</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight gradient-text">
              Tudo que você precisa.
              <br />Nada que você não usa.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: MessageCircle, color: 'emerald', title: 'Inbox WhatsApp', desc: 'Recebe e responde direto do painel. Sem perder lead no meio de 50 conversas.' },
              { icon: Kanban, color: 'blue', title: 'CRM Kanban', desc: 'Arrasta lead entre etapas. Conta valor por coluna. Pipeline visual e simples.' },
              { icon: Sparkles, color: 'purple', title: 'IA de Nicho', desc: 'Notícias, ideias de conteúdo e oportunidades do seu setor entregues todo dia 6h.' },
              { icon: Zap, color: 'amber', title: 'Aprovação 1-clique', desc: 'Cliente aprova post em segundos. Fim do WhatsApp pra aprovar criativo.' },
              { icon: Check, color: 'green', title: 'Multi-tenant', desc: 'Você atende N clientes com 1 deploy. Cada cliente vê só os dados dele.' },
              { icon: ArrowRight, color: 'red', title: 'Sem lock-in', desc: 'Export CSV nativo. Webhook aberto. Levou tudo, levou os dados.' },
            ].map((f, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-6 hover:bg-white/[0.04] hover:border-white/10 transition-colors">
                <div className={`w-10 h-10 rounded-lg bg-${f.color}-500/10 border border-${f.color}-500/20 flex items-center justify-center mb-4`}>
                  <f.icon className={`w-4 h-4 text-${f.color}-400`} />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing comparativo */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-blue-400 font-semibold mb-3">Preço</p>
          <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-4">
            Por R$ 197/mês.
            <br />Kommo cobra R$ 1.250.
          </h2>
          <p className="text-gray-400 text-lg">
            Mesmo Inbox WhatsApp. Mesmo CRM. Bônus: IA de nicho entregando insights todo dia.
          </p>

          <div className="mt-12 inline-flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-left max-w-sm shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
            <div className="text-sm text-blue-300 mb-1 font-semibold">Plano Fundador</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-bold tabular-nums">R$ 197</span>
              <span className="text-sm text-gray-400">/ mês</span>
            </div>
            <p className="text-xs text-gray-500 mb-6">trava esse preço pra sempre. Sobe pra R$ 297 a partir do 11º cliente.</p>
            <ul className="space-y-2.5 mb-8 text-sm">
              {[
                'Inbox WhatsApp ilimitado',
                'CRM Kanban + Lista',
                'IA de nicho diária',
                'Aprovação de posts',
                'Até 5 usuários do time',
                'Webhook aberto',
                'Export CSV',
              ].map((feat, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>
            <Link to="/login">
              <Button size="lg" className="w-full bg-white text-black hover:bg-gray-100 font-semibold">
                Quero garantir minha vaga
              </Button>
            </Link>
            <p className="text-[10px] text-gray-500 text-center mt-3">14 dias grátis, sem cartão</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px]">S</div>
            <span>© svi.ai · {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/precos" className="hover:text-white">Preços</Link>
            <Link to="/login" className="hover:text-white">Entrar</Link>
            <span>Software brasileiro, com IA brasileira</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
