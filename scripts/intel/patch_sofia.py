# -*- coding: utf-8 -*-
"""Liga a Sofia no Cofre de Inteligencia.

O que faz no workflow ATIVO 'Sofia - Assistente WhatsApp' (qLZgPE9TRUpmFW2s):
  1. adiciona 4 ferramentas HTTP no agente (analisar, modelar, subir, listar)
  2. acrescenta a secao COFRE DE INTELIGENCIA no system prompt
  3. faz o video mandado direto no WhatsApp cair no cofre em vez de so devolver a transcricao

Idempotente: rodar de novo so atualiza o que mudou.
"""
import json, os, sys, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import segredos

WF_ID = "qLZgPE9TRUpmFW2s"
BASE = "https://n8n.svicompany.com.br/api/v1"
KEY = segredos.n8n_api_key()
SUPA_KEY = segredos.supabase_service_key()
# Rede interna do EasyPanel: o n8n nao alcanca o proprio dominio publico (sem hairpin NAT).
# Ver feedback_easypanel_rede_interna_webhook. O host do processador de webhook e n8n_n8n_webhook.
HOOK = "http://n8n_n8n_webhook:5678/webhook/cofre-intel"
CHAT = "$('Todas as Mensagens').first().json.chatid"
QUEM = "$('Todas as Mensagens').first().json.sender_name"

SECAO = """
## COFRE DE INTELIGENCIA (referencia -> peca -> task no ClickUp)
Quando mandarem um LINK de Instagram, TikTok ou YouTube, um video, ou colarem um texto dizendo que e referencia, voce entra neste fluxo. Sao 3 passos e voce nunca pula um.

PASSO 1, LER. Chame `Cofre_Analisar_Link` com a URL. Ela baixa, transcreve e le tudo, e devolve resumo, o_que_faz_funcionar, angulo, formato_sugerido, sugestoes_texto, link e id. Conte o que voce viu (resumo + o que faz funcionar + angulo), liste as sugestoes numeradas do jeito que vieram, mande o link da Central e termine perguntando pra quem modelar. NUNCA sugira cliente que nao veio na resposta. GUARDE o id.

PASSO 2, MODELAR. Quando disserem o cliente, chame `Cofre_Modelar` com intel_id, cliente e formato. Se nao disserem o formato, pergunte com 2 opcoes (roteiro de reel ou copy de flyer, por exemplo) antes de chamar. A propria ferramenta manda a peca no chat. Voce NAO repete a peca, NAO resume e NAO reescreve nada dela. Responda uma linha curta e pergunte pra quem subir.

PASSO 3, SUBIR. A modelagem devolve um `id` NOVO, que e o id da PECA (a referencia continua separada, porque a mesma referencia serve varios clientes). Use SEMPRE esse id da peca no passo 3, nunca o id da analise. Quando disserem o nome, chame `Cofre_Subir_Task` com intel_id e responsavel (jose, lais, sarah, leticia, matheus, arthur, aleilson ou joao). Ela cria a task com a peca inteira mais o link. Confirme com o link da task.

REGRA DE HONESTIDADE DO COFRE (a mais importante):
Toda ferramenta do cofre devolve um campo `ok`. Voce SO pode dizer que algo ficou pronto se veio `ok: true`. Se veio `ok: false`, ou se a ferramenta nao respondeu, voce diz exatamente o motivo que veio no campo `motivo` ou `erro` e NAO afirma que modelou, que subiu ou que esta pronto. Nunca diga "pronto", "modelado" ou "subi" por antecipacao. Se a resposta trouxer o campo `instrucao`, siga essa instrucao ao pe da letra.

REGRAS DO COFRE:
- NAO use Create_ClickUp_Task pra peca do cofre. Quem cria e o `Cofre_Subir_Task`, porque ele cola a peca VERBATIM. Create_ClickUp_Task continua valendo pro resto.
- Perdeu o intel_id, ou o Joao falou de "aquela referencia de ontem"? Chame `Cofre_Listar_Recentes` primeiro e confirme qual e antes de modelar. Use SEMPRE o id da leitura mais recente daquele link: referencia com estado `arquivado` foi invalidada e a ferramenta vai recusar.
- Analise voltou ok=false? Diga o motivo e peca o video direto ou outro link. Nao invente o conteudo da referencia.
- Mandaram link e ja disseram o cliente na mesma mensagem? Roda o passo 1 e emenda no passo 2, sem esperar.
- Uma referencia pode virar peca pra varios clientes. Cada modelagem gera uma peca propria, entao pra modelar pro segundo cliente voce usa de novo o id da ANALISE, e pra subir usa o id da PECA daquele cliente.
- Video que o Joao manda direto ja entra no cofre sozinho. Se ele responder sobre esse video, use `Cofre_Listar_Recentes` pra achar o id.
"""


