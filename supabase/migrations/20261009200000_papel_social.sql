-- Papel "social" para a social media.
--
-- A Rayana entrou em 08/10 e cuida de estratégia e publicação, não de
-- financeiro, resultados nem comercial. O papel `executor` abriria tarefas,
-- carteira e scripts junto, que é mais do que ela precisa ver.
--
-- É papel LATERAL, igual ao `traffic`: não entra na escada de hierarquia,
-- tem área própria na navegação.
alter type public.app_role add value if not exists 'social';
