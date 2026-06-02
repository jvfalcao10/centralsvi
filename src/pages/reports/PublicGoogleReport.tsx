import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react'

type Metric = { key: string; label: string; current: number | null; previous: number | null; delta_pct: number | null; unit?: string }
type Module = { titulo: string; valor: string; delta_pct: number | null; legenda: string; image_url: string }
type Ponto = { tipo: 'gargalo' | 'oportunidade'; titulo: string; texto: string }
type Acao = { titulo: string; texto: string }
type Analysis = {
  resumo_cliente?: string
  destaque?: string
  modules?: Module[]
  diagnostico?: { pontos?: Ponto[]; acoes?: Acao[] }
}
type Report = {
  slug: string
  client_name: string
  period_label: string
  metrics: Metric[]
  analysis: Analysis
  review_messages: string
}

const CSS = `
.svir-root{--gold:#D4A82C;--gold-bright:#F0C744;--gold-light:#FDEBA8;--gold-dark:#9B7518;--amber:#E89A1C;--black:#0A0608;--black-2:#120B0F;--ink:#1A1218;--ink-2:#241820;--ink-3:#2E2028;--text:#F7F2E7;--text-2:#DCD1B8;--text-m:#A89B82;--text-mm:#6E634F;--green:#4ABE7C;--red:#E0726A;--line:rgba(245,241,232,0.08);--line-2:rgba(245,241,232,0.12);
  min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.6;
  background:radial-gradient(700px 380px at 15% 0%,rgba(232,154,28,0.16),transparent 55%),radial-gradient(700px 460px at 90% 26%,rgba(212,168,44,0.12),transparent 55%),linear-gradient(180deg,var(--black) 0%,var(--black-2) 100%);background-attachment:fixed;}
.svir-wrap{max-width:640px;margin:0 auto;padding:44px 20px 72px;}
.svir-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:999px;background:linear-gradient(135deg,rgba(240,199,68,0.12),rgba(212,168,44,0.06));border:1px solid rgba(240,199,68,0.25);color:var(--gold-light);font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;}
.svir-title{font-size:clamp(28px,7vw,44px);font-weight:600;letter-spacing:-0.03em;line-height:1.04;margin:16px 0 4px;}
.svir-period{color:var(--text-m);font-size:14px;}
.svir-hl{background:linear-gradient(110deg,var(--gold-light) 10%,var(--gold-bright) 50%,var(--amber) 90%);-webkit-background-clip:text;background-clip:text;color:transparent;}
.svir-destaque{margin-top:22px;padding:18px 20px;border-radius:18px;background:linear-gradient(135deg,rgba(240,199,68,0.13),rgba(212,168,44,0.05));border:1px solid rgba(240,199,68,0.22);box-shadow:0 0 40px rgba(240,199,68,0.08),inset 0 1px 0 rgba(255,255,255,0.04);}
.svir-destaque p{font-size:17px;font-weight:500;color:var(--gold-light);letter-spacing:-0.01em;}
.svir-h2{font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--gold-bright);margin:30px 0 12px;}
.svir-metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.svir-metric{position:relative;overflow:hidden;background:linear-gradient(165deg,var(--ink-2) 0%,var(--ink) 100%);border:1px solid rgba(212,168,44,0.14);border-radius:18px;padding:18px 18px 16px;box-shadow:0 14px 34px -18px rgba(0,0,0,0.6);}
.svir-metric::before{content:'';position:absolute;top:0;left:18px;right:18px;height:2px;background:linear-gradient(90deg,transparent,var(--gold),var(--amber),transparent);opacity:.7;}
.svir-metric .ml{font-size:11px;color:var(--text-m);line-height:1.3;min-height:28px;}
.svir-metric .mv{font-size:32px;font-weight:600;letter-spacing:-0.02em;color:var(--text);margin-top:4px;line-height:1;}
.svir-delta{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:600;}
.svir-delta.up{color:var(--green);}.svir-delta.down{color:var(--red);}.svir-delta.flat{color:var(--text-m);}
.svir-body{font-size:15px;line-height:1.7;color:var(--text-2);margin-top:22px;}
.svir-module{margin-top:20px;}
.svir-module-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:12px;}
.svir-module-title{font-size:15px;font-weight:600;color:var(--text);}
.svir-module-num{display:flex;align-items:center;gap:10px;}
.svir-module-num .n{font-size:24px;font-weight:600;letter-spacing:-0.02em;color:var(--text);}
.svir-shot{border-radius:14px;overflow:hidden;border:1px solid var(--line-2);background:#0d0d10;}
.svir-shot img{width:100%;display:block;}
.svir-cap{font-size:12.5px;color:var(--text-m);margin-top:8px;line-height:1.5;font-style:italic;}
.svir-point{position:relative;padding:14px 16px 14px 20px;border-radius:14px;background:linear-gradient(165deg,var(--ink-2),var(--ink));border:1px solid var(--line-2);margin-bottom:10px;overflow:hidden;}
.svir-point::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;}
.svir-point.gargalo::before{background:var(--red);}
.svir-point.oportunidade::before{background:var(--gold);}
.svir-point .pt{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;}
.svir-point .px{font-size:13.5px;color:var(--text-2);line-height:1.55;}
.svir-acao{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);}
.svir-acao:last-child{border-bottom:0;}
.svir-acao .ai{width:26px;height:26px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,rgba(240,199,68,0.2),rgba(232,154,28,0.1));border:1px solid rgba(240,199,68,0.3);color:var(--gold-bright);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.svir-acao .at{font-size:14px;font-weight:600;color:var(--text);margin-bottom:2px;}
.svir-acao .ax{font-size:13px;color:var(--text-m);line-height:1.5;}
.svir-reviews{margin-top:18px;padding:20px;border-radius:18px;background:linear-gradient(165deg,var(--ink-2),var(--ink));border:1px solid var(--line-2);}
.svir-reviews p{font-size:15px;line-height:1.7;color:var(--text-2);white-space:pre-line;}
.svir-foot{margin-top:48px;padding-top:24px;border-top:1px solid var(--line);text-align:center;}
.svir-foot .fl{font-size:18px;font-weight:600;letter-spacing:-0.01em;}
.svir-foot .fs{font-size:12px;color:var(--text-mm);margin-top:4px;letter-spacing:.3px;}
.svir-spin{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0608;}
.svir-spin .d{width:32px;height:32px;border-radius:50%;border:2px solid #F0C744;border-top-color:transparent;animation:svirspin .8s linear infinite;}
@keyframes svirspin{to{transform:rotate(360deg);}}
`

