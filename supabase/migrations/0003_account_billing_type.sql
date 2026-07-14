-- Guarda se a conta é pré-paga (saldo = disponível) ou cartão/linha de
-- crédito (saldo = valor devido). Fica nulo até a primeira sincronização.
alter table ad_accounts add column is_prepay boolean;
