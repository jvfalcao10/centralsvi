import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'

interface ReportRow {
  slug: string
  account_id: string
  account_name: string
  cliente_label: string
  period_start: string
  period_end: string
  spend_cents: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  frequency: number | null
  conv_count: number | null
  first_reply_count: number | null
  d2_count: number | null
  leads_count: number | null
  purchase_count: number | null
  cpmsg_cents: number | null
  currency: string
  status: string
  generated_at: string
}

function brl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function nf(n: number) {
  return n.toLocaleString('pt-BR')
}
function fmtDate(iso: string) {
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${months[m - 1]}`
}

function interpretar(ctr: number, reach: number) {
  const ctrPct = ctr * 100
  if (ctrPct >= 2) return { tag: 'Acima da média', good: true, frase: 'A receptividade do público está muito boa.' }
  if (ctrPct >= 1) return { tag: 'Bom resultado', good: true, frase: 'A campanha está conversando bem com o público.' }
  if (reach < 1000) return { tag: 'Em aquecimento', good: false, frase: 'A campanha ainda está ganhando volume.' }
  return { tag: 'Dentro do esperado', good: false, frase: 'Resultado dentro da média esperada para o segmento.' }
}

export default function TrafegoReport() {
  const { slug } = useParams<{ slug: string }>()

  // Força a fonte DM Sans nessa rota pública (independe do tema da Central SVI)
  useEffect(() => {
    const id = 'dm-sans-google'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['weekly-traffic-report', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_traffic_reports' as never)
        .select('*')
        .eq('slug', slug as string)
        .maybeSingle()
      if (error) throw error
      return data as unknown as ReportRow | null
    },
  })

  if (isLoading) return <Loading />
  if (error || !data) return <Notice title="Relatório não encontrado">O link expirou ou está incorreto. Solicite um novo relatório com a equipe SVI Company.</Notice>
  if (data.status === 'rejected' || data.status === 'failed') return <Notice title="Relatório indisponível">Entre em contato com a equipe SVI Company para mais detalhes.</Notice>
  // status pending também mostra (serve como preview interno antes da aprovação)

  const ctrPct = (data.ctr * 100).toFixed(2).replace('.', ',')
  const insight = interpretar(data.ctr, data.reach)

  const conv = data.conv_count ?? 0
  const leads = data.leads_count ?? 0
  const purchases = data.purchase_count ?? 0
  const hasResults = conv > 0 || leads > 0 || purchases > 0

  return (
    <div style={styles.root}>
      <style>{globalCss}</style>

      {/* Top bar */}
      <div style={styles.topbar}>
        <div style={styles.container}>
          <div style={styles.topbarInner}>
            <div style={styles.brand}>
              <span style={styles.brandSvi}>SVI</span>
              <span style={styles.brandCompany}>Company</span>
            </div>
            <span style={styles.tag}>Relatório semanal</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section style={{ ...styles.section, paddingTop: 96, paddingBottom: 48 }}>
        <div style={styles.container}>
          <div style={styles.heroCenter}>
            <p style={styles.heroOla}>
              Olá, <span style={{ color: COLORS.text }}>{data.cliente_label}</span>
            </p>
            <h1 style={styles.heroTitle}>
              Veja como foi a semana<br />
              das <span style={styles.gold}>suas campanhas</span>
            </h1>
            <p style={styles.heroDate}>
              {fmtDate(data.period_start)} a {fmtDate(data.period_end)}
            </p>
          </div>
        </div>
      </section>

      {/* Hero metric — Investimento */}
      <section style={styles.section}>
        <div style={styles.container}>
          <div style={styles.heroMetric}>
            <p style={styles.metricEyebrow}>Investimento na semana</p>
            <p style={styles.heroMetricValue}>{brl(data.spend_cents)}</p>
            <p style={styles.heroMetricHelp}>
              Esse valor foi aplicado em anúncios no Facebook e Instagram durante toda a semana.
            </p>
          </div>
        </div>
      </section>

      {/* Pessoas alcançadas */}
      <section style={{ ...styles.section, paddingBottom: hasResults ? 32 : 80 }}>
        <div style={styles.container}>
          <div style={styles.secondaryMetric}>
            <p style={styles.metricEyebrow}>Pessoas únicas alcançadas</p>
            <p style={styles.secondaryMetricValue}>{nf(data.reach)}</p>
            <p style={styles.secondaryMetricHelp}>
              É quantas pessoas diferentes viram suas campanhas durante a semana.
            </p>
          </div>
        </div>
      </section>

      {/* Resultados — só aparece se houver conversa/lead/compra */}
      {hasResults && (
        <section style={{ ...styles.section, paddingBottom: 80 }}>
          <div style={styles.container}>
            <h2 style={styles.sectionHeadDark}>O que veio dessas pessoas</h2>
            <div style={styles.resultCards}>
              {conv > 0 && (
                <ResultCard
                  label="Conversas iniciadas"
                  value={nf(conv)}
                  help="Pessoas que clicaram no anúncio e mandaram a primeira mensagem no WhatsApp."
                  big
                />
              )}
              {leads > 0 && (
                <ResultCard
                  label="Cadastros recebidos"
                  value={nf(leads)}
                  help="Pessoas que preencheram o formulário direto no Facebook/Instagram."
                />
              )}
              {purchases > 0 && (
                <ResultCard
                  label="Compras registradas"
                  value={nf(purchases)}
                  help="Pessoas que finalizaram compra após verem ou clicarem no anúncio."
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3 cards explicativos — fundo claro */}
      <section style={styles.sectionLight}>
        <div style={styles.container}>
          <h2 style={styles.sectionHeadLight}>Por dentro dos números</h2>
          <div style={styles.cards}>
            <ExplainCard
              label="Aparições do anúncio"
              value={nf(data.impressions)}
              help="Quantas vezes seu anúncio apareceu na tela. Uma mesma pessoa pode ter visto várias vezes."
            />
            <ExplainCard
              label="Cliques"
              value={nf(data.clicks)}
              help="Quantas pessoas se interessaram a ponto de clicar para saber mais."
            />
            <ExplainCard
              label="Taxa de interesse"
              value={`${ctrPct}%`}
              help={`De cada 100 pessoas que viram o anúncio, ${(data.ctr * 100).toFixed(1).replace('.', ',')} clicaram.`}
            />
          </div>
        </div>
      </section>

      {/* Em resumo */}
      <section style={{ ...styles.section, paddingTop: 64, paddingBottom: 64 }}>
        <div style={styles.container}>
          <div style={styles.resumo}>
            <div style={styles.resumoHead}>
              <span style={{
                ...styles.badge,
                ...(insight.good ? styles.badgeGood : styles.badgeNeutral),
              }}>
                {insight.tag}
              </span>
              <h2 style={styles.resumoTitle}>Em resumo</h2>
            </div>
            <p style={styles.resumoBody}>
              Esta semana investimos <strong style={{ color: COLORS.goldBright }}>{brl(data.spend_cents)}</strong> e
              levamos sua marca para <strong style={{ color: COLORS.text }}>{nf(data.reach)} pessoas diferentes</strong>.{' '}
              {data.clicks > 0 && (
                <>
                  Dessas, <strong style={{ color: COLORS.text }}>{nf(data.clicks)} pessoas</strong> clicaram para saber
                  mais sobre você (<strong style={{ color: COLORS.text }}>{ctrPct}%</strong> de interesse).{' '}
                </>
              )}
              {conv > 0 && (
                <>
                  E o mais importante: <strong style={{ color: COLORS.goldBright }}>{nf(conv)} {conv === 1 ? 'pessoa começou' : 'pessoas começaram'} uma conversa no WhatsApp</strong>{leads > 0 && <> e mais <strong style={{ color: COLORS.text }}>{nf(leads)} {leads === 1 ? 'cadastro foi' : 'cadastros foram'}</strong> recebidos</>}.{' '}
                </>
              )}
              {insight.frase}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.container}>
          <div style={styles.footerInner}>
            <p style={styles.footerLine}>Tem dúvida sobre algum número?</p>
            <p style={styles.footerLineStrong}>
              Fale com a equipe <span style={styles.gold}>SVI Company</span>.
            </p>
            <p style={styles.footerSmall}>
              Relatório gerado em{' '}
              {new Date(data.generated_at).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              })}
            </p>
          </div>
        </div>
      </footer>
    </div>
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
  ink3: '#2E2028',
  ink4: '#3A2A34',
  offWhite: '#F7F2E7',
  paper: '#FBF7EC',
  paper2: '#EEE5D1',
  text: '#F7F2E7',
  text2: '#DCD1B8',
  textM: '#A89B82',
  textMM: '#6E634F',
  textDark: '#1A1218',
  textDarkM: '#524437',
  green: '#4ABE7C',
  line: 'rgba(245,241,232,0.08)',
  line2: 'rgba(245,241,232,0.12)',
}

const globalCss = `
  .svi-r-root, .svi-r-root * { box-sizing: border-box; font-family: 'DM Sans', system-ui, -apple-system, sans-serif; }
  .svi-r-root ::selection { background: ${COLORS.gold}; color: ${COLORS.black}; }
`

const styles: Record<string, React.CSSProperties> = {
  root: {
    background: COLORS.ink,
    color: COLORS.text,
    minHeight: '100vh',
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  } as React.CSSProperties,
  container: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 24px',
  },
  topbar: {
    background: COLORS.black,
    borderBottom: `1px solid ${COLORS.line}`,
    padding: '18px 0',
  },
  topbarInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },
  brandSvi: {
    fontSize: 22,
    fontWeight: 700,
    color: COLORS.goldBright,
    letterSpacing: '-0.02em',
  },
  brandCompany: {
    fontSize: 13,
    fontWeight: 500,
    color: COLORS.text2,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  tag: {
    fontSize: 11,
    fontWeight: 500,
    color: COLORS.textM,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  section: {
    padding: '32px 0',
  },
  sectionLight: {
    background: COLORS.paper,
    color: COLORS.textDark,
    padding: '80px 0',
    borderTop: `1px solid ${COLORS.ink3}`,
    borderBottom: `1px solid ${COLORS.ink3}`,
  },
  heroCenter: {
    textAlign: 'center' as const,
    maxWidth: 760,
    margin: '0 auto',
  },
  heroOla: {
    fontSize: 16,
    color: COLORS.textM,
    marginBottom: 16,
    fontWeight: 500,
  },
  heroTitle: {
    fontSize: 'clamp(36px, 5vw, 60px)' as any,
    fontWeight: 600,
    letterSpacing: '-0.025em',
    lineHeight: 1.08,
    margin: '0 0 24px',
    color: COLORS.text,
  },
  heroDate: {
    fontSize: 15,
    color: COLORS.text2,
    fontWeight: 500,
  },
  gold: {
    background: `linear-gradient(135deg, ${COLORS.goldBright} 0%, ${COLORS.gold} 60%, ${COLORS.goldDark} 100%)`,
    WebkitBackgroundClip: 'text' as any,
    backgroundClip: 'text' as any,
    color: 'transparent',
  } as React.CSSProperties,
  heroMetric: {
    background: `linear-gradient(160deg, rgba(240,199,68,0.14) 0%, rgba(212,168,44,0.06) 50%, rgba(155,117,24,0.02) 100%)`,
    border: `1px solid rgba(240,199,68,0.25)`,
    borderRadius: 24,
    padding: '56px 32px',
    textAlign: 'center' as const,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  metricEyebrow: {
    fontSize: 12,
    color: COLORS.goldBright,
    fontWeight: 500,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  heroMetricValue: {
    fontSize: 'clamp(56px, 9vw, 96px)' as any,
    fontWeight: 700,
    color: COLORS.text,
    letterSpacing: '-0.03em',
    margin: 0,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums' as any,
  },
  heroMetricHelp: {
    fontSize: 15,
    color: COLORS.text2,
    maxWidth: 460,
    margin: '24px auto 0',
    lineHeight: 1.6,
  },
  secondaryMetric: {
    background: COLORS.ink2,
    border: `1px solid ${COLORS.line2}`,
    borderRadius: 24,
    padding: '48px 32px',
    textAlign: 'center' as const,
  },
  secondaryMetricValue: {
    fontSize: 'clamp(40px, 7vw, 64px)' as any,
    fontWeight: 700,
    color: COLORS.text,
    letterSpacing: '-0.025em',
    margin: 0,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums' as any,
  },
  secondaryMetricHelp: {
    fontSize: 14,
    color: COLORS.textM,
    maxWidth: 460,
    margin: '20px auto 0',
    lineHeight: 1.6,
  },
  sectionHeadLight: {
    fontSize: 12,
    color: COLORS.goldDark,
    fontWeight: 500,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    margin: '0 0 32px',
  },
  sectionHeadDark: {
    fontSize: 12,
    color: COLORS.goldBright,
    fontWeight: 500,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    margin: '0 0 32px',
  },
  resultCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  },
  resumo: {
    background: COLORS.ink2,
    border: `1px solid ${COLORS.line2}`,
    borderRadius: 24,
    padding: '40px 36px',
  },
  resumoHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap' as const,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    border: '1px solid',
  },
  badgeGood: {
    background: 'rgba(74,190,124,0.10)',
    color: COLORS.green,
    borderColor: 'rgba(74,190,124,0.30)',
  },
  badgeNeutral: {
    background: 'rgba(240,199,68,0.08)',
    color: COLORS.goldBright,
    borderColor: 'rgba(240,199,68,0.25)',
  },
  resumoTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: COLORS.text,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  resumoBody: {
    fontSize: 17,
    color: COLORS.text2,
    lineHeight: 1.7,
    margin: 0,
  },
  footer: {
    background: COLORS.black,
    borderTop: `1px solid ${COLORS.line}`,
    padding: '56px 0 40px',
  },
  footerInner: {
    textAlign: 'center' as const,
  },
  footerLine: {
    fontSize: 14,
    color: COLORS.textM,
    margin: '0 0 6px',
  },
  footerLineStrong: {
    fontSize: 15,
    color: COLORS.text,
    margin: '0 0 28px',
    fontWeight: 500,
  },
  footerSmall: {
    fontSize: 11,
    color: COLORS.textMM,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
}

function ExplainCard({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div style={cardStyles.card}>
      <p style={cardStyles.label}>{label}</p>
      <p style={cardStyles.value}>{value}</p>
      <p style={cardStyles.help}>{help}</p>
    </div>
  )
}

function ResultCard({ label, value, help, big }: { label: string; value: string; help: string; big?: boolean }) {
  return (
    <div style={{
      background: big
        ? `linear-gradient(160deg, rgba(240,199,68,0.16) 0%, rgba(212,168,44,0.06) 60%, rgba(155,117,24,0.02) 100%)`
        : COLORS.ink2,
      border: big
        ? `1px solid rgba(240,199,68,0.30)`
        : `1px solid ${COLORS.line2}`,
      borderRadius: 20,
      padding: '32px 24px',
      textAlign: 'center' as const,
    }}>
      <p style={{ ...cardStyles.label, color: big ? COLORS.goldBright : COLORS.textM }}>{label}</p>
      <p style={{
        fontSize: big ? 48 : 36,
        fontWeight: 700,
        color: COLORS.text,
        letterSpacing: '-0.025em',
        margin: '0 0 16px',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums' as any,
      }}>{value}</p>
      <p style={{ fontSize: 13, color: COLORS.text2, lineHeight: 1.6, margin: 0 }}>{help}</p>
    </div>
  )
}

const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    background: COLORS.paper2,
    border: `1px solid rgba(11,4,8,0.10)`,
    borderRadius: 20,
    padding: '28px 24px',
    color: COLORS.textDark,
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: COLORS.goldDark,
    margin: '0 0 12px',
  },
  value: {
    fontSize: 36,
    fontWeight: 700,
    color: COLORS.textDark,
    letterSpacing: '-0.02em',
    margin: '0 0 16px',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums' as any,
  },
  help: {
    fontSize: 13,
    color: COLORS.textDarkM,
    lineHeight: 1.6,
    margin: 0,
  },
}

function Loading() {
  return (
    <div style={{ ...styles.root, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 28, height: 28, border: `2px solid ${COLORS.gold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...styles.root, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{globalCss}</style>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: COLORS.text, margin: '0 0 12px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: COLORS.textM, lineHeight: 1.6 }}>{children}</p>
      </div>
    </div>
  )
}
