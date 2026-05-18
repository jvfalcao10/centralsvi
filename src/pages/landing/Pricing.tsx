import { ArrowRight, Check, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

const INCLUDED = [
  'Inbox WhatsApp ilimitado (via UazAPI)',
  'CRM Kanban com arrastar e soltar',
  'IA de nicho diária via Perplexity sonar-reasoning-pro',
  'Aprovação de posts em 1 clique',
  'Até 5 usuários do time',
  'Notificações em tempo real',
  'Webhook aberto pra integrar com n8n',
  'Export CSV de leads e conversas',
  'Suporte humano no WhatsApp',
]

const COMPARISON: { feature: string; svi: string | boolean; kommo: string | boolean }[] = [
  { feature: 'Preço mensal (5 usuários)', svi: 'R$ 197 fundador / R$ 297 cheio', kommo: 'R$ 1.250 (US$ 250)' },
  { feature: 'Inbox WhatsApp nativo', svi: true, kommo: true },
  { feature: 'CRM Kanban com drag-and-drop', svi: true, kommo: true },
  { feature: 'IA gerando insights do seu nicho', svi: true, kommo: false },
  { feature: 'Aprovação de posts pelo cliente', svi: true, kommo: false },
  { feature: 'Suporte em português nativo', svi: true, kommo: 'Parcial, robotizado' },
  { feature: 'Onboarding com humano', svi: true, kommo: false },
  { feature: 'Webhook aberto pra n8n/Make', svi: true, kommo: 'Só plano Enterprise' },
  { feature: 'White-label da sua agência', svi: 'Em breve', kommo: 'Só plano Enterprise' },
  { feature: 'Setup em até 24h', svi: true, kommo: false },
]

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-400 mx-auto" />
  if (value === false) return <X className="w-4 h-4 text-red-400/60 mx-auto" />
  return <span className="text-xs text-gray-300">{value}</span>
}

