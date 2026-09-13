# -*- coding: utf-8 -*-
"""Monta (ou atualiza) o workflow n8n 'SVI - Cofre de Inteligencia (Sofia)'.

Tres acoes num webhook so:
  analisar  -> baixa o link, transcreve, le tudo e devolve resumo + angulo + pra quem serve
  modelar   -> pega o item do cofre, carrega o metodo da casa e escreve a peca
  subir     -> cria a task no ClickUp com a peca VERBATIM + link da Central

Rodar: python3 build_wf_cofre.py            (cria ou atualiza)
"""
import json, os, sys, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

N8N = "https://n8n.svicompany.com.br/api/v1"
import segredos
KEY = segredos.n8n_api_key()
SUPA = "https://qvkfcvcqlfamyzgqgnrq.supabase.co/rest/v1"
SUPA_KEY = segredos.supabase_service_key()
# O dominio da Central. Em 22/08 ele estava preso num alias da landing de agencias e foi
# devolvido pro projeto centralsvi. Deep link conferido: /login e /inteligencia respondem 200.
CENTRAL = "https://central.svicompany.com.br"
WF_NAME = "SVI - Cofre de Inteligencia (Sofia)"

CRED = {
    "apify": {"httpBearerAuth": {"id": "sv5oDLIUgke1Lt1C", "name": "Apify Espiar Concorrentes"}},
    "groq": {"httpHeaderAuth": {"id": "adKNowIsock0ok79", "name": "Groq Whisper (SVI)"}},
    "supa": {"httpHeaderAuth": {"id": "GCIj79t5VczWnFIO", "name": "Supabase Auth Bearer (qvkf)"}},
    "claude": {"httpHeaderAuth": {"id": "zt4vlDqQSbB9fW9H", "name": "Anthropic API Key"}},
    "uaz": {"httpHeaderAuth": {"id": "ZH4UhXChfo8uG1pM", "name": "uazapi sofia"}},
    "clickup": {"clickUpApi": {"id": "H0bM7QHsaRW41PDZ", "name": "ClickUp SVI (token 06/08)"}},
}

nodes, conns = [], {}
X = {"x": 0}


def node(name, ntype, params, tv=1, creds=None, pos=None, extra=None):
    n = {"parameters": params, "id": name, "name": name, "type": ntype,
         "typeVersion": tv, "position": pos or [X["x"], 300]}
    X["x"] += 220
    if creds:
        n["credentials"] = CRED[creds]
    if extra:
        n.update(extra)
    nodes.append(n)
    return name


def link(a, b, out=0):
    conns.setdefault(a, {}).setdefault("main", [])
    while len(conns[a]["main"]) <= out:
        conns[a]["main"].append([])
    conns[a]["main"][out].append({"node": b, "type": "main", "index": 0})


def supa_headers():
    return {"sendHeaders": True, "specifyHeaders": "keypair",
            "headerParameters": {"parameters": [{"name": "apikey", "value": SUPA_KEY}]}}


def http(url, method="GET", body=None, creds="supa", headers=None, timeout=60000, never_error=True):
    p = {"method": method, "url": url, "authentication": "genericCredentialType",
         "genericAuthType": "httpHeaderAuth" if creds != "apify" else "httpBearerAuth",
         "options": {"timeout": timeout}}
    if never_error:
        p["options"]["response"] = {"response": {"neverError": True}}
    if headers:
        p.update(headers)
    if body is not None:
        p.update({"sendBody": True, "contentType": "json", "specifyBody": "json", "jsonBody": body})
    return p


