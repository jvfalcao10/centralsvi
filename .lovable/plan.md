
## Problema identificado

`AuthContext.tsx` usa `async` callback dentro de `onAuthStateChange`. O Supabase **não suporta** callbacks assíncronos nessa função — ele não aguarda o Promise resolver, então `setLoading(false)` só é chamado após o `await fetchProfile()` completar. Se o fetch do perfil travar, atrasar, ou falhar silenciosamente, o `loading` nunca vira `false` e o spinner fica para sempre.

Confirmado: a tabela `profiles` existe, RLS ativo com `SELECT qual: true` (todos podem ver), então a query não é o problema em si. O problema é a ordem de execução: o `onAuthStateChange` dispara, inicia `fetchProfile` async, e a sessão do Supabase pode já ter sido inicializada pela `getSession()` abaixo — causando dupla execução e race conditions.

## Fix: separar em dois efeitos

### `src/contexts/AuthContext.tsx` — reescrever

**Novo padrão (correto):**

1. `onAuthStateChange` — callback **síncrono**: só atualiza `user`, `session` e chama `setLoading(false)` imediatamente. Sem await.
2. `getSession()` — inicialização inicial, também síncrona no callback.
3. Novo `useEffect([user])` — observa mudanças no `user` e faz `fetchProfile` de forma independente, com try/catch para não travar nada.

```text
ANTES (quebrado):
  onAuthStateChange(async (_event, session) => {
    ...
    await fetchProfile()   ← trava aqui
    setLoading(false)      ← nunca chega aqui se trava
  })

DEPOIS (correto):
  onAuthStateChange((_event, session) => {
    setSession(session)
    setUser(session?.user ?? null)
    setLoading(false)      ← imediato, não espera nada
  })

  useEffect(() => {
    if (user) fetchProfile(user.id)  ← separado, não bloqueia loading
    else setProfile(null)
  }, [user])
```

### Arquivos alterados
- `src/contexts/AuthContext.tsx` — único arquivo, mudança cirúrgica
