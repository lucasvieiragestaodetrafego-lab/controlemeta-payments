# Meta Payments — Painel de Alertas de Saldo

## O que é

Painel interno para monitorar o saldo de contas de anúncio (hoje: Meta Ads;
Google Ads planejado) e avisar automaticamente, via grupo do WhatsApp, quando uma
conta está com saldo baixo ou travada — evitando que campanhas parem por falta de
pagamento sem que o time perceba a tempo.

## Por que existe

Antes deste painel, o acompanhamento de saldo de dezenas de contas de clientes era
manual. O objetivo é centralizar a visão de todas as contas, sinalizar risco cedo, e
automatizar o aviso para quem precisa agir (gestor de tráfego, cliente).

## Funcionalidades principais

- **Alertas de saldo** (`/`, chamado de "Relatórios" no menu): lista todas as contas
  de anúncio ativas, com saldo, situação (Ativa / Travada / Atenção), tendência
  recente (mini-gráfico) e um gráfico de "contas em risco ao longo do tempo".
- **Automação por conta**: cada conta pode ter um envio automático de alerta de
  saldo baixo, configurável (limite, grupo de destino, mensagem personalizada).
- **Criação/edição de relatórios**: feita via modal, direto na página de Relatórios
  (sem precisar navegar até Configurações).
- **Coluna de Plataforma**: cada conta tem uma plataforma (`meta` hoje, `google`
  reservado). Preparação para múltiplas plataformas por cliente.
- **Configurações**: virou uma página de Integrações (status de conexão por
  plataforma) + Padrões gerais (grupo padrão de WhatsApp, link para Templates).
- **Templates de mensagem** (`/templates`): mensagens de alerta customizáveis por
  conta, com marcadores (`{conta}`, `{saldo}`, `{limite}`, `{gestor}`, `{status}`).
- **Checagem automática**: rotina agendada (`/api/cron/check-balances`) que consulta
  o saldo real no Meta Ads e dispara alertas conforme a automação de cada conta.

## Em construção / próximos passos

- Agrupamento da tabela de Relatórios por cliente (uma linha de cabeçalho por
  cliente, sub-linhas por conta/plataforma) — preparação para clientes com mais de
  uma automação (ex: Meta + Google).
- Seletor de grupo do WhatsApp pelo nome real (em vez de colar o código do grupo
  manualmente), buscando a lista direto da Z-API.
- Integração real com Google Ads (hoje só existe a coluna/preparação estrutural).

## Stack técnica

Next.js 15 (App Router, Server Actions), Supabase (Postgres + Auth), Tailwind CSS,
Vitest para testes de funções puras. Integração com Meta Graph API (saldo das
contas) e Z-API (envio de mensagens no WhatsApp).