def code(js):
    return {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": js}


# ---------------------------------------------------------------- entrada
wh = node("Webhook Cofre", "n8n-nodes-base.webhook",
          {"httpMethod": "POST", "path": "cofre-intel", "responseMode": "responseNode",
           "options": {"allowedOrigins": "https://central.svicompany.com.br,https://guia.svicompany.com.br,https://centralsvi.vercel.app,http://localhost:8080,http://localhost:5173"}}, tv=2, pos=[-400, 300])

rota = node("Rota", "n8n-nodes-base.switch", {
    "rules": {"values": [
        {"conditions": {"options": {"caseSensitive": False, "typeValidation": "loose", "version": 1},
                        "conditions": [{"leftValue": "={{ $json.body.acao }}", "rightValue": a,
                                        "operator": {"type": "string", "operation": "equals"}}],
                        "combinator": "and"},
         "renameOutput": True, "outputKey": a}
        for a in ("analisar", "modelar", "subir", "pingar")]},
    "options": {"fallbackOutput": "none"}}, tv=3, pos=[-180, 300])
link(wh, rota)

# ---------------------------------------------------------------- ANALISAR
norm = node("Normalizar Entrada", "n8n-nodes-base.code", code(r"""
const b = $input.first().json.body || {};
const url = (b.url || '').trim();
const texto = (b.texto || '').trim();
const transcricao_in = (b.transcricao || '').trim();

// tira ?img_index=, ?igsi= e afins, que atrapalham o scraper
const limpa = url.split('?')[0];

let plataforma = 'outro';
if (/instagram\.com/i.test(url)) plataforma = 'instagram';
else if (/tiktok\.com/i.test(url)) plataforma = 'tiktok';
else if (/youtube\.com|youtu\.be/i.test(url)) plataforma = 'youtube';

// No Instagram, /reel/ tem fala e vai pro downloader de video (proven).
// /p/ pode ser carrossel ou foto, e ai quem le e o scraper de post.
const eh_reel = /instagram\.com\/(reel|reels)\//i.test(url);

let actor = '', abody = '';
if (plataforma === 'instagram' && eh_reel) {
  actor = 'seemuapps~instagram-video-downloader';
  abody = JSON.stringify({ postUrls: [limpa], saveFiles: false });
} else if (plataforma === 'instagram') {
  actor = 'apify~instagram-scraper';
  abody = JSON.stringify({ directUrls: [limpa], resultsType: 'posts', resultsLimit: 1,
                           addParentData: false });
} else if (plataforma === 'tiktok') {
  actor = 'clockworks~tiktok-video-scraper';
  abody = JSON.stringify({ postURLs: [limpa], shouldDownloadVideos: true, resultsPerPage: 1 });
} else if (plataforma === 'youtube') {
  actor = 'streamers~youtube-video-downloader';
  abody = JSON.stringify({ videos: [{ url: limpa }], storeInKVStore: true, preferredFormat: 'mp3',
                           transcriptionAndSubtitle: 'always-transcribe' });
}

const precisa_baixar = !!actor && !transcricao_in;

let tipo = 'link';
if (transcricao_in && !url) tipo = 'video';
if (!url && texto) tipo = 'texto';

return [{ json: {
  acao: 'analisar', url, limpa, texto, transcricao_in, plataforma, eh_reel, actor, abody,
  precisa_baixar, tipo,
  chatid: b.chatid || '', enviado_por: b.enviado_por || 'Joao',
  origem: b.origem || 'whatsapp', autor_in: b.autor || '', titulo_in: b.titulo || ''
}}];
"""), tv=2, pos=[40, 120])
link(rota, norm, 0)

if_baixar = node("Precisa Baixar?", "n8n-nodes-base.if", {
    "conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 2},
                   "conditions": [{"leftValue": "={{ $json.precisa_baixar }}", "rightValue": "true",
                                   "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                   "combinator": "and"}, "options": {}}, tv=2, pos=[260, 120])
link(norm, if_baixar)

apify = node("Apify Baixar", "n8n-nodes-base.httpRequest",
             http("=https://api.apify.com/v2/acts/{{ $json.actor }}/run-sync-get-dataset-items",
                  "POST", "={{ $json.abody }}", creds="apify", timeout=300000),
             tv=4, creds="apify", pos=[480, 40],
             extra={"onError": "continueRegularOutput"})
link(if_baixar, apify, 0)

extrair = node("Extrair Midia", "n8n-nodes-base.code", code(r"""
const n = $('Normalizar Entrada').first().json;
const items = $input.all().map(i => i.json);
const d = items[0] || {};

function urls(o, re) {
  const found = [];
  (function walk(v) {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) found.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(o);
  return found.filter(u => re.test(u));
}

let midia_url = '', legenda = '', autor = '', titulo = '', transcricao = '';
let imagens = [];

if (n.plataforma === 'instagram' && n.eh_reel) {
  midia_url = d.videoUrl || d.video_url || urls(d, /\.mp4/i)[0] || '';
  legenda = d.caption || d.text || '';
  autor = d.ownerUsername || d.username || d.owner || '';
  titulo = d.title || '';
} else if (n.plataforma === 'instagram') {
  // scraper de post: pode ser Sidecar (carrossel), Image ou Video
  legenda = d.caption || '';
  autor = d.ownerUsername || d.ownerFullName || '';
  titulo = d.type || '';
  midia_url = d.videoUrl || '';
  const filhos = Array.isArray(d.childPosts) ? d.childPosts : [];
  const deFilhos = filhos.map(c => c && (c.displayUrl || c.imageUrl)).filter(Boolean);
  const diretas = Array.isArray(d.images) ? d.images.filter(Boolean) : [];
  imagens = [...new Set([...deFilhos, ...diretas, ...(d.displayUrl ? [d.displayUrl] : [])])];
  // no carrossel o displayUrl repete a capa, entao so entra se nao houver filhos
  if (deFilhos.length) imagens = [...new Set([...deFilhos, ...diretas])];
  imagens = imagens.slice(0, 8);
} else if (n.plataforma === 'tiktok') {
  midia_url = (d.mediaUrls && d.mediaUrls[0]) || urls(d, /\.(mp4|mp3)/i)[0] || '';
  legenda = d.text || d.desc || '';
  autor = (d.authorMeta && d.authorMeta.name) || d.authorUniqueId || '';
  titulo = (d.videoMeta && d.videoMeta.title) || '';
  transcricao = d.transcript || '';
} else {
  midia_url = urls(d, /\.(mp3|m4a|mp4|webm)/i)[0] || urls(d, /./)[0] || '';
  legenda = d.description || d.text || '';
  autor = d.uploader || d.channelName || '';
  titulo = d.title || '';
  const t = d.transcript || d.transcription || d.subtitles || '';
  transcricao = typeof t === 'string' ? t : JSON.stringify(t);
}

// pra onde vai: ler imagens, ja tem fala, baixar audio, ou nada
let rota_midia = 'nada';
if (transcricao) rota_midia = 'pronta';
else if (imagens.length) rota_midia = 'imagens';
else if (midia_url) rota_midia = 'video';

const erro = rota_midia === 'nada' ? 'o Apify nao devolveu nem video nem imagem pra essa URL' : '';
return [{ json: { midia_url, legenda, autor, titulo, transcricao, imagens,
                  qtd_imagens: imagens.length, rota_midia, erro } }];
"""), tv=2, pos=[700, 40])
link(apify, extrair)

rota_midia = node("Rota da Midia", "n8n-nodes-base.switch", {
    "rules": {"values": [
        {"conditions": {"options": {"caseSensitive": False, "typeValidation": "loose", "version": 1},
                        "conditions": [{"leftValue": "={{ $json.rota_midia }}", "rightValue": r,
                                        "operator": {"type": "string", "operation": "equals"}}],
                        "combinator": "and"},
         "renameOutput": True, "outputKey": r}
        for r in ("imagens", "video", "pronta", "nada")]},
    "options": {"fallbackOutput": "none"}}, tv=3, pos=[920, 40])
link(extrair, rota_midia)

separar_img = node("Separar Imagens", "n8n-nodes-base.splitOut",
                   {"fieldToSplitOut": "imagens", "options": {}}, tv=1, pos=[1140, -80])
link(rota_midia, separar_img, 0)

baixar_img = node("Baixar Imagem", "n8n-nodes-base.httpRequest",
                  {"url": "={{ $json.imagens }}",
                   "options": {"response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}},
                               "timeout": 60000}},
                  tv=4, pos=[1360, -80], extra={"onError": "continueRegularOutput"})
link(separar_img, baixar_img)

montar_img = node("Montar Imagens", "n8n-nodes-base.code", code(r"""
// ATENCAO: esta instancia guarda binario fora do item (modo database). Nesse modo
// item.binary.data.data vem com a string "database", nao com o base64. O jeito certo
// e pedir o buffer pro helper. Foi isso que fez a Anthropic responder "Could not process image".
const blocos = [];
const itens = $input.all();
let total = 0;
for (let i = 0; i < itens.length; i++) {
  const bin = (itens[i].binary || {}).data;
  if (!bin) continue;
  const mime = (bin.mimeType || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|gif|webp)$/.test(mime)) continue;
  let b64 = '';
  try {
    const buf = await this.helpers.getBinaryDataBuffer(i, 'data');
    b64 = buf.toString('base64');
  } catch (e) { continue; }
  if (!b64 || b64.length < 500) continue;      // 1 slide de verdade nao e tao pequeno
  if (b64.length > 5000000) continue;          // teto por imagem
  if (total + b64.length > 14000000) break;    // teto do request inteiro
  total += b64.length;
  blocos.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
}
return [{ json: { blocos_imagem: blocos, qtd: blocos.length, bytes_base64: total } }];
"""), tv=2, pos=[1580, -80])
link(baixar_img, montar_img)

baixar = node("Baixar Video", "n8n-nodes-base.httpRequest",
              {"url": "={{ $json.midia_url }}",
               "options": {"response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}},
                           "timeout": 300000}},
              tv=4, pos=[1140, 120], extra={"onError": "continueRegularOutput"})
link(rota_midia, baixar, 1)

whisper = node("Whisper Cofre", "n8n-nodes-base.httpRequest", {
    "method": "POST", "url": "https://api.groq.com/openai/v1/audio/transcriptions",
    "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
    "sendBody": True, "contentType": "multipart-form-data",
    "bodyParameters": {"parameters": [
        {"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data"},
        {"parameterType": "formData", "name": "model", "value": "whisper-large-v3"},
        {"parameterType": "formData", "name": "response_format", "value": "json"},
        {"parameterType": "formData", "name": "language", "value": "pt"}]},
    "options": {"timeout": 300000, "response": {"response": {"neverError": True}}}},
    tv=4, creds="groq", pos=[1360, 120], extra={"onError": "continueRegularOutput"})
link(baixar, whisper)

consolidar = node("Consolidar Conteudo", "n8n-nodes-base.code", code(r"""
const n = $('Normalizar Entrada').first().json;
let m = {};
try { m = $('Extrair Midia').first().json || {}; } catch (e) {}

let fala = n.transcricao_in || '';
if (!fala) {
  try { const w = $('Whisper Cofre').first().json; fala = (w && (w.text || w.transcription)) || ''; } catch (e) {}
}
if (!fala && m.transcricao) fala = m.transcricao;

let blocos = [];
try { blocos = ($('Montar Imagens').first().json.blocos_imagem) || []; } catch (e) {}

const conteudo = [
  n.texto ? 'TEXTO MANDADO PELO JOAO:\n' + n.texto : '',
  m.legenda ? 'LEGENDA DO POST:\n' + m.legenda : '',
  fala ? 'FALA DO VIDEO (transcricao):\n' + fala : '',
  blocos.length ? 'SLIDES DO POST: ' + blocos.length + ' imagens seguem anexadas, leia todas.' : ''
].filter(Boolean).join('\n\n');

// TRAVA: sem fala, sem imagem e sem texto proprio, nao da pra analisar.
// Legenda curta sozinha NAO autoriza analise, foi assim que a leitura foi inventada em 22/08.
const substancia = (n.texto ? n.texto.length : 0) + fala.length + (blocos.length ? 5000 : 0)
                 + (m.legenda && m.legenda.length > 400 ? m.legenda.length : 0);
const vazio = substancia < 200;

return [{ json: {
  ...n,
  midia_url: m.midia_url || '',
  legenda: m.legenda || '',
  autor: m.autor || n.autor_in || '',
  titulo: m.titulo || n.titulo_in || '',
  transcricao: fala,
  blocos_imagem: blocos,
  qtd_imagens: blocos.length,
  conteudo,
  vazio,
  erro: vazio
    ? (m.erro || 'so consegui pegar a legenda, sem fala e sem slide. Nao da pra analisar sem o conteudo.')
    : ''
}}];
"""), tv=2, pos=[1800, 120])
link(rota_midia, consolidar, 2)
link(rota_midia, consolidar, 3)
link(if_baixar, consolidar, 1)
link(montar_img, consolidar)
link(whisper, consolidar)

if_vazio = node("Deu pra Ler?", "n8n-nodes-base.if", {
    "conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 2},
                   "conditions": [{"leftValue": "={{ $json.vazio }}", "rightValue": "true",
                                   "operator": {"type": "boolean", "operation": "false", "singleValue": True}}],
                   "combinator": "and"}, "options": {}}, tv=2, pos=[2020, 120])
link(consolidar, if_vazio)

recusa = node("Resposta Nao Deu", "n8n-nodes-base.code", code(r"""
const c = $input.first().json;
return [{ json: {
  ok: false,
  erro: c.erro,
  link: null,
  instrucao: 'NAO analise essa referencia e NAO deduza o conteudo dela. Diga ao Joao exatamente o motivo (' + c.erro + ') e peca o print dos slides, o video ou o texto colado.'
}}];
"""), tv=2, pos=[2240, 260])
link(if_vazio, recusa, 1)

clientes = node("Buscar Clientes", "n8n-nodes-base.httpRequest",
                http(SUPA + "/clients?select=name,segment,instagram,status,notes&status=eq.ativo&order=name",
                     headers=supa_headers()), tv=4, creds="supa", pos=[2240, 120])
link(if_vazio, clientes, 0)

metodo_base = node("Buscar Metodo Base", "n8n-nodes-base.httpRequest",
                   http(SUPA + "/intel_metodo?select=slug,titulo,conteudo&ativo=is.true&aplica_em=ov.%7Bsempre%7D&order=ordem",
                        headers=supa_headers()), tv=4, creds="supa", pos=[2460, 120])
link(clientes, metodo_base)

prompt_analise = node("Montar Prompt Analise", "n8n-nodes-base.code", code(r"""
const c = $('Consolidar Conteudo').first().json;
const clientes = $('Buscar Clientes').all().map(i => i.json).filter(x => x && x.name);
const cards = $input.all().map(i => i.json).filter(x => x && x.conteudo);

const metodo = cards.map(k => '### ' + k.titulo + '\n' + k.conteudo).join('\n\n');
const carteira = clientes.map(x =>
  '- ' + x.name + ' | cadastro: ' + (x.segment || 'segmento nao cadastrado') +
  (x.instagram ? ' | ' + x.instagram : '')
).join('\n');

const system = [
'Voce e a inteligencia de conteudo da SVI Company, agencia de Redencao/PA que atende medico, clinica, solar, agro, varejo e educacao.',
'O Joao (CEO) te manda uma referencia que ele viu por ai. Voce le/assiste TUDO e diz o que faz aquilo funcionar e pra quem da carteira serve.',
'',
'METODO DA CASA (use como regua de leitura):',
metodo,
'',
'CARTEIRA ATIVA (so pode sugerir nomes desta lista):',
carteira,
'',
'O QUE VOCE NAO PODE DEDUZIR (bloqueante):',
'1. Voce recebe AUDIO TRANSCRITO, IMAGENS e texto. O que nao veio, voce NAO sabe. Nunca afirme genero, idade, aparencia, profissao, esporte, cargo ou cidade de quem aparece se isso nao estiver dito na transcricao, na legenda ou visivel nas imagens. Sem isso, escreva neutro: "quem grava", "a pessoa que fala". Tambem nao invente rotina, familia, competicao nem historico.',
'2. NUNCA descreva cena, slide ou fala que voce nao recebeu. Se so veio legenda, sua analise se limita ao que a legenda diz. Inventar a cena a partir da legenda e o pior erro possivel aqui.',
'3. ESPECIALIDADE DE CLIENTE: use exatamente o que esta no cadastro acima. Se o cadastro nao diz a especialidade, cite so o nome, sem inventar. Errar a especialidade de um medico da carteira e falha grave.',
'',
'REGRAS DA ANALISE:',
'1. Nao resuma o video, DECIFRE. O que prende, por que prende, qual mecanismo de atencao esta rodando.',
'2. O angulo tem que ser a leitura incomum aplicavel, nao o tema.',
'3. Sugira 3 clientes no maximo, cada um com o porque em uma frase concreta. Se so 1 encaixa, sugira 1.',
'4. Nada de inventar dado, oferta ou resultado.',
'5. ZERO TRAVESSAO no texto. Use virgula, dois pontos ou quebre a frase.',
'6. Responda SOMENTE com JSON valido, sem cerca de codigo, sem texto antes ou depois.',
'',
'ESTILO VISUAL (so quando vierem imagens): descreva o DESIGN com precisao suficiente pra um designer reproduzir sem ver a referencia. Diga fundo e paleta com as cores dominantes, familia e peso de tipografia, tamanho relativo e alinhamento do texto, uso de imagem, meme, recorte ou foto, presenca de moldura, borda, sombra ou grao, como o texto se posiciona em relacao a imagem, e o que se repete slide a slide (o que e template) contra o que muda. Diga tambem a estrutura: o que a capa faz, o que cada slide do meio faz e como o ultimo fecha.',
'',
'FORMATO DO JSON:',
'{"titulo":"...","resumo":"3 a 5 linhas do que a peca diz","o_que_faz_funcionar":"o mecanismo de atencao, 2 a 3 linhas","angulo":"a leitura incomum aplicavel","mecanismo":"qual dos 15 mecanismos da anatomia viral","formato_sugerido":"nome do formato do catalogo","estilo_visual":"o design descrito como acima, ou vazio se nao vieram imagens","qtd_slides":numero de slides recebidos ou 0,"sugestao_clientes":[{"cliente":"nome exato da carteira","porque":"uma frase"}],"pergunta":"a pergunta curta pro Joao, sempre terminando em pra quem modelo"}'
].join('\n');

const texto = [
'REFERENCIA RECEBIDA',
'Plataforma: ' + (c.plataforma || 'nao identificada'),
'URL: ' + (c.url || 'sem link'),
c.autor ? 'Perfil de origem: ' + c.autor : '',
'',
c.conteudo
].filter(Boolean).join('\n');

const conteudo_user = [];
for (const b of (c.blocos_imagem || [])) conteudo_user.push(b);
conteudo_user.push({ type: 'text', text: texto });

return [{ json: { anthropic_body: {
  model: 'claude-sonnet-4-5',
  max_tokens: 2000,
  system,
  messages: [{ role: 'user', content: conteudo_user }]
}}}];
"""), tv=2, pos=[2680, 120])
link(metodo_base, prompt_analise)

claude_analise = node("Claude Analisa", "n8n-nodes-base.httpRequest",
                      http("https://api.anthropic.com/v1/messages", "POST",
                           "={{ JSON.stringify($json.anthropic_body) }}", creds="claude",
                           headers={"sendHeaders": True, "specifyHeaders": "keypair",
                                    "headerParameters": {"parameters": [
                                        {"name": "anthropic-version", "value": "2023-06-01"},
                                        {"name": "content-type", "value": "application/json"}]}},
                           timeout=180000),
                      tv=4, creds="claude", pos=[2900, 120])
link(prompt_analise, claude_analise)

parse_analise = node("Parse Analise", "n8n-nodes-base.code", code(r"""
const c = $('Consolidar Conteudo').first().json;
const r = $input.first().json || {};
let txt = '';
try { txt = (r.content || []).map(b => b.text || '').join('\n'); } catch (e) {}

let a = {};
const m = txt.match(/\{[\s\S]*\}/);
if (m) { try { a = JSON.parse(m[0]); } catch (e) {} }

// trava da casa: travessao nao sai daqui, nem no texto que a Sofia vai repetir
const limpa = (v) => typeof v === 'string'
  ? v.replace(/\s+[—–]\s+/g, ', ').replace(/[—–]/g, ',')
  : v;
for (const k of Object.keys(a)) a[k] = limpa(a[k]);

const sug = Array.isArray(a.sugestao_clientes) ? a.sugestao_clientes : [];
sug.forEach(s => { if (s) { s.cliente = limpa(s.cliente); s.porque = limpa(s.porque); } });
const nomes = sug.map(s => s && s.cliente).filter(Boolean);

const row = {
  origem: c.origem, tipo: c.qtd_imagens ? 'imagem' : c.tipo, plataforma: c.plataforma,
  fonte_url: c.url || null, midia_url: c.midia_url || null,
  autor: c.autor || null, titulo: a.titulo || c.titulo || null,
  legenda: c.legenda || null, transcricao: c.transcricao || null,
  resumo: a.resumo || null, motor: a.o_que_faz_funcionar || null,
  angulo: a.angulo || null, mecanismo: a.mecanismo || null,
  formato_sugerido: a.formato_sugerido || null,
  estilo_visual: a.estilo_visual || null,
  qtd_slides: Number(a.qtd_slides) || c.qtd_imagens || null,
  sugestao_clientes: nomes,
  estado: (a.resumo ? 'analisado' : 'erro'),
  enviado_por: c.enviado_por || null, chat_id: c.chatid || null,
  erro: c.erro || (a.resumo ? null : 'a analise voltou vazia')
};

return [{ json: { row, analise: a, sugestoes: sug, qtd_imagens: c.qtd_imagens || 0 } }];
"""), tv=2, pos=[3120, 120])
link(claude_analise, parse_analise)

salvar = node("Salvar no Cofre", "n8n-nodes-base.httpRequest",
              http(SUPA + "/intel_items", "POST", "={{ JSON.stringify($json.row) }}",
                   headers={"sendHeaders": True, "specifyHeaders": "keypair",
                            "headerParameters": {"parameters": [
                                {"name": "apikey", "value": SUPA_KEY},
                                {"name": "Prefer", "value": "return=representation"}]}}),
              tv=4, creds="supa", pos=[3340, 120])
link(parse_analise, salvar)

resp_analise = node("Resposta Analisar", "n8n-nodes-base.code", code(r"""
const saved = $input.first().json;
const row = Array.isArray(saved) ? saved[0] : saved;
const p = $('Parse Analise').first().json;
const a = p.analise || {};
const id = (row && row.id) || '';

const link = id ? '%CENTRAL%/inteligencia/' + id : '%CENTRAL%/inteligencia';

if (!a.resumo) {
  return [{ json: { ok: false, id, link,
    erro: (row && row.erro) || 'nao consegui ler essa referencia',
    instrucao: 'Diga ao Joao que nao deu pra ler essa referencia e peca o video direto ou outro link. Nao invente o conteudo.' }}];
}

const sug = (p.sugestoes || []).map((s, i) => (i + 1) + '. ' + s.cliente + ': ' + s.porque).join('\n');
const lido = p.qtd_imagens ? p.qtd_imagens + ' slides lidos' : 'video transcrito';

return [{ json: {
  ok: true, id, link, lido,
  titulo: a.titulo || '',
  resumo: a.resumo || '',
  o_que_faz_funcionar: a.o_que_faz_funcionar || '',
  angulo: a.angulo || '',
  mecanismo: a.mecanismo || '',
  formato_sugerido: a.formato_sugerido || '',
  sugestoes_texto: sug,
  pergunta: a.pergunta || 'pra quem eu modelo isso?',
  instrucao: 'Conte pro Joao o que voce viu (resumo + o que faz funcionar + angulo), liste as sugestoes de cliente numeradas do jeito que vieram, mande o link e termine perguntando pra quem modelar. Nao invente cliente fora da lista, nao mude a especialidade que veio escrita e nao use travessao.'
}}];
""".replace("%CENTRAL%", CENTRAL)), tv=2, pos=[3560, 120])
link(salvar, resp_analise)

# ---------------------------------------------------------------- MODELAR
prep_mod = node("Preparar Modelagem", "n8n-nodes-base.code", code(r"""
const b = $input.first().json.body || {};
const fmt = (b.formato || 'roteiro').toLowerCase().trim();
const ok = ['roteiro', 'flyer', 'carrossel', 'legenda'];
const formato = ok.includes(fmt) ? fmt : 'roteiro';
return [{ json: {
  intel_id: (b.intel_id || '').trim(),
  cliente: (b.cliente || '').trim(),
  formato,
  observacao: (b.observacao || '').trim(),
  chatid: b.chatid || ''
}}];
"""), tv=2, pos=[40, 460])
link(rota, prep_mod, 1)

# ATENCAO: no n8n, no HTTP que devolve lista vazia o fluxo PARA em silencio, sem erro.
# Foi o que aconteceu em 22/08: "Dr Daniel Peralba" nao casou com "Dr. Daniel Peralba" no
# ilike, a busca voltou vazia e a modelagem morreu ali, sem resposta pro agente.
# Por isso: alwaysOutputData em toda busca, e o match do cliente e feito no codigo.
buscar_item = node("Buscar Item", "n8n-nodes-base.httpRequest",
                   http("=" + SUPA + "/intel_items?id=eq.{{ $json.intel_id }}&select=*",
                        headers=supa_headers()), tv=4, creds="supa", pos=[260, 460],
                   extra={"alwaysOutputData": True})
link(prep_mod, buscar_item)

buscar_cli = node("Buscar Clientes p/ Modelar", "n8n-nodes-base.httpRequest",
                  http(SUPA + "/clients?select=name,segment,instagram,notes&status=eq.ativo&order=name",
                       headers=supa_headers()), tv=4, creds="supa", pos=[480, 460],
                  extra={"alwaysOutputData": True})
link(buscar_item, buscar_cli)

buscar_metodo = node("Buscar Metodo do Formato", "n8n-nodes-base.httpRequest",
                     http("=" + SUPA + "/intel_metodo?select=slug,titulo,conteudo&ativo=is.true&aplica_em=ov.%7Bsempre,{{ $('Preparar Modelagem').first().json.formato }}%7D&order=ordem",
                          headers=supa_headers()), tv=4, creds="supa", pos=[700, 460],
                     extra={"alwaysOutputData": True})
link(buscar_cli, buscar_metodo)

prompt_mod = node("Montar Prompt Modelagem", "n8n-nodes-base.code", code(r"""
const p = $('Preparar Modelagem').first().json;
const itens = $('Buscar Item').all().map(i => i.json);
const item = Array.isArray(itens[0]) ? itens[0][0] : itens[0];
const cards = $input.all().map(i => i.json).filter(x => x && x.conteudo);

if (!item || !item.id) {
  return [{ json: { falhou: true, motivo: 'nao achei essa referencia no cofre' } }];
}
if (item.estado === 'arquivado') {
  return [{ json: { falhou: true, motivo: 'essa referencia foi arquivada porque a leitura dela era invalida. Peca o link de novo pro Joao pra reler.' } }];
}
if (!item.resumo) {
  return [{ json: { falhou: true, motivo: 'essa referencia nunca foi lida direito, nao da pra modelar em cima dela' } }];
}

// match do cliente no codigo, sem depender de acento, ponto ou "Dr"
const slug = (v) => String(v || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(dr|dra|drs|clinica|hospital)\b/g, ' ').replace(/\s+/g, ' ').trim();
const alvo = slug(p.cliente);
const todos = $('Buscar Clientes p/ Modelar').all().map(i => i.json).filter(x => x && x.name);
let cli = todos.find(c => slug(c.name) === alvo)
       || todos.find(c => slug(c.name).includes(alvo) || alvo.includes(slug(c.name)));
if (!cli) {
  const palavras = alvo.split(' ').filter(w => w.length > 3);
  cli = todos.find(c => palavras.some(w => slug(c.name).includes(w))) || null;
}
const nome_cliente = cli ? cli.name : p.cliente;

const metodo = cards.map(k => '### ' + k.titulo + '\n' + k.conteudo).join('\n\n');

const alvo_txt = [
'CLIENTE ALVO: ' + nome_cliente,
cli && cli.segment ? 'Nicho: ' + cli.segment : '',
cli && cli.instagram ? 'Instagram: ' + cli.instagram : '',
cli && cli.notes ? 'Notas internas: ' + String(cli.notes).slice(0, 600) : '',
cli ? '' : 'AVISO: esse nome nao esta na tabela de clientes. Trate como cliente novo e nao invente dado dele.'
].filter(Boolean).join('\n');

// Modelagem espelho: se a referencia e carrossel lido slide a slide, a peca sai com a MESMA
// quantidade de slides (pedido do Joao em 22/08). O teto de 3 slides da casa vale quando nao
// existe referencia contada.
const n_slides = Number(item.qtd_slides) || 0;
const espelho = p.formato === 'carrossel' && n_slides >= 2;

const saida = {
roteiro: [
'ENTREGUE NESTA ORDEM, em markdown:',
'1. TITULO do video em uma linha.',
'2. ANGULO em uma frase (a leitura incomum) e TESE ("depois desse video quero que a pessoa acredite que...").',
'3. FORMATO escolhido do catalogo, com uma linha de por que esse e nao outro.',
'4. GANCHO VISUAL / COLD OPEN (0 a 2s), com a tecnica nomeada.',
'5. ROTEIRO em 6 blocos cronometrados. Cada bloco: nome do bloco, faixa de tempo, funcao em 4 palavras, e a FALA COMPLETA palavra por palavra, escrita pra boca.',
'6. 3 GANCHOS ALTERNATIVOS pro bloco 1.',
'7. B-ROLL POR FRASE: o que cobre a tela em cada trecho.',
'8. TEXTO NA TELA dos primeiros 5 a 8 segundos.',
'9. LEGENDA do post pronta pra colar.',
'10. CHECKLIST DE GRAVACAO: o que precisa ter em maos.'
],
flyer: [
'ENTREGUE NESTA ORDEM, em markdown:',
'1. CONCEITO em uma frase.',
'2. H1 (6 a 8 palavras) e mais 4 variacoes de H1 numeradas.',
'3. H2 que fortalece o H1.',
'4. CTA unico.',
'5. TEXTO DE APOIO se a arte pedir.',
'6. DIRECAO DE ARTE: o que aparece, enquadramento, paleta, referencia de estilo natural e real.',
'7. BRIEFING PRO DESIGNER no formato da casa, texto limpo sem asterisco, com tipo e formato, dimensoes, conteudo da arte, compliance, links do cliente, direcao de estilo e prazo.',
'8. PROMPT DE GERACAO da cena pra colar numa IA de imagem, uma cena, um sujeito, 4:5, sem texto nem logo na imagem, terco superior escuro reservado pro H1.',
'9. LEGENDA do post.'
],
carrossel: [
'ENTREGUE NESTA ORDEM, em markdown:',
'1. CONCEITO em uma frase e o angulo.',
'2. 5 VARIACOES DE CAPA numeradas, com o Top 3 recomendado.',
'3. O CARROSSEL COMPLETO com ' + (espelho ? 'EXATAMENTE ' + n_slides + ' SLIDES, a mesma quantidade da referencia' : 'NO MAXIMO 3 SLIDES') + '. Escreva o texto exato de cada slide, numerado, sem resumir e sem juntar dois num so.',
'4. DIRECAO DE ARTE POR SLIDE, replicando o estilo visual da referencia descrito acima: diga o fundo, a tipografia, o peso e o tamanho do texto, o que e imagem e o que e texto, e o que se mantem igual em todos os slides (o template).',
'5. COMO REPLICAR O ESTILO: um bloco curto pro designer, dizendo o que copiar da referencia (estrutura, tipografia, tratamento de imagem, ritmo) e o que trocar pra virar a marca do cliente (paleta, logo, assinatura). Copiar o SISTEMA visual, nunca a arte nem o texto do outro.',
'6. BRIEFING PRO DESIGNER em texto limpo, com dimensoes, quantidade de slides e compliance.',
'7. LEGENDA de 3 paragrafos.'
],
legenda: [
'ENTREGUE NESTA ORDEM, em markdown:',
'1. ANGULO em uma frase.',
'2. A LEGENDA pronta pra colar, com gancho nas 3 primeiras linhas.',
'3. 3 VARIACOES DE PRIMEIRA LINHA.',
'4. CTA e hashtags no fim.'
]
}[p.formato].join('\n');

const system = [
'Voce e o roteirista e copywriter da SVI Company. Escreve peca PRONTA PRA GRAVAR ou PRONTA PRA ARTE, nunca esqueleto.',
'',
'METODO DA CASA (obrigatorio, e a sua regua):',
metodo,
'',
alvo_txt,
'',
'MODELAR NAO E COPIAR. Voce pega o MECANISMO da referencia (o que faz ela prender) e aplica no territorio do cliente. Nada de traduzir a peca do outro nicho palavra por palavra.',
'',
saida,
'',
'REGRA DO PLACEHOLDER (bloqueante, e o erro que mais custa caro):',
'Nome de pessoa, numero de resultado, peso, prazo, preco, quantidade e nome de profissional so entram na peca se vierem da referencia, das notas do cliente ou da observacao do Joao. Se nao vierem, escreva o placeholder entre colchetes: [NOME DO PROFISSIONAL], [NUMERO REAL A CONFIRMAR], [PRECO A CONFIRMAR]. NUNCA preencha por plausibilidade, nem como exemplo.',
'NAO ATRIBUA IDENTIDADE. Genero, idade, profissao e esporte de quem aparece na referencia so podem ser citados se vierem escritos na transcricao ou na legenda. A analise veio de audio, nao de imagem.',
'DEPOIMENTO NAO SE INVENTA. Se a peca pede depoimento ou UGC em primeira pessoa de cliente, voce NAO escreve a fala fingindo ser o cliente. Voce entrega o ROTEIRO DE CAPTACAO: as perguntas que o cliente real responde, a direcao pra quem grava e os trechos obrigatorios. Fala inventada na boca de cliente e prova falsa.',
'',
'REVISAO FINAL OBRIGATORIA antes de montar o JSON, releia o que vai APARECER NA TELA e na legenda e conserte: nenhum travessao, nenhum "a gente" (troque por "nos", pelo verbo na primeira pessoa do plural, ou reformule), nenhum cliche de influencer, acentuacao correta. Esses quatro sao bloqueantes e ja escaparam antes.',
'',
'ANTES DE ENTREGAR, rode o gate de auditoria em silencio: zero travessao, acentuacao correta, sem "a gente" no escrito, sem cliche de influencer, sem numero inventado, sem promessa de resultado. Se o cliente for da saude, aplique a trava CFM. Nao escreva o relatorio da auditoria, so entregue a peca ja limpa.',
'',
'FECHE A PECA com uma secao "## A CONFIRMAR" listando cada dado que precisa ser confirmado antes de gravar ou de virar arte (numero, nome, oferta, preco, prova). Se nao houver nada pendente, escreva "nada pendente".',
'',
'COMO RESPONDER (obrigatorio): devolva SOMENTE um JSON valido com tres chaves, sem cerca de codigo e sem texto fora dele.',
'{"peca":"o markdown completo da peca, do jeito que foi pedido acima","whatsapp":"a versao curta pro WhatsApp","task":"o briefing pronto pra descricao da task no ClickUp"}',
'',
'A CHAVE whatsapp segue estas regras, porque ela e lida no celular:',
'1. No maximo 1200 caracteres. E o resumo do que da pra decidir no chat, nao o documento.',
'2. Sem markdown: nada de #, nada de ##, nada de ** e nada de bullet com hifen. WhatsApp nao renderiza isso e fica sujo na tela.',
'3. Negrito so com um asterisco de cada lado, no maximo tres vezes na mensagem inteira.',
'4. Estrutura, nesta ordem: uma linha com o formato, o cliente e o tamanho (ex: Carrossel · Hospital Jordao · 3 slides). Linha em branco. A capa recomendada. Linha em branco. O texto de cada slide ou de cada bloco, numerado, uma ideia por linha, so o que vai aparecer na peca. Linha em branco. Uma linha final dizendo que a direcao de arte, o briefing e o restante estao na task.',
'5. NADA de tipografia, peso de fonte, tamanho em pt, paleta, compliance, links do cliente ou secao A CONFIRMAR. Isso e briefing de designer e mora na task, nao no chat.',
'6. Nao repita a peca inteira, nao invente nada que nao esteja nela.',
'',
'A CHAVE task e o que o executor vai ler no ClickUp. Ela e a peca REORGANIZADA pra execucao, nao uma copia do documento:',
'1. TEXTO LIMPO. A API do ClickUp nao renderiza markdown, entao proibido #, ##, **, -- e linha de tracos. Titulo de secao em CAIXA ALTA sozinho na linha, e o conteudo embaixo. Acentuacao correta e obrigatoria, porque o executor copia esse texto direto pra arte. CAIXA ALTA NAO TIRA ACENTO: escreva CONSTIPAÇÃO, PÓLIPO, FÍSTULA, PRURIDO ANAL, ATENÇÃO. Palavra sem acento na arte e erro que vai impresso.',
'2. CADA COISA APARECE UMA VEZ SO. Nao repita o texto dos slides dentro da direcao de arte, nem monte um briefing que recapitula o que ja foi dito.',
'3. Nada de variacoes pra escolher. Va so com a capa recomendada. Escolha e do Joao, nao do executor.',
'4. Nada de conceito, angulo, tese ou explicacao de metodo. Isso e conversa interna e nao ajuda quem executa.',
'',
'ORDEM DA CHAVE task quando o formato for carrossel ou flyer (peca de design):',
'TIPO E FORMATO (o que e, quantas pecas, dimensoes em px)',
'CLIENTE E CONTEXTO (duas linhas, quem e e do que trata a peca)',
'O QUE ESCREVER EM CADA SLIDE (ou o H1, H2 e CTA no flyer): o texto exato, um slide por bloco, sem comentario)',
'DIRECAO DE ARTE (primeiro o TEMPLATE FIXO, o que se repete em todos, depois o que muda em cada slide, sem repetir o texto da copy)',
'O QUE COPIAR DA REFERENCIA e O QUE TROCAR (duas listas curtas, so quando existe referencia)',
'COMPLIANCE (as regras do cliente em linhas curtas)',
'LINKS DO CLIENTE (Instagram e site, com [A CONFIRMAR] no que faltar)',
'LEGENDA DO POST (o texto pronto)',
'A CONFIRMAR (o que falta pra executar)',
'PRAZO E PROVA (entregar na propria task)',
'',
'ORDEM DA CHAVE task quando o formato for roteiro ou legenda (peca de gravacao):',
'TIPO E FORMATO / CLIENTE E CONTEXTO / GANCHO VISUAL / ROTEIRO BLOCO A BLOCO com tempo e fala exata / GANCHOS ALTERNATIVOS / B-ROLL E TEXTO NA TELA / CHECKLIST DE GRAVACAO / LEGENDA DO POST / A CONFIRMAR / PRAZO E PROVA.',
'',
'DECORO (bloqueante em cliente de saude): nada de palavrao, vulgaridade ou piada de baixo calao em nenhuma parte da peca, nem como variacao descartada. Humor sim, chulo nao.'
].join('\n');

const user = [
'REFERENCIA DO COFRE',
item.titulo ? 'Titulo: ' + item.titulo : '',
item.fonte_url ? 'Fonte: ' + item.fonte_url : '',
item.autor ? 'Perfil de origem: ' + item.autor : '',
item.resumo ? '\nResumo: ' + item.resumo : '',
item.motor ? 'Motor: ' + item.motor : '',
item.angulo ? 'Angulo mapeado: ' + item.angulo : '',
item.mecanismo ? 'Mecanismo: ' + item.mecanismo : '',
item.formato_sugerido ? 'Formato sugerido na analise: ' + item.formato_sugerido : '',
item.estilo_visual ? '\nESTILO VISUAL DA REFERENCIA (replicar o sistema, nao a arte):\n' + item.estilo_visual : '',
espelho ? 'A REFERENCIA TEM ' + n_slides + ' SLIDES. A peca sai com ' + n_slides + ' slides, nem mais nem menos.' : '',
item.legenda ? '\nLEGENDA ORIGINAL:\n' + item.legenda : '',
item.transcricao ? '\nFALA ORIGINAL (transcricao):\n' + item.transcricao : '',
'\nMODELE ISSO PARA: ' + nome_cliente,
'FORMATO PEDIDO: ' + p.formato,
p.observacao ? 'OBSERVACAO DO JOAO: ' + p.observacao : ''
].filter(Boolean).join('\n');

return [{ json: { falhou: false, cliente_casado: nome_cliente, anthropic_body: {
  model: 'claude-sonnet-4-5',
  max_tokens: 8000,
  system,
  messages: [{ role: 'user', content: user }]
}}}];
"""), tv=2, pos=[920, 460])
link(buscar_metodo, prompt_mod)

if_mod = node("Da pra Modelar?", "n8n-nodes-base.if", {
    "conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 2},
                   "conditions": [{"leftValue": "={{ $json.falhou }}", "rightValue": "true",
                                   "operator": {"type": "boolean", "operation": "false", "singleValue": True}}],
                   "combinator": "and"}, "options": {}}, tv=2, pos=[1030, 460])
link(prompt_mod, if_mod)

recusa_mod = node("Resposta Nao Modelou", "n8n-nodes-base.code", code(r"""
const m = $input.first().json;
return [{ json: { ok: false, motivo: m.motivo,
  instrucao: 'A modelagem NAO aconteceu. Diga ao Joao exatamente isto: ' + m.motivo + '. NAO diga que ficou pronto e NAO invente a peca.' } }];
"""), tv=2, pos=[1250, 620])
link(if_mod, recusa_mod, 1)

claude_mod = node("Claude Modela", "n8n-nodes-base.httpRequest",
                  http("https://api.anthropic.com/v1/messages", "POST",
                       "={{ JSON.stringify($json.anthropic_body) }}", creds="claude",
                       headers={"sendHeaders": True, "specifyHeaders": "keypair",
                                "headerParameters": {"parameters": [
                                    {"name": "anthropic-version", "value": "2023-06-01"},
                                    {"name": "content-type", "value": "application/json"}]}},
                       timeout=300000),
                  tv=4, creds="claude", pos=[1140, 460])
link(if_mod, claude_mod, 0)

parse_mod = node("Parse Modelagem", "n8n-nodes-base.code", code(r"""
const p = $('Preparar Modelagem').first().json;
const r = $input.first().json || {};
let bruto = '';
try { bruto = (r.content || []).map(b => b.text || '').join('\n').trim(); } catch (e) {}

// Trava da casa: travessao nunca sai daqui.
const semTraco = (v) => String(v || '').replace(/\s+[—–]\s+/g, ', ').replace(/[—–]/g, ',');

// O modelo come acento quando escreve em CAIXA ALTA, e esse texto vai IMPRESSO na arte.
// Pedir no prompt nao resolveu, entao a correcao e deterministica.
const ACENTO_CAPS = {
  ATENCAO: 'ATENÇÃO', CONSTIPACAO: 'CONSTIPAÇÃO', POLIPO: 'PÓLIPO', FISTULA: 'FÍSTULA',
  ANUS: 'ÂNUS', INFLAMACAO: 'INFLAMAÇÃO', INFECCAO: 'INFECÇÃO', EVACUACAO: 'EVACUAÇÃO',
  PREVENCAO: 'PREVENÇÃO', ORIENTACAO: 'ORIENTAÇÃO', AVALIACAO: 'AVALIAÇÃO',
  LOCALIZACAO: 'LOCALIZAÇÃO', INFORMACAO: 'INFORMAÇÃO', RESTRICAO: 'RESTRIÇÃO',
  DIAGNOSTICO: 'DIAGNÓSTICO', PROSTATA: 'PRÓSTATA', CANCER: 'CÂNCER', HERNIA: 'HÉRNIA',
  ULCERA: 'ÚLCERA', ESTOMAGO: 'ESTÔMAGO', COLICA: 'CÓLICA', ANTIBIOTICO: 'ANTIBIÓTICO',
  MEDICO: 'MÉDICO', MEDICA: 'MÉDICA', CLINICA: 'CLÍNICA', SAUDE: 'SAÚDE',
  EMERGENCIA: 'EMERGÊNCIA', PRESSAO: 'PRESSÃO', VISAO: 'VISÃO', DEPRESSAO: 'DEPRESSÃO',
  NUTRICAO: 'NUTRIÇÃO', CIRURGICO: 'CIRÚRGICO', CIRURGIAO: 'CIRURGIÃO',
  ULTIMO: 'ÚLTIMO', PROXIMO: 'PRÓXIMO', OBSERVACAO: 'OBSERVAÇÃO', PADRAO: 'PADRÃO',
  SESSAO: 'SESSÃO', SESSOES: 'SESSÕES', DUVIDA: 'DÚVIDA', DUVIDAS: 'DÚVIDAS',
  TITULO: 'TÍTULO', VIDEO: 'VÍDEO', AUDIO: 'ÁUDIO', LOGICA: 'LÓGICA'
};
const arrumaCaps = (v) => String(v || '').replace(/\b[A-Z]{4,}\b/g,
  (w) => ACENTO_CAPS[w] || w);

const limpar = (v) => arrumaCaps(semTraco(v));
bruto = semTraco(bruto);

// O modelo devolve {"peca": ..., "whatsapp": ...}. Se o JSON vier quebrado, o texto cru vira a peca
// e o resumo de chat e montado no codigo, pra nunca deixar o Joao sem resposta.
let md = '', zap = '', tsk = '';
const bloco = bruto.match(/\{[\s\S]*\}/);
if (bloco) {
  try {
    const j = JSON.parse(bloco[0]);
    md = limpar(j.peca || ''); zap = limpar(j.whatsapp || ''); tsk = limpar(j.task || '');
  } catch (e) {}
}
if (!md) md = bruto.replace(/^```[a-z]*|```$/gm, '').trim();
if (!zap) {
  // plano B: tira as secoes de briefing e manda so o miolo da peca
  const corta = md.split(/^#{1,3}\s*(direcao de arte|direção de arte|como replicar|briefing|prompt|legenda|a confirmar)/im)[0];
  zap = corta.replace(/^#{1,6}\s*/gm, '').replace(/\*\*/g, '').trim().slice(0, 1200);
}

const casado = (() => { try { return $('Montar Prompt Modelagem').first().json.cliente_casado; } catch (e) { return ''; } })();
const cliente_final = casado || p.cliente;

const itens = $('Buscar Item').all().map(i => i.json);
const ref = Array.isArray(itens[0]) ? itens[0][0] : itens[0];

// A mesma referencia serve varios clientes, entao a REFERENCIA NUNCA guarda peca: toda
// modelagem nasce como linha propria apontando pra origem. Quando a peca morava na referencia,
// modelar pro segundo cliente apagava a do primeiro.
// Excecao: se a linha ja e uma peca derivada, remodelar atualiza ela mesma.
const derivar = !!(ref && !ref.derivado_de);

const patch = {
  cliente: cliente_final, formato: p.formato,
  entregavel: md || null,
  estado: md ? 'modelado' : 'erro',
  erro: md ? null : 'a modelagem voltou vazia'
};

const novo = derivar && md ? {
  derivado_de: ref.id,
  origem: ref.origem, tipo: ref.tipo, plataforma: ref.plataforma,
  fonte_url: ref.fonte_url, midia_url: ref.midia_url, autor: ref.autor,
  titulo: ref.titulo, legenda: ref.legenda, transcricao: ref.transcricao,
  resumo: ref.resumo, motor: ref.motor, angulo: ref.angulo, mecanismo: ref.mecanismo,
  formato_sugerido: ref.formato_sugerido, estilo_visual: ref.estilo_visual,
  qtd_slides: ref.qtd_slides, sugestao_clientes: ref.sugestao_clientes,
  enviado_por: ref.enviado_por, chat_id: p.chatid || ref.chat_id,
  cliente: cliente_final, formato: p.formato, entregavel: md, estado: 'modelado'
} : null;
// o briefing de execucao mora junto com a peca, pra task nunca sair de um dump de markdown
if (tsk) { patch.briefing = tsk; if (novo) novo.briefing = tsk; }

return [{ json: { patch, novo, derivar: !!novo, entregavel: md, whatsapp: zap, briefing: tsk,
                  intel_id: p.intel_id, chatid: p.chatid,
                  cliente: cliente_final, formato: p.formato } }];
"""), tv=2, pos=[1360, 460])
link(claude_mod, parse_mod)

prefer = {"sendHeaders": True, "specifyHeaders": "keypair",
          "headerParameters": {"parameters": [
              {"name": "apikey", "value": SUPA_KEY},
              {"name": "Prefer", "value": "return=representation"}]}}

if_deriva = node("Ja Tinha Peca?", "n8n-nodes-base.if", {
    "conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 2},
                   "conditions": [{"leftValue": "={{ $json.derivar }}", "rightValue": "true",
                                   "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                   "combinator": "and"}, "options": {}}, tv=2, pos=[1470, 460])
link(parse_mod, if_deriva)

criar_peca = node("Criar Peca Derivada", "n8n-nodes-base.httpRequest",
                  http(SUPA + "/intel_items", "POST", "={{ JSON.stringify($json.novo) }}",
                       headers=prefer), tv=4, creds="supa", pos=[1580, 340])
link(if_deriva, criar_peca, 0)

salvar_mod = node("Salvar Entregavel", "n8n-nodes-base.httpRequest",
                  http("=" + SUPA + "/intel_items?id=eq.{{ $json.intel_id }}", "PATCH",
                       "={{ JSON.stringify($json.patch) }}", headers=prefer),
                  tv=4, creds="supa", pos=[1580, 560])
link(if_deriva, salvar_mod, 1)

partir_msg = node("Partir Mensagem", "n8n-nodes-base.code", code(r"""
const m = $('Id da Peca').first().json;
const link = '%CENTRAL%/inteligencia/' + m.peca_id;
const chat = m.chatid || '';
if (!chat || !m.entregavel) return [{ json: { number: '', text: '', ordem: 0, skip: true } }];

// No chat vai a peca ENXUTA. O documento completo (direcao de arte, briefing, A CONFIRMAR)
// fica na task e na Central. Antes o markdown inteiro era despejado aqui e ficava ilegivel.
let texto = (m.whatsapp || '').trim();

// limpeza final de marcacao que o WhatsApp nao renderiza
texto = texto
  .replace(/^#{1,6}\s*/gm, '')
  .replace(/\*\*(.+?)\*\*/g, '*$1*')
  .replace(/^\s*[-•]\s+/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const partes = [];
if (texto.length <= 3000) {
  partes.push(texto);
} else {
  let buf = '';
  for (const l of texto.split('\n')) {
    if ((buf + l + '\n').length > 3000) { partes.push(buf.trimEnd()); buf = ''; }
    buf += l + '\n';
  }
  if (buf.trim()) partes.push(buf.trimEnd());
}
partes.push('Peca completa na Central: ' + link);

return partes.map((t, i) => ({ json: { number: chat.split('@')[0], text: t, ordem: i } }));
""".replace("%CENTRAL%", CENTRAL)), tv=2, pos=[1800, 460])
id_peca = node("Id da Peca", "n8n-nodes-base.code", code(r"""
// Depois de gravar, o id que interessa pro link e pro subir e o da PECA, nao o da referencia.
const salvo = $input.first().json;
const linha = Array.isArray(salvo) ? salvo[0] : salvo;
const m = $('Parse Modelagem').first().json;
return [{ json: { ...m, peca_id: (linha && linha.id) || m.intel_id } }];
"""), tv=2, pos=[1690, 460])
link(criar_peca, id_peca)
link(salvar_mod, id_peca)
link(id_peca, partir_msg)

loop_msg = node("Loop Partes", "n8n-nodes-base.splitInBatches", {"options": {}}, tv=3, pos=[2020, 460])
link(partir_msg, loop_msg)

enviar_peca = node("Enviar Peca no WhatsApp", "n8n-nodes-base.httpRequest",
                   http("https://svicompany.uazapi.com/send/text", "POST",
                        "={{ JSON.stringify({ number: $json.number, text: $json.text, delay: 900 }) }}",
                        creds="uaz"), tv=4, creds="uaz", pos=[2240, 560])
link(loop_msg, enviar_peca, 1)
link(enviar_peca, loop_msg)

resp_mod = node("Resposta Modelar", "n8n-nodes-base.code", code(r"""
const m = $('Id da Peca').first().json;
const link = '%CENTRAL%/inteligencia/' + m.peca_id;
if (!m.entregavel) {
  return [{ json: { ok: false, id: m.peca_id, link,
    instrucao: 'Diga ao Joao que a modelagem falhou e pergunte se ele quer tentar de novo.' }}];
}
const noChat = !!m.chatid;
return [{ json: {
  ok: true, id: m.peca_id, link, cliente: m.cliente, formato: m.formato,
  entregue_no_chat: noChat,
  entregavel: noChat ? undefined : m.entregavel,
  instrucao: noChat
    ? 'A peca ja foi enviada no chat, na versao enxuta, com o link da Central. NAO repita nada dela e NAO resuma. Responda com UMA linha curta perguntando pra quem subir, citando os nomes possiveis.'
    : 'Mande a peca do campo entregavel no chat, na integra e sem reescrever nada, depois pergunte pra quem subir.'
}}];
""".replace("%CENTRAL%", CENTRAL)), tv=2, pos=[2240, 380])
link(loop_msg, resp_mod, 0)

# ---------------------------------------------------------------- SUBIR
prep_subir = node("Preparar Task", "n8n-nodes-base.code", code(r"""
const b = $input.first().json.body || {};
return [{ json: {
  intel_id: (b.intel_id || '').trim(),
  responsavel: (b.responsavel || '').trim(),
  prazo: (b.prazo || '').trim(),
  chatid: b.chatid || ''
}}];
"""), tv=2, pos=[40, 800])
link(rota, prep_subir, 2)

buscar_item2 = node("Buscar Item p/ Task", "n8n-nodes-base.httpRequest",
                    http("=" + SUPA + "/intel_items?id=eq.{{ $json.intel_id }}&select=*",
                         headers=supa_headers()), tv=4, creds="supa", pos=[260, 800])
link(prep_subir, buscar_item2)

montar_task = node("Montar Task", "n8n-nodes-base.code", code(r"""
const p = $('Preparar Task').first().json;
const arr = $input.all().map(i => i.json);
const item = Array.isArray(arr[0]) ? arr[0][0] : arr[0];

if (!item || !item.entregavel) {
  return [{ json: { falhou: true, motivo: 'essa referencia ainda nao tem peca modelada' } }];
}

const TIME = {
  jose:     { id: '284506251', lista: '901521539717', papel: 'design' },
  lais:     { id: '112541047', lista: '901524992979', papel: 'design' },
  sarah:    { id: '284661071', lista: '901523996247', papel: 'social' },
  leticia:  { id: '88008778',  lista: '',             papel: 'video' },
  matheus:  { id: '302494819', lista: '901523658547', papel: 'edicao' },
  arthur:   { id: '302513742', lista: '',             papel: 'gmb' },
  aleilson: { id: '102790495', lista: '901522278032', papel: 'trafego' },
  joao:     { id: '78754871',  lista: '',             papel: 'ceo' }
};

const CLIENTES = {
  'dr. brenno': '901513446653', 'brenno': '901513446653',
  'dra esia': '901521680352', 'esia': '901521680352',
  'dr daniel peralba': '901517387152', 'daniel': '901517387152', 'peralba': '901517387152',
  'dr felipe branco': '901520517836', 'felipe': '901520517836',
  'dra paula': '901522088950', 'paula': '901522088950',
  'spa nature': '901511034769', 'hospital jordao': '901511034766', 'jordao': '901511034766',
  'nikolas fisio': '901511034768', 'nikolas': '901511034768',
  'a formula': '901512304200', 'formula': '901512304200',
  'vanessa back': '901514733445', 'vanessa': '901514733445',
  'numeros contabilidade': '901516154768', 'espaco soraia': '901520517828', 'soraia': '901520517828',
  'colegio christo rei': '901521680351', 'christo': '901521680351',
  'dale carnegie': '901522561321', 'norte capital': '901522064869', 'realme': '901520822878',
  'oficinas burguer': '901521680366', 'otica central': '901511034765', 'otica': '901511034765',
  'alpha fitness': '901511205105', 'alpha': '901511205105',
  'mjc kitchen': '901511034783', 'mjc pavers': '901513967600', 'ma pavers': '901515886007',
  'experience pavers': '901522218395', 'aerojet': '901517934387',
  'exatta solar': '901511034757', 'exatta': '901511034757', 'svi moda': '901512721116'
};

const GERAL = '901510966944';

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const rkey = slug(p.responsavel).split(' ')[0];
const resp = TIME[rkey];
if (!resp) {
  return [{ json: { falhou: true, motivo: 'nao reconheci o responsavel ' + p.responsavel } }];
}

const cslug = slug(item.cliente);
let lista_cliente = CLIENTES[cslug] || '';
if (!lista_cliente) {
  for (const k of Object.keys(CLIENTES)) {
    if (cslug && (cslug.includes(k) || k.includes(cslug))) { lista_cliente = CLIENTES[k]; break; }
  }
}

// Design vai pra lista do designer (regra da casa). O resto vai pra lista do cliente.
const lista = resp.papel === 'design'
  ? resp.lista
  : (lista_cliente || resp.lista || GERAL);

const eh_anuncio = /anuncio|ads|trafego/i.test(item.entregavel.slice(0, 400));
const rotulo = { roteiro: 'ROTEIRO', flyer: 'ARTE', carrossel: 'CARROSSEL', legenda: 'LEGENDA' }[item.formato] || 'PECA';
const cliente_nome = item.cliente || 'SVI';
// O titulo da task e o nome da PECA, nao um rotulo de secao nem o titulo da referencia.
// Em carrossel e flyer o entregavel abre com "# CONCEITO", entao caçar o primeiro heading
// dava titulo "CONCEITO". Aqui a capa vem primeiro, depois heading util, depois fallback.
const md = item.entregavel;
const generico = /^(conceito|angulo|angulo e tese|formato|tese|resumo|carrossel completo|variacoes de capa|5 variacoes de capa|direcao de arte|briefing|legenda|prompt|checklist|a confirmar|roteiro|entrega)/i;
const semAcento = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

let escolhido = '';
// 1. a capa do carrossel ou o H1 do flyer
const capa = md.match(/slide\s*1[^\n]*\n+\s*\*\*([^*\n]{6,90})\*\*/i)
          || md.match(/\bH1\b[^\n]*?\*\*([^*\n]{6,90})\*\*/i)
          || md.match(/^\s*\*\*([^*\n]{10,90})\*\*\s*$/m);
if (capa) escolhido = capa[1];

// 2. senao, o primeiro heading que nao seja rotulo de secao
if (!escolhido) {
  const heads = [...md.matchAll(/^#{1,3}\s+(.+)$/gm)].map(m => m[1].trim());
  escolhido = heads.find(h => !generico.test(semAcento(h))) || '';
}

const titulo_curto = (escolhido || item.titulo || item.angulo || 'peca modelada')
  .replace(/^(ROTEIRO|CARROSSEL|FLYER|LEGENDA|ARTE)\s*[:.]?\s*/i, '')
  .replace(/\*\*/g, '').split('\n')[0].trim().slice(0, 70);

// Prazo: entende o que o Joao fala ("hoje", "amanha", "segunda"). Sem nada dito, +2 dias uteis.
// Tudo calculado em horario de Brasilia e devolvido em epoch UTC.
function prazoMs() {
  const pedido = String(p.prazo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const d = new Date(Date.now() + 3 * 3600 * 1000);   // agora, em Brasilia
  const dias = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

  if (/hoje/.test(pedido)) {
    // fica hoje mesmo
  } else if (/amanha/.test(pedido)) {
    d.setUTCDate(d.getUTCDate() + 1);
  } else {
    const dia = Object.keys(dias).find(k => pedido.includes(k));
    if (dia) {
      const alvoDow = dias[dia];
      do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== alvoDow);
    } else {
      let add = 2;
      while (add > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) add--;
      }
    }
  }
  d.setUTCHours(18, 0, 0, 0);
  return d.getTime() - 3 * 3600 * 1000;
}

const link = '%CENTRAL%/inteligencia/' + item.id;

const espelhou = item.formato === 'carrossel' && Number(item.qtd_slides) >= 2;

// A descricao e o BRIEFING de execucao, ja em texto limpo e sem repeticao. O documento
// completo (conceito, variacoes, metodo) fica na Central, que e onde o Joao revisa.
// Sem link da Central aqui: Jose e Lais nao tem conta.
// Plano B: se a modelagem nao gerou briefing, vai a peca, com a marcacao removida.
const corpo = item.briefing
  ? item.briefing
  : String(item.entregavel || '')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/^\s*---+\s*$/gm, '');

const desc = [
rotulo + (eh_anuncio ? ' ANUNCIO' : '') + ' para ' + cliente_nome,
espelhou ? 'Modelagem espelho: a referencia tem ' + item.qtd_slides + ' slides, a peca sai com ' + item.qtd_slides + '.' : '',
item.fonte_url ? 'Referencia de origem, abra pra ver o design: ' + item.fonte_url : '',
'',
corpo,
'',
'Duvida sobre o conteudo, chama o Joao.'
].filter(Boolean).join('\n');

return [{ json: {
  falhou: false,
  intel_id: item.id,
  lista,
  assignee: resp.id,
  responsavel: p.responsavel,
  task_name: rotulo + ' · [' + cliente_nome.toUpperCase() + '] ' + titulo_curto,
  task_desc: desc.slice(0, 30000),
  due: prazoMs(),
  chatid: p.chatid,
  cliente: cliente_nome,
  link
}}];
""".replace("%CENTRAL%", CENTRAL)), tv=2, pos=[480, 800])
link(buscar_item2, montar_task)

criar_task = node("ClickUp Criar Task", "n8n-nodes-base.clickUp", {
    "team": "9015595861", "space": "90154550355", "folderless": True,
    "list": "={{ $json.lista }}",
    "name": "={{ $json.task_name }}",
    "additionalFields": {
        "assignees": ["={{ $json.assignee }}"],
        "content": "={{ $json.task_desc }}",
        "dueDate": "={{ new Date($json.due).toISOString() }}",
        "dueDateTime": True,
        "priority": 3}},
    tv=1, creds="clickup", pos=[700, 800],
    extra={"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 2500,
           "onError": "continueRegularOutput"})
link(montar_task, criar_task)

salvar_task = node("Salvar Task no Cofre", "n8n-nodes-base.httpRequest",
                   http("=" + SUPA + "/intel_items?id=eq.{{ $('Montar Task').first().json.intel_id }}",
                        "PATCH",
                        "={{ JSON.stringify({ estado: $json.id ? 'entregue' : 'modelado', responsavel: $('Montar Task').first().json.responsavel, clickup_task_id: $json.id || null, clickup_url: $json.url || null }) }}",
                        headers=supa_headers()), tv=4, creds="supa", pos=[920, 800])
link(criar_task, salvar_task)

resp_subir = node("Resposta Subir", "n8n-nodes-base.code", code(r"""
const t = $('Montar Task').first().json;
if (t.falhou) {
  return [{ json: { ok: false, instrucao: 'Diga ao Joao: ' + t.motivo } }];
}
const task = $('ClickUp Criar Task').first().json || {};
const ok = !!task.id;
return [{ json: {
  ok,
  task_id: task.id || null,
  task_url: task.url || null,
  responsavel: t.responsavel,
  cliente: t.cliente,
  link: t.link,
  instrucao: ok
    ? 'Confirme pro Joao em uma linha que subiu pro ' + t.responsavel + ' e mande o link da task do ClickUp. Nao mande o link da Central pra ninguem do time (so o Joao, a Leticia, a Sarah e o Arthur tem acesso) e nao repita a peca.'
    : 'Diga ao Joao que a task nao foi criada no ClickUp e que a peca segue salva na Central.'
}}];
"""), tv=2, pos=[1140, 800])
link(salvar_task, resp_subir)

# ---------------------------------------------------------------- PINGAR
# Rota de diagnostico. O n8n no EasyPanel nao alcanca o proprio dominio publico
# (sem hairpin NAT), entao serve pra descobrir qual host interno responde.
ping = node("Ping Interno", "n8n-nodes-base.httpRequest",
            {"method": "GET", "url": "={{ $json.body.alvo }}",
             "options": {"timeout": 12000, "response": {"response": {"neverError": True, "fullResponse": True}}}},
            tv=4, pos=[40, 1100], extra={"onError": "continueRegularOutput"})
link(rota, ping, 3)

resp_ping = node("Resposta Ping", "n8n-nodes-base.code", code(r"""
const alvo = $('Webhook Cofre').first().json.body.alvo;
const r = $input.first().json || {};
return [{ json: { ok: !r.error, alvo, status: r.statusCode || null,
                  erro: r.error ? String(r.error).slice(0, 200) : null,
                  corpo: typeof r.body === 'string' ? r.body.slice(0, 200) : null } }];
"""), tv=2, pos=[260, 1100])
link(ping, resp_ping)

# ---------------------------------------------------------------- resposta
responder = node("Responder", "n8n-nodes-base.respondToWebhook",
                 {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}", "options": {}},
                 tv=1, pos=[3360, 460])
link(resp_analise, responder)
link(recusa, responder)
link(resp_mod, responder)
link(recusa_mod, responder)
link(resp_subir, responder)
link(resp_ping, responder)

wf = {"name": WF_NAME, "nodes": nodes, "connections": conns,
      "settings": {"executionOrder": "v1", "timezone": "America/Belem",
                   "saveExecutionProgress": True, "saveManualExecutions": True},
      "staticData": None}


def api(path, method="GET", data=None):
    req = urllib.request.Request(
        N8N + path, method=method,
        headers={"X-N8N-API-KEY": KEY, "Content-Type": "application/json"},
        data=json.dumps(data).encode() if data is not None else None)
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:600]}") from None


if __name__ == "__main__":
    existing = [w for w in api("/workflows?limit=250")["data"] if w["name"] == WF_NAME]
    if existing:
        wid = existing[0]["id"]
        api(f"/workflows/{wid}", "PUT", wf)
        print("atualizado", wid)
    else:
        r = api("/workflows", "POST", wf)
        wid = r["id"]
        print("criado", wid)
    print("webhook: https://n8n.svicompany.com.br/webhook/cofre-intel")
    print("nodes:", len(nodes))
