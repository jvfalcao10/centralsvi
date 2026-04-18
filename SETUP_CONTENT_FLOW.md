# SVI.Co — Módulo de Conteúdo + Fluxo de Aprovação de Clientes

Este guia documenta a adição do **módulo de gestão de conteúdo** ao `centralsvi`, incluindo o fluxo de cadastro e aprovação de clientes externos.

## O que foi adicionado

### Backend (Supabase)
- **Role `client`** no enum `app_role` — usuário externo com login próprio.
- **Tabela `client_signup_requests`** — fila de aprovação (status: pending / approved / rejected).
- **Colunas em `clients`**: `user_id` (liga cliente do CRM ao usuário auth).
- **Tabelas de conteúdo**: `content_posts`, `content_pautas`, `content_references`, `content_trends`.
- **RLS policies** — cada cliente só vê seus próprios dados; staff (executor+) vê tudo.
- **Funções SQL**: `approve_client_signup(request_id, link_to_client_id?)`, `reject_client_signup(request_id, reason?)`, `current_client_id()`.

### Frontend
- **`/client-signup`** — formulário público de solicitação de acesso.
- **`/pending-approval`** — tela de status (pendente / aprovado / rejeitado) com refresh manual.
- **`/admin/approvals`** — master dashboard (admin/manager) para aprovar ou rejeitar, com opção de vincular a cliente CRM existente ou criar novo.
- **`/minha-area`** — home do cliente aprovado, com stats e atalhos.
- **`/content/posts`** — Gestor de Posts (Kanban).
- **`/content/pautas`** — Banco de Pautas.
- **`/content/calendar`** — Calendário Editorial.
- **`/content/radar`** — Radar de Tendências.
- **`/content/monitor`** — Monitor de Referências.
- **Link "Sou cliente SVI.Co"** no Login aponta para `/client-signup`.
- **Menu "Aprovações"** na sidebar da equipe (manager+).
- **Menu "Conteúdo"** na sidebar da equipe (executor+).
- **`ClientSidebar` + `ClientLayout`** — menu simplificado exclusivo para role `client`.

## Como aplicar

### 1. Rodar a migration SQL
No painel Supabase (SQL Editor), cole e execute:

```
supabase/SETUP_CONTENT_MODULE.sql
```

> **Pré-requisito:** `SETUP_COMPLETO.sql` e `SETUP_ROLES.sql` já devem ter sido aplicados.

A migration é idempotente — pode ser re-rodada sem quebrar o banco.

### 2. Testar o fluxo end-to-end

**a) Cadastro de cliente:**
1. Abra `/client-signup` em uma aba anônima.
2. Preencha o formulário e envie.
3. Confirme o email se exigido pela config do Supabase Auth.

**b) Aprovação no master dashboard:**
1. Em outra aba, entre como admin (ou manager).
2. Acesse **Aprovações** na sidebar.
3. Clique em **Aprovar** → escolha "Criar novo cliente" ou "Vincular a cliente existente".

**c) Cliente acessando o painel:**
1. Na aba do cliente, clique em **Atualizar** na tela de pendente.
2. Ele é redirecionado para `/minha-area`.
3. Navegue pelos 5 módulos de conteúdo.

### 3. Como STAFF acessa dados de um cliente específico
Nos módulos `/content/*`, a equipe (executor+) vê um **Select de cliente** no topo para filtrar/gerenciar por conta. Cada ação (criar post, pauta, etc.) usa esse `client_id`.

## Arquitetura de permissões

| Role | Acesso |
|---|---|
| `admin` | Tudo + aprovações |
| `manager` | CRM completo + conteúdo de todos os clientes + aprovações |
| `seller` | Pipeline, Prospecção, Clientes |
| `executor` | Clientes, Entregas, Scripts, Conteúdo (todos os clientes) |
| `client` | Apenas `/minha-area` + `/content/*` escopado ao próprio `client_id` |

RLS no Postgres garante que um `client` nunca consiga ler/escrever em linhas de outro cliente, mesmo se burlar o frontend.

## Rotas públicas (não exigem login)
- `/login`
- `/client-signup`
- `/reset-password`
- `/pending-approval` (aceita usuário logado mas sem role de staff)

## Notas técnicas

- **`approve_client_signup`** é `SECURITY DEFINER` — só usuários com `has_min_role('manager')` podem chamá-la.
- **`current_client_id()`** retorna o `id` do cliente vinculado ao `auth.uid()` atual. Use em queries de RLS ou para inserir novos dados como role `client`.
- Quando o admin aprova, a função **cria um registro em `clients`** (se não vinculado a um existente) com `plano='conteudo'`, `status='ativo'`, `mrr=0`. Ajuste esses defaults conforme seu processo comercial.
- O campo `content_posts.scheduled_date` é DATE (não TIMESTAMPTZ) — compatível com a UI do Calendário.
- A role `client` **não** está na hierarquia de staff — `can('manager')` sempre retorna false para cliente.
