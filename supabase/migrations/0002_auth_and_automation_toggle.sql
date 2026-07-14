-- Liga os gestores a um login do Supabase Auth e define papel (admin/user).
-- Adiciona toggle separado para ligar/desligar o envio automático de alertas
-- por conta, independente do campo is_active (que controla se a conta ainda
-- é monitorada).

alter table managers
  add column auth_user_id uuid unique references auth.users(id) on delete set null,
  add column role text not null default 'user' check (role in ('admin', 'user'));

alter table ad_accounts
  add column automation_enabled boolean not null default true;

-- View com o saldo mais recente de cada conta, para o dashboard não
-- precisar fazer essa lógica de "pega o último snapshot" toda vez.
create view latest_balance_snapshots as
select distinct on (ad_account_id)
  ad_account_id,
  balance,
  spend_cap,
  amount_spent,
  account_status,
  funding_source_status,
  checked_at
from balance_snapshots
order by ad_account_id, checked_at desc;
