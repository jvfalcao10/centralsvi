import { useState, useMemo, useEffect } from 'react'
import opsData from '@/data/ops_clientes.json'
import {
  Search, ExternalLink, AlertTriangle, TrendingUp, Activity,
  DollarSign, Target, MessageSquare, Eye, ChevronDown, Image as ImageIcon,
  Zap, AlertCircle, ArrowRight, Calendar
} from 'lucide-react'

interface Campanha {
  id: string
  name: string
  objective: string
  daily_budget_cents: number | null
  lifetime_budget_cents: number | null
  start_time?: string
  meta_url: string
  spend_90d: number
  conv_90d: number
  ctr_90d: number
  freq_90d: number
}

interface Ad {
  id: string
  name: string
  campaign_id: string
  adset_id: string
  created_time?: string
  thumbnail_url: string | null
  image_url: string | null
  body: string
  title: string
  cta: string
  meta_url: string
}

interface Cliente {
  label: string
  id: string
  display: string
  vertical: string
  icone: string
  resp: string
  severidade: 'critical' | 'alto' | 'medio' | 'ok'
  account_url: string
  account_status: number
  financeiro: {
    saldo_display: string
    balance_cents: number
    spend_cap_cents: number | null
    amount_spent_cents: number
    cap_restante_cents: number | null
    runway_days: number | null
    daily_spend_7d_cents: number
  }
  estado_atual: {
    campanhas_ativas: number
    adsets_ativos: number
    ads_ativos: number
  }
  spend_periodos: {
    d7_cents: number
    d30_cents: number
    d90_cents: number
  }
  snapshot_30d: {
    reach: number
    clicks: number
    ctr: number
    freq: number
    conv: number
    first_reply: number
    d2: number
    d5: number
    leads: number
    cpmsg_cents: number | null
    taxa_resposta: number | null
    taxa_d2: number | null
  }
  campanhas: Campanha[]
  ads: Ad[]
}

const CLIENTES = Object.values(opsData) as Cliente[]

const SEV_RANK: Record<string, number> = { critical: 0, alto: 1, medio: 2, ok: 3 }
const SEV_LABEL: Record<string, string> = { critical: 'CRÍTICO', alto: 'ALTO', medio: 'MÉDIO', ok: 'OK' }

const OBJ_PT: Record<string, string> = {
  OUTCOME_ENGAGEMENT: 'Mensagens',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Vendas',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_AWARENESS: 'Alcance',
  LINK_CLICKS: 'Cliques',
  MESSAGES: 'Mensagens',
  REACH: 'Alcance',
  VIDEO_VIEWS: 'Vídeo',
}

