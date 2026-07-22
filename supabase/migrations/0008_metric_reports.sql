-- supabase/migrations/0008_metric_reports.sql
-- Relatórios de métricas de campanha (separado do alerta de saldo em ad_accounts).

create table metric_reports (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  name text not null,
  whatsapp_group_id text not null,
  whatsapp_group_name text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  send_hour smallint not null default 9,
  period text not null default 'last_7_days'
    check (period in ('today', 'last_7_days', 'last_30_days', 'current_month')),
  message_template text not null,
  creative_ranking_size smallint,
  is_active boolean not null default true,
  next_send_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_metric_reports_account on metric_reports(ad_account_id);
create index idx_metric_reports_next_send on metric_reports(next_send_at) where is_active;

create trigger trg_metric_reports_updated_at
  before update on metric_reports
  for each row execute function set_updated_at();

create table report_log (
  id uuid primary key default gen_random_uuid(),
  metric_report_id uuid not null references metric_reports(id) on delete cascade,
  message text not null,
  whatsapp_message_id text,
  sent_at timestamptz not null default now()
);

create index idx_report_log_report_time on report_log(metric_report_id, sent_at desc);
