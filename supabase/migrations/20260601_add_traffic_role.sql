-- Adiciona a role 'traffic' (Gestor de Tráfego) ao enum app_role.
-- Acesso restrito: apenas ao módulo /operacional/trafego na Central SVI.
-- Não entra na hierarquia staff (não satisfaz manager/seller/executor/admin checks).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'traffic';
