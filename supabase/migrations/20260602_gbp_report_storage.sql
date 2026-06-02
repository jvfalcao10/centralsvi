-- Bucket de Storage pros prints do relatório Google.
-- Público (leitura) porque o relatório do cliente é um link público que exibe as imagens.
-- O upload é feito pela Vercel Function com service role (bypassa RLS).

insert into storage.buckets (id, name, public)
values ('gbp-reports', 'gbp-reports', true)
on conflict (id) do nothing;
