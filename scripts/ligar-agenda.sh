#!/bin/bash
# Liga a página de agendamento à agenda do Google.
#
# Roda UMA vez, no Mac do João. O Claude não roda isto porque o passo abre o
# navegador e manuseia credencial.
#
# O que faz, nesta ordem:
#   1. guarda o token.json atual, que é o do Search Console, Ads e Drive;
#   2. autoriza SÓ os escopos de agenda, numa concessão separada;
#   3. manda client_id, client_secret e refresh_token para a Vercel, sem passar
#      por arquivo intermediário e sem aparecer na tela;
#   4. devolve o token.json antigo para o lugar;
#   5. publica.
#
# O Google aceita vários refresh_tokens ativos para o mesmo par app+conta,
# então a autorização da agenda não invalida a que já existe.

set -euo pipefail

GA=~/Dev/google-auth
CENTRAL=~/Dev/centralsvi
SEGREDO="$GA/client_secret_2_870926124396-84phhhpk0eu8g75om2g7egqea3pp5me2.apps.googleusercontent.com.json"

[ -f "$SEGREDO" ] || { echo "Não achei o arquivo de client do Google em $GA"; exit 1; }
cd "$GA"

GUARDADO=""
if [ -f token.json ]; then
  GUARDADO="token.json.antes-agenda-$(date +%s)"
  cp token.json "$GUARDADO"
  echo "Token atual guardado em $GUARDADO"
fi

devolver () {
  if [ -n "$GUARDADO" ] && [ -f "$GUARDADO" ]; then
    mv -f "$GUARDADO" token.json
    echo "Token do Search Console devolvido ao lugar."
  fi
}
trap devolver EXIT

echo
echo "Vai abrir o navegador. Entre com svicompanyy@gmail.com e autorize o acesso à Agenda."
echo
python3 gauth.py login --scopes cal,cal_ro --secret "$SEGREDO"

python3 - <<'PY' | ( cd "$CENTRAL" && vercel env rm AGENDA_GOOGLE_OAUTH production --yes >/dev/null 2>&1; cd "$CENTRAL" && vercel env add AGENDA_GOOGLE_OAUTH production )
import json
d = json.load(open('token.json'))
faltando = [k for k in ('client_id','client_secret','refresh_token') if not d.get(k)]
if faltando:
    raise SystemExit('token.json veio sem: ' + ', '.join(faltando))
print(json.dumps({k: d[k] for k in ('client_id','client_secret','refresh_token')}), end='')
PY

echo
echo "Credencial gravada. Publicando."
cd "$CENTRAL"
vercel --prod --yes >/dev/null
echo
echo "Pronto. Abra https://agenda.svicompany.com.br e confira se os horários aparecem."
