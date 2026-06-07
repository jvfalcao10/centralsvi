import { useState, useMemo, useEffect } from 'react'
import planosData from '@/data/planos_semana.json'
import { Search, Clock, User, Target, CheckCircle2, ChevronDown } from 'lucide-react'

interface Acao {
  dia: string
  'ação': string
  resp: string
  tempo: string
  impacto: string
}

interface Plano {
  label: string
  display: string
  vertical: string
  icone: string
  resp: string
  severidade: 'critical' | 'alto' | 'medio' | 'ok'
  contexto: string
  meta: string
  acoes: Acao[]
}

const PLANOS = planosData as Plano[]

const SEV_RANK: Record<string, number> = { critical: 0, alto: 1, medio: 2, ok: 3 }
const SEV_LABEL: Record<string, string> = { critical: 'CRÍTICO', alto: 'ALTO', medio: 'MÉDIO', ok: 'OK' }

const DIAS = ['SEG 09/06', 'TER 10/06', 'QUA 11/06', 'QUI 12/06', 'SEX 13/06']

export default function TrafegoPlanoSemana() {
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState<string>('all')
  const [dayFilter, setDayFilter] = useState<string>('all')
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null)

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  const filtered = useMemo(() => {
    let list = PLANOS.slice()
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.display.toLowerCase().includes(q) ||
        p.vertical.toLowerCase().includes(q) ||
        p.contexto.toLowerCase().includes(q)
      )
    }
    if (sevFilter !== 'all') list = list.filter(p => p.severidade === sevFilter)
    list.sort((a, b) => (SEV_RANK[a.severidade] ?? 9) - (SEV_RANK[b.severidade] ?? 9))
    return list
  }, [search, sevFilter])

  const totals = useMemo(() => {
    const r = { total: PLANOS.length, critical: 0, alto: 0, medio: 0, ok: 0, acoes: 0 }
    PLANOS.forEach(p => {
      r[p.severidade]++
      r.acoes += p.acoes.length
    })
    return r
  }, [])

  return (
    <div style={styles.root}>
      <style>{globalCss}</style>

      {/* HERO */}
      <section style={styles.hero}>
        <div style={styles.gridBg} />
        <div style={styles.heroContent}>
          <div style={styles.heroNav}>
            <div style={styles.brand}>
              <span style={styles.brandMark}>SVI</span>
              <span style={styles.brandSub}>Company</span>
            </div>
            <div style={styles.versionTag}>v1.0 · 07/06/2026</div>
          </div>

          <div style={styles.heroBody}>
            <div style={styles.heroBadge}>
              <span style={styles.heroBadgeDot} />
              <span>Plano de Ação Operacional</span>
            </div>

            <h1 style={styles.heroTitle}>
              16 contas Meta Ads<br />
              <span style={styles.heroHighlight}>ações da semana</span>
            </h1>

            <p style={styles.heroPeriod}>08 a 14 · Junho · 2026</p>

            <div style={styles.heroStats}>
              <Stat num="16" label="Clientes" gold />
              <Divider />
              <Stat num={String(totals.acoes)} label="Ações" />
              <Divider />
              <Stat num={String(totals.critical)} label="Críticas" />
              <Divider />
              <Stat num="~20h" label="Tempo total" gold />
            </div>

            <div style={styles.heroMeta}>
              <span>
                <strong>Para:</strong> Aleilson Borges + João Vitor Falcão
              </span>
              <span style={{ color: 'var(--gold)' }}>
                <strong>Reunião:</strong> Segunda 08/06 às 9h
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FILTROS */}
      <section style={styles.filterBar}>
        <div style={styles.container}>
          <div style={styles.filterRow}>
            <div style={styles.searchWrap}>
              <Search style={styles.searchIcon} />
              <input
                placeholder="Buscar cliente, vertical, contexto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            <div style={styles.sevPills}>
              <SevPill active={sevFilter === 'all'} onClick={() => setSevFilter('all')} label="Todas" count={totals.total} />
              <SevPill active={sevFilter === 'critical'} onClick={() => setSevFilter('critical')} label="Críticas" count={totals.critical} sev="critical" />
              <SevPill active={sevFilter === 'alto'} onClick={() => setSevFilter('alto')} label="Alto" count={totals.alto} sev="alto" />
              <SevPill active={sevFilter === 'medio'} onClick={() => setSevFilter('medio')} label="Médio" count={totals.medio} sev="medio" />
            </div>
          </div>
        </div>
      </section>

      {/* CONTEÚDO */}
      <section style={{ ...styles.section, paddingTop: 48 }}>
        <div style={styles.container}>
          {filtered.length === 0 ? (
            <div style={styles.empty}>Nenhum cliente encontrado.</div>
          ) : (
            <div style={styles.cardsGrid}>
              {filtered.map((p, i) => (
                <ClientCard
                  key={p.label}
                  plano={p}
                  index={i}
                  expanded={expandedLabel === p.label}
                  onToggle={() => setExpandedLabel(expandedLabel === p.label ? null : p.label)}
                  dayFilter={dayFilter}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer style={styles.footer}>
        <div style={styles.container}>
          <div style={styles.footerInner}>
            <div style={styles.brand}>
              <span style={styles.brandMark}>SVI</span>
              <span style={styles.brandSub}>Company</span>
            </div>
            <p style={styles.footerNote}>
              Confidencial · Uso interno SVI · Gerado em 07/06/2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Stat({ num, label, gold }: { num: string; label: string; gold?: boolean }) {
  return (
    <div style={styles.stat}>
      <div style={{ ...styles.statNum, ...(gold ? styles.statNumGold : {}) }}>{num}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function Divider() {
  return <div style={styles.statDivider} />
}

function SevPill({ active, onClick, label, count, sev }: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  sev?: string
}) {
  const sevColor: Record<string, string> = {
    critical: '#E0726A',
    alto: '#E89A1C',
    medio: 'var(--gold-bright)',
  }
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.sevPill,
        background: active ? 'rgba(240,199,68,0.14)' : 'rgba(247,242,231,0.04)',
        borderColor: active ? 'rgba(240,199,68,0.4)' : 'var(--line-2)',
        color: active ? 'var(--gold-light)' : 'var(--text-2)',
      }}
    >
      {sev && (
        <span style={{
          width: 6, height: 6, borderRadius: 999,
          background: sevColor[sev] || 'var(--text-m)',
        }} />
      )}
      {label}
      <span style={styles.sevPillCount}>{count}</span>
    </button>
  )
}

function ClientCard({ plano, index, expanded, onToggle, dayFilter }: {
  plano: Plano
  index: number
  expanded: boolean
  onToggle: () => void
  dayFilter: string
}) {
  const sevColors: Record<string, { fg: string; bg: string; border: string }> = {
    critical: { fg: '#E0726A', bg: 'rgba(224,114,106,0.10)', border: 'rgba(224,114,106,0.3)' },
    alto: { fg: '#E89A1C', bg: 'rgba(232,154,28,0.10)', border: 'rgba(232,154,28,0.3)' },
    medio: { fg: 'var(--gold-bright)', bg: 'rgba(240,199,68,0.10)', border: 'rgba(240,199,68,0.3)' },
    ok: { fg: 'var(--green)', bg: 'rgba(74,190,124,0.10)', border: 'rgba(74,190,124,0.3)' },
  }
  const sv = sevColors[plano.severidade] || sevColors.medio
  const acoes = dayFilter === 'all' ? plano.acoes : plano.acoes.filter(a => a.dia.startsWith(dayFilter))

  return (
    <article style={{ ...styles.card, borderColor: expanded ? 'rgba(212,168,44,0.4)' : 'var(--line-2)' }}>
      {/* Header */}
      <div
        style={{ ...styles.cardHeader, cursor: 'pointer' }}
        onClick={onToggle}
      >
        <div style={styles.cardHeaderLeft}>
          <div style={styles.cardNumber}>{String(index + 1).padStart(2, '0')}</div>
          <div>
            <div style={styles.cardTitleRow}>
              <span style={styles.cardIcon}>{plano.icone}</span>
              <h2 style={styles.cardTitle}>{plano.display}</h2>
              <span style={{
                ...styles.sevBadge,
                background: sv.bg,
                color: sv.fg,
                borderColor: sv.border,
              }}>
                {SEV_LABEL[plano.severidade]}
              </span>
            </div>
            <div style={styles.cardMeta}>
              <span>{plano.vertical}</span>
              <span style={styles.metaSep}>·</span>
              <span style={styles.metaResp}><User style={{ width: 12, height: 12 }} /> {plano.resp}</span>
            </div>
          </div>
        </div>
        <ChevronDown style={{
          ...styles.chevron,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </div>

      {/* Sempre visível: meta + qtd ações */}
      <div style={styles.cardMetaRow}>
        <div style={styles.metaBox}>
          <div style={styles.metaBoxLabel}><Target style={{ width: 12, height: 12 }} /> Meta da semana</div>
          <div style={styles.metaBoxValue}>{plano.meta}</div>
        </div>
        <div style={styles.metaBox}>
          <div style={styles.metaBoxLabel}><CheckCircle2 style={{ width: 12, height: 12 }} /> Ações</div>
          <div style={styles.metaBoxValue}>{plano.acoes.length} esta semana</div>
        </div>
      </div>

      {/* Expanded: contexto + tabela */}
      {expanded && (
        <div style={styles.cardExpanded}>
          <div style={styles.contexto}>
            <div style={styles.contextLabel}>Contexto</div>
            <p style={styles.contextText}>{plano.contexto}</p>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={{ ...styles.th, ...styles.thDay }}>Dia</th>
                  <th style={styles.th}>Ação</th>
                  <th style={styles.th}>Responsável</th>
                  <th style={styles.th}>Tempo</th>
                  <th style={styles.th}>Impacto</th>
                </tr>
              </thead>
              <tbody>
                {acoes.map((a, idx) => (
                  <tr key={idx} style={idx % 2 === 1 ? styles.trEven : undefined}>
                    <td style={styles.tdDay}>{a.dia}</td>
                    <td style={styles.tdAction}>{a['ação']}</td>
                    <td style={styles.tdResp}>{a.resp}</td>
                    <td style={styles.tdTime}><Clock style={{ width: 11, height: 11, display: 'inline', marginRight: 4, opacity: 0.6 }} />{a.tempo}</td>
                    <td style={styles.tdImpact}>{a.impacto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  )
}

const COLORS = {
  gold: '#D4A82C',
  goldBright: '#F0C744',
  goldLight: '#FDEBA8',
  goldDark: '#9B7518',
  amber: '#E89A1C',
  black: '#0A0608',
  black2: '#120B0F',
  ink: '#1A1218',
  ink2: '#241820',
  paper: '#FBF7EC',
  paper2: '#EEE5D1',
  text: '#F7F2E7',
  text2: '#DCD1B8',
  textM: '#A89B82',
  textMM: '#6E634F',
  textDark: '#1A1218',
  green: '#4ABE7C',
  red: '#E0726A',
}

const globalCss = `
  :root {
    --gold: ${COLORS.gold};
    --gold-bright: ${COLORS.goldBright};
    --gold-light: ${COLORS.goldLight};
    --gold-dark: ${COLORS.goldDark};
    --amber: ${COLORS.amber};
    --black: ${COLORS.black};
    --black-2: ${COLORS.black2};
    --ink: ${COLORS.ink};
    --ink-2: ${COLORS.ink2};
    --paper: ${COLORS.paper};
    --paper-2: ${COLORS.paper2};
    --text: ${COLORS.text};
    --text-2: ${COLORS.text2};
    --text-m: ${COLORS.textM};
    --text-mm: ${COLORS.textMM};
    --text-dark: ${COLORS.textDark};
    --green: ${COLORS.green};
    --line: rgba(245,241,232,0.08);
    --line-2: rgba(245,241,232,0.12);
  }
  .svi-plan-page, .svi-plan-page * { font-family: 'DM Sans', system-ui, sans-serif; }
  .svi-plan-page input:focus { outline: none; border-color: rgba(240,199,68,0.4); }
  .svi-plan-page button { cursor: pointer; transition: all 0.2s; }
  .svi-plan-page ::selection { background: var(--gold); color: var(--black); }
`

const styles: Record<string, React.CSSProperties> = {
  root: {
    background: COLORS.paper,
    minHeight: '100vh',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: COLORS.textDark,
  },
  hero: {
    position: 'relative',
    background: `
      radial-gradient(900px 500px at 20% 10%, rgba(232,154,28,0.18), transparent 55%),
      radial-gradient(800px 600px at 80% 60%, rgba(212,168,44,0.14), transparent 55%),
      radial-gradient(600px 400px at 50% 100%, rgba(184,115,51,0.12), transparent 60%),
      linear-gradient(180deg, ${COLORS.black} 0%, ${COLORS.black2} 100%)
    `,
    color: COLORS.text,
    padding: '100px 24px 80px',
    overflow: 'hidden',
    borderBottom: `5px solid transparent`,
    borderImage: `linear-gradient(90deg, ${COLORS.goldBright}, ${COLORS.gold}, ${COLORS.goldDark}, ${COLORS.gold}, ${COLORS.goldBright}) 1`,
  },
  gridBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `linear-gradient(rgba(212,168,44,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,44,0.04) 1px, transparent 1px)`,
    backgroundSize: '80px 80px',
    maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
    WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
    pointerEvents: 'none',
  },
  heroContent: { position: 'relative', zIndex: 2, maxWidth: 1200, margin: '0 auto' },
  heroNav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 56 },
  brand: { display: 'flex', alignItems: 'baseline', gap: 8 },
  brandMark: { fontSize: 28, fontWeight: 700, color: COLORS.goldBright, letterSpacing: '-0.04em', lineHeight: 1 },
  brandSub: { fontSize: 10, fontWeight: 500, color: COLORS.text2, letterSpacing: '0.25em', textTransform: 'uppercase' },
  versionTag: { fontSize: 10, color: COLORS.textM, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(245,241,232,0.12)', borderRadius: 999 },
  heroBody: { maxWidth: 900 },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 18px',
    background: 'linear-gradient(135deg, rgba(240,199,68,0.12), rgba(212,168,44,0.06))',
    border: '1px solid rgba(240,199,68,0.3)',
    borderRadius: 999,
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginBottom: 32,
  },
  heroBadgeDot: { width: 6, height: 6, background: COLORS.goldBright, borderRadius: '50%' },
  heroTitle: {
    fontSize: 'clamp(42px, 6vw, 76px)' as any,
    fontWeight: 500,
    lineHeight: 1.02,
    letterSpacing: '-0.035em',
    color: COLORS.text,
    marginBottom: 20,
  },
  heroHighlight: {
    background: `linear-gradient(110deg, ${COLORS.goldLight} 10%, ${COLORS.goldBright} 45%, ${COLORS.amber} 85%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  heroPeriod: { fontSize: 18, color: COLORS.text2, marginBottom: 36, fontWeight: 400, letterSpacing: '0.02em' },
  heroStats: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 28,
    padding: '24px 36px',
    background: 'rgba(247,242,231,0.04)',
    border: '1px solid rgba(245,241,232,0.12)',
    borderRadius: 16,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  stat: { textAlign: 'left' },
  statNum: { fontSize: 32, fontWeight: 600, color: COLORS.text, lineHeight: 1, marginBottom: 6, letterSpacing: '-0.02em' },
  statNumGold: {
    background: `linear-gradient(120deg, ${COLORS.goldBright}, ${COLORS.amber})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  statLabel: { fontSize: 10, color: COLORS.textM, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 },
  statDivider: { width: 1, height: 36, background: `linear-gradient(180deg, transparent, rgba(212,168,44,0.3), transparent)` },
  heroMeta: { display: 'flex', gap: 28, fontSize: 13, color: COLORS.text2, flexWrap: 'wrap' },

  filterBar: {
    background: COLORS.ink,
    borderBottom: `1px solid var(--line-2)`,
    padding: '20px 0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backdropFilter: 'blur(20px)',
  },
  container: { maxWidth: 1200, margin: '0 auto', padding: '0 24px' },
  filterRow: { display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
  searchWrap: { position: 'relative', flex: '1 1 320px', maxWidth: 480 },
  searchIcon: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: COLORS.textM, pointerEvents: 'none' },
  searchInput: {
    width: '100%',
    padding: '10px 16px 10px 42px',
    background: 'rgba(247,242,231,0.06)',
    border: '1px solid var(--line-2)',
    borderRadius: 10,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: 'inherit',
  },
  sevPills: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  sevPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 14px',
    border: '1px solid',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  sevPillCount: { padding: '1px 7px', background: 'rgba(247,242,231,0.10)', borderRadius: 999, fontSize: 10, fontWeight: 600 },

  section: { padding: '48px 0' },
  empty: { padding: 64, textAlign: 'center', color: COLORS.textMM, background: 'rgba(255,255,255,0.5)', borderRadius: 12 },
  cardsGrid: { display: 'flex', flexDirection: 'column', gap: 16 },

  card: {
    background: '#FFFEFB',
    border: '1px solid var(--line-2)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(10,6,8,0.04)',
    transition: 'all 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    padding: '20px 24px',
  },
  cardHeaderLeft: { display: 'flex', gap: 16, alignItems: 'center', flex: 1 },
  cardNumber: {
    fontSize: 22,
    fontWeight: 700,
    color: COLORS.goldDark,
    letterSpacing: '-0.02em',
    minWidth: 40,
  },
  cardTitleRow: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' },
  cardIcon: { fontSize: 22 },
  cardTitle: { fontSize: 19, fontWeight: 600, color: COLORS.ink, letterSpacing: '-0.02em', margin: 0 },
  sevBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    border: '1px solid',
    borderRadius: 999,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  cardMeta: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: COLORS.textMM, flexWrap: 'wrap' },
  metaSep: { opacity: 0.4 },
  metaResp: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  chevron: { width: 20, height: 20, color: COLORS.textMM, transition: 'transform 0.2s' },

  cardMetaRow: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, padding: '0 24px 16px' },
  metaBox: {
    padding: '12px 14px',
    background: 'linear-gradient(135deg, rgba(212,168,44,0.06) 0%, rgba(212,168,44,0.02) 100%)',
    border: '1px solid rgba(212,168,44,0.18)',
    borderRadius: 10,
  },
  metaBoxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.goldDark,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaBoxValue: { fontSize: 13, color: COLORS.ink, fontWeight: 500, lineHeight: 1.5 },

  cardExpanded: {
    borderTop: '1px solid var(--line-2)',
    padding: '20px 24px 24px',
    background: 'linear-gradient(180deg, rgba(251,247,236,0.4) 0%, transparent 100%)',
  },
  contexto: { marginBottom: 18 },
  contextLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.goldDark,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  contextText: { fontSize: 13.5, color: '#524437', lineHeight: 1.65, margin: 0 },

  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(212,168,44,0.2)' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12.5, background: '#FFFEFB' },
  thRow: { background: `linear-gradient(135deg, ${COLORS.ink} 0%, ${COLORS.black2} 100%)` },
  th: {
    padding: '12px 14px',
    textAlign: 'left' as const,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: COLORS.goldBright,
  },
  thDay: { width: 100 },
  trEven: { background: 'rgba(251,247,236,0.5)' },
  tdDay: { padding: '10px 14px', fontWeight: 700, color: COLORS.goldDark, fontSize: 11, letterSpacing: '0.03em', background: 'rgba(240,199,68,0.06)', whiteSpace: 'nowrap' },
  tdAction: { padding: '10px 14px', color: COLORS.ink, fontWeight: 500, lineHeight: 1.5 },
  tdResp: { padding: '10px 14px', color: '#524437', fontSize: 12, whiteSpace: 'nowrap' },
  tdTime: { padding: '10px 14px', color: COLORS.textMM, fontSize: 12, whiteSpace: 'nowrap' },
  tdImpact: { padding: '10px 14px', color: '#2A6F44', fontSize: 12, fontStyle: 'italic' },

  footer: {
    background: COLORS.black,
    color: COLORS.text,
    padding: '40px 0',
    marginTop: 40,
    borderTop: `1px solid var(--line-2)`,
  },
  footerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  footerNote: { fontSize: 11, color: COLORS.textMM, letterSpacing: '0.04em' },
}

