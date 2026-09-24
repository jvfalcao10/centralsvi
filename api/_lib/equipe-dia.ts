import type { VercelRequest, VercelResponse } from '@vercel/node';

// Fechamento do dia: como cada pessoa do time terminou, lido do ClickUp ao vivo.
// Link publico por token, para abrir do WhatsApp sem login.

const TEAM_ID = '9015595861';
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // Belem e UTC-3 o ano todo

type Task = {
  id: string;
  name: string;
  status?: { status?: string; type?: string };
  due_date?: string | null;
  date_closed?: string | null;
  date_updated?: string | null;
  assignees?: { id: number; username?: string }[];
  url?: string;
  list?: { name?: string };
};

type Pessoa = {
  nome: string;
  abertas: number;
  atrasadas: number;
  concluidasHoje: number;
  semPrazo: number;
  vencendoHoje: number;
  piores: { nome: string; dias: number; url: string }[];
};

function inicioDoDiaBelem(agora: number): number {
  const d = new Date(agora - TZ_OFFSET_MS);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() + TZ_OFFSET_MS;
}

async function puxarTarefas(token: string, fechadas: boolean): Promise<Task[]> {
  const out: Task[] = [];
  for (let page = 0; page < 12; page++) {
    const qs = new URLSearchParams({
      subtasks: 'true',
      include_closed: String(fechadas),
      page: String(page),
    });
    if (fechadas) {
      const desde = inicioDoDiaBelem(Date.now());
      qs.set('date_closed_gt', String(desde));
    }
    const r = await fetch(`https://api.clickup.com/api/v2/team/${TEAM_ID}/task?${qs}`, {
      headers: { Authorization: token },
    });
    if (!r.ok) break;
    const d = (await r.json()) as { tasks?: Task[]; last_page?: boolean };
    const lote = d.tasks || [];
    out.push(...lote);
    if (d.last_page || lote.length === 0) break;
  }
  return out;
}

function montar(abertas: Task[], fechadasHoje: Task[]) {
  const agora = Date.now();
  const fimHoje = inicioDoDiaBelem(agora) + 24 * 3600 * 1000;
  const mapa = new Map<string, Pessoa>();

  const pega = (nome: string): Pessoa => {
    if (!mapa.has(nome)) {
      mapa.set(nome, { nome, abertas: 0, atrasadas: 0, concluidasHoje: 0, semPrazo: 0, vencendoHoje: 0, piores: [] });
    }
    return mapa.get(nome)!;
  };

  for (const t of abertas) {
    const donos = (t.assignees || []).map(a => a.username || 'sem nome');
    if (!donos.length) donos.push('Sem responsável');
    for (const nome of donos) {
      const p = pega(nome);
      p.abertas++;
      const dd = t.due_date ? Number(t.due_date) : 0;
      if (!dd) {
        p.semPrazo++;
      } else if (dd < agora) {
        p.atrasadas++;
        const dias = Math.floor((agora - dd) / 86400000);
        p.piores.push({ nome: t.name, dias, url: t.url || `https://app.clickup.com/t/${t.id}` });
      } else if (dd < fimHoje) {
        p.vencendoHoje++;
      }
    }
  }

  for (const t of fechadasHoje) {
    const donos = (t.assignees || []).map(a => a.username || 'sem nome');
    for (const nome of donos) pega(nome).concluidasHoje++;
  }

  const lista = [...mapa.values()];
  for (const p of lista) p.piores.sort((a, b) => b.dias - a.dias);
  // Quem tem mais atraso aparece primeiro: e por ele que a cobranca comeca.
  lista.sort((a, b) => b.atrasadas - a.atrasadas || b.abertas - a.abertas);
  return lista;
}

const esc = (s: string) => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));

