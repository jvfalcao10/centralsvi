#!/usr/bin/env bash
# Dispara a coleta do Radar na mão, sem esperar o cron das 9h.
#
# O segredo é lido do ambiente da Vercel, usado em memória e o arquivo
# temporário é apagado antes da chamada. Nada de segredo fica no disco nem
# aparece na saída.
#
# Uso:  ./scripts/rodar-coleta-radar.sh
set -euo pipefail

ALVO="${RADAR_URL:-https://central.svicompany.com.br/api/radar-coletar}"
TMP="$(mktemp -t envprod.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

echo "Lendo a configuração de produção..."
vercel env pull "$TMP" --environment=production --yes >/dev/null 2>&1

# O arquivo tem valores com várias linhas (mensagem de commit, por exemplo),
# então o parse é feito em Python e não pelo shell.
SECRET="$(python3 - "$TMP" <<'PY'
import re, sys
texto = open(sys.argv[1], encoding="utf-8", errors="replace").read()
achado = re.search(r'^CRON_SECRET=(.*)$', texto, re.M)
valor = achado.group(1).strip() if achado else ""
if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in "\"'":
    valor = valor[1:-1]
print(valor, end="")
PY
)"

rm -f "$TMP"

if [ -z "$SECRET" ]; then
  echo "Não achei CRON_SECRET na configuração de produção."
  exit 1
fi
echo "Segredo lido (${#SECRET} caracteres). Chamando a coleta..."
echo "Pode levar alguns minutos, porque depende do Instagram."

curl -sS -X POST -H "Authorization: Bearer $SECRET" --max-time 600 "$ALVO"
echo
