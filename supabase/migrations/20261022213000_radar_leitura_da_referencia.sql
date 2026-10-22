begin;

-- João, 22/10/2026: "eu quero jogar o link e já aparecer preview, estilo Trello,
-- o que fazer e etc já". Guardar o link só adia o trabalho: quem abrir o quadro
-- daqui a duas semanas não lembra por que aquilo foi salvo.
--
-- A leitura fica em jsonb porque é texto gerado, não dado de negócio: ninguém
-- vai filtrar nem somar por ele, e o formato pode mudar sem migração nova.
-- Campos: gancho, porque, o_que_fazer, formato.
alter table public.radar_saves add column if not exists leitura jsonb;
alter table public.radar_saves add column if not exists lido_em timestamptz;

commit;