def tool(name, desc, body, pos):
    return {
        "id": "cofre-" + name.lower(),
        "name": name,
        "type": "n8n-nodes-base.httpRequestTool",
        "typeVersion": 4.4,
        "position": pos,
        "parameters": {
            "toolDescription": desc,
            "method": "POST",
            "url": HOOK,
            "sendBody": True,
            "contentType": "json",
            "specifyBody": "json",
            "jsonBody": body,
            "options": {"timeout": 300000},
        },
    }


TOOLS = [
    tool("Cofre_Analisar_Link",
         "Le uma referencia de conteudo (link de Instagram, TikTok ou YouTube, ou um texto colado) e devolve resumo, o que faz aquilo funcionar, o angulo, o formato sugerido e pra quais clientes da SVI serve. Use SEMPRE que mandarem um link de post ou um texto de referencia. Devolve tambem o id da referencia no cofre, guarde esse id.",
         "={{ JSON.stringify({ acao: 'analisar', url: $fromAI('url', 'URL completa do post, reel ou video. Vazio se for so texto.', 'string'), texto: $fromAI('texto', 'Texto colado, quando nao houver link. Pode ser vazio.', 'string'), chatid: " + CHAT + ", enviado_por: " + QUEM + ", origem: 'whatsapp' }) }}",
         [3400, 900]),
    tool("Cofre_Modelar",
         "Modela uma referencia do cofre para um cliente especifico, no metodo da casa (anatomia viral, formatos criativos, ORION, copy, travas de CFM). Formatos aceitos: roteiro, flyer, carrossel, legenda. A ferramenta JA ENVIA a peca pronta no chat, voce nao precisa repetir. Use depois que o Joao disser pra quem modelar.",
         "={{ JSON.stringify({ acao: 'modelar', intel_id: $fromAI('intel_id', 'id da referencia no cofre, veio da analise', 'string'), cliente: $fromAI('cliente', 'nome do cliente pra quem modelar', 'string'), formato: $fromAI('formato', 'roteiro, flyer, carrossel ou legenda', 'string'), observacao: $fromAI('observacao', 'instrucao extra do Joao. Pode ser vazio.', 'string'), chatid: " + CHAT + " }) }}",
         [3620, 900]),
    tool("Cofre_Subir_Task",
         "Sobe a peca modelada pro ClickUp na lista certa, com o roteiro ou a copy inteira na descricao mais o link da Central, e atribui ao responsavel. Use depois que o Joao disser pra quem subir. Responsaveis: jose, lais, sarah, leticia, matheus, arthur, aleilson, joao.",
         "={{ JSON.stringify({ acao: 'subir', intel_id: $fromAI('intel_id', 'id da referencia no cofre', 'string'), responsavel: $fromAI('responsavel', 'primeiro nome de quem vai executar', 'string'), prazo: $fromAI('prazo', 'prazo dito pelo Joao: hoje, amanha, segunda, terca... Vazio se ele nao disser.', 'string'), chatid: " + CHAT + " }) }}",
         [3840, 900]),
]

LISTAR = {
    "id": "cofre-listar",
    "name": "Cofre_Listar_Recentes",
    "type": "n8n-nodes-base.httpRequestTool",
    "typeVersion": 4.4,
    "position": [4060, 900],
    "parameters": {
        "toolDescription": "Lista as ultimas referencias guardadas no cofre de inteligencia, com id, titulo, cliente e estado. Use quando o Joao falar de uma referencia anterior e voce nao tiver o id em maos.",
        "method": "GET",
        "url": "https://qvkfcvcqlfamyzgqgnrq.supabase.co/rest/v1/intel_items?select=id,titulo,cliente,formato,estado,criado_em&order=criado_em.desc&limit=8",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "apikey", "value": SUPA_KEY},
            {"name": "Authorization", "value": "Bearer " + SUPA_KEY}]},
        "options": {"timeout": 20000},
    },
}

COFRE_VIDEO = {
    "id": "cofre-video",
    "name": "Cofre do Video",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4,
    "position": [3180, 1500],
    "parameters": {
        "method": "POST",
        "url": HOOK,
        "sendBody": True,
        "contentType": "json",
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ acao: 'analisar', transcricao: ($json.text || ''), tipo: 'video', chatid: $('UazAPI Webhook').first().json.body.message.chatid, enviado_por: ($('UazAPI Webhook').first().json.body.message.senderName || 'Joao'), origem: 'whatsapp', titulo: ($('UazAPI Webhook').first().json.body.message.caption || '') }) }}",
        "options": {"timeout": 300000, "response": {"response": {"neverError": True}}},
    },
    "onError": "continueRegularOutput",
}

