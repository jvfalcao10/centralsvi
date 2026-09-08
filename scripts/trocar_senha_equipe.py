#!/usr/bin/env python3
"""Troca a senha de alguem da equipe na Central e guarda no cofre de Senhas.

Uso:  python3 scripts/trocar_senha_equipe.py leticia
      python3 scripts/trocar_senha_equipe.py arthur

O que faz: acha a pessoa em profiles pelo nome, gera uma senha temporaria
legivel, troca no Supabase Auth, salva na aba Senhas da Central (cliente
"SVI · <nome> (equipe)") e PROVA fazendo um login real com a senha nova.
A senha aparece so no SEU terminal; no banco ela vai pro cofre, que e o
lugar sancionado da casa pra credencial.

Nenhum segredo mora neste arquivo: a service key e lida em runtime da
memoria do Claude (reference_svi_tokens.md), como manda a regra da casa.
"""
import base64, json, os, re, secrets, string, sys, urllib.request

MEM = os.path.expanduser(
    "~/.claude/projects/-Users-joao-Documents-CLAUDE-CODE-N8N/memory/reference_svi_tokens.md")
REF = "qvkfcvcqlfamyzgqgnrq"
AU = f"https://{REF}.supabase.co/auth/v1"
RE = f"https://{REF}.supabase.co/rest/v1"


def service_key() -> str:
    texto = open(MEM).read()
    for t in re.findall(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}", texto):
        corpo = t.split(".")[1]
        corpo += "=" * (-len(corpo) % 4)
        try:
            d = json.loads(base64.urlsafe_b64decode(corpo))
        except Exception:
            continue
        if d.get("ref") == REF and d.get("role") == "service_role":
            return t
    sys.exit("service key nao encontrada na memoria")


def req(chave, url, metodo="GET", corpo=None, prefer=None):
    h = {"apikey": chave, "Authorization": f"Bearer {chave}", "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    r = urllib.request.Request(url, data=json.dumps(corpo).encode() if corpo else None,
                               method=metodo, headers=h)
    resp = urllib.request.urlopen(r, timeout=40).read()
    return json.loads(resp) if resp.strip() else {}


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: python3 scripts/trocar_senha_equipe.py <nome ou parte do nome>")
    alvo = sys.argv[1].lower()
    sk = service_key()

    perfis = req(sk, f"{RE}/profiles?select=user_id,name")
    achados = [p for p in perfis if alvo in (p["name"] or "").lower()]
    if not achados:
        sys.exit(f"ninguem em profiles casa com '{alvo}'")
    if len(achados) > 1:
        sys.exit("mais de um perfil casa: " + ", ".join(p["name"] for p in achados) + ". Seja mais especifico.")
    pessoa = achados[0]

    user = req(sk, f"{AU}/admin/users/{pessoa['user_id']}")
    email = user.get("email")
    if not email:
        sys.exit("conta sem e-mail no auth, confere no painel")

    # senha legivel, sem caracteres ambiguos (l I 1 O 0)
    alfabeto = "".join(c for c in string.ascii_letters + string.digits if c not in "lI1O0")
    senha = "Svi." + "".join(secrets.choice(alfabeto) for _ in range(10))

    req(sk, f"{AU}/admin/users/{pessoa['user_id']}", metodo="PUT", corpo={"password": senha})

    # cofre: atualiza se ja tem registro dessa pessoa/servico, senao cria
    existentes = req(sk, f"{RE}/client_credentials?select=id&servico=eq.central&login=eq.{email}")
    registro = {
        "cliente": f"SVI · {pessoa['name'].split()[0]} (equipe)", "servico": "central",
        "login": email, "senha": senha, "url": "https://central.svicompany.com.br",
        "obs": "senha temporaria trocada via script; pedir pra trocar no primeiro acesso",
        "atualizado_por": "script trocar_senha_equipe (Joao)",
    }
    if existentes:
        req(sk, f"{RE}/client_credentials?id=eq.{existentes[0]['id']}", metodo="PATCH",
            corpo=registro, prefer="return=minimal")
    else:
        req(sk, f"{RE}/client_credentials", metodo="POST", corpo=registro, prefer="return=minimal")

    # prova real: login com a senha nova
    try:
        tok = req(sk, f"{AU}/token?grant_type=password", metodo="POST",
                  corpo={"email": email, "password": senha})
        ok = bool(tok.get("access_token"))
    except Exception:
        ok = False

    print(f"\npessoa:   {pessoa['name']}")
    print(f"login:    {email}")
    print(f"senha:    {senha}")
    print(f"cofre:    salva na aba Senhas da Central (SVI · {pessoa['name'].split()[0]})")
    print(f"testada:  {'SIM, login real funcionou' if ok else 'NAO, login falhou, me chama'}")


if __name__ == "__main__":
    main()
