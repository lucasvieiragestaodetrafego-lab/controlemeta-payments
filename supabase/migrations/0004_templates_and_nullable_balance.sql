-- Saldo disponível só existe para contas pré-pagas; contas de cartão ficam nulas.
alter table balance_snapshots alter column balance drop not null;

-- Mensagens de alerta editáveis pelo admin. Placeholders suportados:
-- {conta}, {saldo}, {limite}, {gestor}, {status}
create table message_templates (
  key text primary key,
  label text not null,
  template text not null,
  updated_at timestamptz not null default now()
);

insert into message_templates (key, label, template) values
('saldo', 'Saldo baixo / sem saldo', $tmpl$⚠️ *Saldo baixo*

Conta: *{conta}*
Saldo atual: {saldo}
Limite configurado: {limite}
Gestor responsável: {gestor}

Adicione saldo antes que a conta pare de veicular.$tmpl$),
('pagamento', 'Cobrança do cartão falhou', $tmpl$🔴 *Conta travada — cobrança não realizada*

Conta: *{conta}*
Situação: o Meta não conseguiu cobrar do cartão / há fatura em aberto ({status}).
Gestor responsável: {gestor}

Regularize o pagamento no Business Manager para reativar a veiculação.$tmpl$),
('desativada', 'Conta desativada / com problema', $tmpl$🚫 *Conta travada / com problema*

Conta: *{conta}*
Status: {status}
Gestor responsável: {gestor}

Verifique o Business Manager imediatamente.$tmpl$);

create trigger trg_message_templates_updated_at
  before update on message_templates
  for each row execute function set_updated_at();