function render(pessoas: Pessoa[], quando: string): string {
  const totAtraso = pessoas.reduce((s, p) => s + p.atrasadas, 0);
  const totAbertas = pessoas.reduce((s, p) => s + p.abertas, 0);
  const totFeitas = pessoas.reduce((s, p) => s + p.concluidasHoje, 0);

  const cards = pessoas
    .filter(p => p.abertas || p.concluidasHoje)
    .map(p => {
      const grave = p.atrasadas >= 5;
      const piores = p.piores.slice(0, 3)
        .map(t => `<li><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.nome.slice(0, 70))}</a> <span class="d">${t.dias}d</span></li>`)
        .join('');
      return `<article class="p${grave ? ' grave' : ''}">
        <header><h3>${esc(p.nome)}</h3>${p.atrasadas ? `<span class="tag">${p.atrasadas} atrasada${p.atrasadas > 1 ? 's' : ''}</span>` : '<span class="tag ok">em dia</span>'}</header>
        <div class="n">
          <div><b>${p.abertas}</b><span>abertas</span></div>
          <div><b class="${p.atrasadas ? 'r' : ''}">${p.atrasadas}</b><span>atrasadas</span></div>
          <div><b class="${p.concluidasHoje ? 'g' : ''}">${p.concluidasHoje}</b><span>feitas hoje</span></div>
          <div><b>${p.vencendoHoje}</b><span>vencem hoje</span></div>
          <div><b>${p.semPrazo}</b><span>sem prazo</span></div>
        </div>
        ${piores ? `<ul class="t">${piores}</ul>` : ''}
      </article>`;
    })
    .join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Fechamento do dia · Equipe SVI</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap">
<style>
:root{--gold:#D4A82C;--gold-b:#F0C744;--black:#0A0608;--ink:#1A1218;--ink2:#241820;
--text:#F7F2E7;--dim:#A89B82;--green:#4ABE7C;--red:#E0726A;--line:rgba(245,241,232,.1)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--black);color:var(--text);font:400 15px/1.55 'DM Sans',system-ui,sans-serif;
padding:28px 18px 70px;-webkit-font-smoothing:antialiased}
.w{max-width:780px;margin:0 auto}
.eye{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:var(--gold)}
h1{font-size:clamp(24px,6vw,34px);font-weight:700;letter-spacing:-.03em;margin:8px 0 4px}
.sub{color:var(--dim);font-size:14px;margin-bottom:22px}
.res{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:26px}
.res div{background:linear-gradient(165deg,var(--ink2),var(--ink));border:1px solid rgba(212,168,44,.16);
border-radius:14px;padding:15px}
.res b{display:block;font-size:30px;font-weight:700;letter-spacing:-.02em}
.res span{font-size:11.5px;color:var(--dim)}
.p{background:linear-gradient(165deg,var(--ink2),var(--ink));border:1px solid var(--line);
border-radius:15px;padding:16px 17px;margin-bottom:11px}
.p.grave{border-color:rgba(224,114,106,.4)}
.p header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px}
.p h3{font-size:16px;font-weight:600}
.tag{font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;
background:rgba(224,114,106,.14);color:var(--red);white-space:nowrap}
.tag.ok{background:rgba(74,190,124,.13);color:var(--green)}
.n{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.n div{text-align:center}
.n b{display:block;font-size:21px;font-weight:600;font-variant-numeric:tabular-nums}
.n b.r{color:var(--red)}.n b.g{color:var(--green)}
.n span{font-size:10.5px;color:var(--dim);line-height:1.25;display:block;margin-top:2px}
.t{list-style:none;margin-top:13px;padding-top:12px;border-top:1px solid var(--line)}
.t li{font-size:13px;padding:4px 0;display:flex;justify-content:space-between;gap:10px}
.t a{color:var(--text);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.t a:hover{color:var(--gold-b)}
.t .d{color:var(--red);font-weight:600;font-size:12px;white-space:nowrap}
footer{margin-top:26px;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--dim)}
@media(max-width:520px){.res{grid-template-columns:1fr 1fr}.n{grid-template-columns:repeat(3,1fr);gap:10px}}
</style></head><body><div class="w">
<span class="eye">SVI Company · fechamento do dia</span>
<h1>Como a equipe terminou</h1>
<p class="sub">${esc(quando)}</p>
<div class="res">
  <div><b class="${totAtraso ? '' : ''}" style="color:${totAtraso ? 'var(--red)' : 'var(--text)'}">${totAtraso}</b><span>atrasadas no time</span></div>
  <div><b style="color:var(--green)">${totFeitas}</b><span>concluídas hoje</span></div>
  <div><b>${totAbertas}</b><span>abertas no total</span></div>
</div>
${cards || '<p class="sub">Nenhuma tarefa aberta encontrada.</p>'}
<footer>Dados do ClickUp no momento em que você abriu esta página. Ordenado por quem tem mais atraso.
Clique numa tarefa para abrir direto no ClickUp.</footer>
</div></body></html>`;
}

export async function handleEquipeDia(req: VercelRequest, res: VercelResponse) {
  const token = process.env.CLICKUP_TK;
  if (!token) {
    res.status(500).send('CLICKUP_TK nao configurado');
    return;
  }
  const chave = process.env.EQUIPE_KEY;
  if (chave && String(req.query.k || '') !== chave) {
    res.status(401).send('link invalido');
    return;
  }

  try {
    const [abertas, fechadas] = await Promise.all([
      puxarTarefas(token, false),
      puxarTarefas(token, true),
    ]);
    const pessoas = montar(abertas, fechadas);
    const quando = new Date(Date.now() - TZ_OFFSET_MS).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).send(render(pessoas, quando));
  } catch (e) {
    res.status(500).send('Nao consegui ler o ClickUp agora. Tente de novo em instantes.');
  }
}
