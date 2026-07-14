-- Mensagem personalizada por conta. Se preenchida, substitui o template global
-- nos alertas dessa conta. Se nula/vazia, usa o template global padrão.
alter table ad_accounts add column custom_message text;
