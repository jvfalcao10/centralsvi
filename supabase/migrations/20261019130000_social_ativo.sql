-- Liga-desliga da cadência, separado do status do contrato.
--
-- João, 19/10/2026, olhando a tela: "tirar Essenc, Fórmula, Médic, MJC,
-- Números, e conectar as contas". Os cinco são clientes ATIVOS da casa que
-- não têm carteira de social media, então apareciam eternamente como 0/4,
-- cobrando uma entrega que não existe e empurrando para baixo quem de fato
-- está atrasado.
--
-- Fica em `clients` e não numa lista no código porque é decisão de operação,
-- muda sozinha quando um cliente passa a ter social, e ninguém deveria
-- precisar de deploy para isso.
alter table public.clients add column if not exists social_ativo boolean not null default true;

-- Os cinco de 19/10. Default continua true: cliente novo entra na cadência.
update public.clients set social_ativo = false
 where name in ('Clínica Essenc', 'A Fórmula', 'Médic Fácil', 'MJC Pavers', 'Números Contabilidade');
