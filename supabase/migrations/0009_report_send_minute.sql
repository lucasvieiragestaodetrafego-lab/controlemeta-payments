-- Adiciona o minuto do horário de envio dos relatórios de métricas
-- (send_hour já existia; faltava o minuto pra formar um horário completo HH:MM).
alter table metric_reports
  add column if not exists send_minute smallint not null default 0;
