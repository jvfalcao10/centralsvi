import { ClipboardList, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/**
 * Painel de Produção — repasse pro time.
 * Varredura de conteúdo cliente por cliente (ago→dez 2026): cada peça amarrada
 * em data estratégica + dor real, padrão novo (H1/H2/CTA, Brands Decoded),
 * organizada por Empresa no ClickUp, revisada por CFM e travas de escrita.
 */

type Cli = { n: string; ni: string; q: string; h: string; tag: 'med' | 'com' | 'est' }

const MEDICOS: Cli[] = [
  { n: 'Dr. Felipe Branco', ni: 'Cirurgião do aparelho digestivo', q: '6 peças', tag: 'med', h: 'Obesidade é doença, mitos da digestão, caneta x cirurgia, o que o cocô diz, Dia dos Pais (priorizado), Dia do Médico.' },
  { n: 'Dr. Brenno Cangussu', ni: 'Ortopedia e medicina da dor', q: '7 peças', tag: 'med', h: 'Automedicação, a dor tem endereço, tipos de dor no joelho, "é da idade" (Dia do Idoso), Setembro Amarelo, Dia do Médico.' },
  { n: 'Dra. Ésia Lopes', ni: 'Pediatria', q: '6 peças', tag: 'med', h: 'Tempo seco e tosse, febre no bebê, vacinação, leite fraco (Agosto Dourado), saúde emocional (Set. Amarelo), Dia do Médico.' },
  { n: 'Dra. Erika Figueiredo', ni: 'Medicina geriátrica', q: '7 peças', tag: 'med', h: 'Desidratação no idoso, quedas, Alzheimer + Dia do Idoso, 2 reels narrativos com IA + ElevenLabs, Dia do Médico.' },
  { n: 'Dr. Daniel Peralba', ni: 'Proctologia', q: '3 peças + vídeo', tag: 'med', h: 'Tabu com humor, sangue no papel, Dia do Médico (vídeos próprios rodando).' },
  { n: 'PROURO Urologia', ni: 'Saúde do homem', q: '5 peças', tag: 'med', h: 'Agosto Azul (tweet + carrossel), Dia dos Pais, Novembro Azul, Dia do Médico.' },
  { n: 'Dra. Enia Paula', ni: 'Saúde mental', q: 'perfil + leva', tag: 'med', h: 'Perfil reorganizado (capas + 28 stories com fotos), leva Setembro Amarelo, reapresentação, Dia do Médico.' },
  { n: 'Hospital de Olhos Jordão', ni: 'Oftalmologia', q: '8 peças', tag: 'med', h: 'Sol e olhos, catarata é mito, glaucoma, olho seco de tela, exame da família, Dia da Visão, Dia dos Pais, Dia do Médico.' },
]

const COMERCIO: Cli[] = [
  { n: 'Alpha Fitness', ni: 'Academia', q: 'página + 6+', tag: 'com', h: 'Página de roteiros (reativação, rápidos/descontraídos, Projeto Fim de Ano), 4 flyers, Dia do Cliente, Black Friday.' },
  { n: 'GM Gás', ni: 'Gás e água', q: 'página + flyers', tag: 'com', h: 'Página com 11 roteiros (bastidor, segurança, mito, oferta) + flyers datados, Dia do Cliente.' },
  { n: 'CCR · Colégio Christo Rei', ni: 'Escola / ENEM', q: 'página + 2', tag: 'com', h: '4 vídeos em 4 cenas + 2 carrosséis (5 estratégias ENEM, matrículas).' },
  { n: 'Ótica Central', ni: 'Óptica', q: '6 + BF', tag: 'com', h: 'Sol/UV, criança não enxerga o quadro, dor de cabeça, vista cansada, luz azul, Dia do Cliente, Black Friday.' },
  { n: 'Números Contabilidade', ni: 'Contabilidade', q: '8 peças', tag: 'com', h: 'Imposto a mais, contador que só manda guia, MEI, Reforma Tributária, alerta golpe MEI, Dia do Contador, Dia do Cliente.' },
  { n: 'Pro Life', ni: 'Academia (treino acompanhado)', q: '5 peças', tag: 'com', h: 'Nunca treina sozinho, treina e não muda?, emagrecer é treinar certo, todas as idades, Dia do Prof. de Ed. Física.' },
  { n: 'Espaço Soraia', ni: 'Moda premium · 40 anos', q: '5 + 8 spotlights', tag: 'est', h: 'Marcas exclusivas, 40 anos, qualidade, Dia do Cliente, Outubro Rosa + spotlight das 8 marcas (Le Lis Blanc, Dudalina, A|X...).' },
  { n: 'Spa Nature', ni: 'Estética', q: '3 peças', tag: 'est', h: 'Projeto Desinchar (oferta da cliente), Dia do Cliente, Black Friday.' },
  { n: 'Carlotinha Veículos', ni: 'Seminovos', q: '3 peças', tag: 'com', h: 'Sorteio de inauguração (Caixa de Som Aiwa), Dia do Cliente, Black Friday.' },
  { n: 'Norte Capital', ni: 'Investimentos / agro', q: '2 peças', tag: 'com', h: 'Na voz do Elpídio (post + carrossel).' },
]

const SISTEMAS = [
  { icon: '🗓️', t: 'Calendário de datas', d: 'Todas as datas estratégicas (oficiais + pop) mapeadas por cliente, ago→dez.', link: '/content/datas', linkLabel: 'Datas Estratégicas' },
  { icon: '🤖', t: 'Sofia lembrando', d: 'Todo dia 8h a Sofia avisa o grupo SVI Geral das datas dos próximos 7 dias. Ninguém esquece.', link: '', linkLabel: 'n8n · ativo' },
  { icon: '🌿', t: 'Perfil da Dra. Enia', d: 'Reorganização completa + 7 capas + 28 stories com as fotos reais dela.', link: 'https://enia-perfil.svicompany.com.br', linkLabel: 'enia-perfil' },
  { icon: '🎬', t: 'Páginas de roteiro', d: 'Roteiros de gravação prontos, com botão copiar (Alpha · CCR · GM).', link: 'https://alpha-roteiros.svicompany.com.br', linkLabel: 'Alpha · CCR · GM' },
]

const TAG_CLS: Record<Cli['tag'], string> = {
  med: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  com: 'bg-primary/20 text-primary border-primary/30',
  est: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
}

export default function Producao() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Painel de Produção
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          O que a SVI produziu, cliente por cliente. Cada peça amarrada em data estratégica + dor
          real, no padrão novo (H1/H2/CTA, Brands Decoded), organizada por Empresa no ClickUp,
          revisada por CFM e travas de escrita.
        </p>
      </div>

      {/* STATS */}
      <div className="flex flex-wrap gap-3">
        {[
          ['18', 'clientes com leva'],
          ['100+', 'peças produzidas'],
          ['4', 'sistemas de pé'],
          ['1', 'calendário + Sofia lembrando'],
        ].map(([n, l], i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-5 py-3 min-w-[130px]">
            <div className="text-2xl font-bold text-primary leading-none">{n}</div>
            <div className="text-xs text-muted-foreground mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* SISTEMAS */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-2">Sistemas que ficaram de pé</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SISTEMAS.map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="text-lg mb-1">{s.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{s.t}</h3>
              <p className="text-xs text-muted-foreground mb-2">{s.d}</p>
              {s.link ? (
                <a
                  href={s.link}
                  className="text-primary text-xs font-semibold inline-flex items-center gap-1"
                  {...(s.link.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  {s.linkLabel} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground font-medium">{s.linkLabel}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MÉDICOS */}
      <Section title="Médicos" list={MEDICOS} />
      {/* COMÉRCIO */}
      <Section title="Comércio & serviços" list={COMERCIO} />

      {/* FORA DA RODADA */}
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-sm text-orange-200/90">
        <b className="text-orange-300">Fora da rodada (por decisão):</b> Exatta e Uzi (têm conteúdo
        próprio) · Vanessa Back, Supermercado América e IPER (fora da operação). Black Friday, Singles
        Day e Natal entraram como <b>brief pra definir a oferta real com cada cliente</b> (não se
        inventa oferta).
      </div>

      <footer className="text-xs text-muted-foreground pt-2">
        Produção de conteúdo · Ago→Dez 2026 · cada peça: data estratégica + dor real + CFM + zero
        travessão.
      </footer>
    </div>
  )
}

function Section({ title, list }: { title: string; list: Cli[] }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-primary mb-2">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((x, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 flex gap-3">
            <div
              className={
                'shrink-0 w-11 h-11 rounded-lg border flex items-center justify-center font-bold ' +
                TAG_CLS[x.tag]
              }
            >
              {x.n[0]}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                {x.ni}
              </div>
              <h3 className="font-semibold">{x.n}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{x.h}</p>
              <Badge variant="outline" className="mt-2 bg-primary/10 text-primary border-primary/30">
                {x.q}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