function deltaClass(pct: number | null) {
  if (pct == null) return 'flat'
  return pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
}
function Delta({ pct }: { pct: number | null }) {
  const cls = deltaClass(pct)
  const Icon = pct == null || pct === 0 ? Minus : pct > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`svir-delta ${cls}`}>
      <Icon size={14} /> {pct == null ? 'estável' : `${pct > 0 ? '+' : ''}${pct}%`}
    </span>
  )
}

export default function PublicGoogleReport() {
  const { slug } = useParams()
  const [report, setReport] = useState<Report | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')

  useEffect(() => {
    if (document.getElementById('svir-font')) return
    const l = document.createElement('link')
    l.id = 'svir-font'
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'
    document.head.appendChild(l)
  }, [])

  useEffect(() => {
    let alive = true
    fetch(`/api/reports/google/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) { setReport(d.report); setState('ok') } })
      .catch(() => { if (alive) setState('notfound') })
    return () => { alive = false }
  }, [slug])

  if (state === 'loading') {
    return <div className="svir-root"><style>{CSS}</style><div className="svir-spin"><div className="d" /></div></div>
  }
  if (state === 'notfound' || !report) {
    return (
      <div className="svir-root">
        <style>{CSS}</style>
        <div className="svir-wrap" style={{ textAlign: 'center', paddingTop: 120 }}>
          <MapPin size={40} style={{ margin: '0 auto 12px', color: '#A89B82' }} />
          <h1 className="svir-title" style={{ fontSize: 22 }}>Relatório não disponível</h1>
          <p className="svir-period">Esse link pode ter expirado ou ainda não foi publicado.</p>
        </div>
      </div>
    )
  }

  const a = report.analysis || {}
  const modules = a.modules || []
  const pontos = a.diagnostico?.pontos || []
  const acoes = a.diagnostico?.acoes || []

  return (
    <div className="svir-root">
      <style>{CSS}</style>
      <div className="svir-wrap">
        <span className="svir-eyebrow"><MapPin size={13} /> Resultados no Google</span>
        <h1 className="svir-title">{report.client_name}</h1>
        <p className="svir-period">{report.period_label}</p>

        {a.destaque && <div className="svir-destaque"><p>{a.destaque}</p></div>}

        {report.metrics?.length > 0 && (
          <>
            <div className="svir-h2">Visão geral</div>
            <div className="svir-metrics">
              {report.metrics.map((m) => (
                <div key={m.key} className="svir-metric">
                  <div className="ml">{m.label}</div>
                  <div className="mv">{m.current ?? '—'}{m.unit}</div>
                  <div style={{ marginTop: 8 }}><Delta pct={m.delta_pct} /></div>
                </div>
              ))}
            </div>
          </>
        )}

        {a.resumo_cliente && <p className="svir-body">{a.resumo_cliente}</p>}

        {/* Detalhamento por módulo — os prints como registro oficial */}
        {modules.length > 0 && (
          <>
            <div className="svir-h2">Registro oficial · detalhamento</div>
            {modules.map((m, i) => (
              <div key={i} className="svir-module">
                <div className="svir-module-head">
                  <span className="svir-module-title">{m.titulo}</span>
                  {(m.valor || m.delta_pct != null) && (
                    <span className="svir-module-num">
                      {m.valor && <span className="n">{m.valor}</span>}
                      {m.delta_pct != null && <Delta pct={m.delta_pct} />}
                    </span>
                  )}
                </div>
                {m.image_url && (
                  <div className="svir-shot"><img src={m.image_url} alt={m.titulo} loading="lazy" /></div>
                )}
                {m.legenda && <p className="svir-cap">{m.legenda}</p>}
              </div>
            ))}
          </>
        )}

        {/* Diagnóstico */}
        {pontos.length > 0 && (
          <>
            <div className="svir-h2">Diagnóstico</div>
            {pontos.map((p, i) => (
              <div key={i} className={`svir-point ${p.tipo === 'gargalo' ? 'gargalo' : 'oportunidade'}`}>
                <div className="pt">{p.titulo}</div>
                <div className="px">{p.texto}</div>
              </div>
            ))}
          </>
        )}

        {acoes.length > 0 && (
          <>
            <div className="svir-h2">Próximos passos</div>
            {acoes.map((ac, i) => (
              <div key={i} className="svir-acao">
                <span className="ai">{i + 1}</span>
                <div>
                  <div className="at">{ac.titulo}</div>
                  <div className="ax">{ac.texto}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {report.review_messages?.trim() && (
          <>
            <div className="svir-h2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Star size={13} style={{ color: '#F0C744' }} /> Avaliações
            </div>
            <div className="svir-reviews"><p>{report.review_messages}</p></div>
          </>
        )}

        <div className="svir-foot">
          <div className="fl"><span className="svir-hl">SVI</span> Company</div>
          <div className="fs">Sistema de Vendas Inteligente</div>
        </div>
      </div>
    </div>
  )
}