function brl(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function nf(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('pt-BR')
}

function detectErros(c: Cliente): { tipo: string; msg: string; sev: 'critical' | 'warn' | 'info' }[] {
  const erros: { tipo: string; msg: string; sev: 'critical' | 'warn' | 'info' }[] = []
  const f = c.financeiro
  const s = c.snapshot_30d

  // Financeiro
  if (f.runway_days !== null && f.runway_days < 3) {
    erros.push({ tipo: 'Financeiro', msg: `Conta para em ${f.runway_days}d (cap restante ${brl(f.cap_restante_cents)}). Reabastecer URGENTE.`, sev: 'critical' })
  } else if (f.runway_days !== null && f.runway_days < 14) {
    erros.push({ tipo: 'Financeiro', msg: `Cap restante R$ ${(f.cap_restante_cents! / 100).toFixed(0)} = ~${f.runway_days}d. Subir spend cap esta semana.`, sev: 'warn' })
  }
  if (c.financeiro.balance_cents === 0 && f.daily_spend_7d_cents === 0) {
    erros.push({ tipo: 'Conta', msg: 'Saldo R$ 0,00 e zero gasto 7d. Conta operacionalmente parada.', sev: 'critical' })
  }

  // Performance
  if (c.estado_atual.ads_ativos === 0 && f.daily_spend_7d_cents === 0) {
    erros.push({ tipo: 'Ativos', msg: '0 anúncios ativos. Sem nada rodando hoje.', sev: 'critical' })
  } else if (c.estado_atual.ads_ativos === 0) {
    erros.push({ tipo: 'Ativos', msg: 'Gastou nos últimos 7d mas hoje 0 anúncios ativos. Investigar pausas.', sev: 'warn' })
  } else if (c.estado_atual.ads_ativos < 3) {
    erros.push({ tipo: 'Concentração', msg: `Apenas ${c.estado_atual.ads_ativos} anúncios ativos. Concentração de risco se entrar em fadiga.`, sev: 'warn' })
  }

  // Pulverização
  if (c.estado_atual.campanhas_ativas > 8) {
    erros.push({ tipo: 'Pulverização', msg: `${c.estado_atual.campanhas_ativas} campanhas ativas em paralelo. Consolidar em 3-5 estruturas.`, sev: 'warn' })
  }

  // Frequência
  if (s.freq > 5) {
    erros.push({ tipo: 'Saturação', msg: `Frequência ${s.freq.toFixed(1)}x = mesma pessoa vendo o anúncio ${s.freq.toFixed(1)} vezes. Renovar criativos.`, sev: 'warn' })
  } else if (s.freq > 7) {
    erros.push({ tipo: 'Saturação', msg: `Frequência ${s.freq.toFixed(1)}x = saturação severa. Refresh urgente ou troca de público.`, sev: 'critical' })
  }

  // Conversa sem resposta
  if (s.taxa_resposta !== null && s.taxa_resposta < 70 && s.conv > 5) {
    const perdidas = s.conv - s.first_reply
    erros.push({ tipo: 'Atendimento', msg: `${perdidas} de ${s.conv} conversas sem resposta da secretária (${s.taxa_resposta}%). Maior vazamento.`, sev: 'warn' })
  }

  // CPmsg alto
  if (s.cpmsg_cents !== null && s.cpmsg_cents > 5000 && s.conv > 3) {
    erros.push({ tipo: 'Eficiência', msg: `CPmsg ${brl(s.cpmsg_cents)} acima do esperado. Auditar criativos e adsets de pior performance.`, sev: 'warn' })
  }

  // Sem purchases
  if (c.spend_periodos.d30_cents > 50000 && s.conv > 20 && c.snapshot_30d.leads === 0) {
    erros.push({ tipo: 'Tracking', msg: 'Sem leads/purchases registrados em 30 dias. CAPI não configurado = algoritmo cego.', sev: 'warn' })
  }

  return erros
}

function gerarProximosPassos(c: Cliente): { acao: string; quando: string; impacto: string }[] {
  const passos: { acao: string; quando: string; impacto: string }[] = []
  const f = c.financeiro
  const s = c.snapshot_30d

  // Crítico financeiro
  if (f.runway_days !== null && f.runway_days < 5) {
    passos.push({
      acao: 'Subir spend cap + acionar cliente para reabastecer cartão',
      quando: 'Hoje',
      impacto: 'Não pausa entrega da semana',
    })
  }

  // Sem ativos
  if (c.estado_atual.ads_ativos === 0) {
    passos.push({
      acao: 'Auditar pausas: identificar por que tudo foi pausado e priorizar 3 ads pra reativar',
      quando: 'Esta semana',
      impacto: 'Recoloca a conta operando',
    })
  }

  // Freq alta
  if (s.freq > 5 && c.estado_atual.ads_ativos > 0) {
    passos.push({
      acao: 'Briefing pro José: 3 criativos novos (refresh)',
      quando: 'Esta semana',
      impacto: 'Reduz freq e renova CTR',
    })
  }

  // Pulverização
  if (c.estado_atual.campanhas_ativas > 6) {
    passos.push({
      acao: `Auditar ${c.estado_atual.campanhas_ativas} campanhas ativas e consolidar em 3-5 estruturas`,
      quando: 'Esta semana',
      impacto: 'Algoritmo tem mais dados por adset = aprende melhor',
    })
  }

  // Atendimento
  if (s.taxa_resposta !== null && s.taxa_resposta < 70 && s.conv > 5) {
    passos.push({
      acao: 'Conversa com cliente sobre SLA de resposta no WhatsApp',
      quando: 'Esta semana',
      impacto: 'Cada 10% de melhora = ~' + Math.round((s.conv * 0.1)) + ' conversas a mais salvas',
    })
  }

  // Sem CAPI
  if (c.spend_periodos.d30_cents > 50000 && c.snapshot_30d.leads === 0) {
    passos.push({
      acao: 'Configurar Conversions API (Lead + Purchase) via n8n',
      quando: 'Próximas 2 semanas',
      impacto: 'Algoritmo passa a otimizar pra resultado real, não proxy',
    })
  }

  // Nenhum problema detectado: escalar
  if (passos.length === 0) {
    passos.push({
      acao: `Conta saudável. Avaliar escalada de budget (${brl(f.daily_spend_7d_cents)} → ${brl(Math.round(f.daily_spend_7d_cents * 1.3))})`,
      quando: 'Esta semana',
      impacto: 'Crescimento controlado mantendo eficiência',
    })
  }

  return passos
}

export default function TrafegoPlanoSemana() {
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  const filtered = useMemo(() => {
    let list = CLIENTES.slice()
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.display.toLowerCase().includes(q) ||
        c.vertical.toLowerCase().includes(q)
      )
    }
    if (sevFilter !== 'all') list = list.filter(c => c.severidade === sevFilter)
    list.sort((a, b) => (SEV_RANK[a.severidade] ?? 9) - (SEV_RANK[b.severidade] ?? 9))
    return list
  }, [search, sevFilter])

  const totals = useMemo(() => {
    const r = {
      total: CLIENTES.length,
      critical: 0, alto: 0, medio: 0, ok: 0,
      ativos: 0, conv30: 0, spend7: 0,
    }
    CLIENTES.forEach(c => {
      r[c.severidade]++
      r.ativos += c.estado_atual.ads_ativos
      r.conv30 += c.snapshot_30d.conv
      r.spend7 += c.financeiro.daily_spend_7d_cents * 7
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
            <div style={styles.versionTag}>Dados ao vivo · 07/06/2026</div>
          </div>

          <div style={styles.heroBody}>
            <div style={styles.heroBadge}>
              <span style={styles.heroBadgeDot} />
              <span>Central de Operações de Tráfego</span>
            </div>

            <h1 style={styles.heroTitle}>
              16 contas Meta Ads<br />
              <span style={styles.heroHighlight}>operação em tempo real</span>
            </h1>

            <p style={styles.heroPeriod}>O que tá rodando, o que tá errado, o que fazer agora</p>

            <div style={styles.heroStats}>
              <Stat num="16" label="Clientes" gold />
              <Divider />
              <Stat num={String(totals.ativos)} label="Ads ativos" />
              <Divider />
              <Stat num={nf(totals.conv30)} label="Conv 30d" />
              <Divider />
              <Stat num={brl(totals.spend7)} label="Spend 7d" gold />
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
                placeholder="Buscar cliente, vertical..."
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
      <section style={{ ...styles.section, paddingTop: 40 }}>
        <div style={styles.container}>
          <div style={styles.cardsGrid}>
            {filtered.map((c, i) => (
              <ClienteCard
                key={c.label}
                c={c}
                index={i}
                expanded={expanded === c.label}
                onToggle={() => setExpanded(expanded === c.label ? null : c.label)}
              />
            ))}
          </div>
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
              Dados ao vivo da Meta Ads · Última atualização 07/06/2026 · Confidencial
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

function Divider() { return <div style={styles.statDivider} /> }

function SevPill({ active, onClick, label, count, sev }: {
  active: boolean; onClick: () => void; label: string; count: number; sev?: string
}) {
  const dotColor: Record<string, string> = {
    critical: '#E0726A', alto: '#E89A1C', medio: COLORS.goldBright,
  }
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.sevPill,
        background: active ? 'rgba(240,199,68,0.14)' : 'rgba(247,242,231,0.04)',
        borderColor: active ? 'rgba(240,199,68,0.4)' : 'var(--line-2)',
        color: active ? COLORS.goldLight : COLORS.text2,
      }}
    >
      {sev && <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor[sev] || COLORS.textM }} />}
      {label}
      <span style={styles.sevPillCount}>{count}</span>
    </button>
  )
}

