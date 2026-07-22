-- supabase/migrations/0010_dashboard_accounts.sql
-- Contas visíveis no dashboard visual de métricas — independente do cadastro
-- de automação de saldo em ad_accounts (uma conta pode estar em uma tabela,
-- na outra, nas duas, ou em nenhuma).

create table dashboard_accounts (
  id uuid primary key default gen_random_uuid(),
  meta_account_id text not null unique,
  account_name text not null,
  result_metric_key text not null default 'compras',
  created_at timestamptz not null default now()
);

create index idx_dashboard_accounts_meta_account on dashboard_accounts(meta_account_id);

-- Seed: começa com as mesmas contas já cadastradas em ad_accounts hoje.
insert into dashboard_accounts (meta_account_id, account_name, result_metric_key)
select meta_account_id, name, 'compras'
from ad_accounts
on conflict (meta_account_id) do nothing;
