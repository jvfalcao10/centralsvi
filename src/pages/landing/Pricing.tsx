import { ArrowRight, Check, Sparkles, MessageCircle, Kanban, Users, Shield, Zap, Headphones } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

const INCLUDED = [
  'Inbox WhatsApp ilimitado',
  'CRM Kanban com arrastar e soltar',
  'IA de nicho diária com notícias e ideias',
  'Aprovação de posts em 1 clique',
  'Até 5 usuários no time',
  'Notificações em tempo real',
  'Integração via webhook aberto',
  'Export CSV de leads e conversas',
  'Suporte humano no WhatsApp',
]

const FAQ = [
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
  {
    q: 'O que entra nesse preço além do que está na lista?',
    a: 'Atualizações de produto, suporte humano via WhatsApp, hospedagem, banco de dados, segurança e toda a infraestrutura de IA. Sem taxa de setup e sem cobrança por uso.',
  },
  {
    q: 'O que acontece quando lotarem os 10 fundadores?',
    a: 'Os 10 fundadores travam R$ 197 enquanto durar a assinatura. Quem entra a partir do 11º paga R$ 297. Mesmo produto, sem desconto de coorte.',
  },
]

const VALUE_BLOCKS = [
  { icon: MessageCircle, title: 'WhatsApp ligado', desc: 'Toda mensagem entra no painel, sem perder lead no celular do vendedor.' },
  { icon: Kanban, title: 'Pipeline visual', desc: 'Arrasta o lead pelo funil. Time inteiro vê o mesmo, sem planilha.' },
  { icon: Sparkles, title: 'IA do seu nicho', desc: 'Insights diários sobre seu setor. Você aparece pronto pra conversa.' },
  { icon: Users, title: 'Time multi-usuário', desc: 'Vendedor, secretária e sócio com permissões separadas.' },
  { icon: Shield, title: 'Sem letra miúda', desc: 'Cancela quando quiser, exporta os dados, leva tudo embora.' },
  { icon: Headphones, title: 'Setup feito pela equipe', desc: 'Configuramos a conta, conectamos o WhatsApp e treinamos seu time.' },
]

