
# SVI Command Center — Plano de Implementação

## Visão Geral
Aplicação completa de gestão para agências de marketing com autenticação, dashboard, CRM kanban, clientes, entregas e financeiro — usando Lovable Cloud (Supabase integrado), tema dark padrão e dados de exemplo.

---

## 1. Identidade Visual & Tema
- Configurar paleta de cores SVI: Dourado `#C5A572`, Preto `#1A1A1A`, verde `#10b981`, amarelo `#f59e0b`, vermelho `#ef4444`, azul `#3b82f6`
- Dark mode como padrão global via `next-themes`
- Importar e usar os dois logos SVI (branco para dark, colorido para light)
- Tipografia e espaçamentos consistentes com shadcn/ui

---

## 2. Banco de Dados (Supabase via Lovable Cloud)
Criar as seguintes tabelas com RLS habilitado:
- **profiles** (id, name, avatar_url, role) — vinculada a `auth.users`
- **user_roles** (id, user_id, role) — separada para segurança
- **leads** (id, name, company, phone, email, segment, source, stage, ticket_estimado, plano, mrr_projetado, owner_id, notes)
- **clients** (id, name, company, phone, email, segment, plano, mrr, status, health_score, inicio_contrato, owner_id)
- **deliveries** (id, client_id, tipo, titulo, responsavel_id, status, prazo, data_entrega)
- **invoices** (id, client_id, valor, vencimento, status, metodo_pagamento, data_pagamento)
- **expenses** (id, categoria, descricao, valor, vencimento, status)
- **interactions** (id, client_id, lead_id, tipo, descricao, user_id, created_at)

Seed com dados de exemplo realistas para demonstração.

---

## 3. Autenticação
- Página `/login` com logo SVI, email/senha, toggle mostrar/ocultar senha, loading state
- Link "Esqueci minha senha" com página `/reset-password`
- Proteção de rotas: redireciona para `/login` se não autenticado
- Context de autenticação global com dados do perfil do usuário

---

## 4. Layout Principal
- **Sidebar** (250px, colapsável): logo + navegação (Dashboard, Pipeline, Clientes, Entregas, Financeiro) + toggle dark/light + avatar do usuário
- **Header** por página: título + breadcrumb + sino de notificações + avatar
- Layout responsivo: sidebar colapsada em mobile com botão hamburguer

---

## 5. Dashboard
- **4 KPI Cards**: MRR Atual, Churn Mensal, Clientes Ativos, Taxa de Conversão — com variação percentual colorida
- **Gráfico de Linha** (Recharts): Evolução MRR 6 meses
- **Gráfico de Barras** (Recharts): Receita vs Despesas do mês
- **Card de Alertas**: lista com badges de criticidade (churn, faturas vencidas, entregas atrasadas)

---

## 6. Pipeline (CRM Kanban)
- 6 colunas drag-and-drop com `@hello-pangea/dnd`: Lead → Qualificação → Diagnóstico → Proposta → Negociação → Fechado
- Cards com: nome, empresa, badge segmento, badge origem, valor estimado, avatar responsável, tempo na etapa
- Modal ao clicar: detalhes completos, histórico, edição, botões "Próxima etapa" e "Marcar como perdido"
- Filtros no topo: origem, responsável, segmento
- Persistência no Supabase ao arrastar (atualiza `stage`)

---

## 7. Clientes
- Tabela completa com: nome/empresa, plano (badge), MRR (verde), status (badge colorido), health score (barra de progresso), início contrato, responsável, ações
- Filtros: status, plano, responsável, busca por nome
- **Modal de detalhes** com 5 abas: Informações Gerais, Histórico (timeline), Entregas, Faturas, Notas Internas

---

## 8. Entregas
- Lista agrupada por cliente com checkbox funcional
- Badges de tipo (roteiro, copy, reunião), prazo colorido (verde/amarelo/vermelho), status
- Filtros: cliente, tipo, status, responsável, prazo (hoje/semana/mês/atrasadas)
- Indicadores no topo: total, pendentes, atrasadas (alerta vermelho), % entregues no prazo
- Checkbox que atualiza `status` no Supabase

---

## 9. Financeiro
- **4 abas**:
  1. **Visão Geral**: 5 KPIs (MRR, receita, despesas, lucro, margem) + gráfico projeção de caixa 30/60/90 dias
  2. **Contas a Receber**: tabela de faturas com filtros, resumo (total/vencidas/vencendo em 7 dias), ações (cobrar/marcar pago)
  3. **Contas a Pagar**: tabela de despesas por categoria + botão "Nova Despesa" com modal
  4. **DRE**: demonstrativo em cascata (Receita → Margem Bruta → Lucro Líquido) + comparativo mês a mês

---

## 10. Tipos TypeScript & Utilitários
- `src/types/index.ts` com interfaces Lead, Client, Delivery, Invoice, Expense, Interaction, Profile
- `src/lib/supabase.ts` com cliente configurado
- Hooks customizados por módulo (useLeads, useClients, useDeliveries, useFinancial)
- Toast notifications para todas as ações
- Skeleton loaders e empty states
