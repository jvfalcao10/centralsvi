# Cofre de Inteligência (Central + Sofia)

Desenhado com o João em 22/08/2026. Ele manda uma referência, a Sofia lê tudo, propõe pra quem
serve, modela no método da casa e sobe pro ClickUp com a peça inteira.

## O fluxo

1. **Você manda** um link de Instagram, TikTok ou YouTube pra Sofia no WhatsApp (PV ou grupo, marcando
   ela). Vídeo enviado direto também entra. Pela Central, o botão "Nova referência" faz o mesmo.
2. **Ela lê tudo**: baixa via Apify, transcreve no Whisper (Groq) e passa pelo método da casa.
   Devolve resumo, o que faz aquilo funcionar, o ângulo, o formato do catálogo e 3 clientes da
   carteira pra quem serve. Grava no cofre e manda o link.
3. **Você diz pra quem** modelar e em qual formato (roteiro, flyer, carrossel ou legenda).
4. **Ela modela** e manda a peça pronta no chat, na íntegra.
5. **Você diz pra quem subir**. Ela cria a task no ClickUp com a peça VERBATIM na descrição, o link
   da Central e o responsável, na lista certa.

## As peças

| Peça | Onde | ID |
|---|---|---|
| Workflow do cofre | n8n | `8sKHvNlYEPvoEjLG` · webhook `/webhook/cofre-intel` |
| Sofia (agente) | n8n | `qLZgPE9TRUpmFW2s` · 4 ferramentas `Cofre_*` |
| Tabela do cofre | Supabase `qvkfcvcqlfamyzgqgnrq` | `intel_items` |
| Método de conteúdo | Supabase | `intel_metodo` (16 cartões) |
| Página | Central | `/inteligencia` e `/inteligencia/:id` |

## O método que ela usa

`intel_metodo` é a destilação executável das skills de conteúdo da casa. Cada cartão tem
`aplica_em`, e a Sofia carrega só os que valem pro formato pedido, mais os `sempre`.

travas-svi · cfm-2336 · diagnostico-mercado · anatomia-viral · orion · maquina-roteiros ·
roteiro-falcao · gancho-visual · formatos-criativos · reel-tabu-medico · brands-decoded ·
copy-direct-response · legenda-svi · subir-design · auditar-texto · distribuicao

Pra editar o método: mexer em `scripts/intel/metodo_cards.py` e rodar `python3 scripts/intel/seed_metodo.py`.
Não precisa tocar no n8n, o workflow lê do banco em toda modelagem.

## Rodar de novo os builders

```
cd scripts/intel
python3 seed_metodo.py       # método no Supabase
python3 build_wf_cofre.py    # workflow do cofre (cria ou atualiza)
python3 patch_sofia.py       # liga as ferramentas na Sofia (idempotente)
```

Os segredos saem de onde já moram no disco (`segredos.py`), nunca da linha de comando.

## Gotchas que custaram tempo

- **Rede interna do EasyPanel.** A Sofia não alcança `https://n8n.svicompany.com.br` (o VPS não faz
  hairpin NAT). As ferramentas apontam pra `http://n8n_n8n_webhook:5678/webhook/cofre-intel`. A rota
  `pingar` do workflow existe pra diagnosticar isso: `{"acao":"pingar","alvo":"<url>"}`.
- **Domínio da Central.** `central.svicompany.com.br` passou a servir a landing "Central para
  Agências" em 22/08. O app responde em `guia.svicompany.com.br`, e é pra lá que os links apontam.
- **Teto de funções da Vercel.** Nada de endpoint novo em `api/`. A página fala direto com o
  Supabase e com o webhook do n8n.
- **PUT no n8n.** O `settings` que o GET devolve tem campos que o PUT recusa. Filtrar antes de enviar.
- **Invenção.** A modelagem foi endurecida: nome, número, preço e prazo que não vieram da referência
  saem como `[A CONFIRMAR]`, depoimento não se escreve fingindo ser o cliente, e toda peça fecha com
  uma seção `## A CONFIRMAR`.
