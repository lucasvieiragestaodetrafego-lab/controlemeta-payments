-- supabase/migrations/0011_dashboard_column_preferences.sql
-- Preferência global de colunas extras da visão geral do Dashboard — uma
-- única linha (id = 1), análoga a uma "visualização" salva no Gerenciador
-- de Anúncios do Meta. Não é por conta nem por usuário nesta v1.

create table dashboard_column_preferences (
  id smallint primary key default 1 check (id = 1),
  metric_keys text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into dashboard_column_preferences (id, metric_keys) values (1, '{}');
