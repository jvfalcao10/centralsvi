import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAdminClient } from './supabase.js';
import { TECNICAS, ABERTAS, PESO_TECNICO, PESO_ABERTO } from '../../src/data/vagaTrafego.js';
import { GABARITO, PARCIAL, CRITERIOS } from './gabarito-trafego.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

/**
 * Recebe a candidatura da vaga de trafego, corrige e salva com nota.
 *
 * Entra por `api/r.ts` (`__rota=vaga-trafego`) porque o projeto esta no teto de
 * funcoes do plano Hobby. Roda com service role: a tabela nao aceita escrita do
 * anon, entao o gabarito nunca sai daqui e ninguem insere nota por fora.
 *
 * O gabarito mora em `gabarito-trafego.ts`, que nunca é importado por página
 * React: se fosse, o candidato leria a resposta certa no bundle.
 *
 * Duas notas somadas:
 *   tecnica  - gabarito fechado, deterministico, pesca vicio conhecido
 *   abertas  - a IA le e pontua contra um criterio escrito por pergunta
 * Se a IA falhar, a candidatura NAO se perde: salva com a nota tecnica e um
 * aviso de que falta corrigir. Perder candidato por erro de API seria pior.
 */
export async function handleVagaTrafego(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const b = (req.body || {}) as Record<string, any>;
  const nome = String(b.nome || '').trim();
  const whatsapp = String(b.whatsapp || '').replace(/\D/g, '');
  const respostas = (b.respostas || {}) as Record<string, string>;

  if (nome.length < 3) return res.status(400).json({ error: 'nome_invalido' });
  if (whatsapp.length < 10) return res.status(400).json({ error: 'whatsapp_invalido' });
  for (const q of TECNICAS) if (!respostas[q.id]) return res.status(400).json({ error: 'faltou_tecnica', id: q.id });
  for (const q of ABERTAS) {
    if (String(respostas[q.id] || '').trim().length < 40) return res.status(400).json({ error: 'resposta_curta', id: q.id });
  }

  // 1. Nota tecnica: gabarito fechado
  let bruto = 0;
  const gabarito: Record<string, 'certa' | 'parcial' | 'errada'> = {};
  for (const q of TECNICAS) {
    const r = respostas[q.id];
    if (r === GABARITO[q.id]) { bruto += q.peso; gabarito[q.id] = 'certa'; }
    else if (PARCIAL[q.id] && r === PARCIAL[q.id]) { bruto += q.peso * 0.4; gabarito[q.id] = 'parcial'; }
    else gabarito[q.id] = 'errada';
  }
  const scoreTecnico = Math.round((bruto / PESO_TECNICO) * 100 * 100) / 100;
  const errouCritico = TECNICAS.filter(q => q.peso >= 12 && gabarito[q.id] === 'errada');

  // 2. Nota das abertas, pela IA
  let scoreAberto: number | null = null;
  let parecer = '';
  let fortes: string[] = [];
  let alertas: string[] = errouCritico.map(q => `Errou uma questão eliminatória: ${q.pega}`);
  let notasDim: Record<string, number> = {};
  let erroCorrecao: string | null = null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    erroCorrecao = 'ANTHROPIC_API_KEY ausente: abertas não corrigidas.';
  } else {
    const criterios = ABERTAS.map(q =>
      `[${q.id}] dimensão: ${q.dimensao} (peso ${q.peso})\nPergunta: ${q.pergunta}\nComo julgar: ${CRITERIOS[q.id]}\nResposta do candidato: """${String(respostas[q.id] || '').slice(0, 2500)}"""`
    ).join('\n\n');

    const SYSTEM = [
      'Você avalia candidatos a gestor de tráfego de uma agência brasileira. Seja rigoroso e honesto: a vaga é sênior e paga acima da média da região.',
      '',
      'Para CADA resposta aberta, dê uma nota de 0 a 10 seguindo o critério dado. Não invente qualidade que o texto não tem.',
      'Resposta genérica, sem caso concreto, sem número e sem consequência recebe nota baixa, por mais bem escrita que seja.',
      'Texto longo não vale mais que texto específico. Especificidade verificável é o que conta.',
      '',
      'Sinais que PUXAM PRA CIMA: número antes e depois, nome da ferramenta ou da métrica, decisão que o candidato tomou sozinho, erro assumido com correção de processo, aplicação recente do que aprendeu.',
      'Sinais que PUXAM PRA BAIXO: só adjetivo sobre si mesmo, mérito coletivo sem a parte dele, culpa terceirizada, "nunca errei", jargão sem prática, resposta que serviria pra qualquer vaga.',
      '',
      'Escreva em português do Brasil com acentuação correta e completa. NUNCA use travessão.',
      'Responda APENAS um objeto JSON válido, sem markdown e sem texto em volta.',
      '',
      'Formato:',
      '{',
      '  "notas": { "a1": 7, "a2": 4, "a3": 8, "a4": 6, "a5": 9 },',
      '  "parecer": "3 a 5 frases dizendo se vale entrevistar e por quê, apontando a evidência que sustenta",',
      '  "pontos_fortes": ["frase curta e específica", "outra"],',
      '  "alertas": ["o que preocupa de verdade nesta candidatura", "outro"]',
      '}',
    ].join('\n');

    try {
      const aiRes = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 1600, system: SYSTEM,
          messages: [{ role: 'user', content: `Candidato: ${nome}\n\n${criterios}` }],
        }),
      });
      if (!aiRes.ok) throw new Error(`anthropic_${aiRes.status}`);
      const data = (await aiRes.json()) as { content?: Array<{ type: string; text?: string }> };
      const raw = data.content?.find(c => c.type === 'text')?.text || '';
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

      let somaAberto = 0;
      for (const q of ABERTAS) {
        const n = Math.max(0, Math.min(10, Number(j.notas?.[q.id] ?? 0)));
        notasDim[q.dimensao] = n;
        somaAberto += (n / 10) * q.peso;
      }
      scoreAberto = Math.round((somaAberto / PESO_ABERTO) * 100 * 100) / 100;
      parecer = String(j.parecer || '');
      fortes = Array.isArray(j.pontos_fortes) ? j.pontos_fortes.map(String) : [];
      alertas = [...alertas, ...(Array.isArray(j.alertas) ? j.alertas.map(String) : [])];
    } catch (e: any) {
      erroCorrecao = `Correção automática falhou (${String(e?.message || e).slice(0, 80)}). Nota das abertas pendente.`;
    }
  }

  // Técnica pesa 60 porque é onde mora o vício que custa dinheiro.
  const scoreTotal = scoreAberto === null
    ? Math.round(scoreTecnico * 0.6 * 100) / 100
    : Math.round((scoreTecnico * 0.6 + scoreAberto * 0.4) * 100) / 100;

  const admin = createAdminClient();
  const { error } = await admin.from('vaga_candidatos').upsert({
    vaga: 'gestor-trafego',
    nome, whatsapp,
    email: String(b.email || '').trim() || null,
    cidade: String(b.cidade || '').trim() || null,
    link_prova: String(b.link_prova || '').trim() || null,
    anos_experiencia: Number(b.anos_experiencia) || null,
    verba_gerida: b.verba_gerida || null,
    contas_simultaneas: b.contas_simultaneas || null,
    verticais: Array.isArray(b.verticais) ? b.verticais.map(String) : null,
    disponibilidade: b.disponibilidade || null,
    aceita_pj: typeof b.aceita_pj === 'boolean' ? b.aceita_pj : null,
    pretensao: String(b.pretensao || '').trim() || null,
    respostas: { ...respostas, __gabarito: gabarito },
    score_tecnico: scoreTecnico,
    score_aberto: scoreAberto,
    score_total: scoreTotal,
    notas_dimensao: notasDim,
    parecer, pontos_fortes: fortes, alertas,
    erro_correcao: erroCorrecao,
    status: 'novo',
  }, { onConflict: 'vaga,whatsapp' });

  if (error) return res.status(500).json({ error: 'save_failed', detail: error.message });
  // O candidato não recebe nota nem gabarito de volta.
  return res.status(200).json({ ok: true });
}
