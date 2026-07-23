-- supabase/migrations/0012_dashboard_default_columns.sql
-- As colunas Gasto/Resultado/Custo por resultado/ROAS deixam de ser
-- pinadas nesta rodada (viram métricas normais do catálogo, selecionáveis
-- e removíveis). Pra quem já usa o dashboard não perder essas colunas do
-- dia pra noite, prepend na preferência global já existente — a leitura
-- (getSelectedMetricKeys) já deduplica preservando a primeira ocorrência,
-- então não há problema se alguma delas já estiver selecionada.

update dashboard_column_preferences
set metric_keys = array['gasto', 'resultado', 'custo_por_resultado', 'roas_compras'] || metric_keys
where id = 1;
