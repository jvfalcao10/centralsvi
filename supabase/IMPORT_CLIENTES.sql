-- ============================================================================
-- IMPORTAR CLIENTES DO SUPABASE ANTIGO
-- ============================================================================
-- Cola tudo no SQL Editor do Supabase NOVO (qvkfcvcqlfamyzgqgnrq) e roda

INSERT INTO public.clients (id, name, company, phone, email, segment, plano, mrr, status, health_score, inicio_contrato, owner_id, notes, created_at, updated_at, instagram, dia_vencimento, currency) VALUES
('940a8394-2a7f-492d-b5f3-ae5ebde96e67', 'Dr. Brenno', 'Medicina da Dor', '', NULL, 'saude', 'growth', 1600.00, 'ativo', 85, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:26:14.303517+00', NULL, NULL, 'BRL'),
('e509a650-6313-4b9e-a5c0-24660f1135e8', 'Dr. Daniel Peralba', 'Cirurgia - Saúde Intestinal', '', NULL, 'saude', 'growth', 2000.00, 'ativo', 90, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:26:14.303517+00', NULL, NULL, 'BRL'),
('a182ba93-3d20-4500-a59b-caad65e1ebdc', 'Dr. Felipe Branco', 'Cirurgia Bariátrica', '', NULL, 'saude', 'growth', 2000.00, 'ativo', 90, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:26:14.303517+00', NULL, NULL, 'BRL'),
('0802af1f-e473-480a-bef6-7d6fc7afbcf9', 'Dra. Esia Lopes Xinguara', 'Pediatria Xinguara', '', NULL, 'saude', 'growth', 1750.00, 'ativo', 80, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:26:14.303517+00', NULL, NULL, 'BRL'),
('78c10794-0719-475c-a81e-423092ffd46c', 'Nikolas Fisio', 'Fisioterapia - Joelho', '', NULL, 'saude', 'growth', 2000.00, 'ativo', 88, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:26:14.303517+00', NULL, NULL, 'BRL'),
('6daad814-ab73-40ec-9b7e-e102a58becd8', 'ProLife', 'Academia de Reabilitação', '', NULL, 'saude', 'growth', 2000.00, 'ativo', 85, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:26:14.303517+00', NULL, NULL, 'BRL'),
('d1624520-6348-4bf3-8823-34e3df2852ea', 'Espaço Soraia', 'Roupas e Perfumaria', '', NULL, 'varejo', 'growth', 2000.00, 'ativo', 83, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:26:14.303517+00', NULL, NULL, 'BRL'),
('20d0dba3-5d07-4f9b-a90d-990949816b00', 'Aerojet', 'Aviação Agrícola', '', NULL, 'energia_agro', 'starter', 700.00, 'ativo', 72, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:26:14.303517+00', NULL, NULL, 'BRL'),
('2ee34c34-408c-452b-9e1a-a0f607d29286', 'Exatta Solar', 'Energia Solar', '', NULL, 'energia_agro', 'pro', 2500.00, 'ativo', 88, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:28:26.39361+00', NULL, NULL, 'BRL'),
('1aeebc52-840b-4146-9609-fceb20430421', 'Spa Nature', 'Clinica de estética', '', NULL, 'estetica', 'growth', 2000.00, 'ativo', 82, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:28:41.392695+00', NULL, NULL, 'BRL'),
('5f2968ee-1286-4e2e-948d-dc827942093c', 'Alpha Fitness', 'Academia', '', NULL, 'fitness', 'growth', 2000.00, 'ativo', 85, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:28:55.497802+00', NULL, NULL, 'BRL'),
('8b9c688b-5d10-4222-8c3a-6cf603ffcee3', 'Supermercado América', 'Supermercado', '', NULL, 'alimentacao', 'growth', 2000.00, 'ativo', 85, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:29:04.886657+00', NULL, NULL, 'BRL'),
('46ee3160-5bea-4403-954c-b5df7843751b', 'Oficinas Burguer', 'Haburgueria', '', NULL, 'alimentacao', 'growth', 1800.00, 'ativo', 82, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:29:16.495816+00', NULL, NULL, 'BRL'),
('ed8f169f-a990-4cb5-b996-1845529d47d5', 'Hospital Jordão', 'Clinica Oftalmologica', '', NULL, 'saude', 'growth', 1750.00, 'ativo', 85, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:29:31.061253+00', NULL, NULL, 'BRL'),
('e5ed7878-8e3a-4bf4-bdb7-7a375b2068ca', 'Ótica Central', 'Ótica', '', NULL, 'varejo', 'growth', 1750.00, 'ativo', 80, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:29:38.856921+00', NULL, NULL, 'BRL'),
('1e7bff54-e977-459f-b774-06e82b95b66f', 'Números Contabilidade', 'Contabilidade', '', NULL, 'servicos', 'starter', 0.00, 'ativo', 75, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 01:30:43.637706+00', NULL, NULL, 'BRL'),
('60a00235-685c-4651-9881-55898f0938bc', 'MJC Pavers', 'Construção (Orlando)', '', NULL, 'construcao', 'starter', 500.00, 'ativo', 80, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 19:55:19.299491+00', NULL, NULL, 'USD'),
('c0cd0da7-7ac3-479a-a8a3-0f97e21fbb8b', 'MJC Kitchen', 'Moveis planejados (Orlando)', '', NULL, 'construcao', 'starter', 500.00, 'ativo', 80, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-09 19:55:19.299491+00', NULL, NULL, 'USD'),
('d6bbb054-0e75-44a9-8b24-21252bdaaf05', 'Colégio Christo Rei', 'Colégio', '', NULL, 'educacao', 'pro', 2500.00, 'ativo', 90, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-03-10 19:07:54.952642+00', NULL, 10, 'BRL'),
('4fb6c00f-0e2a-434e-bdb1-0ff7b108ecd3', 'A Fórmula', 'Farmácia de Manipulação', '', NULL, 'servicos', 'starter', 1200.00, 'ativo', 75, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-04-10 21:03:30.120164+00', NULL, NULL, 'BRL'),
('976fb2ce-a5f7-4749-ad43-858323e1e447', 'Vanessa Back', 'Clinica Estética', '', NULL, 'estetica', 'growth', 1000.00, 'ativo', 80, '2026-03-09', NULL, NULL, '2026-03-09 01:26:14.303517+00', '2026-04-10 21:03:47.040563+00', NULL, NULL, 'BRL'),
('6049cd59-f98e-4299-81a3-dd164ae7a9ec', 'Cedrus', 'Clinica Cedrus', '', NULL, '', 'starter', 2000.00, 'ativo', 80, '2026-03-18', NULL, NULL, '2026-04-10 21:05:34.639787+00', '2026-04-10 21:05:34.639787+00', NULL, NULL, 'BRL'),
('3899a5be-d0b2-4f1b-931c-83b8b58dddab', 'Experience', 'Experience Pavers', '', NULL, '', 'starter', 300.00, 'ativo', 80, '2026-03-10', NULL, NULL, '2026-04-10 21:28:10.021048+00', '2026-04-10 21:40:14.48711+00', NULL, NULL, 'USD');

-- Confirma quantos foram importados
SELECT count(*) as total_clientes FROM public.clients;