RESPOSTA_VIDEO = r"""
const chatid = $('UazAPI Webhook').first().json.body.message.chatid || '';
let t = '';
try { t = ($('Whisper Video').first().json.text || '').trim(); } catch (e) {}

// 22/08: o video agora passa pelo Cofre de Inteligencia antes de responder.
let c = {};
try { c = $input.first().json || {}; } catch (e) {}

// O limite de 25 MB e do Whisper (vale pro Groq e pra OpenAI).
let mb = 0;
try {
  const bin = $('UazAPI Download Binary').first().binary || {};
  const d = bin.data || Object.values(bin)[0] || {};
  const raw = String(d.fileSize || '');
  const num = parseFloat(raw.replace(/[^\d.]/g, '')) || 0;
  if (/gb/i.test(raw)) mb = num * 1024;
  else if (/kb/i.test(raw)) mb = num / 1024;
  else if (/mb/i.test(raw)) mb = num;
  else if (num > 1000000) mb = num / 1048576;
  else mb = num;
} catch (e) {}

let msg;
if (c && c.ok && c.resumo) {
  msg = 'Vi o video.\n\n' + c.resumo +
        (c.o_que_faz_funcionar ? '\n\nO que faz funcionar: ' + c.o_que_faz_funcionar : '') +
        (c.angulo ? '\n\nAngulo: ' + c.angulo : '') +
        (c.formato_sugerido ? '\nFormato: ' + c.formato_sugerido : '') +
        (c.sugestoes_texto ? '\n\nServe pra:\n' + c.sugestoes_texto : '') +
        (c.link ? '\n\n' + c.link : '') +
        '\n\nPra quem eu modelo?';
} else if (t) {
  msg = 'Transcricao do video:\n\n' + t;
} else if (mb > 24) {
  msg = 'Esse video tem cerca de ' + mb.toFixed(0) + ' MB e passa do limite de 25 MB da transcricao.\n\nManda um trecho menor, ou extrai o audio e me envia como audio, que eu transcrevo na hora.';
} else {
  msg = 'Nao consegui transcrever esse video.\n\nSe ele nao tem fala, e isso mesmo. Se tem, me manda o audio separado que eu tento de novo.';
}
return [{ json: { number: chatid.split('@')[0], text: msg, delayMs: 800 } }];
"""


def api(path, method="GET", data=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        headers={"X-N8N-API-KEY": KEY, "Content-Type": "application/json"},
        data=json.dumps(data).encode() if data is not None else None)
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:600]}") from None


def main():
    wf = api(f"/workflows/{WF_ID}")
    nodes = wf["nodes"]
    conns = wf["connections"]
    by_name = {n["name"]: n for n in nodes}

    novos = TOOLS + [LISTAR]
    for t in novos:
        if t["name"] in by_name:
            nodes[nodes.index(by_name[t["name"]])] = t
            print("atualizado tool", t["name"])
        else:
            nodes.append(t)
            print("adicionado tool", t["name"])
        conns[t["name"]] = {"ai_tool": [[{"node": "Sofia Agent", "type": "ai_tool", "index": 0}]]}

    # system prompt
    agent = by_name["Sofia Agent"]
    sm = agent["parameters"]["options"]["systemMessage"]
    marcador = "## COFRE DE INTELIGENCIA"
    if marcador in sm:
        ini = sm.index(marcador)
        fim = sm.index("## FORMATO DE RESPOSTA NO WHATSAPP")
        sm = sm[:ini] + SECAO.strip() + "\n\n" + sm[fim:]
        print("secao do cofre atualizada no prompt")
    else:
        alvo = "## FORMATO DE RESPOSTA NO WHATSAPP"
        assert alvo in sm, "nao achei onde encaixar a secao"
        sm = sm.replace(alvo, SECAO.strip() + "\n\n" + alvo)
        print("secao do cofre adicionada no prompt")
    agent["parameters"]["options"]["systemMessage"] = sm

    # video -> cofre
    if "Cofre do Video" not in by_name:
        nodes.append(COFRE_VIDEO)
        print("adicionado no Cofre do Video")
    else:
        nodes[nodes.index(by_name["Cofre do Video"])] = COFRE_VIDEO
        print("atualizado no Cofre do Video")
    conns["Whisper Video"] = {"main": [[{"node": "Cofre do Video", "type": "main", "index": 0}]]}
    conns["Cofre do Video"] = {"main": [[{"node": "Montar Resposta Video", "type": "main", "index": 0}]]}
    by_name["Montar Resposta Video"]["parameters"]["jsCode"] = RESPOSTA_VIDEO.strip()
    print("resposta do video reescrita")

    # o PUT so aceita um subconjunto de settings, o GET devolve mais do que isso
    PERMITIDO = {"executionOrder", "timezone", "saveExecutionProgress", "saveManualExecutions",
                 "saveDataErrorExecution", "saveDataSuccessExecution", "callerPolicy",
                 "errorWorkflow", "executionTimeout"}
    settings = {k: v for k, v in (wf.get("settings") or {}).items() if k in PERMITIDO}
    payload = {"name": wf["name"], "nodes": nodes, "connections": conns,
               "settings": settings, "staticData": wf.get("staticData")}
    api(f"/workflows/{WF_ID}", "PUT", payload)
    depois = api(f"/workflows/{WF_ID}")
    print("nodes:", len(depois["nodes"]), "| ativo:", depois["active"])


if __name__ == "__main__":
    main()
