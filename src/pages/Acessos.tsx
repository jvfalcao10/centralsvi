import { useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'

// [nome, url (sem https:// — ou "/" pra rota interna)]
type Item = [string, string]
type Group = { title: string; items: Item[] }

const GROUPS: Group[] = [
  { title: 'Onboarding & Kickoff', items: [
    ['Guia — Como funciona o onboarding', '/guia-onboarding.html'],
    ['Onboarding — gerar contrato', 'svicompany.com.br/onboarding'],
    ['Kickoff — Marketing', 'svicompany.com.br/kickoff'],
    ['Kickoff — CRM', 'svicompany.com.br/kickoff-crm'],
    ['Admin Kickoff (ler respostas)', 'svicompany.com.br/admin-kickoff'],
  ]},
  { title: 'Ferramentas', items: [
    ['n8n (automações)', 'n8n.svicompany.com.br'],
    ['Supabase', 'supabase.com/dashboard/projects'],
    ['Stripe', 'dashboard.stripe.com'],
    ['ClickUp', 'app.clickup.com'],
    ['GitHub', 'github.com/jvfalcao10'],
    ['Vercel', 'vercel.com/svicompanyy-2539s-projects'],
  ]},
  { title: 'Centrais & Dashboards', items: [
    ['SVI Dashboards', 'svi-dashboards.vercel.app'],
    ['Diretoria SVI (command center)', 'diretoria-svi.vercel.app'],
    ['Alpha — Dashboard', 'alpha.svicompany.com.br'],
    ['Pro Life — Dashboard', 'prolife.svicompany.com.br'],
    ['Exatta — Dashboard', 'exatta-dashboard.vercel.app'],
  ]},
  { title: 'Clube de Cashback', items: [
    ['Clube — Oferta (venda)', 'clube.svicompany.com.br/oferta'],
    ['Clube — Diagnóstico (isca)', 'clube.svicompany.com.br/diagnostico'],
    ['Clube — Começar (assinar)', 'clube.svicompany.com.br/comecar'],
    ['Clube — Assinar ANUAL à vista', 'clube.svicompany.com.br/comecar?plano=anual'],
    ['Clube — Pagamento Soraia (link fixo)', 'buy.stripe.com/dRmcMX0TkfZI78saUa3oA00'],
    ['Clube — Central (MRR/lojas)', 'clube.svicompany.com.br/superadmin'],
    ['Clube — App / balcão', 'clube.svicompany.com.br/app'],
    ['Clube — Motor n8n', 'n8n.svicompany.com.br/workflow/wRFulrJKT21U7jhC'],
    ['Clube — Prospecção cold n8n', 'n8n.svicompany.com.br/workflow/oL9zIohWP8bXo4NO'],
  ]},
  { title: 'Concierge (bio que vende)', items: [
    ['Concierge — Oferta (venda)', 'concierge.svicompany.com.br'],
    ['Concierge — Planos', 'concierge.svicompany.com.br/planos'],
    ['Concierge — Bio da SVI (demo)', 'concierge.svicompany.com.br/svi'],
    ['Concierge — Painel (editor cliente)', 'concierge.svicompany.com.br/painel'],
    ['Concierge — Bio Comando Drones', 'concierge.svicompany.com.br/comando-drones'],
  ]},
  { title: 'Produtos SVI (SaaS)', items: [
    ['Clube de Cashback', 'clube.svicompany.com.br'],
    ['MedCaixa', 'medcaixa.vercel.app'],
    ['AURA — Spa Nature', 'aurasvicompany.vercel.app'],
    ['SVI MedCRM', 'svi-medcrm.vercel.app'],
    ['Kickoff CRM AI', 'kickoffcrmai-svicompanyy-2539s-projects.vercel.app'],
    ['SVI OS', 'svi-os.vercel.app'],
  ]},
  { title: 'Raio-X / Diagnóstico', items: [
    ['Raio-X SVI', 'raiox-svi.vercel.app'],
    ['Raio-X (app)', 'raiox-svi-app.vercel.app'],
    ['SVI Diagnóstico', 'svi-diagnostico.vercel.app'],
    ['Helmer Kids (diagnóstico)', 'helmerkids.vercel.app'],
  ]},
  { title: 'Autoridade & Institucional', items: [
    ['SVI Company (site)', 'svicompany.com.br'],
    ['SVI Autoridade (Topo)', 'topo.svicompany.com.br'],
    ['SVI Authority (EN)', 'svi-authority-en.vercel.app'],
    ['SVI Doctor', 'svidoctor.vercel.app'],
  ]},
  { title: 'Estratégia & Backs (por cliente)', items: [
    ['Back Estratégia', 'back.svicompany.com.br'],
    ['Dra Erika — Estratégia', 'draerika.svicompany.com.br'],
    ['Prouro — Estratégia', 'prouro.svicompany.com.br'],
    ['Spa Nature — Roteiros', 'spanature.svicompany.com.br'],
    ['Conteúdos — Back', 'conteudos-back.vercel.app'],
    ['Conteúdos — Lorena', 'conteudos-lorena.vercel.app'],
    ['Plano MJC', 'svi-plano-mjc.vercel.app'],
  ]},
  { title: 'Sites de clientes', items: [
    ['Dr Daniel Peralba', 'drdanielperalba.site'],
    ['Dr Felipe Branco', 'drfelipebranco.site'],
    ['Dr Brenno Cangussú', 'drbrennocangussu.vercel.app'],
    ['Dra Luana Caroline', 'draluanacaroline.vercel.app'],
    ['Dra Erika Figueiredo', 'draerikafigueiredo.vercel.app'],
    ['Dra Esia Lopes', 'draesialopes.vercel.app'],
    ['Urologia Redenção', 'urologiaredencao.vercel.app'],
    ['Hospital de Olhos Jordão', 'hospitaldeolhosjordao.vercel.app'],
    ['Uzi Makeup', 'uzimakeup.vercel.app'],
    ['Norte Capital', 'site-norte-capital.vercel.app'],
    ['Exatta Solar', 'exattasolar.com.br'],
    ['MJC Pavers', 'www.mjcpavers.com'],
    ['Igreja Paz e Reino', 'igrejapazereino.vercel.app'],
    ['Carlotinha', 'carlotinha-site.vercel.app'],
  ]},
]

const hrefOf = (u: string) => (u.startsWith('/') ? u : `https://${u}`)

export default function Acessos() {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter(([n, u]) => !query || (n + ' ' + u).toLowerCase().includes(query)) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Acessos &amp; Ferramentas</h1>
      <p className="text-muted-foreground mt-1 mb-5">Todos os sites, produtos e painéis da SVI num lugar só.</p>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar… (ex: clube, kickoff, erika, n8n)"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {groups.map((g) => (
        <section key={g.title} className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map(([name, url]) => (
              <a
                key={name + url}
                href={hrefOf(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-semibold leading-tight">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{url}</span>
                </span>
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="text-center text-muted-foreground py-10">Nada encontrado para “{q}”.</p>
      )}
    </div>
  )
}
