import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAdminClient } from './_lib/supabase.js';

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
.svir-root{--gold:#D4A82C;--gold-bright:#F0C744;--gold-light:#FDEBA8;--gold-dark:#9B7518;--amber:#E89A1C;--black:#0A0608;--black-2:#120B0F;--ink:#1A1218;--ink-2:#241820;--ink-3:#2E2028;--text:#F7F2E7;--text-2:#DCD1B8;--text-m:#A89B82;--text-mm:#6E634F;--green:#4ABE7C;--red:#E0726A;--line:rgba(245,241,232,0.08);--line-2:rgba(245,241,232,0.12);
  min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.6;
  background:radial-gradient(700px 380px at 15% 0%,rgba(232,154,28,0.16),transparent 55%),radial-gradient(700px 460px at 90% 26%,rgba(212,168,44,0.12),transparent 55%),linear-gradient(180deg,var(--black) 0%,var(--black-2) 100%);background-attachment:fixed}
.svir-wrap{max-width:640px;margin:0 auto;padding:44px 20px 72px}
.svir-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:999px;background:linear-gradient(135deg,rgba(240,199,68,0.12),rgba(212,168,44,0.06));border:1px solid rgba(240,199,68,0.25);color:var(--gold-light);font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase}
.svir-title{font-size:clamp(28px,7vw,44px);font-weight:600;letter-spacing:-0.03em;line-height:1.04;margin:16px 0 4px}
.svir-period{color:var(--text-m);font-size:14px}
.svir-hl{background:linear-gradient(110deg,var(--gold-light) 10%,var(--gold-bright) 50%,var(--amber) 90%);-webkit-background-clip:text;background-clip:text;color:transparent}
.svir-destaque{margin-top:22px;padding:18px 20px;border-radius:18px;background:linear-gradient(135deg,rgba(240,199,68,0.13),rgba(212,168,44,0.05));border:1px solid rgba(240,199,68,0.22);box-shadow:0 0 40px rgba(240,199,68,0.08),inset 0 1px 0 rgba(255,255,255,0.04)}
.svir-destaque p{font-size:17px;font-weight:500;color:var(--gold-light);letter-spacing:-0.01em}
.svir-h2{font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--gold-bright);margin:30px 0 12px}
.svir-metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.svir-metric{position:relative;overflow:hidden;background:linear-gradient(165deg,var(--ink-2) 0%,var(--ink) 100%);border:1px solid rgba(212,168,44,0.14);border-radius:18px;padding:18px 18px 16px;box-shadow:0 14px 34px -18px rgba(0,0,0,0.6)}
.svir-metric::before{content:'';position:absolute;top:0;left:18px;right:18px;height:2px;background:linear-gradient(90deg,transparent,var(--gold),var(--amber),transparent);opacity:.7}
.svir-metric .ml{font-size:11px;color:var(--text-m);line-height:1.3;min-height:28px}
.svir-metric .mv{font-size:32px;font-weight:600;letter-spacing:-0.02em;color:var(--text);margin-top:4px;line-height:1}
.svir-delta{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:600;margin-top:8px}
.svir-delta.up{color:var(--green)}.svir-delta.down{color:var(--red)}.svir-delta.flat{color:var(--text-m)}
.svir-body{font-size:15px;line-height:1.7;color:var(--text-2);margin-top:22px}
.svir-module{margin-top:20px}
.svir-module-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:12px}
.svir-module-title{font-size:15px;font-weight:600;color:var(--text)}
.svir-module-num{display:flex;align-items:center;gap:10px}
.svir-module-num .n{font-size:24px;font-weight:600;letter-spacing:-0.02em;color:var(--text)}
.svir-module-num .svir-delta{margin-top:0}
.svir-shot{border-radius:14px;overflow:hidden;border:1px solid var(--line-2);background:#0d0d10}
.svir-shot img{width:100%;display:block}
.svir-cap{font-size:12.5px;color:var(--text-m);margin-top:8px;line-height:1.5;font-style:italic}
.svir-point{position:relative;padding:14px 16px 14px 20px;border-radius:14px;background:linear-gradient(165deg,var(--ink-2),var(--ink));border:1px solid var(--line-2);margin-bottom:10px;overflow:hidden}
.svir-point::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px}
.svir-point.gargalo::before{background:var(--red)}
.svir-point.oportunidade::before{background:var(--gold)}
.svir-point .pt{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px}
.svir-point .px{font-size:13.5px;color:var(--text-2);line-height:1.55}
.svir-acao{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.svir-acao:last-child{border-bottom:0}
.svir-acao .ai{width:26px;height:26px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,rgba(240,199,68,0.2),rgba(232,154,28,0.1));border:1px solid rgba(240,199,68,0.3);color:var(--gold-bright);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.svir-acao .at{font-size:14px;font-weight:600;color:var(--text);margin-bottom:2px}
.svir-acao .ax{font-size:13px;color:var(--text-m);line-height:1.5}
.svir-reviews{margin-top:18px;padding:20px;border-radius:18px;background:linear-gradient(165deg,var(--ink-2),var(--ink));border:1px solid var(--line-2)}
.svir-reviews p{font-size:15px;line-height:1.7;color:var(--text-2);white-space:pre-line}
.svir-foot{margin-top:48px;padding-top:24px;border-top:1px solid var(--line);text-align:center}
.svir-foot .fl{font-size:18px;font-weight:600;letter-spacing:-0.01em}
.svir-foot .fs{font-size:12px;color:var(--text-mm);margin-top:4px;letter-spacing:.3px}
`;

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function deltaHtml(pct: any): string {
  if (pct == null || typeof pct !== 'number') return '<span class="svir-delta flat">estável</span>';
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '–';
  return `<span class="svir-delta ${cls}">${arrow} ${pct > 0 ? '+' : ''}${pct}%</span>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = String(req.query.slug || '').trim().replace(/\/$/, '');
  const host = req.headers.host || 'centralsvi.vercel.app';
  const pageUrl = `https://${host}/r/${slug}`;

  const admin = createAdminClient();
  const { data } = await admin
    .from('google_reports')
    .select('client_name, period_label, metrics, analysis, review_messages, status')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!data) {
    res.status(404).send(
      `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório não disponível</title><style>${CSS}</style></head><body><div class="svir-root"><div class="svir-wrap" style="text-align:center;padding-top:120px"><h1 class="svir-title" style="font-size:22px">Relatório não disponível</h1><p class="svir-period">Esse link pode ter expirado ou ainda não foi publicado.</p></div></div></body></html>`,
    );
    return;
  }

  const a = (data.analysis || {}) as any;
  const metrics = Array.isArray(data.metrics) ? (data.metrics as any[]) : [];
  const modules = Array.isArray(a.modules) ? a.modules : [];
  const pontos = Array.isArray(a.diagnostico?.pontos) ? a.diagnostico.pontos : [];
  const acoes = Array.isArray(a.diagnostico?.acoes) ? a.diagnostico.acoes : [];

  // OG: até 3 bullets BONS — SÓ crescimento entra no card do cliente. Sem positivos, cai no destaque.
  const ogPick = metrics
    .filter((m) => typeof m.delta_pct === 'number' && m.delta_pct > 0)
    .sort((x, y) => y.delta_pct - x.delta_pct)
    .slice(0, 3);
  const bullets = ogPick.map((m) => `${m.label} ${m.current ?? ''}${m.unit || ''} (+${m.delta_pct}%)`.trim());

  // Imagem de preview gerada na hora (arte preto+dourado com cliente, data e bullets)
  const ogImg = `https://${host}/api/oimg?client=${encodeURIComponent(data.client_name || '')}&period=${encodeURIComponent(data.period_label || '')}&b=${encodeURIComponent(bullets.join('|'))}`;
  const ogDesc = ([data.period_label, ...(bullets.length ? bullets : [a.destaque])].filter(Boolean) as string[]).join(' · ').slice(0, 200);
  const ogTitle = `Análise do Google · ${data.client_name}`;

  const metricsHtml = metrics.length
    ? `<div class="svir-h2">Visão geral</div><div class="svir-metrics">${metrics
        .map((m) => `<div class="svir-metric"><div class="ml">${esc(m.label)}</div><div class="mv">${esc(m.current ?? '—')}${esc(m.unit || '')}</div><div style="margin-top:8px">${deltaHtml(m.delta_pct)}</div></div>`)
        .join('')}</div>`
    : '';

  const modulesHtml = modules.length
    ? `<div class="svir-h2">Registro oficial · detalhamento</div>${modules
        .map(
          (m: any) =>
            `<div class="svir-module"><div class="svir-module-head"><span class="svir-module-title">${esc(m.titulo)}</span>${
              m.valor || m.delta_pct != null
                ? `<span class="svir-module-num">${m.valor ? `<span class="n">${esc(m.valor)}</span>` : ''}${m.delta_pct != null ? deltaHtml(m.delta_pct) : ''}</span>`
                : ''
            }</div>${m.image_url ? `<div class="svir-shot"><img src="${esc(m.image_url)}" alt="${esc(m.titulo)}" loading="lazy"></div>` : ''}${m.legenda ? `<p class="svir-cap">${esc(m.legenda)}</p>` : ''}</div>`,
        )
        .join('')}`
    : '';

  const pontosHtml = pontos.length
    ? `<div class="svir-h2">Diagnóstico</div>${pontos
        .map((p: any) => `<div class="svir-point ${p.tipo === 'gargalo' ? 'gargalo' : 'oportunidade'}"><div class="pt">${esc(p.titulo)}</div><div class="px">${esc(p.texto)}</div></div>`)
        .join('')}`
    : '';

  const acoesHtml = acoes.length
    ? `<div class="svir-h2">Próximos passos</div>${acoes
        .map((ac: any, i: number) => `<div class="svir-acao"><span class="ai">${i + 1}</span><div><div class="at">${esc(ac.titulo)}</div><div class="ax">${esc(ac.texto)}</div></div></div>`)
        .join('')}`
    : '';

  const reviewsHtml = (data.review_messages || '').trim()
    ? `<div class="svir-h2">Avaliações</div><div class="svir-reviews"><p>${esc(data.review_messages)}</p></div>`
    : '';

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ogTitle)}</title>
<meta name="description" content="${esc(ogDesc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:image" content="${ogImg}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:site_name" content="SVI Company">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(ogDesc)}">
<meta name="twitter:image" content="${ogImg}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap">
<style>${CSS}</style>
</head><body><div class="svir-root"><div class="svir-wrap">
<span class="svir-eyebrow">Resultados no Google</span>
<h1 class="svir-title">${esc(data.client_name)}</h1>
<p class="svir-period">${esc(data.period_label)}</p>
${a.destaque ? `<div class="svir-destaque"><p>${esc(a.destaque)}</p></div>` : ''}
${metricsHtml}
${a.resumo_cliente ? `<p class="svir-body">${esc(a.resumo_cliente)}</p>` : ''}
${modulesHtml}
${pontosHtml}
${acoesHtml}
${reviewsHtml}
<div class="svir-foot"><div class="fl"><span class="svir-hl">SVI</span> Company</div><div class="fs">Sistema de Vendas Inteligente</div></div>
</div></div></body></html>`;

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  res.status(200).send(html);
}
