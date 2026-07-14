-- Guarda o nome real do grupo do WhatsApp (resolvido via seletor), evitando
-- depender de uma chamada à Z-API a cada carregamento da tabela de relatórios.
-- Nullable: contas antigas ficam sem nome até serem editadas de novo com o
-- seletor; a UI cai de volta para mostrar o código bruto nesse caso.
alter table ad_accounts
  add column if not exists whatsapp_group_name text;
