import os, sys, json, subprocess, tempfile
os.environ.setdefault("N8N_API_KEY","x"); os.environ.setdefault("SUPA_SERVICE_KEY","y")
import importlib.util
spec = importlib.util.spec_from_file_location("b", "build_wf_cofre.py")
m = importlib.util.module_from_spec(spec)
sys.modules["b"] = m
spec.loader.exec_module(m)
bad = 0
for n in m.nodes:
    js = n["parameters"].get("jsCode")
    if not js: continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write("(async () => {\n" + js + "\n})();"); path = f.name
    r = subprocess.run(["node","--check",path], capture_output=True, text=True)
    if r.returncode:
        bad += 1
        print("FALHOU:", n["name"]); print(r.stderr[:500])
    else:
        print("ok  ", n["name"])
    os.unlink(path)
print("nodes:", len(m.nodes), "| jsCode com erro:", bad)
# valida o JSON inteiro
json.dumps(m.wf)
print("json serializa ok")
# checa conexoes orfas
names = {n["name"] for n in m.nodes}
for a, c in m.conns.items():
    assert a in names, a
    for out in c["main"]:
        for t in out:
            assert t["node"] in names, t["node"]
print("conexoes ok")
