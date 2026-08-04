import { useState } from 'react'
import { ExternalLink, Search, KeyRound } from 'lucide-react'

// [nome, url (sem https:// — ou "/" pra rota interna), acesso? (como entrar)]
type Item = [string, string, string?]
type Group = { title: string; items: Item[] }

const GROUPS: Group[] = [
  { title: 'Apps & Produtos SVI', items: [
    ['Estúdio SVI — gerador de conteúdo', 'estudio.svicompany.com.br', 'login e-mail+senha (self-service)'],
    ['MedPost — Estúdio médico', 'medpost.svicompany.com.br', 'landing pública · testar = login'],
    ['Central 100K — @falcao', '100k.svicompany.com.br', 'público'],
    ['Arsenal — frameworks + roteiros', 'arsenal.svicompany.com.br', 'senha: svi102030'],
    ['Ápice — prova social SaaS', 'apice.svicompany.com.br', 'login'],
    ['MedCaixa', 'medcaixa.svicompany.com.br', 'login'],
    ['MedCRM', 'medcrm.svicompany.com.br', 'signup self-service'],
    ['Clube de Cashback', 'clube.svicompany.com.br', 'público · /superadmin interno'],
    ['Concierge — bio que vende', 'concierge.svicompany.com.br', 'público · painel = login'],
    ['AURA — Spa Nature', 'aurasvicompany.vercel.app', 'login'],
    ['SVI OS', 'svi-os.vercel.app', 'login'],
    ['Kickoff CRM AI', 'kickoffcrmai-svicompanyy-2539s-projects.vercel.app', 'login'],
    ['Câmera na Mão', 'camera.svicompany.com.br', 'público · /admin.html interno'],
  ]},
  { title: 'Centrais & Painéis internos', items: [
    ['Central SVI (esta central)', 'centralsvi.vercel.app', 'interno'],
    ['Diretoria — command center', 'diretoria.svicompany.com.br', 'interno'],
    ['Inteligência — central', 'inteligencia.svicompany.com.br', 'interno'],
    ['Catálogo de ofertas com preço', 'ofertas.svicompany.com.br', 'interno'],
    ['Cofre de Senhas', '/senhas', 'João · Arthur · Sarah · Letícia'],
    ['Diagnóstico / Raio-X (isca)', 'diagnostico.svicompany.com.br', 'público'],
    ['Alpha — Dashboard', 'alpha.svicompany.com.br', 'link do cliente'],
    ['Pro Life — Dashboard', 'prolife.svicompany.com.br', 'link do cliente'],
    ['Exatta — Dashboard', 'exatta-dashboard.vercel.app', 'link do cliente'],
  ]},
  { title: 'Ferramentas externas', items: [
    ['n8n (automações)', 'n8n.svicompany.com.br', 'conta SVI'],
    ['Supabase', 'supabase.com/dashboard/projects', 'conta SVI'],
    ['Stripe', 'dashboard.stripe.com', 'conta SVI'],
    ['ClickUp', 'app.clickup.com', 'conta SVI'],
    ['GitHub', 'github.com/jvfalcao10', 'conta SVI'],
    ['Vercel', 'vercel.com/svicompanyy-2539s-projects', 'conta SVI'],
  ]},
  { title: 'Onboarding & Kickoff', items: [
    ['Guia — Como funciona o onboarding', '/guia-onboarding.html'],
    ['Onboarding — gerar contrato', 'svicompany.com.br/onboarding'],
    ['Kickoff — Marketing', 'svicompany.com.br/kickoff'],
    ['Kickoff — CRM', 'svicompany.com.br/kickoff-crm'],
    ['Admin Kickoff (ler respostas)', 'svicompany.com.br/admin-kickoff', 'interno'],
  ]},
  { title: 'Clube de Cashback', items: [
    ['Clube — Central (MRR/lojas/onboarding)', 'clube.svicompany.com.br/superadmin', 'interno'],
    ['Clube — Oferta (venda)', 'clube.svicompany.com.br/oferta', 'público'],
    ['Clube — Diagnóstico (isca)', 'clube.svicompany.com.br/diagnostico', 'público'],
    ['Clube — Assinar ANUAL à vista', 'clube.svicompany.com.br/comecar?plano=anual', 'público'],
    ['Clube — Assinar mensal (14d grátis)', 'clube.svicompany.com.br/comecar', 'público'],
    ['Clube — Guia: conectar WhatsApp', 'clube.svicompany.com.br/guia-whatsapp', 'público'],
    ['Clube — Pagamento Soraia (link fixo)', 'buy.stripe.com/dRmcMX0TkfZI78saUa3oA00', 'link fixo'],
    ['Clube — App / balcão', 'clube.svicompany.com.br/app', 'login loja'],
    ['Clube — Motor n8n', 'n8n.svicompany.com.br/workflow/wRFulrJKT21U7jhC', 'conta SVI'],
    ['Clube — Prospecção cold n8n', 'n8n.svicompany.com.br/workflow/oL9zIohWP8bXo4NO', 'conta SVI'],
  ]},
  { title: 'Concierge (bio que vende)', items: [
    ['Concierge — Oferta (venda)', 'concierge.svicompany.com.br', 'público'],
    ['Concierge — Planos', 'concierge.svicompany.com.br/planos', 'público'],
    ['Concierge — Bio da SVI (demo)', 'concierge.svicompany.com.br/svi', 'público'],
    ['Concierge — Painel (editor cliente)', 'concierge.svicompany.com.br/painel', 'login cliente'],
    ['Concierge — Bio Comando Drones', 'concierge.svicompany.com.br/comando-drones', 'público'],
  ]},
  { title: 'Câmera na Mão (produto)', items: [
    ['App · Câmera na Mão (cada vendedor cria o seu)', 'camera.svicompany.com.br', 'público · /admin.html interno'],
    ['Aula · apresentação do curso (ministrar ao vivo)', 'aula-camera.svicompany.com.br', 'público'],
    ['Apresentação de venda (deck + QR do app)', 'camera-app.svicompany.com.br', 'público'],
    ['Curso completo (página em texto)', 'curso-exatta.svicompany.com.br', 'público'],
    ['Folha de bolso do vendedor (imprimir)', 'camera-folha.svicompany.com.br', 'público'],
  ]},
  { title: 'Raio-X / Diagnóstico', items: [
    ['Raio-X SVI', 'raiox-svi.vercel.app', 'público'],
    ['Raio-X (app)', 'raiox-svi-app.vercel.app', 'público'],
    ['SVI Diagnóstico', 'svi-diagnostico.vercel.app', 'público'],
    ['Helmer Kids (diagnóstico)', 'helmerkids.vercel.app', 'público'],
  ]},
  { title: 'Autoridade & Institucional', items: [
    ['SVI Company (site)', 'svicompany.com.br', 'público'],
    ['SVI Autoridade (Topo)', 'topo.svicompany.com.br', 'público'],
    ['SVI Authority (EN)', 'svi-authority-en.vercel.app', 'público'],
    ['SVI Doctor', 'svidoctor.vercel.app', 'público'],
  ]},
  { title: 'Estratégia & Backs (por cliente)', items: [
    ['Back Estratégia', 'back.svicompany.com.br', 'interno'],
    ['Dra Erika — Estratégia', 'draerika.svicompany.com.br', 'interno'],
    ['Prouro — Estratégia', 'prouro.svicompany.com.br', 'interno'],
    ['Spa Nature — Roteiros', 'spanature.svicompany.com.br', 'interno'],
    ['Conteúdos — Back', 'conteudos-back.vercel.app', 'interno'],
    ['Conteúdos — Lorena', 'conteudos-lorena.vercel.app', 'interno'],
    ['Plano MJC', 'svi-plano-mjc.vercel.app', 'interno'],
  ]},
  { title: 'Sites de clientes', items: [
    ['Dr Daniel Peralba', 'drdanielperalba.site', 'público'],
    ['Dr Felipe Branco', 'drfelipebranco.site', 'público'],
    ['Dr Brenno Cangussú', 'drbrennocangussu.vercel.app', 'público'],
    ['Dra Luana Caroline', 'draluanacaroline.vercel.app', 'público'],
    ['Dra Erika Figueiredo', 'draerikafigueiredo.vercel.app', 'público'],
    ['Dra Esia Lopes', 'draesialopes.vercel.app', 'público'],
    ['Urologia Redenção', 'urologiaredencao.vercel.app', 'público'],
    ['Hospital de Olhos Jordão', 'hospitaldeolhosjordao.vercel.app', 'público'],
    ['Uzi Makeup', 'uzimakeup.vercel.app', 'público'],
    ['Norte Capital', 'site-norte-capital.vercel.app', 'público'],
    ['Exatta Solar', 'exattasolar.com.br', 'público'],
    ['MJC Pavers', 'www.mjcpavers.com', 'público'],
    ['Igreja Paz e Reino', 'igrejapazereino.vercel.app', 'público'],
    ['Carlotinha', 'carlotinha-site.vercel.app', 'público'],
  ]},
]

const hrefOf = (u: string) => (u.startsWith('/') ? u : `https://${u}`)

export default function Acessos() {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter(([n, u, a]) => !query || (n + ' ' + u + ' ' + (a ?? '')).toLowerCase().includes(query)) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Acessos &amp; Ferramentas</h1>
      <p className="text-muted-foreground mt-1 mb-5">Todos os sites, produtos e painéis da SVI num lugar só, com o acesso de cada.</p>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar… (ex: estudio, medpost, arsenal, senha, clube)"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {groups.map((g) => (
        <section key={g.title} className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map(([name, url, acesso]) => (
              <a
                key={name + url}
                href={hrefOf(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <span className="flex flex-col gap-1 min-w-0">
                  <span className="font-semibold leading-tight">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{url}</span>
                  {acesso && (
                    <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                      <KeyRound className="h-3 w-3" /> {acesso}
                    </span>
                  )}
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
