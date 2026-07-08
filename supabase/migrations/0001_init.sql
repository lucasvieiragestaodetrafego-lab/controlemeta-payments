-- Meta Payments — schema inicial
-- Gestores de tráfego, clientes, contas de anúncio, histórico de saldo e alertas.

create extension if not exists "pgcrypto";

create table managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  whatsapp_number text,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_number text,
  created_at timestamptz not null default now()
);

create table ad_accounts (
  id uuid primary key default gen_random_uuid(),
  meta_account_id text unique not null,        -- "act_123456789"
  name text not null,
  client_id uuid not null references clients(id) on delete restrict,
  manager_id uuid not null references managers(id) on delete restrict,
  whatsapp_group_id text,                       -- ID do grupo Z-API que recebe alertas desta conta
  alert_threshold numeric(12,2) not null default 100.00,  -- saldo mínimo (moeda da conta) antes de alertar
  currency text not null default 'BRL',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ad_accounts_manager on ad_accounts(manager_id);
create index idx_ad_accounts_client on ad_accounts(client_id);

create table balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  balance numeric(12,2) not null,
  spend_cap numeric(12,2),
  amount_spent numeric(12,2),
  account_status text,              -- status retornado pela Meta (ACTIVE, DISABLED, etc.)
  funding_source_status text,       -- status do meio de pagamento, quando disponível
  checked_at timestamptz not null default now()
);

create index idx_balance_snapshots_account_time on balance_snapshots(ad_account_id, checked_at desc);

create type alert_type as enum ('low_balance', 'payment_error', 'account_disabled');

create table alerts_log (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  alert_type alert_type not null,
  balance_at_alert numeric(12,2),
  message text not null,
  whatsapp_message_id text,
  sent_at timestamptz not null default now()
);

create index idx_alerts_log_account_time on alerts_log(ad_account_id, sent_at desc);

-- Evita reenviar o mesmo alerta repetidamente: consulta na aplicação
-- para checar se já existe alerta do mesmo tipo nas últimas N horas
-- antes de disparar um novo (regra fica no código, não no banco).

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_ad_accounts_updated_at
  before update on ad_accounts
  for each row execute function set_updated_at();