export default function Pricing() {
  return (
    <div className="bg-[#0A0A0A] text-[#F5EFE0] min-h-screen overflow-x-hidden font-sans antialiased">
      <style>{`
        @keyframes appear { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .animate-appear { animation: appear 0.8s ease-out forwards; }
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
      `}</style>

      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between max-w-7xl mx-auto px-6 py-5">
        <Link to="/produto" className="flex items-center gap-2.5">
          <img src="/svi-logo.png" alt="svi.ai" className="h-8 w-auto" />
          <span className="font-semibold tracking-tight text-[#F5EFE0]">svi.ai</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link to="/produto" className="hidden sm:inline text-sm text-[#F5EFE0]/70 hover:text-[#D4AF37] transition-colors px-3 py-2">
            Produto
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
      <section className="relative pt-12 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[450px] rounded-full bg-[#D4AF37]/15 blur-[140px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#D4AF37]/8 border border-[#D4AF37]/30 rounded-full px-3 py-1 text-xs font-semibold text-[#D4AF37] mb-6 animate-appear opacity-0">
            <Sparkles className="w-3 h-3" />
            Acesso fundador · 10 vagas disponíveis
          </div>
          <h1 className="gold-text text-5xl md:text-6xl font-bold tracking-tight mb-5 animate-appear opacity-0">
            Um plano. Um preço.
            <br />Travado pra sempre.
          </h1>
          <p className="text-[#F5EFE0]/65 text-lg max-w-2xl mx-auto animate-appear opacity-0">
            R$ 197/mês pros 10 primeiros pagantes. Quem entra agora trava esse valor enquanto durar a assinatura.
            A partir do 11º, sobe pra R$ 297 cheio.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="relative px-6 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Card Fundador */}
          <div className="relative bg-gradient-to-br from-[#D4AF37]/8 to-transparent border border-[#D4AF37]/40 rounded-2xl p-8 shadow-[0_0_80px_-20px_rgba(212,175,55,0.5)]">
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-[#D4AF37] to-[#A8851F] text-[#0A0A0A] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Fundador
            </div>
            <div className="mb-2 text-sm text-[#D4AF37] uppercase tracking-wider font-semibold">Primeiros 10 clientes</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-6xl font-bold tabular-nums text-[#F5EFE0]">R$ 197</span>
              <span className="text-sm text-[#F5EFE0]/55">/ mês</span>
            </div>
            <p className="text-xs text-[#D4AF37] mb-6 font-medium">trava esse preço enquanto durar a assinatura</p>
            <ul className="space-y-2.5 mb-8 text-sm">
              {INCLUDED.map((feat, i) => (
                <li key={i} className="flex items-start gap-2 text-[#F5EFE0]/80">
                  <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                  <span>{feat}</span>
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

          {/* Card Padrão */}
          <div className="bg-[#F5EFE0]/[0.025] border border-[#F5EFE0]/10 rounded-2xl p-8 opacity-85">
            <div className="mb-2 text-sm text-[#F5EFE0]/55 uppercase tracking-wider font-semibold">A partir do 11º</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-6xl font-bold tabular-nums text-[#F5EFE0]/70">R$ 297</span>
              <span className="text-sm text-[#F5EFE0]/55">/ mês</span>
            </div>
            <p className="text-xs text-[#F5EFE0]/45 mb-6">preço cheio, sem coorte fundador</p>
            <ul className="space-y-2.5 mb-8 text-sm">
              {INCLUDED.map((feat, i) => (
                <li key={i} className="flex items-start gap-2 text-[#F5EFE0]/75">
                  <Check className="w-4 h-4 text-[#F5EFE0]/40 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
            <Button size="lg" disabled variant="outline" className="w-full border-[#F5EFE0]/10 text-[#F5EFE0]/40 cursor-not-allowed">
              Disponível quando lotar fundador
            </Button>
            <p className="text-[10px] text-[#F5EFE0]/40 text-center mt-3">mesmo produto, sem desconto de coorte</p>
          </div>
        </div>
      </section>

      {/* Por que vale */}
      <section className="border-t border-[#D4AF37]/10 py-20 px-6 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-[#D4AF37]/8 blur-[140px]" />
        </div>
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37] font-semibold mb-3">O que você ganha</p>
            <h2 className="text-4xl md:text-5xl font-bold cream-text mb-3">
              Tudo dentro do preço.
              <br />Sem taxa, sem add-on.
            </h2>
            <p className="text-[#F5EFE0]/60 max-w-2xl mx-auto">
              Software, infraestrutura e equipe humana incluídos. Você assina, conecta e tá rodando.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {VALUE_BLOCKS.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="bg-[#F5EFE0]/[0.025] border border-[#D4AF37]/12 rounded-xl p-5 hover:border-[#D4AF37]/30 transition-colors">
                  <Icon className="w-5 h-5 text-[#D4AF37] mb-3" />
                  <h3 className="font-semibold mb-1.5 text-sm text-[#F5EFE0]">{f.title}</h3>
                  <p className="text-xs text-[#F5EFE0]/60 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#D4AF37]/10 py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.18em] text-[#D4AF37] font-semibold mb-3">Perguntas</p>
            <h2 className="text-3xl md:text-4xl font-bold cream-text">
              O que dono pergunta antes de assinar.
            </h2>
          </div>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <div key={i} className="bg-[#F5EFE0]/[0.025] border border-[#D4AF37]/10 rounded-xl p-6 hover:border-[#D4AF37]/25 transition-colors">
                <h3 className="font-semibold mb-2 text-[#F5EFE0]">{item.q}</h3>
                <p className="text-sm text-[#F5EFE0]/65 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative border-t border-[#D4AF37]/10 py-24 px-6 overflow-hidden text-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-[#D4AF37]/12 blur-[140px]" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <Zap className="w-8 h-8 text-[#D4AF37] mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-bold gold-text mb-4">
            Sobram poucas vagas
            <br />de fundador.
          </h2>
          <p className="text-[#F5EFE0]/65 mb-10 text-lg">
            R$ 197/mês travado enquanto durar a assinatura. Depois sobe pra R$ 297.
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
            <Link to="/produto" className="hover:text-[#D4AF37] transition-colors">Produto</Link>
            <Link to="/login" className="hover:text-[#D4AF37] transition-colors">Entrar</Link>
            <span className="text-[#F5EFE0]/35">Software brasileiro, com IA brasileira</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