function ClienteCard({ c, index, expanded, onToggle }: {
  c: Cliente; index: number; expanded: boolean; onToggle: () => void
}) {
  const sevColors: Record<string, { fg: string; bg: string; border: string }> = {
    critical: { fg: '#E0726A', bg: 'rgba(224,114,106,0.10)', border: 'rgba(224,114,106,0.3)' },
    alto: { fg: '#E89A1C', bg: 'rgba(232,154,28,0.10)', border: 'rgba(232,154,28,0.3)' },
    medio: { fg: COLORS.goldDark, bg: 'rgba(240,199,68,0.12)', border: 'rgba(240,199,68,0.3)' },
    ok: { fg: COLORS.green, bg: 'rgba(74,190,124,0.10)', border: 'rgba(74,190,124,0.3)' },
  }
  const sv = sevColors[c.severidade] || sevColors.medio
  const erros = detectErros(c)
  const passos = gerarProximosPassos(c)

  return (
    <article style={{ ...styles.card, borderColor: expanded ? 'rgba(212,168,44,0.4)' : 'var(--line-2)' }}>
      {/* Header */}
      <div style={styles.cardHeader} onClick={onToggle}>
        <div style={styles.cardHeaderLeft}>
          <div style={styles.cardNumber}>{String(index + 1).padStart(2, '0')}</div>
          <div style={{ flex: 1 }}>
            <div style={styles.cardTitleRow}>
              <span style={styles.cardIcon}>{c.icone}</span>
              <h2 style={styles.cardTitle}>{c.display}</h2>
              <span style={{ ...styles.sevBadge, background: sv.bg, color: sv.fg, borderColor: sv.border }}>
                {SEV_LABEL[c.severidade]}
              </span>
              {erros.length > 0 && (
                <span style={styles.errosBadge}>
                  <AlertCircle style={{ width: 11, height: 11 }} />
                  {erros.length} alerta{erros.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={styles.cardMeta}>
              <span>{c.vertical}</span>
              <span style={styles.metaSep}>·</span>
              <span>{c.resp}</span>
            </div>
          </div>
        </div>
        <div style={styles.cardHeaderRight}>
          <a
            href={c.account_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={styles.metaBtn}
          >
            Abrir no Meta <ExternalLink style={{ width: 11, height: 11 }} />
          </a>
          <ChevronDown style={{
            ...styles.chevron,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </div>
      </div>

      {/* KPIs sempre visíveis */}
      <div style={styles.kpiRow}>
        <KpiBox icon={DollarSign} label="Saldo" value={c.financeiro.saldo_display || '—'} tone={c.financeiro.runway_days !== null && c.financeiro.runway_days < 7 ? 'critical' : 'default'} />
        <KpiBox icon={Activity} label="Spend 7d" value={brl(c.financeiro.daily_spend_7d_cents * 7)} />
        <KpiBox icon={MessageSquare} label="Conv 30d" value={nf(c.snapshot_30d.conv)} highlight />
        <KpiBox icon={Target} label="CPmsg 30d" value={brl(c.snapshot_30d.cpmsg_cents)} />
        <KpiBox icon={Zap} label="Ads ativos" value={String(c.estado_atual.ads_ativos)} tone={c.estado_atual.ads_ativos === 0 ? 'critical' : 'default'} />
        <KpiBox icon={TrendingUp} label="Freq 30d" value={c.snapshot_30d.freq.toFixed(2) + 'x'} tone={c.snapshot_30d.freq > 5 ? 'warn' : 'default'} />
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={styles.cardExpanded}>
          {/* RODANDO AGORA */}
          <SectionTitle title="Rodando agora" icon={Activity} />
          <div style={styles.subTitle}>
            {c.estado_atual.campanhas_ativas} campanha{c.estado_atual.campanhas_ativas !== 1 ? 's' : ''} ·{' '}
            {c.estado_atual.adsets_ativos} adset{c.estado_atual.adsets_ativos !== 1 ? 's' : ''} ·{' '}
            {c.estado_atual.ads_ativos} ad{c.estado_atual.ads_ativos !== 1 ? 's' : ''}
          </div>

          {c.campanhas.length > 0 && (
            <div style={styles.campanhasList}>
              {c.campanhas.map(camp => (
                <a key={camp.id} href={camp.meta_url} target="_blank" rel="noreferrer" style={styles.campanhaRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.campanhaName}>{camp.name}</div>
                    <div style={styles.campanhaMeta}>
                      <span style={styles.objBadge}>{OBJ_PT[camp.objective] || camp.objective}</span>
                      {camp.daily_budget_cents && (
                        <span><strong>{brl(camp.daily_budget_cents)}</strong>/dia</span>
                      )}
                      {camp.spend_90d > 0 && (
                        <span>{brl(Math.round(camp.spend_90d * 100))} em 90d · {camp.conv_90d} conv</span>
                      )}
                    </div>
                  </div>
                  <ExternalLink style={{ width: 13, height: 13, color: COLORS.textMM, flexShrink: 0 }} />
                </a>
              ))}
            </div>
          )}

          {c.ads.length > 0 && (
            <>
              <div style={{ ...styles.subTitle, marginTop: 16, marginBottom: 8 }}>
                <ImageIcon style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                Criativos ativos
              </div>
              <div style={styles.adsGrid}>
                {c.ads.map(ad => (
                  <a key={ad.id} href={ad.meta_url} target="_blank" rel="noreferrer" style={styles.adCard}>
                    {ad.thumbnail_url || ad.image_url ? (
                      <div style={styles.adImg}>
                        <img src={ad.image_url || ad.thumbnail_url!} alt={ad.name} style={styles.adImgInner} />
                      </div>
                    ) : (
                      <div style={{ ...styles.adImg, ...styles.adImgPlaceholder }}>
                        <ImageIcon style={{ width: 24, height: 24, opacity: 0.4 }} />
                      </div>
                    )}
                    <div style={styles.adInfo}>
                      <div style={styles.adName}>{ad.name}</div>
                      {ad.title && <div style={styles.adTitle}>{ad.title}</div>}
                      {ad.body && <div style={styles.adBody}>{ad.body.substring(0, 180)}{ad.body.length > 180 ? '...' : ''}</div>}
                      <div style={styles.adFooter}>
                        {ad.cta && <span style={styles.ctaBadge}>{ad.cta.replace(/_/g, ' ')}</span>}
                        <span style={styles.adLink}>Ver no Meta <ExternalLink style={{ width: 10, height: 10 }} /></span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          {/* ÚLTIMOS 30 DIAS */}
          <SectionTitle title="Últimos 30 dias" icon={Calendar} marginTop={28} />
          <div style={styles.funilGrid}>
            <FunilStep label="Alcance" value={nf(c.snapshot_30d.reach)} />
            <FunilArrow />
            <FunilStep label="Cliques" value={nf(c.snapshot_30d.clicks)} />
            <FunilArrow />
            <FunilStep label="Conversas" value={nf(c.snapshot_30d.conv)} highlight />
            <FunilArrow />
            <FunilStep label="1ª resposta" value={nf(c.snapshot_30d.first_reply)} suffix={c.snapshot_30d.taxa_resposta !== null ? `(${c.snapshot_30d.taxa_resposta}%)` : ''} />
            <FunilArrow />
            <FunilStep label="Voltou (D2)" value={nf(c.snapshot_30d.d2)} suffix={c.snapshot_30d.taxa_d2 !== null ? `(${c.snapshot_30d.taxa_d2}%)` : ''} />
          </div>

          {/* ERROS / DIAGNÓSTICO */}
          {erros.length > 0 && (
            <>
              <SectionTitle title="Problemas detectados" icon={AlertTriangle} marginTop={28} />
              <div style={styles.errosList}>
                {erros.map((e, i) => {
                  const colorMap: Record<string, { bg: string; border: string; fg: string }> = {
                    critical: { bg: 'rgba(224,114,106,0.08)', border: 'rgba(224,114,106,0.3)', fg: '#B53F36' },
                    warn: { bg: 'rgba(232,154,28,0.08)', border: 'rgba(232,154,28,0.3)', fg: '#8C5B0F' },
                    info: { bg: 'rgba(212,168,44,0.08)', border: 'rgba(212,168,44,0.3)', fg: COLORS.goldDark },
                  }
                  const col = colorMap[e.sev]
                  return (
                    <div key={i} style={{ ...styles.erroItem, background: col.bg, borderColor: col.border }}>
                      <div style={{ ...styles.erroTipo, color: col.fg }}>{e.tipo}</div>
                      <div style={styles.erroMsg}>{e.msg}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* PRÓXIMOS PASSOS */}
          <SectionTitle title="Próximos passos" icon={ArrowRight} marginTop={28} />
          <div style={styles.passosList}>
            {passos.map((p, i) => (
              <div key={i} style={styles.passoItem}>
                <div style={styles.passoNum}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={styles.passoAcao}>{p.acao}</div>
                  <div style={styles.passoMeta}>
                    <span><Calendar style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} />{p.quando}</span>
                    <span style={styles.passoImpacto}>{p.impacto}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function SectionTitle({ title, icon: Icon, marginTop }: { title: string; icon: any; marginTop?: number }) {
  return (
    <div style={{ ...styles.sectionTitle, marginTop }}>
      <Icon style={{ width: 14, height: 14, color: COLORS.goldDark }} />
      {title}
    </div>
  )
}

function KpiBox({ icon: Icon, label, value, tone, highlight }: {
  icon: any; label: string; value: string; tone?: 'default' | 'critical' | 'warn'; highlight?: boolean
}) {
  const toneStyle: React.CSSProperties = {}
  if (tone === 'critical') {
    toneStyle.borderColor = 'rgba(224,114,106,0.4)'
    toneStyle.background = 'rgba(224,114,106,0.06)'
  } else if (tone === 'warn') {
    toneStyle.borderColor = 'rgba(232,154,28,0.4)'
    toneStyle.background = 'rgba(232,154,28,0.06)'
  } else if (highlight) {
    toneStyle.borderColor = 'rgba(212,168,44,0.35)'
    toneStyle.background = 'linear-gradient(135deg, rgba(240,199,68,0.10) 0%, rgba(212,168,44,0.04) 100%)'
  }
  return (
    <div style={{ ...styles.kpiBox, ...toneStyle }}>
      <div style={styles.kpiLabelRow}>
        <Icon style={{ width: 12, height: 12, opacity: 0.5 }} />
        <span style={styles.kpiLabel}>{label}</span>
      </div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  )
}

function FunilStep({ label, value, highlight, suffix }: { label: string; value: string; highlight?: boolean; suffix?: string }) {
  return (
    <div style={{ ...styles.funilStep, ...(highlight ? styles.funilStepHighlight : {}) }}>
      <div style={styles.funilLabel}>{label}</div>
      <div style={styles.funilValue}>{value}</div>
      {suffix && <div style={styles.funilSuffix}>{suffix}</div>}
    </div>
  )
}

function FunilArrow() {
  return <ArrowRight style={{ width: 14, height: 14, color: COLORS.textM, flexShrink: 0, alignSelf: 'center' }} />
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
}

const globalCss = `
  :root {
    --gold: ${COLORS.gold};
    --gold-bright: ${COLORS.goldBright};
    --gold-light: ${COLORS.goldLight};
    --gold-dark: ${COLORS.goldDark};
    --line: rgba(245,241,232,0.08);
    --line-2: rgba(245,241,232,0.12);
  }
  .svi-ops-page, .svi-ops-page * { font-family: 'DM Sans', system-ui, sans-serif; }
  .svi-ops-page input:focus { outline: none; border-color: rgba(240,199,68,0.4); }
  .svi-ops-page button, .svi-ops-page a { cursor: pointer; }
  .svi-ops-page ::selection { background: ${COLORS.gold}; color: ${COLORS.black}; }
  .svi-ops-page img { display: block; }
`

const styles: Record<string, React.CSSProperties> = {
  root: { background: COLORS.paper, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: COLORS.textDark },

  hero: {
    position: 'relative',
    background: `
      radial-gradient(900px 500px at 20% 10%, rgba(232,154,28,0.18), transparent 55%),
      radial-gradient(800px 600px at 80% 60%, rgba(212,168,44,0.14), transparent 55%),
      linear-gradient(180deg, ${COLORS.black} 0%, ${COLORS.black2} 100%)
    `,
    color: COLORS.text,
    padding: '80px 24px 64px',
    overflow: 'hidden',
    borderBottom: `5px solid transparent`,
    borderImage: `linear-gradient(90deg, ${COLORS.goldBright}, ${COLORS.gold}, ${COLORS.goldDark}, ${COLORS.gold}, ${COLORS.goldBright}) 1`,
  },
  gridBg: {
    position: 'absolute', inset: 0,
    backgroundImage: `linear-gradient(rgba(212,168,44,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,44,0.04) 1px, transparent 1px)`,
    backgroundSize: '80px 80px',
    maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
    WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
    pointerEvents: 'none',
  },
  heroContent: { position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto' },
  heroNav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 },
  brand: { display: 'flex', alignItems: 'baseline', gap: 8 },
  brandMark: { fontSize: 26, fontWeight: 700, color: COLORS.goldBright, letterSpacing: '-0.04em', lineHeight: 1 },
  brandSub: { fontSize: 10, fontWeight: 500, color: COLORS.text2, letterSpacing: '0.25em', textTransform: 'uppercase' },
  versionTag: { fontSize: 10, color: COLORS.textM, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(245,241,232,0.12)', borderRadius: 999 },

  heroBody: { maxWidth: 920 },
  heroBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 18px',
    background: 'linear-gradient(135deg, rgba(240,199,68,0.12), rgba(212,168,44,0.06))',
    border: '1px solid rgba(240,199,68,0.3)',
    borderRadius: 999,
    color: COLORS.goldLight,
    fontSize: 11, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase',
    marginBottom: 28,
  },
  heroBadgeDot: { width: 6, height: 6, background: COLORS.goldBright, borderRadius: '50%' },
  heroTitle: { fontSize: 'clamp(40px, 5.5vw, 68px)' as any, fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.035em', color: COLORS.text, marginBottom: 18 },
  heroHighlight: {
    background: `linear-gradient(110deg, ${COLORS.goldLight} 10%, ${COLORS.goldBright} 45%, ${COLORS.amber} 85%)`,
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  },
  heroPeriod: { fontSize: 16, color: COLORS.text2, marginBottom: 28, fontWeight: 400 },

  heroStats: {
    display: 'inline-flex', alignItems: 'center', gap: 28,
    padding: '22px 32px',
    background: 'rgba(247,242,231,0.04)',
    border: '1px solid rgba(245,241,232,0.12)',
    borderRadius: 14,
    flexWrap: 'wrap',
  },
  stat: { textAlign: 'left' },
  statNum: { fontSize: 28, fontWeight: 600, color: COLORS.text, lineHeight: 1, marginBottom: 5, letterSpacing: '-0.02em' },
  statNumGold: {
    background: `linear-gradient(120deg, ${COLORS.goldBright}, ${COLORS.amber})`,
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  },
  statLabel: { fontSize: 9.5, color: COLORS.textM, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 },
  statDivider: { width: 1, height: 32, background: `linear-gradient(180deg, transparent, rgba(212,168,44,0.3), transparent)` },

  filterBar: { background: COLORS.ink, borderBottom: `1px solid var(--line-2)`, padding: '18px 0', position: 'sticky', top: 0, zIndex: 10 },
  container: { maxWidth: 1280, margin: '0 auto', padding: '0 24px' },
  filterRow: { display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' },
  searchWrap: { position: 'relative', flex: '1 1 280px', maxWidth: 420 },
  searchIcon: { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: COLORS.textM, pointerEvents: 'none' },
  searchInput: { width: '100%', padding: '9px 14px 9px 38px', background: 'rgba(247,242,231,0.06)', border: '1px solid var(--line-2)', borderRadius: 10, color: COLORS.text, fontSize: 13.5, fontFamily: 'inherit' },
  sevPills: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  sevPill: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', border: '1px solid', borderRadius: 999, fontSize: 11.5, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' as const },
  sevPillCount: { padding: '1px 6px', background: 'rgba(247,242,231,0.10)', borderRadius: 999, fontSize: 9.5, fontWeight: 600 },

  section: { padding: '36px 0' },
  cardsGrid: { display: 'flex', flexDirection: 'column', gap: 14 },

  card: { background: '#FFFEFB', border: '1px solid var(--line-2)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,6,8,0.04)', transition: 'all 0.2s' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '18px 22px', cursor: 'pointer' as const },
  cardHeaderLeft: { display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 },
  cardNumber: { fontSize: 20, fontWeight: 700, color: COLORS.goldDark, letterSpacing: '-0.02em', minWidth: 36 },
  cardTitleRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' },
  cardIcon: { fontSize: 20 },
  cardTitle: { fontSize: 17, fontWeight: 600, color: COLORS.ink, letterSpacing: '-0.02em', margin: 0 },
  sevBadge: { display: 'inline-block', padding: '2.5px 9px', border: '1px solid', borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' },
  errosBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(232,154,28,0.12)', color: '#8C5B0F', border: '1px solid rgba(232,154,28,0.3)', borderRadius: 999, fontSize: 10, fontWeight: 600 },
  cardMeta: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: COLORS.textMM, flexWrap: 'wrap' },
  metaSep: { opacity: 0.4 },
  cardHeaderRight: { display: 'flex', alignItems: 'center', gap: 12 },
  metaBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(212,168,44,0.08)', border: '1px solid rgba(212,168,44,0.25)', borderRadius: 999, fontSize: 11, color: COLORS.goldDark, fontWeight: 500, textDecoration: 'none' },
  chevron: { width: 19, height: 19, color: COLORS.textMM, transition: 'transform 0.2s' },

  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: '0 22px 16px' },
  kpiBox: { padding: '10px 12px', background: 'rgba(251,247,236,0.6)', border: '1px solid rgba(212,168,44,0.15)', borderRadius: 9 },
  kpiLabelRow: { display: 'flex', alignItems: 'center', gap: 5, color: COLORS.textMM, marginBottom: 4 },
  kpiLabel: { fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  kpiValue: { fontSize: 14, fontWeight: 600, color: COLORS.ink, lineHeight: 1.3 },

  cardExpanded: { borderTop: '1px solid var(--line-2)', padding: '20px 22px 24px', background: 'linear-gradient(180deg, rgba(251,247,236,0.4) 0%, transparent 100%)' },

  sectionTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, color: COLORS.goldDark, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 },
  subTitle: { fontSize: 11.5, color: COLORS.textMM, marginBottom: 10 },

  campanhasList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 },
  campanhaRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(212,168,44,0.18)', borderRadius: 9, textDecoration: 'none', color: 'inherit', transition: 'all 0.15s' },
  campanhaName: { fontSize: 12.5, color: COLORS.ink, fontWeight: 500, marginBottom: 3, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  campanhaMeta: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: COLORS.textMM, flexWrap: 'wrap' },
  objBadge: { display: 'inline-block', padding: '2px 7px', background: 'rgba(212,168,44,0.12)', border: '1px solid rgba(212,168,44,0.3)', color: COLORS.goldDark, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em', borderRadius: 4, textTransform: 'uppercase' as const },

  adsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 },
  adCard: { display: 'flex', flexDirection: 'column', background: '#FFFEFB', border: '1px solid rgba(212,168,44,0.2)', borderRadius: 10, overflow: 'hidden', textDecoration: 'none', color: 'inherit', transition: 'all 0.15s' },
  adImg: { width: '100%', aspectRatio: '1', background: '#F0EBDA', overflow: 'hidden' },
  adImgInner: { width: '100%', height: '100%', objectFit: 'cover' as const },
  adImgPlaceholder: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMM },
  adInfo: { padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' },
  adName: { fontSize: 11.5, fontWeight: 600, color: COLORS.ink, marginBottom: 4, lineHeight: 1.3 },
  adTitle: { fontSize: 10.5, color: COLORS.goldDark, fontWeight: 500, marginBottom: 4, lineHeight: 1.3 },
  adBody: { fontSize: 10, color: '#524437', lineHeight: 1.45, marginBottom: 8, flex: 1 },
  adFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 'auto' },
  ctaBadge: { fontSize: 8.5, padding: '2px 6px', background: 'rgba(212,168,44,0.1)', border: '1px solid rgba(212,168,44,0.25)', borderRadius: 4, color: COLORS.goldDark, fontWeight: 600, letterSpacing: '0.04em' },
  adLink: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: COLORS.textMM },

  funilGrid: { display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap' },
  funilStep: { flex: '1 1 110px', padding: '10px 12px', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(212,168,44,0.15)', borderRadius: 8, textAlign: 'center' as const },
  funilStepHighlight: { background: 'linear-gradient(135deg, rgba(240,199,68,0.12), rgba(212,168,44,0.04))', borderColor: 'rgba(212,168,44,0.4)' },
  funilLabel: { fontSize: 9, color: COLORS.textMM, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4, fontWeight: 600 },
  funilValue: { fontSize: 18, fontWeight: 700, color: COLORS.ink, letterSpacing: '-0.02em' },
  funilSuffix: { fontSize: 10, color: COLORS.textMM, marginTop: 2 },

  errosList: { display: 'flex', flexDirection: 'column', gap: 8 },
  erroItem: { padding: '11px 14px', border: '1px solid', borderRadius: 9 },
  erroTipo: { fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 3 },
  erroMsg: { fontSize: 12.5, color: '#1A1218', lineHeight: 1.5 },

  passosList: { display: 'flex', flexDirection: 'column', gap: 8 },
  passoItem: { display: 'flex', gap: 11, padding: '11px 14px', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(212,168,44,0.2)', borderRadius: 9, alignItems: 'flex-start' },
  passoNum: { width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.goldBright}, ${COLORS.amber})`, color: COLORS.black, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  passoAcao: { fontSize: 12.5, color: COLORS.ink, fontWeight: 500, lineHeight: 1.4, marginBottom: 4 },
  passoMeta: { display: 'flex', gap: 12, fontSize: 10.5, color: COLORS.textMM, flexWrap: 'wrap' },
  passoImpacto: { color: '#2A6F44', fontStyle: 'italic' as const },

  footer: { background: COLORS.black, color: COLORS.text, padding: '32px 0', marginTop: 40, borderTop: `1px solid var(--line-2)` },
  footerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
  footerNote: { fontSize: 11, color: COLORS.textMM, letterSpacing: '0.04em' },
}
