# -*- coding: utf-8 -*-
"""Le os segredos de onde eles ja moram no disco. Nada de chave em linha de comando."""
import os, re, sys, json

MEM = os.path.expanduser(
    "~/.claude/projects/-Users-joao-Documents-CLAUDE-CODE-N8N/memory/reference_svi_tokens.md")


def n8n_api_key():
    txt = open(MEM, encoding="utf-8").read()
    bloco = txt.split("**n8n API**", 1)[1]
    m = re.search(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+", bloco)
    if not m:
        raise SystemExit("nao achei a chave do n8n")
    return m.group(0)


def supabase_service_key(ref="qvkfcvcqlfamyzgqgnrq"):
    sys.path.insert(0, os.path.expanduser("~/Dev/svi-supabase-audit"))
    import sb
    for k in sb.get(f"/v1/projects/{ref}/api-keys"):
        if k.get("name") == "service_role" or k.get("type") == "secret":
            return k["api_key"]
    raise SystemExit("nao achei a service_role key")