export default function Pricing() {
  return (
    <div className="bg-black text-white min-h-screen overflow-x-hidden">
      <style>{`
        @keyframes appear { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-appear { animation: appear 0.8s ease-out forwards; }
        .gradient-text {
          background: linear-gradient(180deg, #fff 0%, #fff 60%, rgba(255,255,255,0.55) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
      `}</style>

      <nav className="relative z-50 flex items-center justify-between max-w-7xl mx-auto px-6 py-5">
        <Link to="/produto" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
            S
          </div>
          <span className="font-semibold tracking-tight">svi.ai</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/produto" className="text-sm text-gray-300 hover:text-white">
            Produto
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

      <section className="relative pt-12 pb-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-blue-500/20 blur-[120px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-full px-3 py-1 text-xs font-semibold text-blue-300 mb-6 animate-appear opacity-0">
            <Sparkles className="w-3 h-3" />
            Vagas fundador: 10 disponíveis
          </div>
          <h1 className="gradient-text text-5xl md:text-6xl font-bold tracking-tight mb-5 animate-appear opacity-0">
            Um plano. Um preço.
            <br />Sem pegadinha.
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto animate-appear opacity-0">
            R$ 197/mês pros 10 primeiros clientes pagantes. Trava esse valor pra sempre.
            Quando lotar, sobe pra R$ 297. Cancela quando quiser, leva os dados quando sair.
          </p>
        </div>
      </section>

      {/* Card principal */}
      <section className="relative px-6 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Card Fundador */}
          <div className="relative bg-white/[0.04] border border-blue-500/40 rounded-2xl p-8 shadow-[0_0_80px_-20px_rgba(59,130,246,0.5)]">
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Fundador
            </div>
            <div className="mb-2 text-sm text-gray-400">Primeiros 10 clientes</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-6xl font-bold tabular-nums">R$ 197</span>
              <span className="text-sm text-gray-400">/ mês</span>
            </div>
            <p className="text-xs text-blue-300 mb-6 font-medium">trava esse preço pra sempre</p>
            <ul className="space-y-2.5 mb-8 text-sm">
              {INCLUDED.map((feat, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
            <Link to="/login">
              <Button size="lg" className="w-full bg-white text-black hover:bg-gray-100 font-semibold">
                Garantir minha vaga<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="text-[10px] text-gray-500 text-center mt-3">14 dias grátis, sem cartão</p>
          </div>

          {/* Card Padrão (futuro) */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 opacity-80">
            <div className="mb-2 text-sm text-gray-400">A partir do 11º cliente</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-6xl font-bold tabular-nums text-gray-300">R$ 297</span>
              <span className="text-sm text-gray-400">/ mês</span>
            </div>
            <p className="text-xs text-gray-500 mb-6">preço cheio, sem trava de fundador</p>
            <ul className="space-y-2.5 mb-8 text-sm">
              {INCLUDED.map((feat, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300">
                  <Check className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
            <Button size="lg" disabled variant="outline" className="w-full border-white/10 text-gray-500 cursor-not-allowed">
              Disponível quando lotar fundador
            </Button>
            <p className="text-[10px] text-gray-500 text-center mt-3">mesmo produto, sem desconto de coorte</p>
          </div>
        </div>
      </section>

      {/* Comparativo Kommo */}
      <section className="border-t border-white/5 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-400 font-semibold mb-3">Comparativo direto</p>
            <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-3">
              svi.ai vs Kommo
            </h2>
            <p className="text-gray-400">Mesma promessa, 5x mais barato, com IA dia 1.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] border-b border-white/10">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-300">Recurso</th>
                  <th className="p-4 font-semibold text-center">
                    <span className="text-blue-300">svi.ai</span>
                  </th>
                  <th className="p-4 font-semibold text-center text-gray-500">Kommo</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 text-gray-300">{row.feature}</td>
                    <td className="p-4 text-center"><Cell value={row.svi} /></td>
                    <td className="p-4 text-center"><Cell value={row.kommo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-600 text-center mt-4">
            Preços Kommo baseados no plano Avançado (US$ 250/mês para 5 usuários), conversão US$ 1 = R$ 5.
            Comparativo atualizado em maio/2026.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/5 py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold gradient-text mb-10 text-center">Perguntas que sempre vêm</h2>
          <div className="space-y-6">
            {[
              {
                q: 'Posso cancelar quando quiser?',
                a: 'Pode. Sem multa, sem fidelidade. Cancela no painel, exporta os dados em CSV e vai embora.',
              },
              {
                q: 'O que entra nesse preço além do que está na lista?',
                a: 'Atualizações de produto, suporte humano via WhatsApp, hospedagem, banco de dados e o uso da IA Perplexity. Você só paga UazAPI separado (R$ 138/mês) se quiser usar Inbox WhatsApp.',
              },
              {
                q: 'Por que vocês cobram metade do Kommo?',
                a: 'Operamos enxuto, no Brasil, sem comissão de revenda internacional e sem chefes em San Francisco. Sobra margem pra repassar pra você.',
              },
              {
                q: 'O que acontece quando lotarem os 10 fundadores?',
                a: 'Os 10 fundadores travam R$ 197 pra sempre. Quem entra a partir do 11º paga R$ 297. Mesmo produto, sem desconto de coorte.',
              },
              {
                q: 'Funciona pra qualquer tipo de negócio?',
                a: 'Funciona pra qualquer PME que atende cliente via WhatsApp. Já temos clínicas, agência, imobiliária, igreja, solar, móveis planejados, financeira e estética rodando.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-white/5 py-20 px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-4">
          Sobram poucas vagas fundador.
        </h2>
        <p className="text-gray-400 mb-8">Trava R$ 197/mês pra sempre. Depois sobe pra R$ 297.</p>
        <Link to="/login">
          <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold">
            Quero garantir minha vaga<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px]">S</div>
            <span>© svi.ai · {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/produto" className="hover:text-white">Produto</Link>
            <Link to="/login" className="hover:text-white">Entrar</Link>
            <span>Software brasileiro, com IA brasileira</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
