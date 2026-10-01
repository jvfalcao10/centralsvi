-- Serviço contratado por cliente (01/10/2026).
--
-- Joao: "Medic Facil nao e cliente da assessoria, mas fazemos somente o Google
-- pra ela porque fechamos o CRM. Conseguimos colocar so na aba de Google?"
--
-- Ate aqui "cliente" era uma coisa so: quem tem assessoria. Mas a casa ja tem
-- gente com escopo diferente (Medic Facil = CRM + Google de cortesia; Jordao
-- saiu do marketing e seguiu com CRM). Sem esse campo, a unica saida seria
-- cadastrar como assessoria e sujar a lista, ou nao cadastrar e ficar sem
-- relatorio. Agora cada tela mostra quem contratou aquilo.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS servicos TEXT[] NOT NULL DEFAULT ARRAY['assessoria'];

COMMENT ON COLUMN public.clients.servicos IS 'O que o cliente contratou: assessoria, google, crm, agente_ia, site. A tela de Clientes mostra assessoria; o Relatorio Google mostra quem tem google.';

CREATE INDEX IF NOT EXISTS clients_servicos_idx ON public.clients USING GIN (servicos);

-- A view nao aceita reordenar coluna (42P16), entao servicos entra no FIM.
CREATE OR REPLACE VIEW public.clientes_operacional AS
 SELECT c.id, c.name, c.company, c.phone, c.email, c.segment, c.status,
    c.instagram, c.dia_vencimento, c.inicio_contrato, c.permuta, c.permuta_ate,
    c.health_score, c.created_at, c.slug, c.servicos
   FROM clients c
  WHERE (EXISTS ( SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.role::text = ANY (ARRAY['admin','manager','seller','executor','traffic']))));
