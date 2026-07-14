-- Adiciona a plataforma de origem da conta de anúncio.
-- 'meta' hoje; 'google' reservado para integração futura do Google Ads.
alter table ad_accounts
  add column if not exists platform text not null default 'meta';

-- Índice leve para filtrar/agrupar por plataforma na listagem.
create index if not exists idx_ad_accounts_platform on ad_accounts(platform);
