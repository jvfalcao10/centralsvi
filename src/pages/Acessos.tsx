import { ExternalLink } from 'lucide-react'

type Link = { name: string; desc: string; url: string }
type Group = { title: string; hint?: string; links: Link[] }

const GROUPS: Group[] = [
  {
    title: 'Ferramentas internas',
    hint: 'Uso do time',
    links: [
      { name: 'Guia de Onboarding', desc: 'Como funciona a entrada de cliente, passo a passo', url: '/guia-onboarding.html' },
      { name: 'Arsenal SVI', desc: 'Biblioteca de conteúdo e estratégia (gate svi102030)', url: 'https://arsenal.svicompany.com.br' },
      { name: 'Dashboard de Clientes', desc: 'Métricas de Meta por cliente', url: 'https://dashboard.svicompany.com.br' },
      { name: 'n8n — Automações', desc: 'Workflows da Sofia', url: 'https://n8n.svicompany.com.br' },
      { name: 'ClickUp', desc: 'Tarefas e projetos', url: 'https://app.clickup.com/9015595861' },
      { name: 'Hub de Acessos', desc: 'Índice antigo de links (em migração pra cá)', url: 'https://hub.svicompany.com.br' },
    ],
  },
  {
    title: 'Páginas de cliente e prospect',
    hint: 'Hospedadas fora — o cliente acessa sem login',
    links: [
      { name: 'Onboarding — gerar contrato', desc: 'Preencher pra entrar cliente novo (dispara contrato + tudo)', url: 'https://svicompany.com.br/onboarding' },
      { name: 'Kickoff — Marketing', desc: 'O cliente preenche o diagnóstico de marketing', url: 'https://svicompany.com.br/kickoff' },
      { name: 'Kickoff — CRM', desc: 'Diagnóstico comercial / CRM', url: 'https://svicompany.com.br/kickoff-crm' },
      { name: 'Admin Kickoff', desc: 'Ler as respostas dos kickoffs (com login)', url: 'https://svicompany.com.br/admin-kickoff' },
      { name: 'Raio-X', desc: 'Quiz de diagnóstico para prospect', url: 'https://raiox.svicompany.com.br' },
    ],
  },
]

export default function Acessos() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Acessos &amp; Ferramentas</h1>
      <p className="text-muted-foreground mt-1 mb-6">Tudo num lugar só — as ferramentas internas do time e as páginas de cliente.</p>

      {GROUPS.map((g) => (
        <section key={g.title} className="mb-8">
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h2>
            {g.hint && <span className="text-xs text-muted-foreground/70">· {g.hint}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.links.map((l) => (
              <a
                key={l.name}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold leading-tight">{l.name}</span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{l.desc}</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
